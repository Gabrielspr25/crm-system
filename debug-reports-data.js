
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: 'crm_user',
  host: 'localhost',
  database: 'crm_pro',
  password: 'CRM_Seguro_2025!',
  port: 5432,
});

async function debugData() {
  console.log('🔍 DEBUGGING REPORTS DATA...');

  try {
    // 1. Check Products
    console.log('\n📦 PRODUCTS (Name, Base Price, Commission %):');
    const productsRes = await pool.query('SELECT id, name, base_price, commission_percentage FROM products');
    console.table(productsRes.rows);

    // 2. Check Ogoyi Prospect
    console.log('\n👤 PROSPECT: OGOYI GROUP LLC');
    const ogoyiRes = await pool.query(`
      SELECT 
        id, company_name, 
        fijo_ren, fijo_new, movil_nueva, movil_renovacion, 
        claro_tv, cloud, mpls, 
        total_amount, is_completed 
      FROM follow_up_prospects 
      WHERE company_name ILIKE '%OGOYI%'
    `);
    console.table(ogoyiRes.rows);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

debugData();
