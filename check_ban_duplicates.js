
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

async function checkBanDuplicates() {
    try {
        console.log('Checking for duplicate BANs...');
        const res = await pool.query(`
            SELECT ban_number, count(*), array_agg(id), array_agg(client_id)
            FROM bans
            GROUP BY ban_number
            HAVING count(*) > 1
        `);

        if (res.rows.length === 0) {
            console.log('No duplicate BANs found.');
        } else {
            console.log(`Found ${res.rows.length} sets of duplicate BANs:`);
            console.table(res.rows);
        }

        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkBanDuplicates();
