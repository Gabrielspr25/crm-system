
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

async function checkBanConstraintsDef() {
    try {
        const res = await pool.query(`
            SELECT pg_get_constraintdef(oid) as def
            FROM pg_constraint 
            WHERE conrelid = 'bans'::regclass AND conname = 'bans_status_check'
        `);
        console.log('Constraint Def:', res.rows[0].def);
        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkBanConstraintsDef();
