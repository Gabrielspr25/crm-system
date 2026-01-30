
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

async function checkBansTable() {
    try {
        console.log('Checking bans table structure...');
        const res = await pool.query(`SELECT * FROM bans LIMIT 1`);
        if (res.rows.length === 0) {
            // If empty, get column names from schema
            const schemaRes = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'bans'
             `);
            console.log('Columns from schema:', schemaRes.rows.map(r => r.column_name));
        } else {
            console.log('First row keys:', Object.keys(res.rows[0]));
        }
        pool.end();
    } catch (err) {
        console.error(err);
        // Try getting columns even if select * fails (unlikely if table exists)
        try {
            const schemaRes = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'bans'
             `);
            console.log('Columns from schema (after error):', schemaRes.rows.map(r => r.column_name));
        } catch (e) {
            console.error('Schema query also failed', e);
        }
        pool.end();
    }
}

checkBansTable();
