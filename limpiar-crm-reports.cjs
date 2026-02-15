const { Pool } = require('pg');

// CRM Producción
const crmPool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});

// CONFIG
const DRY_RUN = false;  // ← BORRADO REAL ACTIVADO

async function limpiarCRM() {
  try {
    console.log('🗑️  LIMPIEZA DE subscriber_reports\n');
    console.log(`Modo: ${DRY_RUN ? '🔍 DRY RUN (solo análisis)' : '⚠️  ELIMINACIÓN REAL'}\n`);

    // 1. Ver schema de subscriber_reports
    console.log('📋 SCHEMA de subscriber_reports:');
    const schemaQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'subscriber_reports'
      ORDER BY ordinal_position
    `;
    const schema = await crmPool.query(schemaQuery);
    console.table(schema.rows);

    // 2. Contar registros
    const countQuery = `SELECT COUNT(*) as total FROM subscriber_reports`;
    const count = await crmPool.query(countQuery);
    const total = parseInt(count.rows[0].total);

    console.log(`\n📊 Total de registros a eliminar: ${total}`);

    if (total === 0) {
      console.log('\n✅ La tabla ya está vacía. No hay nada que borrar.');
      return;
    }

    // 3. Sample de lo que se va a borrar
    console.log('\n📄 SAMPLE DE LO QUE SE BORRARÁ:');
    const sampleQuery = `
      SELECT * FROM subscriber_reports
      LIMIT 5
    `;
    const sample = await crmPool.query(sampleQuery);
    console.table(sample.rows);

    // 4. Ejecutar borrado (si no es DRY RUN)
    if (!DRY_RUN) {
      console.log('\n⚠️  EJECUTANDO BORRADO...');
      
      const deleteQuery = `TRUNCATE TABLE subscriber_reports RESTART IDENTITY CASCADE`;
      await crmPool.query(deleteQuery);
      
      console.log('✅ BORRADO COMPLETADO');
      
      // Verificar
      const verifyQuery = `SELECT COUNT(*) as total FROM subscriber_reports`;
      const verify = await crmPool.query(verifyQuery);
      console.log(`\n📊 Registros restantes: ${verify.rows[0].total}`);
      
    } else {
      console.log('\n🔍 DRY RUN - No se eliminó nada');
      console.log('   Para ejecutar borrado real, cambia DRY_RUN = false en el script');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await crmPool.end();
  }
}

limpiarCRM();
