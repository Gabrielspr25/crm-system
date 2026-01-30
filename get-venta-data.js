
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

async function getVentaData() {
    try {
        const res = await pool.query(`SELECT * FROM venta LIMIT 2`);
        console.log(res.rows);
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
    await pool.end();
}
getVentaData();
