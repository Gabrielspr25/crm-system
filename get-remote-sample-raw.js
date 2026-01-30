
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '159.203.70.5',
    port: 5432,
    user: 'postgres',
    password: 'p0stmu7t1',
    database: 'celularinnovation',
    connectionTimeoutMillis: 5000
});

async function getSampleRaw() {
    try {
        console.log('--- Obteniendo Muestra de Ventas Movil (RAW) ---');
        const res = await pool.query(`SELECT * FROM ventas_movil LIMIT 1`);
        console.log(JSON.stringify(res.rows[0], null, 2));
        await pool.end();
    } catch (err) {
        console.error('❌ ERROR:', err.message);
    }
}

getSampleRaw();
