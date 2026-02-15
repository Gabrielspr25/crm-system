import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function findClientTypes() {
  try {
    // 1. Buscar columnas relacionadas con tipo
    console.log('\n=== COLUMNAS CON TIPO/CATEGORY ===');
    const cols = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns 
      WHERE table_name IN ('clients', 'bans', 'subscribers', 'products', 'plans')
      AND (
        column_name ILIKE '%tipo%' OR 
        column_name ILIKE '%type%' OR 
        column_name ILIKE '%category%' OR
        column_name ILIKE '%segmento%'
      )
      ORDER BY table_name, column_name
    `);
    console.log(cols.rows);

    // 2. Ver estructura de products (puede tener categorías)
    console.log('\n=== ESTRUCTURA DE PRODUCTS ===');
    const prods = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `);
    console.log(prods.rows);

    // 3. Ver muestra de products
    console.log('\n=== MUESTRA DE PRODUCTS (10 registros) ===');
    const sample = await pool.query(`SELECT * FROM products LIMIT 10`);
    console.log(JSON.stringify(sample.rows, null, 2));

    // 4. Ver estructura de plans
    console.log('\n=== ESTRUCTURA DE PLANS ===');
    const plans = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'plans'
      ORDER BY ordinal_position
    `);
    console.log(plans.rows);

    // 5. Ver valores distintos en products
    console.log('\n=== VALORES ÚNICOS EN PRODUCTS ===');
    const distinct = await pool.query(`
      SELECT DISTINCT product_tier, COUNT(*) as cantidad
      FROM products
      WHERE product_tier IS NOT NULL
      GROUP BY product_tier
      ORDER BY cantidad DESC
    `);
    console.log(distinct.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

findClientTypes();
