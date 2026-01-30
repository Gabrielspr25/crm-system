
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!',
    ssl: false
});

async function checkTypes() {
    try {
        const t1 = await pool.query(`SELECT pg_typeof(id) as type FROM clients LIMIT 1`);
        console.log('clients.id type:', t1.rows[0]?.type);

        const t2 = await pool.query(`SELECT pg_typeof(client_id) as type FROM bans LIMIT 1`);
        console.log('bans.client_id type:', t2.rows[0]?.type);

        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkTypes();
