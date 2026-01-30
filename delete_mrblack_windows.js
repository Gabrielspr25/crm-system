
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

async function run() {
    try {
        console.log('--- Deleting duplicates for MR BLACK INC from follow_up_prospects ---');
        // Find existing ones
        const clientRes = await pool.query("SELECT id FROM clients WHERE name ILIKE '%MR BLACK INC%'");
        if (clientRes.rows.length === 0) { console.log('Client not found'); return; }

        const clientId = clientRes.rows[0].id;
        console.log(`Deleting follow_up_prospects for client ${clientId}...`);

        await pool.query('DELETE FROM follow_up_prospects WHERE client_id = $1', [clientId]);
        console.log('Deleted.');

        pool.end();
    } catch (e) { console.error(e); pool.end(); }
}
run();
