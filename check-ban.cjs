
const { Pool } = require('pg');

const pool = new Pool({
  user: 'crm_user',
  host: '143.244.191.139',
  database: 'crm_pro',
  password: 'CRM_Seguro_2025!',
  port: 5432,
  ssl: false
});

async function checkBan() {
  try {
    const client = await pool.connect();
    const res = await client.query(`
      SELECT b.ban_number, c.name, c.business_name, c.base 
      FROM bans b 
      JOIN clients c ON b.client_id = c.id 
      WHERE b.ban_number = '374089500'
    `);
    console.log('Result:', res.rows);
    client.release();
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkBan();
