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
    // Verificar usuarios
    const users = await pool.query('SELECT * FROM users_auth LIMIT 5');
    console.log('Usuarios:', users.rows);
  } catch(e) {
    console.error(e.message);
  } finally {
    pool.end();
  }
}

check();
