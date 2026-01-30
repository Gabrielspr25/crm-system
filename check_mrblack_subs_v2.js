
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

async function checkSubs() {
    try {
        // Inspect schema first
        const schema = await pool.query(`SELECT * FROM subscribers LIMIT 1`);
        if (schema.rows.length > 0) {
            console.log('Subscribers Keys:', Object.keys(schema.rows[0]));
        } else {
            const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'subscribers'`);
            console.log('Subscribers Columns:', cols.rows.map(r => r.column_name));
        }

        const clientRes = await pool.query(`SELECT id, name FROM clients WHERE name ILIKE '%MR BLACK INC%'`);
        if (clientRes.rows.length === 0) {
            console.log('Client MR BLACK INC not found.');
            return;
        }
        const clientId = clientRes.rows[0].id;

        // Use 'phone' if it exists, otherwise 'phone_number' (detect from keys)
        // Previous error said 'phone_number' does not exist, so it's likely 'phone'
        const subs = await pool.query(`
            SELECT s.id, s.phone, s.monthly_value, s.line_type, s.plan, b.account_type, b.number as ban
            FROM subscribers s
            JOIN bans b ON s.ban_id = b.id
            WHERE b.client_id = $1
        `, [clientId]);

        console.log(`Subscribers (${subs.rows.length}):`);
        console.table(subs.rows);

        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkSubs();
