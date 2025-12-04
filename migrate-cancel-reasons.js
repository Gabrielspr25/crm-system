
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
    console.log('Adding cancel_reason columns...');
    
    // Add columns
    await client.query(`ALTER TABLE bans ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(255);`);
    await client.query(`ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(255);`);
    console.log('Columns added.');

    // Migrate data for BANs
    console.log('Migrating BAN cancel reasons...');
    await client.query(`
      UPDATE bans b
      SET cancel_reason = bcr.reason
      FROM ban_cancel_reason bcr
      WHERE b.id = bcr.ban_id;
    `);

    // Migrate data for Subscribers
    console.log('Migrating Subscriber cancel reasons...');
    await client.query(`
      UPDATE subscribers s
      SET cancel_reason = scr.reason
      FROM subscriber_cancel_reason scr
      WHERE s.id = scr.subscriber_id;
    `);

    console.log('Migration completed successfully.');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
