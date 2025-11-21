const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});

async function crearIncompletos() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Buscando clientes para convertir en incompletos...\n');
    
    // 1. Encontrar 5 clientes aleatorios con BANs y suscriptores
    const clientesCompletos = await client.query(`
      SELECT c.id, c.business_name, COUNT(DISTINCT b.id) as bans, COUNT(DISTINCT s.id) as suscriptores
      FROM clients c
      LEFT JOIN bans b ON b.client_id = c.id AND b.is_active = 1
      LEFT JOIN subscribers s ON s.ban_id = b.id AND s.is_active = 1
      WHERE c.is_active = 1
        AND c.business_name IS NOT NULL
        AND c.business_name != ''
      GROUP BY c.id, c.business_name
      HAVING COUNT(DISTINCT b.id) > 0 AND COUNT(DISTINCT s.id) > 0
      ORDER BY RANDOM()
      LIMIT 5
    `);
    
    console.log(`📊 Encontrados ${clientesCompletos.rows.length} clientes completos\n`);
    
    let sinBan = 0;
    let sinSuscriptor = 0;
    let sinNombre = 0;
    
    for (let i = 0; i < clientesCompletos.rows.length; i++) {
      const cliente = clientesCompletos.rows[i];
      
      if (i === 0) {
        // Cliente 1: Eliminar todos los BANs (y con ellos los suscriptores)
        await client.query(`DELETE FROM bans WHERE client_id = $1`, [cliente.id]);
        console.log(`❌ Cliente "${cliente.business_name}" (ID: ${cliente.id}) - Eliminados TODOS los BANs`);
        sinBan++;
        
      } else if (i === 1) {
        // Cliente 2: Eliminar todos los suscriptores pero dejar los BANs
        await client.query(`
          DELETE FROM subscribers 
          WHERE ban_id IN (SELECT id FROM bans WHERE client_id = $1)
        `, [cliente.id]);
        console.log(`❌ Cliente "${cliente.business_name}" (ID: ${cliente.id}) - Eliminados TODOS los suscriptores`);
        sinSuscriptor++;
        
      } else if (i === 2) {
        // Cliente 3: Borrar el business_name
        await client.query(`
          UPDATE clients SET business_name = NULL WHERE id = $1
        `, [cliente.id]);
        console.log(`❌ Cliente ID ${cliente.id} - Eliminado el nombre de empresa`);
        sinNombre++;
        
      } else if (i === 3) {
        // Cliente 4: Sin BANs ni suscriptores
        await client.query(`DELETE FROM bans WHERE client_id = $1`, [cliente.id]);
        console.log(`❌ Cliente "${cliente.business_name}" (ID: ${cliente.id}) - Eliminados BANs y suscriptores`);
        sinBan++;
        
      } else if (i === 4) {
        // Cliente 5: Sin nombre y sin suscriptores
        await client.query(`
          UPDATE clients SET business_name = NULL WHERE id = $1
        `, [cliente.id]);
        await client.query(`
          DELETE FROM subscribers 
          WHERE ban_id IN (SELECT id FROM bans WHERE client_id = $1)
        `, [cliente.id]);
        console.log(`❌ Cliente ID ${cliente.id} - Sin nombre ni suscriptores`);
        sinNombre++;
        sinSuscriptor++;
      }
    }
    
    console.log('\n📊 RESUMEN:');
    console.log(`   - Clientes sin BAN: ${sinBan}`);
    console.log(`   - Clientes sin suscriptor: ${sinSuscriptor}`);
    console.log(`   - Clientes sin nombre: ${sinNombre}`);
    console.log(`   - Total de incompletos creados: ${clientesCompletos.rows.length}`);
    
    // Verificar el resultado
    const resultado = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE b.ban_count = 0) as sin_ban,
        COUNT(*) FILTER (WHERE s.subscriber_count = 0) as sin_suscriptor,
        COUNT(*) FILTER (WHERE c.business_name IS NULL OR c.business_name = '') as sin_nombre,
        COUNT(*) as total_incompletos
      FROM clients c
      LEFT JOIN (
        SELECT client_id, COUNT(*) as ban_count
        FROM bans WHERE is_active = 1
        GROUP BY client_id
      ) b ON b.client_id = c.id
      LEFT JOIN (
        SELECT b.client_id, COUNT(DISTINCT s.id) as subscriber_count
        FROM bans b
        INNER JOIN subscribers s ON s.ban_id = b.id
        WHERE b.is_active = 1 AND s.is_active = 1
        GROUP BY b.client_id
      ) s ON s.client_id = c.id
      WHERE c.is_active = 1
        AND (
          c.business_name IS NULL 
          OR c.business_name = ''
          OR COALESCE(b.ban_count, 0) = 0
          OR COALESCE(s.subscriber_count, 0) = 0
        )
    `);
    
    console.log('\n✅ VERIFICACIÓN EN BASE DE DATOS:');
    console.log(`   - Clientes sin BAN: ${resultado.rows[0].sin_ban}`);
    console.log(`   - Clientes sin suscriptor: ${resultado.rows[0].sin_suscriptor}`);
    console.log(`   - Clientes sin nombre: ${resultado.rows[0].sin_nombre}`);
    console.log(`   - Total incompletos: ${resultado.rows[0].total_incompletos}`);
    
    console.log('\n🎉 PROCESO COMPLETADO');
    console.log('   Recarga la página para ver los cambios en la pestaña "Incompletos"');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
crearIncompletos();
