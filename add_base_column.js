import { Pool } from 'pg';

const pool = new Pool({
  user: 'postgres',
  host: '143.244.191.139',
  database: 'crm_pro',
  password: 'CRM_Seguro_2025!',
  port: 5432,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Adding base column to clients...');
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS base DECIMAL(10,2) DEFAULT 0;`);

    console.log('Checking if follow_up_prospects table exists...');
    const res = await client.query(`SELECT to_regclass('public.follow_up_prospects');`);
    if (res.rows[0].to_regclass) {
      console.log('Adding base column to follow_up_prospects...');
      await client.query(`ALTER TABLE follow_up_prospects ADD COLUMN IF NOT EXISTS base DECIMAL(10,2) DEFAULT 0;`);
    } else {
      console.log('follow_up_prospects table does not exist.');
    }

    console.log('Migration completed.');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
