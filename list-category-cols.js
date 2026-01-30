import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!'
});

async function listCategoryColumns() {
    const client = await pool.connect();
    try {
        console.log('🔍 Esquema de tabla CATEGORIES:\n');
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'categories'
            ORDER BY ordinal_position;
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

listCategoryColumns();
