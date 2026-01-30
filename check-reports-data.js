import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro'
});

async function checkData() {
  try {
    // 1. Verificar productos
    const products = await pool.query('SELECT COUNT(*) FROM products');
    console.log('📦 Productos en BD:', products.rows[0].count);
    
    const productsList = await pool.query('SELECT id, name FROM products LIMIT 5');
    console.log('📦 Primeros 5 productos:', productsList.rows);

    // 2. Verificar ventas completadas
    const completed = await pool.query('SELECT COUNT(*) FROM follow_up_prospects WHERE completed_date IS NOT NULL');
    console.log('💰 Ventas completadas:', completed.rows[0].count);

    const completedList = await pool.query(`
      SELECT id, company_name, completed_date, fijo_ren, fijo_new, movil_nueva, movil_renovacion
      FROM follow_up_prospects 
      WHERE completed_date IS NOT NULL
      ORDER BY completed_date DESC
      LIMIT 5
    `);
    console.log('💰 Últimas 5 ventas completadas:', completedList.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkData();
