
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!',
    ssl: false
});

async function debugCalculations() {
    try {
        console.log('--- DEBUGGING MR BLACK INC CALCULATIONS ---');

        // 1. Client
        const clientRes = await pool.query("SELECT id, name FROM clients WHERE name ILIKE '%MR BLACK INC%'");
        if (clientRes.rows.length === 0) { console.log('Client not found'); return; }
        const clientId = clientRes.rows[0].id;
        console.log(`Client: ${clientRes.rows[0].name} (${clientId})`);

        // 2. Subscribers
        const subs = await pool.query(`
            SELECT s.phone, s.monthly_value, s.line_type, s.plan, b.account_type
            FROM subscribers s
            JOIN bans b ON s.ban_id = b.id
            WHERE b.client_id = $1
        `, [clientId]);
        console.log(`\nSubscribers (${subs.rows.length}):`);
        console.table(subs.rows);

        // 3. Products
        const products = await pool.query("SELECT id, name FROM products WHERE name ILIKE '%Movil%'");
        console.log('\nMobile Products:');
        console.table(products.rows);
        const productIds = products.rows.map(p => p.id);

        // 4. Tiers
        if (productIds.length > 0) {
            const tiers = await pool.query(`
                SELECT t.product_id, p.name as product_name, t.range_min, t.range_max, t.commission_amount 
                FROM product_commission_tiers t
                JOIN products p ON t.product_id = p.id
                WHERE t.product_id = ANY($1::uuid[])
                ORDER BY p.name, t.range_min
            `, [productIds]);
            console.log('\nCommission Tiers:');
            console.table(tiers.rows);
        }

        pool.end();
    } catch (e) { console.error(e); pool.end(); }
}

debugCalculations();
