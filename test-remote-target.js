
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '159.203.70.5',
    port: 5432,
    user: 'postgres',
    password: 'p0stmu7t1',
    database: 'postgres', // Intentamos conectar a la db default para verificar acceso
    connectionTimeoutMillis: 5000
});

async function test() {
    try {
        const res = await pool.query('SELECT current_database(), now()');
        console.log('✅ CONEXIÓN EXITOSA');
        console.log('Datos:', res.rows[0]);

        const dbs = await pool.query('SELECT datname FROM pg_database WHERE datistemplate = false');
        console.log('Bases de datos disponibles:', dbs.rows.map(r => r.datname));

        await pool.end();
    } catch (err) {
        console.error('❌ ERROR DE CONEXIÓN:', err.message);
        process.exit(1);
    }
}

test();
