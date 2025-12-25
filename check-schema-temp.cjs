
async function checkSchema() {
    // Dynamic import for ES module in CJS
    const { getClient } = await import('./src/backend/database/db.js');
    const client = await getClient();
    try {
        const res = await client.query(`
            SELECT column_name, is_nullable, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'follow_up_prospects';
        `);
        console.log('SCHEMA follow_up_prospects:');
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }
}

checkSchema();
