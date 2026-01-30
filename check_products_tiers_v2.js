
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

async function checkProducts() {
    try {
        console.log('--- Checking Products ---');
        const products = await pool.query('SELECT * FROM products WHERE name ILIKE \'%Movil%\'');

        if (products.rows.length > 0) {
            const ids = products.rows.map(p => p.id);
            console.log('--- Checking Product Commission Tiers ---');
            const tiers = await pool.query('SELECT * FROM product_commission_tiers WHERE product_id = ANY($1::uuid[])', [ids]);
            console.table(tiers.rows);
        }

        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkProducts();
