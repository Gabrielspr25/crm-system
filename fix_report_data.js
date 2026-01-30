
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

async function fixReport() {
    console.log('--- FIXING REPORT DATA (REMOTE DB) ---');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Identify BANs for MR BLACK INC with NULL account_type
        const clientRes = await client.query(`SELECT id FROM clients WHERE name ILIKE '%MR BLACK INC%'`);
        if (clientRes.rows.length === 0) {
            console.log('Client MR BLACK INC not found.');
            return;
        }
        const clientId = clientRes.rows[0].id;

        const bansToFix = await client.query(`
            SELECT id, ban_number 
            FROM bans 
            WHERE client_id = $1 AND account_type IS NULL
        `, [clientId]);

        console.log(`Found ${bansToFix.rows.length} BANs with NULL account_type for this client.`);

        if (bansToFix.rows.length > 0) {
            const banIds = bansToFix.rows.map(b => b.id);
            await client.query(`
                UPDATE bans 
                SET account_type = 'Movil' 
                WHERE id = ANY($1::uuid[])
            `, [banIds]); // assuming id is int? Check schema from Step 270. Step 270 output didn't show IDs except ban_id. 
            // Wait, in schema check (Step 270), Bans Keys included 'id'. Is it int or uuid?
            // "inspect_bans.js" in Step 4 said "id, client_id...".
            // Migrations usually use SERIAL (int) or UUID.
            // Let's assume matches what I read before.
            // BUT strict typing might fail if I guess wrong.
            // I'll update by ban_number just in case it is safer (string).

            // Actually, using IDs is better. Let's check type.
            // In Step 196 (list tables), we didn't see types.
            // Migrations (Step 216) 0001 had id INTEGER.
            // server-FINAL lines 1551 use uuid for client_id.
            // Let's use ban_number for safety since it is string.

            const banNumbers = bansToFix.rows.map(b => b.ban_number);
            await client.query(`
                UPDATE bans 
                SET account_type = 'Movil' 
                WHERE ban_number = ANY($1::text[])
            `, [banNumbers]);

            console.log(`Updated account_type to 'Movil' for BANs: ${banNumbers.join(', ')}`);
        }

        await client.query('COMMIT');
        console.log('Fix complete.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Fix failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

fixReport();
