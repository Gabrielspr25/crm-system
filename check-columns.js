
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

async function listColumns(table) {
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = $1
  `, [table]);
  console.log(`\nColumns for ${table}:`);
  res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
}

async function main() {
  await listColumns('clients');
  await listColumns('bans');
  await listColumns('subscribers');
  await pool.end();
}

main().catch(console.error);
