const { Pool } = require('pg');

const legacyPool = new Pool({
  host: '159.203.70.5',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'p0stmu7t1'
});

async function contarVentasPymes() {
  try {
    console.log('🔍 Contando ventas PYMES en Tango...\n');

    // PYMES ventatipoid: 138, 139, 140, 141
    const PYMES_TIPOS = [138, 139, 140, 141];

    const query = `
      SELECT 
        v.ventatipoid,
        vt.nombre as tipo_nombre,
        COUNT(*) as total_ventas,
        COUNT(CASE WHEN v.activo = true THEN 1 END) as activas,
        SUM(v.comisionclaro) as total_comision_claro,
        SUM(v.comisionvendedor) as total_comision_vendedor,
        MIN(v.fechaactivacion) as fecha_primera,
        MAX(v.fechaactivacion) as fecha_ultima
      FROM venta v
      LEFT JOIN ventatipo vt ON v.ventatipoid = vt.ventatipoid
      WHERE v.ventatipoid = ANY($1)
      GROUP BY v.ventatipoid, vt.nombre
      ORDER BY v.ventatipoid
    `;

    const result = await legacyPool.query(query, [PYMES_TIPOS]);

    console.log('📊 RESUMEN VENTAS PYMES:');
    console.log('='.repeat(100));
    console.table(result.rows);

    // Total general
    const totales = result.rows.reduce((acc, row) => {
      acc.total += parseInt(row.total_ventas);
      acc.activas += parseInt(row.activas);
      acc.comision_claro += parseFloat(row.total_comision_claro || 0);
      acc.comision_vendedor += parseFloat(row.total_comision_vendedor || 0);
      return acc;
    }, { total: 0, activas: 0, comision_claro: 0, comision_vendedor: 0 });

    console.log('\n💰 TOTALES GENERALES:');
    console.log(`  Total ventas: ${totales.total.toLocaleString()}`);
    console.log(`  Activas: ${totales.activas.toLocaleString()}`);
    console.log(`  Comisión Claro: $${totales.comision_claro.toFixed(2)}`);
    console.log(`  Comisión Vendedor: $${totales.comision_vendedor.toFixed(2)}`);

    // Distribución por año (últimos 3 años)
    console.log('\n📅 DISTRIBUCIÓN POR AÑO (PYMES):');
    const porAnoQuery = `
      SELECT 
        EXTRACT(YEAR FROM fechaactivacion) as ano,
        COUNT(*) as total_ventas,
        SUM(comisionclaro) as comision_claro
      FROM venta
      WHERE ventatipoid = ANY($1)
        AND activo = true
        AND fechaactivacion >= '2024-01-01'
      GROUP BY EXTRACT(YEAR FROM fechaactivacion)
      ORDER BY ano DESC
    `;

    const porAno = await legacyPool.query(porAnoQuery, [PYMES_TIPOS]);
    console.table(porAno.rows);

    // Sample de 5 ventas recientes
    console.log('\n📄 SAMPLE 5 VENTAS PYMES MÁS RECIENTES:');
    const sampleQuery = `
      SELECT 
        v.ventaid,
        v.fechaactivacion,
        vt.nombre as tipo,
        v.ban,
        v.numerocelularactivado,
        v.comisionclaro,
        v.comisionvendedor,
        v.activo
      FROM venta v
      LEFT JOIN ventatipo vt ON v.ventatipoid = vt.ventatipoid
      WHERE v.ventatipoid = ANY($1)
      ORDER BY v.fechaactivacion DESC
      LIMIT 5
    `;

    const sample = await legacyPool.query(sampleQuery, [PYMES_TIPOS]);
    console.table(sample.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await legacyPool.end();
  }
}

contarVentasPymes();
