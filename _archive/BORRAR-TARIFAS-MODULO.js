import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  ssl: false
});

async function borrarTarifas() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Conectando a la base de datos remota...');
    console.log('⚠️  BORRANDO TODOS LOS DATOS DEL MÓDULO DE TARIFAS...\n');

    // Iniciar transacción
    await client.query('BEGIN');

    // 1. Borrar historial de planes
    const historyResult = await client.query('DELETE FROM plan_history');
    console.log(`🗑️  plan_history: ${historyResult.rowCount} registros eliminados`);

    // 2. Borrar beneficios (si existe)
    try {
      const benefitsResult = await client.query('DELETE FROM benefits');
      console.log(`🗑️  benefits: ${benefitsResult.rowCount} registros eliminados`);
    } catch (e) {
      console.log('ℹ️  benefits: tabla no existe o está vacía');
    }

    // 3. Borrar guías de venta (si existe)
    try {
      const guidesResult = await client.query('DELETE FROM sales_guides');
      console.log(`🗑️  sales_guides: ${guidesResult.rowCount} registros eliminados`);
    } catch (e) {
      console.log('ℹ️  sales_guides: tabla no existe o está vacía');
    }

    // 4. Borrar ofertas
    try {
      const offersResult = await client.query('DELETE FROM offers');
      console.log(`🗑️  offers: ${offersResult.rowCount} registros eliminados`);
    } catch (e) {
      console.log('ℹ️  offers: tabla no existe o está vacía');
    }

    // 5. Borrar planes
    const plansResult = await client.query('DELETE FROM plans');
    console.log(`🗑️  plans: ${plansResult.rowCount} registros eliminados`);

    // 6. Borrar categorías de planes
    const categoriesResult = await client.query('DELETE FROM plan_categories');
    console.log(`🗑️  plan_categories: ${categoriesResult.rowCount} registros eliminados`);

    // Confirmar transacción
    await client.query('COMMIT');
    
    console.log('\n✅ TODOS LOS DATOS DEL MÓDULO DE TARIFAS HAN SIDO ELIMINADOS');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

borrarTarifas();
