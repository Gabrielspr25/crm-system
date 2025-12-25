
import { getClient } from './src/backend/database/db.js';

async function deleteDuplicateOgoyi() {
    const client = await getClient();
    try {
        // Borrar el registro más reciente de OGOYI (ID 43) para dejar solo el original (ID 42)
        const res = await client.query(`
            DELETE FROM follow_up_prospects 
            WHERE id = 43 AND company_name ILIKE '%OGOYI%'
            RETURNING *
        `);
        console.log('DELETED DUPLICATE:');
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }
}

deleteDuplicateOgoyi();
