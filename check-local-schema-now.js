
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
    database: 'crm_pro'
});

async function checkSchema() {
    const tables = ['clients', 'bans', 'subscribers'];
    for (const table of tables) {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1
        `, [table]);
        console.log(`\nTable: ${table}`);
        console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
    }
    await pool.end();
}
checkSchema();
