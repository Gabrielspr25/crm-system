
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    host: '143.244.191.139', // FOUND IN run_migration.js
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!', // Fallback to what was in run_migration.js
    ssl: false
});

async function repairReport() {
    console.log('--- STARTING REPAIR REPORT ON REMOTE DB ---');
    const client = await pool.connect();

    try {
        const dbName = await client.query('SELECT current_database()');
        console.log(`Connected to Database: ${dbName.rows[0].current_database} on 143.244.191.139`);

        // 2. Find Duplicates in follow_up_prospects (Completed ones)
        // Groups by client_id and company_name
        // Filter out those with no client_id (shouldn't exist if completed correctly)
        const duplicates = await client.query(`
            SELECT client_id, company_name, array_agg(id ORDER BY created_at ASC) as ids
            FROM follow_up_prospects
            WHERE is_completed = true AND client_id IS NOT NULL
            GROUP BY client_id, company_name
            HAVING count(*) > 1
        `);

        console.log(`Found ${duplicates.rows.length} duplicate completed prospects.`);

        for (const row of duplicates.rows) {
            const [keepId, ...removeIds] = row.ids;
            console.log(`Merging ${row.company_name} (Keeping ${keepId}, removing ${removeIds})`);

            // Sum values from removed rows
            const sums = await client.query(`
                SELECT 
                    sum(fijo_ren) as fijo_ren,
                    sum(fijo_new) as fijo_new,
                    sum(movil_nueva) as movil_nueva,
                    sum(movil_renovacion) as movil_renovacion,
                    sum(claro_tv) as claro_tv,
                    sum(cloud) as cloud,
                    sum(mpls) as mpls,
                    sum(total_amount) as total_amount
                FROM follow_up_prospects
                WHERE id = ANY($1::int[])
            `, [removeIds]);

            const s = sums.rows[0];

            // Update main row
            await client.query(`
                UPDATE follow_up_prospects
                SET 
                    fijo_ren = fijo_ren + $1,
                    fijo_new = fijo_new + $2,
                    movil_nueva = movil_nueva + $3,
                    movil_renovacion = movil_renovacion + $4,
                    claro_tv = claro_tv + $5,
                    cloud = cloud + $6,
                    mpls = mpls + $7,
                    total_amount = total_amount + $8,
                    updated_at = NOW()
                WHERE id = $9
            `, [
                s.fijo_ren || 0, s.fijo_new || 0, s.movil_nueva || 0, s.movil_renovacion || 0,
                s.claro_tv || 0, s.cloud || 0, s.mpls || 0, s.total_amount || 0,
                keepId
            ]);

            // Delete duplicates
            await client.query(`DELETE FROM follow_up_prospects WHERE id = ANY($1::int[])`, [removeIds]);
        }

        console.log('Repair success!');

    } catch (err) {
        console.error('Repair failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

repairReport();
