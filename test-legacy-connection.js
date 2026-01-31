
import pg from 'pg';
const { Pool } = pg;

const remotePool = new Pool({
    host: '159.203.70.5',
    port: 5432,
    user: 'postgres',
    password: 'p0stmu7t1',
    database: 'claropr',
    connectionTimeoutMillis: 5000
});

async function testConnection() {
    console.log('Testing connection to 159.203.70.5...');
    try {
        const res = await remotePool.query('SELECT NOW()');
        console.log('Connection successful:', res.rows[0]);
    } catch (err) {
        console.error('Connection failed:', err.message);
    } finally {
        await remotePool.end();
    }
}

testConnection();
