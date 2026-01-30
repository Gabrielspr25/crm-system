
import pg from 'pg';

async function check() {
    const pool = new pg.Pool({
        host: '143.244.191.139',
        port: 5432,
        database: 'crm_pro',
        user: 'crm_user',
        password: 'CRM_Seguro_2025!',
        ssl: false
    });
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'follow_up_prospects'
    `);
        console.log('Follow Up Prospects:');
        console.table(res.rows);

        const res2 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'call_logs'
    `);
        console.log('\nCall Logs:');
        console.table(res2.rows);

    } finally {
        client.release();
        await pool.end();
    }
}
check();
