
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

async function explore() {
    try {
        console.log('--- EXPLORANDO DB: celularinnovation ---');

        // Listar tablas
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        console.log('Tablas detectadas:', tables.rows.map(r => r.table_name).join(', '));

        // Ver conteo de las mas importantes (asumiendo nombres comunes por el contexto)
        const criticalTables = ['cliente', 'venta', 'vendedor', 'ban', 'suscriptor', 'subscriber', 'client', 'salesperson'];
        for (const t of criticalTables) {
            const exists = tables.rows.find(r => r.table_name === t);
            if (exists) {
                const count = await pool.query(`SELECT COUNT(*) FROM "${t}"`);
                console.log(`Table "${t}": ${count.rows[0].count} registros`);
            }
        }

        await pool.end();
    } catch (err) {
        console.error('❌ ERROR:', err.message);
    }
}

explore();
