
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
    ssl: false
});

async function listTables() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
        console.log('Tables in Remote DB:');
        console.table(res.rows);
    } finally {
        client.release();
        await pool.end();
    }
}
listTables();
