
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const client = await pool.connect();
    
    // Check for clients where name is a number (potential BANs)
    const res = await client.query(`
      SELECT count(*) 
      FROM clients 
      WHERE name ~ '^[0-9]+$'
    `);
    
    console.log('Clients with numeric names:', res.rows[0].count);

    // Check specifically for one of the BANs we saw
    const banCheck = await client.query(`
      SELECT * FROM clients WHERE name = '374089500'
    `);
    console.log('Client with name 374089500:', banCheck.rows);

    client.release();
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

check();
