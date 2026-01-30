
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

async function checkDuplicatesAndSubs() {
    try {
        console.log('--- Checking FollowUp Prospects Duplicates ---');
        const res = await pool.query(`
            SELECT client_id, company_name, count(*) as count, array_agg(id) as ids
            FROM follow_up_prospects
            WHERE completed_date IS NOT NULL
            GROUP BY client_id, company_name
            HAVING count(*) > 1
        `);

        if (res.rows.length === 0) {
            console.log('No duplicates found in follow_up_prospects.');
        } else {
            console.log(`Found ${res.rows.length} sets of duplicates in follow_up_prospects:`);
            res.rows.forEach(r => console.log(r));
        }

        console.log('\n--- Checking MR BLACK INC Data ---');
        const clientRes = await pool.query(`SELECT id, name FROM clients WHERE name ILIKE '%MR BLACK INC%'`);
        if (clientRes.rows.length > 0) {
            const clientId = clientRes.rows[0].id;
            console.log(`Client ID: ${clientId}`);

            const followUps = await pool.query(`SELECT * FROM follow_up_prospects WHERE client_id = $1`, [clientId]);
            console.table(followUps.rows.map(r => ({
                id: r.id,
                completed: r.is_completed,
                movil_new: r.movil_nueva,
                movil_ren: r.movil_renovacion
            })));

            const subscribers = await pool.query(`
                SELECT s.id, s.phone_number, s.monthly_value, s.line_type, s.plan, b.account_type
                FROM subscribers s
                JOIN bans b ON s.ban_id = b.id
                WHERE b.client_id = $1
            `, [clientId]);

            console.log(`Subscribers (${subscribers.rows.length}):`);
            console.table(subscribers.rows);
        } else {
            console.log('Client MR BLACK INC not found.');
        }

        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkDuplicatesAndSubs();
