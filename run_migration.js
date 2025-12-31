
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Using credentials found in check_db_count.js
const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
    ssl: false
});

async function runMigration() {
    const sqlPath = path.join(__dirname, 'create-tarifas-tables.sql');
    console.log(`Reading SQL from: ${sqlPath}`);

    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        const client = await pool.connect();
        console.log('Connected to Database. Executing SQL...');

        await client.query(sql);
        console.log('✅ Migration executed successfully!');

        client.release();
    } catch (err) {
        console.error('❌ Error executing migration:', err);
    } finally {
        await pool.end();
    }
}

runMigration();
