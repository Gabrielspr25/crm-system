const { Pool } = require('pg');

const legacyPool = new Pool({
  host: '167.99.12.125',
  port: 5432,
  user: 'postgres',
  password: 'fF00JIRFXc',
  database: 'claropr'
});

async function analyze() {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   VENTAS POR TIPO DE PLAN: 1 ENE 2026 - 4 FEB 2026      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // Ver estructura de tipoplan
    const tipoplanStructure = await legacyPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tipoplan'
      ORDER BY ordinal_position
    `);
    
    console.log('🔍 Columnas en tabla tipoplan:');
    tipoplanStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    // Ventas con tipo de plan
    const ventasPorTipo = await legacyPool.query(`
      SELECT 
        tp.tipoplanid,
        tp.nombre as tipo_plan,
        tp.codigovoz,
        COUNT(v.ventaid) as cantidad_ventas,
        SUM(v.comisionclaro) as comision_total,
        SUM(v.comisionvendedor) as comision_vendedor_total
      FROM venta v
      LEFT JOIN tipoplan tp ON v.codigovoz = tp.codigovoz
      WHERE v.fechaactivacion >= '2026-01-01'
        AND v.fechaactivacion <= '2026-02-04'
      GROUP BY tp.tipoplanid, tp.nombre, tp.codigovoz
      ORDER BY cantidad_ventas DESC
    `);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('VENTAS POR TIPO DE PLAN:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    let totalVentas = 0;
    ventasPorTipo.rows.forEach((row, i) => {
      totalVentas += parseInt(row.cantidad_ventas);
      const tipoPlan = row.tipo_plan || 'SIN TIPO DE PLAN';
      const codigo = row.codigovoz || 'N/A';
      
      console.log(`[${i + 1}] ${tipoPlan} (${codigo})`);
      console.log(`    Ventas: ${row.cantidad_ventas}`);
      console.log(`    Comisión Claro: $${Number(row.comision_total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`);
      console.log(`    Comisión Vendedor: $${Number(row.comision_vendedor_total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`);
      console.log('');
    });
    
    console.log(`📊 TOTAL: ${totalVentas} ventas\n`);
    
    // Ver top 10 planes más vendidos con nombre completo
    const topPlanes = await legacyPool.query(`
      SELECT 
        tp.nombre,
        tp.codigovoz,
        COUNT(v.ventaid) as ventas
      FROM venta v
      INNER JOIN tipoplan tp ON v.codigovoz = tp.codigovoz
      WHERE v.fechaactivacion >= '2026-01-01'
        AND v.fechaactivacion <= '2026-02-04'
      GROUP BY tp.nombre, tp.codigovoz
      ORDER BY ventas DESC
      LIMIT 10
    `);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TOP 10 PLANES MÁS VENDIDOS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    topPlanes.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.nombre} (${row.codigovoz}) - ${row.ventas} ventas`);
    });
    
    console.log('\n══════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await legacyPool.end();
  }
}

analyze();
