
import { getClient } from './src/backend/database/db.js';

async function checkCompleted() {
    const client = await getClient();
    try {
        const res = await client.query(`
            SELECT count(*) as total, vendor_id 
            FROM follow_up_prospects 
            WHERE is_completed = true 
            GROUP BY vendor_id
        `);
        console.log('COMPLETED PROSPECTS SUMMARY:');
        console.table(res.rows);

        const sample = await client.query(`
            SELECT id, company_name, is_completed, completed_date, vendor_id 
            FROM follow_up_prospects 
            WHERE is_completed = true 
            LIMIT 5
        `);
        console.log('SAMPLE COMPLETED:');
        console.table(sample.rows);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }
}

checkCompleted();
