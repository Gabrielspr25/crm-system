
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

async function checkPyme() {
    try {
        const res = await pool.query(`SELECT COUNT(*) FROM "ventapyme"`);
        console.log(`Table "ventapyme": ${res.rows[0].count} registers`);
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
    await pool.end();
}
checkPyme();
