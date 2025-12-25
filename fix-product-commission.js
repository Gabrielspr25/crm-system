
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: 'crm_user',
  host: 'localhost',
  database: 'crm_pro',
  password: 'CRM_Seguro_2025!',
  port: 5432,
});

async function fixProduct() {
  console.log('🔧 Fixing Product Commission...');
  try {
    await pool.query('UPDATE products SET commission_percentage = 50.00 WHERE id = 6');
    console.log('✅ Updated Móvil Renovación to 50%');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

fixProduct();
