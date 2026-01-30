
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

async function getPymeCols() {
    try {
        const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'ventapyme' ORDER BY column_name`);
        console.log('ventapyme cols:', res.rows.map(r => r.column_name).join(', '));

        const resProd = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'ventaproducto' ORDER BY column_name`);
        console.log('ventaproducto cols:', resProd.rows.map(r => r.column_name).join(', '));
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
    await pool.end();
}
getPymeCols();
