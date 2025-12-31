
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

async function checkTables() {
    try {
        const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('plans', 'plan_categories', 'offers', 'benefits', 'sales_guides');
    `);

        console.log('Tables found:', res.rows.map(r => r.table_name));
        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkTables();
