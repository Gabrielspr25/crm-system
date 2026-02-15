const { Pool } = require('pg');

const legacyPool = new Pool({
  host: '159.203.70.5',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'p0stmu7t1'
});

async function explorarPymes() {
  try {
    console.log('🔍 EXPLORANDO FORMAS DE IDENTIFICAR PYMES EN TANGO\n');

    // 1. Explorar tabla clientecredito - ver columnas relacionadas
    console.log('📋 1. COLUMNAS EN clientecredito:');
    const colsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'clientecredito' 
      ORDER BY ordinal_position
    `;
    const cols = await legacyPool.query(colsQuery);
    console.table(cols.rows);

    // 2. Buscar clientes con campo pyme
    console.log('\n📊 2. ANÁLISIS DE CAMPO PYME:');
    const pymeStatsQuery = `
      SELECT 
        pyme,
        COUNT(*) as total_clientes,
        COUNT(CASE WHEN cc.clientecreditoid IN (
          SELECT DISTINCT clientecreditoid FROM venta WHERE activo = true
        ) THEN 1 END) as con_ventas_activas
      FROM clientecredito cc
      GROUP BY pyme
    `;
    const pymeStats = await legacyPool.query(pymeStatsQuery);
    console.table(pymeStats.rows);

    // 3. Si hay PYMES (pyme=true), contar sus ventas
    console.log('\n📊 3. VENTAS DE CLIENTES PYMES (pyme=true):');
    const ventasPymesQuery = `
      SELECT 
        COUNT(v.ventaid) as total_ventas,
        COUNT(CASE WHEN v.activo = true THEN 1 END) as ventas_activas,
        SUM(v.comisionclaro) as comision_claro_total,
        SUM(v.comisionvendedor) as comision_vendedor_total,
        COUNT(DISTINCT v.clientecreditoid) as clientes_unicos,
        MIN(v.fechaactivacion) as fecha_primera,
        MAX(v.fechaactivacion) as fecha_ultima
      FROM venta v
      INNER JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE cc.pyme = true
    `;
    const ventasPymes = await legacyPool.query(ventasPymesQuery);
    console.table(ventasPymes.rows);

    // 4. Sample de 10 ventas PYMES
    console.log('\n📄 4. SAMPLE 10 VENTAS PYMES (pyme=true):');
    const samplePymesQuery = `
      SELECT 
        v.ventaid,
        v.fechaactivacion,
        v.ban,
        cc.nombre,
        v.comisionclaro,
        v.comisionvendedor,
        v.activo
      FROM venta v
      INNER JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE cc.pyme = true
      ORDER BY v.fechaactivacion DESC
      LIMIT 10
    `;
    const samplePymes = await legacyPool.query(samplePymesQuery);
    console.table(samplePymes.rows);

    // 5. Distribución por año
    console.log('\n📅 5. DISTRIBUCIÓN VENTAS PYMES POR AÑO:');
    const porAnoQuery = `
      SELECT 
        EXTRACT(YEAR FROM v.fechaactivacion) as ano,
        COUNT(*) as total_ventas,
        SUM(v.comisionclaro) as comision_claro
      FROM venta v
      INNER JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE cc.pyme = true
        AND v.activo = true
      GROUP BY EXTRACT(YEAR FROM v.fechaactivacion)
      ORDER BY ano DESC
    `;
    const porAno = await legacyPool.query(porAnoQuery);
    console.table(porAno.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
  }
}

explorarPymes();
