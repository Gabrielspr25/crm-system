
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

async function describeVenta() {
    const tables = ['venta', 'vendedor'];
    for (const t of tables) {
        console.log(`\n--- TABLE: ${t} ---`);
        try {
            const res = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [t]);
            console.log(res.rows.map(r => r.column_name).join(', '));
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
    await pool.end();
}
describeVenta();
