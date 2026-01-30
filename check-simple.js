const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro'
});

async function check() {
  try {
    const p = await pool.query('SELECT COUNT(*) FROM products');
    console.log('Products:', p.rows[0].count);
    
    const c = await pool.query('SELECT COUNT(*) FROM follow_up_prospects WHERE completed_date IS NOT NULL');
    console.log('Completed:', c.rows[0].count);
    
    const list = await pool.query('SELECT id, company_name, completed_date FROM follow_up_prospects WHERE completed_date IS NOT NULL LIMIT 3');
    console.log('Sample:', list.rows);
  } catch(e) {
    console.error(e.message);
  } finally {
    pool.end();
  }
}

check();
