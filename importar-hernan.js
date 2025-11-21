const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});

async function importarCSV() {
  const client = await pool.connect();
  let created = 0;
  let updated = 0;
  let errors = [];
  
  try {
    console.log('📥 Iniciando importación de HERNAN_EQPDESC.csv...\n');
    
    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream('/root/crm-pro/HERNAN_EQPDESC.csv')
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`📊 Total de filas a procesar: ${rows.length}\n`);
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (i % 100 === 0 && i > 0) {
        console.log(`⏳ Procesadas ${i}/${rows.length} filas...`);
      }
      
      try {
        const banNumber = row['NUM_BAN']?.trim();
        const phone = row['TELEFONO']?.trim();
        const businessName = row['CLIENTE']?.trim() || (banNumber ? `Empresa BAN ${banNumber}` : null);
        
        if (!banNumber || !phone) {
          errors.push(`Fila ${i + 1}: Falta BAN o teléfono`);
          continue;
        }
        
        // Buscar o crear cliente por business_name
        let clientId = null;
        
        if (businessName) {
          const existingClients = await client.query(
            'SELECT id FROM clients WHERE business_name = $1 ORDER BY id ASC',
            [businessName]
          );
          
          if (existingClients.rows.length > 0) {
            clientId = existingClients.rows[0].id;
            
            // Fusionar duplicados si existen
            if (existingClients.rows.length > 1) {
              const duplicateIds = existingClients.rows.slice(1).map(r => r.id);
              for (const dupId of duplicateIds) {
                await client.query('UPDATE bans SET client_id = $1 WHERE client_id = $2', [clientId, dupId]);
                await client.query('DELETE FROM clients WHERE id = $1', [dupId]);
              }
            }
          }
        }
        
        // Crear cliente si no existe
        if (!clientId) {
          const newClient = await client.query(
            `INSERT INTO clients (business_name, name, vendor_id, is_active, base, created_at, updated_at)
             VALUES ($1, $1, NULL, 1, 'BD propia', NOW(), NOW())
             RETURNING id`,
            [businessName]
          );
          clientId = newClient.rows[0].id;
          created++;
        } else {
          updated++;
        }
        
        // Crear BAN si no existe
        const existingBan = await client.query(
          'SELECT id FROM bans WHERE ban_number = $1',
          [banNumber]
        );
        
        let banId;
        if (existingBan.rows.length === 0) {
          const newBan = await client.query(
            `INSERT INTO bans (ban_number, client_id, is_active, created_at, updated_at)
             VALUES ($1, $2, 1, NOW(), NOW())
             RETURNING id`,
            [banNumber, clientId]
          );
          banId = newBan.rows[0].id;
        } else {
          banId = existingBan.rows[0].id;
          // Actualizar client_id del BAN existente
          await client.query('UPDATE bans SET client_id = $1 WHERE id = $2', [clientId, banId]);
        }
        
        // Crear suscriptor si no existe
        const existingSubscriber = await client.query(
          'SELECT id FROM subscribers WHERE phone = $1 AND ban_id = $2',
          [phone, banId]
        );
        
        if (existingSubscriber.rows.length === 0) {
          await client.query(
            `INSERT INTO subscribers (phone, ban_id, service_type, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, 1, NOW(), NOW())`,
            [phone, banId, row['TIPO_SERVICIO']?.trim() || 'Móvil']
          );
        }
        
      } catch (error) {
        errors.push(`Fila ${i + 1}: ${error.message}`);
      }
    }
    
    console.log('\n🎉 IMPORTACIÓN COMPLETADA\n');
    console.log('📊 RESULTADOS:');
    console.log(`   - Clientes creados: ${created}`);
    console.log(`   - Clientes actualizados: ${updated}`);
    console.log(`   - Errores: ${errors.length}`);
    
    if (errors.length > 0 && errors.length <= 10) {
      console.log('\n⚠️  ERRORES:');
      errors.forEach(e => console.log(`   ${e}`));
    }
    
    // Verificar resultado
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_clientes,
        COUNT(*) FILTER (WHERE base = 'BD propia') as con_base
      FROM clients
    `);
    
    const bansCount = await client.query('SELECT COUNT(*) as total FROM bans');
    const subsCount = await client.query('SELECT COUNT(*) as total FROM subscribers');
    
    console.log('\n📊 ESTADO FINAL DE LA BASE DE DATOS:');
    console.log(`   - Total clientes: ${stats.rows[0].total_clientes}`);
    console.log(`   - Con base "BD propia": ${stats.rows[0].con_base}`);
    console.log(`   - Total BANs: ${bansCount.rows[0].total}`);
    console.log(`   - Total suscriptores: ${subsCount.rows[0].total}`);
    
  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

importarCSV();
