
const { Pool } = require('pg');

const pool = new Pool({
  user: 'crm_user',
  host: '143.244.191.139',
  database: 'crm_pro',
  password: 'CRM_Seguro_2025!',
  port: 5432,
  ssl: false
});

async function checkSchema() {
  try {
    const client = await pool.connect();
    
    const clients = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients'
      ORDER BY ordinal_position
    `);
    console.log('CLIENTS:', clients.rows.map(x => x.column_name).join(', '));
    
    const followup = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'follow_up_prospects'
      ORDER BY ordinal_position
    `);
    console.log('FOLLOW_UP:', followup.rows.map(x => x.column_name).join(', '));
    
    client.release();
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
