
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: 'postgres',
  host: '143.244.191.139',
  database: 'crm_pro',
  password: 'CL@70049ro',
  port: 5432,
});

async function checkImport() {
  const client = await pool.connect();
  try {
    console.log('🔍 Verificando estado de la base de datos...');

    // 1. Conteos totales
    const counts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM clients) as total_clients,
        (SELECT COUNT(*) FROM bans) as total_bans,
        (SELECT COUNT(*) FROM subscribers) as total_subscribers
    `);
    
    console.log('\n📊 CONTEOS TOTALES:');
    console.log('-------------------');
    console.log(`Clientes:     ${counts.rows[0].total_clients}`);
    console.log(`BANs:         ${counts.rows[0].total_bans}`);
    console.log(`Suscriptores: ${counts.rows[0].total_subscribers}`);

    // 2. Registros creados hoy (últimas 24 horas)
    const recent = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM clients WHERE created_at > NOW() - INTERVAL '24 hours') as new_clients,
        (SELECT COUNT(*) FROM bans WHERE created_at > NOW() - INTERVAL '24 hours') as new_bans,
        (SELECT COUNT(*) FROM subscribers WHERE created_at > NOW() - INTERVAL '24 hours') as new_subscribers,
        (SELECT COUNT(*) FROM clients WHERE updated_at > NOW() - INTERVAL '24 hours') as updated_clients
    `);

    console.log('\n📅 ACTIVIDAD RECIENTE (Últimas 24h):');
    console.log('------------------------------------');
    console.log(`Clientes Nuevos:      ${recent.rows[0].new_clients}`);
    console.log(`Clientes Actualizados:${recent.rows[0].updated_clients}`);
    console.log(`BANs Nuevos:          ${recent.rows[0].new_bans}`);
    console.log(`Suscriptores Nuevos:  ${recent.rows[0].new_subscribers}`);

    // 3. Muestra de últimos clientes creados
    const lastClients = await client.query(`
      SELECT id, name, business_name, created_at 
      FROM clients 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    console.log('\n📝 ÚLTIMOS 5 CLIENTES CREADOS:');
    console.log('-----------------------------');
    lastClients.rows.forEach(c => {
      console.log(`[${c.created_at.toISOString()}] ID: ${c.id} - ${c.business_name || c.name}`);
    });

  } catch (err) {
    console.error('❌ Error conectando a la BD:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkImport();
