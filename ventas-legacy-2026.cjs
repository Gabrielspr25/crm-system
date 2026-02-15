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
    console.log('║       VENTAS LEGACY: 1 ENERO 2026 - 4 FEBRERO 2026      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // Total ventas en el período
    const totalResult = await legacyPool.query(`
      SELECT COUNT(*) as total
      FROM venta
      WHERE fechaactivacion >= '2026-01-01'
        AND fechaactivacion <= '2026-02-04'
    `);
    
    console.log(`📊 TOTAL VENTAS: ${totalResult.rows[0].total}\n`);
    
    // Por vendedor
    const byVendor = await legacyPool.query(`
      SELECT 
        v.vendedorid,
        v.nombre as vendedor,
        COUNT(*) as cantidad_ventas,
        SUM(vt.comisionclaro) as comision_total,
        SUM(vt.subsidio) as subsidio_total
      FROM venta vt
      INNER JOIN vendedor v ON vt.vendedorid = v.vendedorid
      WHERE vt.fechaactivacion >= '2026-01-01'
        AND vt.fechaactivacion <= '2026-02-04'
      GROUP BY v.vendedorid, v.nombre
      ORDER BY cantidad_ventas DESC
    `);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('VENTAS POR VENDEDOR:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    byVendor.rows.forEach((row, i) => {
      console.log(`[${i + 1}] ${row.vendedor} (ID ${row.vendedorid})`);
      console.log(`    Ventas: ${row.cantidad_ventas}`);
      console.log(`    Comisión Claro: $${Number(row.comision_total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`);
      console.log(`    Subsidio: $${Number(row.subsidio_total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`);
      console.log('');
    });
    
    // Por tipo de producto (usando codigovoz)
    const byProduct = await legacyPool.query(`
      SELECT 
        CASE 
          WHEN codigovoz LIKE 'V%' THEN 'MÓVIL'
          WHEN codigovoz LIKE 'F%' THEN 'FIJO'
          WHEN codigovoz IS NULL THEN 'SIN CÓDIGO'
          ELSE 'OTRO'
        END as tipo_producto,
        COUNT(*) as cantidad
      FROM venta
      WHERE fechaactivacion >= '2026-01-01'
        AND fechaactivacion <= '2026-02-04'
      GROUP BY tipo_producto
      ORDER BY cantidad DESC
    `);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('POR TIPO DE PRODUCTO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    byProduct.rows.forEach(row => {
      console.log(`  ${row.tipo_producto}: ${row.cantidad} ventas`);
    });
    
    // Por fecha
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('POR DÍA:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const byDay = await legacyPool.query(`
      SELECT 
        DATE(fechaactivacion) as fecha,
        COUNT(*) as ventas
      FROM venta
      WHERE fechaactivacion >= '2026-01-01'
        AND fechaactivacion <= '2026-02-04'
      GROUP BY DATE(fechaactivacion)
      ORDER BY fecha DESC
      LIMIT 10
    `);
    
    byDay.rows.forEach(row => {
      const fecha = new Date(row.fecha);
      console.log(`  ${fecha.toLocaleDateString('es-ES')}: ${row.ventas} ventas`);
    });
    
    console.log('\n══════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await legacyPool.end();
  }
}

analyze();
