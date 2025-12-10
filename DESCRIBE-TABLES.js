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

async function describeTable(tableName) {
  try {
    const client = await pool.connect();
    
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    console.log(`\nColumnas de ${tableName}:`);
    res.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    client.release();
  } catch (err) {
    console.error('Error:', err);
  }
}

async function main() {
    await describeTable('clients');
    await describeTable('bans');
    await describeTable('subscribers');
    await describeTable('follow_up_prospects');
    await pool.end();
}

main();
