
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

async function checkCrmCliente() {
    try {
        const res = await pool.query(`SELECT COUNT(*) FROM "crmcliente"`);
        console.log(`Table "crmcliente": ${res.rows[0].count} registers`);

        const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'crmcliente'`);
        console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
    await pool.end();
}
checkCrmCliente();
