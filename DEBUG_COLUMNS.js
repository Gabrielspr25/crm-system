
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '.env') });

async function check() {
    const pool = new pg.Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'crm_pro',
        user: process.env.DB_USER || 'crm_user',
        password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!',
    });
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'follow_up_prospects'
    `);
        console.table(res.rows);

        const res2 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'call_logs'
    `);
        console.log('\nCall Logs:');
        console.table(res2.rows);

    } finally {
        client.release();
        await pool.end();
    }
}
check();
