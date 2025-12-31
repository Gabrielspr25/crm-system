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

async function checkColumns() {
  try {
    console.log('Conectando a la base de datos remota...');
    const client = await pool.connect();
    
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'clients'
      ORDER BY ordinal_position
    `);
    
    console.log('Columnas de la tabla clients:');
    res.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type}) [Nullable: ${row.is_nullable}]`));

    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkColumns();
