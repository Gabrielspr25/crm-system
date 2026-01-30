
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '159.203.70.5',
    port: 5432,
    user: 'postgres',
    password: 'p0stmu7t1',
    database: 'celularinnovation',
    connectionTimeoutMillis: 5000
});

async function findColumns() {
    try {
        const columnsToFind = [
            'dealer_code', 'issue_date', 'subscriber_no', 'ban', 'imei', 'monthly_rate', 'price_plan',
            'subscriber_name', 'acc_type', 'dealer_name', 'operator_id', 'item_id', 'precio'
        ];

        console.log('--- Buscando columnas en celularinnovation ---');

        const res = await pool.query(`
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND column_name = ANY($1)
            ORDER BY table_name
        `, [columnsToFind]);

        const mapping = {};
        res.rows.forEach(r => {
            if (!mapping[r.table_name]) mapping[r.table_name] = [];
            mapping[r.table_name].push(r.column_name);
        });

        console.log(JSON.stringify(mapping, null, 2));

        await pool.end();
    } catch (err) {
        console.error('❌ ERROR:', err.message);
    }
}

findColumns();
