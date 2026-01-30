
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!'
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🔄 Agregando columna color_hex a categories...\n');

        await client.query(`
            ALTER TABLE categories 
            ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7) DEFAULT '#3B82F6';
        `);

        console.log('✅ Migración exitosa.');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
