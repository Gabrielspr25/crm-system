
import { getClient } from './src/backend/database/db.js';

async function checkOgoyi() {
    const client = await getClient();
    try {
        const res = await client.query(`
            SELECT id, company_name, is_completed, created_at, total_amount 
            FROM follow_up_prospects 
            WHERE company_name ILIKE '%OGOYI%'
        `);
        console.log('OGOYI RECORDS:');
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }
}

checkOgoyi();
