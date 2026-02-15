import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function showClientTypes() {
  try {
    // 1. Tipos de cuenta en BANs
    console.log('\n=== TIPOS DE CUENTA EN BANs ===');
    const accountTypes = await pool.query(`
      SELECT account_type, COUNT(*) as cantidad
      FROM bans
      WHERE account_type IS NOT NULL
      GROUP BY account_type
      ORDER BY cantidad DESC
    `);
    console.log(accountTypes.rows);

    // 2. Tipos de línea en Subscribers
    console.log('\n=== TIPOS DE LÍNEA EN SUBSCRIBERS ===');
    const lineTypes = await pool.query(`
      SELECT line_type, COUNT(*) as cantidad
      FROM subscribers
      WHERE line_type IS NOT NULL
      GROUP BY line_type
      ORDER BY cantidad DESC
    `);
    console.log(lineTypes.rows);

    // 3. Ver categorías de productos
    console.log('\n=== CATEGORÍAS DE PRODUCTOS ===');
    const categories = await pool.query(`
      SELECT c.id, c.name, COUNT(p.id) as productos
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id, c.name
      ORDER BY c.name
    `);
    console.log(categories.rows);

    // 4. Productos por categoría
    console.log('\n=== PRODUCTOS POR CATEGORÍA ===');
    const prodsByCat = await pool.query(`
      SELECT c.name as categoria, p.name as producto, p.commission_percentage
      FROM products p
      JOIN categories c ON c.id = p.category_id
      ORDER BY c.name, p.name
    `);
    console.log(prodsByCat.rows);

    // 5. Ver plan_categories
    console.log('\n=== CATEGORÍAS DE PLANES ===');
    const planCats = await pool.query(`
      SELECT * FROM plan_categories ORDER BY id
    `);
    console.log(planCats.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

showClientTypes();
