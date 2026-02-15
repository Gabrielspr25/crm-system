
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: '159.203.70.5',
    port: 5432,
    user: 'postgres',
    password: 'p0stmu7t1',
    database: 'claropr',
    ssl: false,
    connectionTimeoutMillis: 5000
});

async function checkSchema() {
    try {
        console.log('🔍 Checking schema for table "venta"...');
        const res = await pool.query(`
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'venta' AND column_name = 'numerocelularactivado';
        `);
        console.log('📋 Column Info:', res.rows);

        console.log('🔍 Checking indexes for "venta"...');
        const indexes = await pool.query(`
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'venta';
        `);
        console.log('📋 Indexes:', indexes.rows.map(r => r.indexdef).filter(def => def.includes('numerocelularactivado')));

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await pool.end();
    }
}

checkSchema();
