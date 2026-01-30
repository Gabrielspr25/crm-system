
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

async function migrateSchema() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('👷 Actualizando tabla subscribers...');
        await client.query(`
      ALTER TABLE subscribers 
      ADD COLUMN IF NOT EXISTS imei VARCHAR(50),
      ADD COLUMN IF NOT EXISTS init_activation_date DATE,
      ADD COLUMN IF NOT EXISTS effective_date DATE,
      ADD COLUMN IF NOT EXISTS subscriber_name_remote VARCHAR(255),
      ADD COLUMN IF NOT EXISTS activity_code VARCHAR(50);
    `);

        console.log('👷 Actualizando tabla bans...');
        await client.query(`
      ALTER TABLE bans 
      ADD COLUMN IF NOT EXISTS dealer_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS dealer_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reason_desc TEXT,
      ADD COLUMN IF NOT EXISTS sub_status_report VARCHAR(100);
    `);

        await client.query('COMMIT');
        console.log('✅ Migración remota completada con éxito.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en la migración:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrateSchema();
