
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'crm_pro',
  user: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!',
});

async function checkData() {
  try {
    console.log('Checking data integrity...');
    
    const clientCount = await pool.query('SELECT COUNT(*) FROM clients');
    console.log(`Total Clients: ${clientCount.rows[0].count}`);

    const banCount = await pool.query('SELECT COUNT(*) FROM bans');
    console.log(`Total BANs: ${banCount.rows[0].count}`);

    const subCount = await pool.query('SELECT COUNT(*) FROM subscribers');
    console.log(`Total Subscribers: ${subCount.rows[0].count}`);

    const linkedBans = await pool.query('SELECT COUNT(*) FROM bans WHERE client_id IS NOT NULL');
    console.log(`BANs with client_id: ${linkedBans.rows[0].count}`);

    const linkedSubs = await pool.query('SELECT COUNT(*) FROM subscribers WHERE ban_id IS NOT NULL');
    console.log(`Subscribers with ban_id: ${linkedSubs.rows[0].count}`);

    // Check a sample client with BANs
    const sample = await pool.query(`
      SELECT c.id, c.name, b.ban_number 
      FROM clients c 
      JOIN bans b ON c.id = b.client_id 
      LIMIT 5
    `);
    console.log('Sample linked data:', sample.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkData();
