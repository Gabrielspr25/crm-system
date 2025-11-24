import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  ssl: false
});

async function checkRecentImports() {
  try {
    console.log('Conectando a la base de datos remota...');
    const client = await pool.connect();
    
    // Check for clients created in the last 20 minutes
    const res = await client.query(`
      SELECT count(*) as count 
      FROM clients 
      WHERE created_at > NOW() - INTERVAL '20 minutes'
    `);
    
    console.log(`Clientes creados en los últimos 20 minutos: ${res.rows[0].count}`);

    if (parseInt(res.rows[0].count) > 0) {
        const details = await client.query(`
            SELECT id, name, business_name, created_at 
            FROM clients 
            WHERE created_at > NOW() - INTERVAL '20 minutes'
            LIMIT 5
        `);
        console.log('Ejemplos:', details.rows);
    }

    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkRecentImports();
