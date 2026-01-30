
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'crm_pro',
    user: process.env.DB_USER || 'crm_user',
    password: process.env.DB_PASSWORD,
});

async function alignSchema() {
    try {
        console.log('Checking bans table columns...');
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'bans'
        `);
        const columns = res.rows.map(r => r.column_name);
        console.log('Columns:', columns);

        if (columns.includes('number') && !columns.includes('ban_number')) {
            console.log('Renaming "number" to "ban_number"...');
            await pool.query('ALTER TABLE bans RENAME COLUMN number TO ban_number');
            console.log('Renamed.');
        } else {
            console.log('Column "ban_number" already exists (or "number" missing). No action.');
        }

        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

alignSchema();
