const { Pool } = require('pg');

const legacyPool = new Pool({
  host: '167.99.12.125',
  port: 5432,
  user: 'postgres',
  password: 'fF00JIRFXc',
  database: 'claropr'
});

const crmPool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro'
});

async function analyze() {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║    BUSCANDO CLIENTES DEL CRM EN LEGACY DATABASE          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    const clientesACruzar = [
      'HOGAR ALBERGUE JESUS DE NAZARET',
      'FERRETERIA COMERCIAL',
      'ASOC CONDOMINES BORINQUEN TOWER1'
    ];
    
    for (const clienteName of clientesACruzar) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🔍 BUSCANDO: ${clienteName}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Buscar en clientecredito
      const clienteLegacy = await legacyPool.query(`
        SELECT 
          clientecreditoid,
          nombre,
          ban,
          email,
          pyme,
          activo
        FROM clientecredito
        WHERE UPPER(nombre) LIKE $1
        LIMIT 5
      `, [`%${clienteName}%`]);
      
      if (clienteLegacy.rows.length === 0) {
        console.log('❌ No encontrado en clientecredito legacy\n');
        
        // Buscar en CRM para obtener BANs
        const clienteCRM = await crmPool.query(`
          SELECT 
            c.name,
            b.ban_number,
            COUNT(s.id) as suscriptores
          FROM clients c
          LEFT JOIN bans b ON b.client_id = c.id
          LEFT JOIN subscribers s ON s.ban_id = b.id
          WHERE UPPER(c.name) LIKE $1
          GROUP BY c.name, b.ban_number
        `, [`%${clienteName}%`]);
        
        if (clienteCRM.rows.length > 0) {
          console.log('📋 Datos en CRM:');
          for (const row of clienteCRM.rows) {
            console.log(`   BAN: ${row.ban_number || 'N/A'} | Suscriptores: ${row.suscriptores}`);
          }
          
          // Buscar ventas por BAN
          if (clienteCRM.rows[0].ban_number) {
            const ventasPorBAN = await legacyPool.query(`
              SELECT 
                v.ventaid,
                v.ban,
                v.fechaactivacion,
                v.comisionclaro,
                ve.nombre as vendedor,
                ve.vendedorid
              FROM venta v
              LEFT JOIN vendedor ve ON v.vendedorid = ve.vendedorid
              WHERE v.ban = $1
              ORDER BY v.fechaactivacion DESC
              LIMIT 10
            `, [clienteCRM.rows[0].ban_number]);
            
            if (ventasPorBAN.rows.length > 0) {
              console.log(`\n✅ Encontradas ${ventasPorBAN.rows.length} ventas en legacy por BAN ${clienteCRM.rows[0].ban_number}:`);
              for (let i = 0; i < ventasPorBAN.rows.length; i++) {
                const venta = ventasPorBAN.rows[i];
                console.log(`   [${i + 1}] Venta ID: ${venta.ventaid}`);
                console.log(`       BAN: ${venta.ban}`);
                console.log(`       Fecha: ${new Date(venta.fechaactivacion).toLocaleDateString('es-ES')}`);
                console.log(`       Vendedor: ${venta.vendedor} (ID ${venta.vendedorid})`);
                console.log(`       Comisión: $${Number(venta.comisionclaro || 0).toFixed(2)}`);
              }
            } else {
              console.log(`\n⚠️  BAN ${clienteCRM.rows[0].ban_number} no tiene ventas en legacy`);
            }
          }
        }
        
      } else {
        console.log(`✅ Encontrado en legacy: ${clienteLegacy.rows.length} registro(s)\n`);
        
        for (let i = 0; i < clienteLegacy.rows.length; i++) {
          const cliente = clienteLegacy.rows[i];
          console.log(`[${i + 1}] ID: ${cliente.clientecreditoid}`);
          console.log(`    Nombre: ${cliente.nombre}`);
          console.log(`    BAN: ${cliente.ban || 'N/A'}`);
          console.log(`    Email: ${cliente.email || 'N/A'}`);
          console.log(`    PYME: ${cliente.pyme ? 'Sí' : 'No'}`);
          console.log(`    Activo: ${cliente.activo ? 'Sí' : 'No'}`);
          
          // Buscar ventas del cliente
          if (cliente.clientecreditoid) {
            const ventas = await legacyPool.query(`
              SELECT 
                v.ventaid,
                v.ban,
                v.fechaactivacion,
                v.comisionclaro,
                ve.nombre as vendedor,
                ve.vendedorid
              FROM venta v
              LEFT JOIN vendedor ve ON v.vendedorid = ve.vendedorid
              WHERE v.clientecreditoid = $1
              ORDER BY v.fechaactivacion DESC
              LIMIT 10
            `, [cliente.clientecreditoid]);
            
            if (ventas.rows.length > 0) {
              console.log(`\n    📊 Ventas (${ventas.rows.length}):`);
              for (const venta of ventas.rows) {
                console.log(`       • ${new Date(venta.fechaactivacion).toLocaleDateString('es-ES')} - BAN: ${venta.ban}`);
                console.log(`         Vendedor: ${venta.vendedor} (ID ${venta.vendedorid})`);
              }
            } else {
              console.log(`\n    ⚠️  Sin ventas registradas`);
            }
          }
          console.log('');
        }
      }
      
      console.log('');
    }
    
    console.log('══════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await legacyPool.end();
    await crmPool.end();
  }
}

analyze();
