
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'crm_pro',
    user: process.env.DB_USER || 'crm_user',
    password: process.env.DB_PASSWORD,
});

async function checkDuplicates() {
    try {
        console.log('Checking for duplicate clients...');
        const res = await pool.query(`
            SELECT lower(trim(name)) as normalized_name, count(*), array_agg(id) as ids, array_agg(name) as names
            FROM clients
            WHERE name IS NOT NULL
            GROUP BY lower(trim(name))
            HAVING count(*) > 1
        `);

        if (res.rows.length === 0) {
            console.log('No duplicate clients found based on normalized name.');
        } else {
            console.log(`Found ${res.rows.length} sets of duplicate clients:`);
            res.rows.forEach(row => {
                console.log(`- Name: "${row.normalized_name}"`);
                console.log(`  IDs: ${row.ids}`);
                console.log(`  Original Names: ${row.names}`);
            });
        }

        console.log('\nChecking for MR BLACK INC specifically...');
        const mrBlack = await pool.query(`
            SELECT id, name, salesperson_id, created_at FROM clients WHERE name ILIKE '%MR BLACK INC%'
        `);
        console.table(mrBlack.rows);

        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkDuplicates();
