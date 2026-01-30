
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

async function getCols() {
    const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'venta' ORDER BY column_name`);
    console.log(res.rows.map(r => r.column_name).join(', '));
    await pool.end();
}
getCols();
