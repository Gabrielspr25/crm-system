// Script para ver estructura y diferencias entre venta y ventapyme
const { Pool } = require('pg');

const legacyPool = new Pool({
  host: '159.203.70.5',
  port: 5432,
  user: 'postgres',
  password: 'p0stmu7t1',
  database: 'claropr'
});

async function analizarVentapyme() {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║     ANÁLISIS: venta vs ventapyme (BD Legacy)            ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // 1. Estructura de ventapyme
    console.log('📋 ESTRUCTURA DE ventapyme:');
    console.log('='.repeat(80));
    const pymeStructure = await legacyPool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'ventapyme'
      ORDER BY ordinal_position
    `);
    console.table(pymeStructure.rows);

    // 2. Total registros
    const pymeTotalResult = await legacyPool.query('SELECT COUNT(*) FROM ventapyme');
    console.log(`\n📊 Total en ventapyme: ${pymeTotalResult.rows[0].count}`);

    const ventaTotalResult = await legacyPool.query('SELECT COUNT(*) FROM venta');
    console.log(`📊 Total en venta: ${ventaTotalResult.rows[0].count}`);

    // 3. Comparación: ventas en venta marcadas como pyme vs ventapyme
    const ventaPyme = await legacyPool.query(`
      SELECT COUNT(*) as count_pymes
      FROM venta v
      JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE cc.pyme = true
    `);
    console.log(`\n🏢 Ventas PYMES en tabla 'venta': ${ventaPyme.rows[0].count_pymes}`);

    // 4. Muestra de ventapyme
    console.log('\n🔍 MUESTRA DE 5 REGISTROS EN ventapyme:');
    console.log('='.repeat(80));
    const samplePyme = await legacyPool.query(`
      SELECT *
      FROM ventapyme
      ORDER BY ventapymeid DESC
      LIMIT 5
    `);
    console.table(samplePyme.rows);

    // 5. Ver si hay relación con venta
    console.log('\n🔗 VERIFICANDO RELACIÓN CON venta:');
    const relacionCheck = await legacyPool.query(`
      SELECT 
        column_name
      FROM information_schema.columns
      WHERE table_name = 'ventapyme'
        AND column_name IN ('ventaid', 'clientecreditoid', 'ban')
    `);
    console.log('Columnas comunes encontradas:', relacionCheck.rows.map(r => r.column_name));

    // 6. Distribución por año en ventapyme
    console.log('\n📅 DISTRIBUCIÓN POR AÑO en ventapyme:');
    console.log('='.repeat(80));
    const pymeByYear = await legacyPool.query(`
      SELECT 
        EXTRACT(YEAR FROM fechaactivacion) as anio,
        COUNT(*) as cantidad
      FROM ventapyme
      GROUP BY EXTRACT(YEAR FROM fechaactivacion)
      ORDER BY anio DESC
    `);
    console.table(pymeByYear.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('does not exist')) {
      console.log('\n⚠️  La tabla ventapyme no existe o no es accesible.');
      console.log('Las ventas PYMES probablemente se identifican via clientecredito.pyme = true');
    }
  } finally {
    await legacyPool.end();
  }
}

analizarVentapyme();
