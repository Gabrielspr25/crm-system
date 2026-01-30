
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
    database: 'postgres', // Connect to default DB
    user: process.env.DB_USER || 'crm_user',
    password: process.env.DB_PASSWORD,
});

async function listDbs() {
    try {
        console.log('Listing databases...');
        const res = await pool.query(`SELECT datname FROM pg_database WHERE datistemplate = false`);
        console.table(res.rows);
        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

listDbs();
