
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    user: 'postgres',
    host: '159.203.70.5',
    database: 'claropr',
    password: 'p0stmu7t1',
    port: 5432,
});

async function checkData() {
    try {
        console.log('Checking columns in remote DB...');
        // Check if columns exist and have data
        const res = await pool.query(`
            SELECT numerocelularactivado, papper, celuseguroexistente, pricecode 
            FROM venta 
            WHERE papper IS NOT NULL OR celuseguroexistente IS NOT NULL
            LIMIT 5
        `);
        console.log('Data sample:', res.rows);

        // Count nulls to see if columns are empty
        const resCount = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(papper) as papper_not_null, 
                COUNT(celuseguroexistente) as seguro_not_null
            FROM venta
        `);
        console.log('Counts:', resCount.rows[0]);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkData();
