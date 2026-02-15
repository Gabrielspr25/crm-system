
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: '159.203.70.5',
    port: 5432,
    user: 'postgres',
    password: 'p0stmu7t1',
    database: 'claropr',
    ssl: false,
    connectionTimeoutMillis: 10000
});

async function addIndex() {
    try {
        console.log('🚀 Connecting to remote DB (159.203.70.5)...');
        // Check if index exists first
        const check = await pool.query(`
            SELECT indexname FROM pg_indexes 
            WHERE tablename = 'venta' AND indexname = 'idx_venta_numerocelularactivado';
        `);

        if (check.rows.length > 0) {
            console.log('✅ Index "idx_venta_numerocelularactivado" already exists.');
        } else {
            console.log('⏳ Creating index concurrently (this might take a while)...');
            const startTime = Date.now();
            await pool.query(`
                CREATE INDEX CONCURRENTLY idx_venta_numerocelularactivado 
                ON venta (numerocelularactivado);
            `);
            const duration = (Date.now() - startTime) / 1000;
            console.log(`✅ Index created successfully in ${duration} seconds!`);
        }

    } catch (err) {
        console.error('❌ Error creating index:', err);
    } finally {
        await pool.end();
    }
}

addIndex();
