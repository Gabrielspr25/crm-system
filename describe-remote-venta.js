
import pg from 'pg';
const { Pool } = pg;

const remotePool = new Pool({
    host: '159.203.70.5',
    port: 5432,
    user: 'postgres',
    password: 'p0stmu7t1',
    database: 'claropr',
    connectionTimeoutMillis: 10000
});

async function describeTable() {
    console.log('Describing table venta...');
    try {
        const res = await remotePool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'venta'
        `);
        console.log('Columns:', res.rows.map(r => r.column_name).join(', '));
    } catch (err) {
        console.error('Error describing table:', err.message);
    } finally {
        await remotePool.end();
    }
}

describeTable();
