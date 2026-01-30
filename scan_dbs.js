
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'crm_user',
    password: process.env.DB_PASSWORD,
};

async function checkDb(dbName) {
    console.log(`Checking DB: ${dbName}...`);
    const pool = new Pool({ ...config, database: dbName });

    try {
        const res = await pool.query(`
            SELECT count(*) 
            FROM information_schema.tables 
            WHERE table_name = 'follow_up_prospects'
        `);

        if (parseInt(res.rows[0].count) > 0) {
            console.log(`FOUND follow_up_prospects in ${dbName}!!!`);
            const rows = await pool.query('SELECT count(*) FROM follow_up_prospects');
            console.log(`Rows: ${rows.rows[0].count}`);
        } else {
            console.log(`Not found in ${dbName}.`);
        }
    } catch (err) {
        console.log(`Error connecting to ${dbName}: ${err.message}`);
    } finally {
        pool.end();
    }
}

async function scan() {
    await checkDb('UI');
    await checkDb('Mom');
    await checkDb('postgres');
}

scan();
