import pkg from 'pg';
const { Pool } = pkg;

const legacyPool = new Pool({
  host: '159.203.70.5',
  user: 'postgres',
  password: 'p0stmu7t1',
  database: 'claropr',
  port: 5432
});

const currentPool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function buscarSantaGema() {
  try {
    console.log('\n=== BUSCANDO "COLEGIO SANTA GEMA" EN LEGACY ===\n');
    
    // Buscar en clientecredito
    const clienteCredito = await legacyPool.query(`
      SELECT * FROM clientecredito 
      WHERE LOWER(nombre) LIKE '%santa gema%' 
         OR LOWER(apellido) LIKE '%santa gema%'
      LIMIT 5
    `);
    
    if (clienteCredito.rows.length > 0) {
      console.log('✓ ENCONTRADO EN clientecredito:');
      clienteCredito.rows.forEach((c, i) => {
        console.log(`\n[${i+1}] ID: ${c.clientecreditoid}`);
        console.log(`    Nombre: ${c.nombre || 'N/A'}`);
        console.log(`    Apellido: ${c.apellido || 'N/A'}`);
        console.log(`    BAN: ${c.ban || 'N/A'}`);
        console.log(`    PYME: ${c.pyme ? 'Sí' : 'No'}`);
      });
      
      const clienteId = clienteCredito.rows[0].clientecreditoid;
      
      // Buscar ventas de este cliente
      console.log('\n\n=== BUSCANDO VENTAS DE ESTE CLIENTE ===\n');
      const ventas = await legacyPool.query(`
        SELECT ventaid, ban, numerocelularactivado, codigovoz, meses,
               comisionclaro, comisionvendedor, comisionextra,
               fechaactivacion, vendedorid
        FROM venta
        WHERE clientecreditoid = $1
        LIMIT 10
      `, [clienteId]);
      
      if (ventas.rows.length > 0) {
        console.log(`✓ ${ventas.rows.length} ventas encontradas:`);
        ventas.rows.forEach((v, i) => {
          console.log(`\n[${i+1}] Venta ID: ${v.ventaid}`);
          console.log(`    BAN: ${v.ban}`);
          console.log(`    Teléfono: ${v.numerocelularactivado || 'N/A'}`);
          console.log(`    Código Voz: ${v.codigovoz || 'N/A'}`);
          console.log(`    Meses: ${v.meses || 'N/A'}`);
          console.log(`    Comisión Claro: $${v.comisionclaro || '0'}`);
          console.log(`    Comisión Vendedor: $${v.comisionvendedor || '0'}`);
          console.log(`    Comisión Extra: $${v.comisionextra || '0'}`);
          console.log(`    Fecha Activación: ${v.fechaactivacion || 'N/A'}`);
          console.log(`    Vendedor ID: ${v.vendedorid || 'N/A'}`);
        });
      } else {
        console.log('❌ No tiene ventas registradas');
      }
      
    } else {
      console.log('❌ NO encontrado en clientecredito');
    }
    
    // Ahora buscar en CRM actual
    console.log('\n\n=== BUSCANDO EN CRM ACTUAL ===\n');
    
    const clienteActual = await currentPool.query(`
      SELECT * FROM clients 
      WHERE LOWER(name) LIKE '%santa gema%'
      LIMIT 1
    `);
    
    if (clienteActual.rows.length > 0) {
      const c = clienteActual.rows[0];
      console.log('✓ ENCONTRADO EN CRM:');
      console.log(`    ID: ${c.id}`);
      console.log(`    Nombre: ${c.name}`);
      console.log(`    Salesperson: ${c.salesperson_id || 'N/A'}`);
      
      // Buscar BANs
      const bans = await currentPool.query(`
        SELECT * FROM bans WHERE client_id = $1
      `, [c.id]);
      
      console.log(`\n    BANs registrados: ${bans.rows.length}`);
      
      if (bans.rows.length > 0) {
        for (const ban of bans.rows) {
          console.log(`\n    BAN: ${ban.ban_number}`);
          
          // Buscar suscriptores
          const subs = await currentPool.query(`
            SELECT * FROM subscribers WHERE ban_id = $1
          `, [ban.id]);
          
          console.log(`      Suscriptores: ${subs.rows.length}`);
          
          for (const sub of subs.rows) {
            console.log(`        • Tel: ${sub.phone || 'N/A'} | Valor: $${sub.monthly_value || '0'}`);
          }
        }
      }
      
      // Buscar follow_up
      const followUp = await currentPool.query(`
        SELECT * FROM follow_up_prospects 
        WHERE client_id = $1
      `, [c.id]);
      
      console.log(`\n    Follow-up prospects: ${followUp.rows.length}`);
      if (followUp.rows.length > 0) {
        followUp.rows.forEach(f => {
          console.log(`      • ID: ${f.id} | Completado: ${f.completed_date || 'NO'}`);
        });
      }
      
      // Buscar en subscriber_reports
      const reports = await currentPool.query(`
        SELECT sr.*, s.phone
        FROM subscriber_reports sr
        JOIN subscribers s ON s.id = sr.subscriber_id
        JOIN bans b ON s.ban_id = b.id
        WHERE b.client_id = $1
      `, [c.id]);
      
      console.log(`\n    Reportes generados: ${reports.rows.length}`);
      if (reports.rows.length > 0) {
        reports.rows.forEach(r => {
          console.log(`      • Tel: ${r.phone} | Company: $${r.company_earnings || '0'} | Vendor: $${r.vendor_commission || '0'}`);
        });
      }
      
    } else {
      console.log('❌ NO encontrado en CRM actual');
    }
    
    console.log('\n\n════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await legacyPool.end();
    await currentPool.end();
  }
}

buscarSantaGema();
