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

async function checkCount() {
  try {
    const client = await pool.connect();
    console.log("Conectado a la BD...");
    
    const resClients = await client.query('SELECT COUNT(*) FROM clients');
    console.log(`Total Clientes: ${resClients.rows[0].count}`);

    const resBans = await client.query('SELECT COUNT(*) FROM bans');
    console.log(`Total BANs: ${resBans.rows[0].count}`);

    const resSubs = await client.query('SELECT COUNT(*) FROM subscribers');
    console.log(`Total Suscriptores: ${resSubs.rows[0].count}`);

    client.release();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkCount();
