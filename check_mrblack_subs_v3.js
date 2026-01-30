
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
        const clientRes = await pool.query(`SELECT id, name FROM clients WHERE name ILIKE '%MR BLACK INC%'`);
        if (clientRes.rows.length === 0) {
            console.log('Client MR BLACK INC not found.');
            return;
        }
        const clientId = clientRes.rows[0].id;

        // Inspect Bans Schema
        const banSchema = await pool.query(`SELECT * FROM bans LIMIT 1`);
        const banKeys = banSchema.rows.length > 0 ? Object.keys(banSchema.rows[0]) : [];
        console.log('Ban Keys:', banKeys);

        const banNumCol = banKeys.includes('number') ? 'number' : 'ban_number';

        const subs = await pool.query(`
            SELECT s.id, s.phone, s.monthly_value, s.line_type, s.plan, b.account_type, b.${banNumCol} as ban
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
