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

async function listTables() {
  try {
    console.log('Conectando a la base de datos remota...');
    const client = await pool.connect();
    
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('Tablas:');
    res.rows.forEach(row => console.log(`- ${row.table_name}`));

    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

listTables();
