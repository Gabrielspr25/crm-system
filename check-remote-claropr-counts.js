
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

async function checkCounts() {
    const tables = ['vendedor', 'venta', 'cliente', 'ban', 'suscriptor', 'tienda', 'producto'];
    for (const t of tables) {
        try {
            const res = await pool.query(`SELECT COUNT(*) FROM "${t}"`);
            console.log(`Table "${t}": ${res.rows[0].count} registers`);
        } catch (e) {
            console.log(`Table "${t}": Error - ${e.message}`);
        }
    }
    await pool.end();
}
checkCounts();
