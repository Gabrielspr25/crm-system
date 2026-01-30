
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

async function testCreate() {
    const client = await pool.connect();
    try {
        console.log('Attempting to create table IF NOT EXISTS...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS follow_up_prospects (
                id SERIAL PRIMARY KEY,
                company_name TEXT
            )
        `);
        console.log('Table created (or already existed).');

        const count = await client.query('SELECT count(*) FROM follow_up_prospects');
        console.log('Row count:', count.rows[0].count);

        if (count.rows[0].count == 0) {
            console.log('Table is empty. Dropping it to restore previous state (if it was made erroneously).');
            await client.query('DROP TABLE follow_up_prospects');
        } else {
            console.log('Table has data! It existed correctly.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        pool.end();
    }
}

testCreate();
