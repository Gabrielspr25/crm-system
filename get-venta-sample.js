
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '159.203.70.5',
    port: 5432,
    user: 'postgres',
    password: 'p0stmu7t1',
    database: 'claropr',
    connectionTimeoutMillis: 5000
});

async function getVentaSample() {
    try {
        const res = await pool.query(`SELECT cliente, numero, ban, imei, pricecode FROM venta WHERE cliente IS NOT NULL LIMIT 1`);
        console.log(res.rows[0]);
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
    await pool.end();
}
getVentaSample();
