
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

async function checkSubscribers() {
    try {
        const res = await pool.query('SELECT * FROM subscribers LIMIT 1');
        if (res.rows.length === 0) {
            const schemaRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'subscribers'");
            console.log('Cols:', schemaRes.rows.map(r => r.column_name));
        } else {
            console.log('Keys:', Object.keys(res.rows[0]));
        }
        pool.end();
    } catch (err) {
        console.error(err);
        try {
            const schemaRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'subscribers'");
            console.log('Cols (fallback):', schemaRes.rows.map(r => r.column_name));
        } catch (e) { console.error(e); }
        pool.end();
    }
}

checkSubscribers();
