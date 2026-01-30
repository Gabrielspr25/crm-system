
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

async function describeTable(tableName) {
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);
        console.log(`\n--- TABLE: ${tableName} ---`);
        console.table(res.rows);
    } finally {
        client.release();
        await pool.end();
    }
}

const table = process.argv[2] || 'subscribers';
describeTable(table);
