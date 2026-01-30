
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '159.203.70.5',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'p0stmu7t1',
    ssl: false
});

async function findTables() {
    const client = await pool.connect();
    try {
        console.log('--- BUSCANDO TABLAS EN TODAS LAS BASES DE DATOS ---');
        const dbs = await client.query("SELECT datname FROM pg_database WHERE datistemplate = false AND datname != 'postgres' AND datname != 'template1' AND datname != 'template0'");

        console.log(`Bases de datos encontradas: ${dbs.rows.map(r => r.datname).join(', ')}`);

        for (const db of dbs.rows) {
            console.log(`\n🔍 Revisando Base de Datos: ${db.datname}`);
            const dbPool = new Pool({
                host: '159.203.70.5',
                port: 5432,
                database: db.datname,
                user: 'postgres',
                password: 'p0stmu7t1',
                ssl: false
            });

            try {
                const c = await dbPool.connect();
                const t = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
                console.log(`Bases de datos [${db.datname}] tiene tablas:`, t.rows.map(r => r.table_name).join(', '));
                c.release();
            } catch (e) {
                console.log(`❌ No se pudo acceder a [${db.datname}]: ${e.message}`);
            } finally {
                await dbPool.end();
            }
        }
    } finally {
        client.release();
        await pool.end();
    }
}

findTables();
