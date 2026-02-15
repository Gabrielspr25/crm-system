const { Pool } = require('pg');

// Legacy CORRECTO
const legacyPool = new Pool({
  host: '167.99.12.125',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'fF00JIRFXc'
});

async function generarTablaCompleta() {
  try {
    console.log('📊 TABLA COMPLETA VENTAS PYMES CON BAN\n');

    const query = `
      SELECT 
        v.ventaid,
        v.fechaactivacion,
        vd.nombre as vendedor,
        cc.nombre as cliente,
        vt.nombre as tipo_venta,
        v.ban,
        v.numerocelularactivado as telefono,
        v.comisionclaro,
        v.comisionvendedor,
        CASE WHEN v.fijo THEN 'FIJO' ELSE 'MOVIL' END as tipo_servicio
      FROM venta v
      LEFT JOIN ventatipo vt ON v.ventatipoid = vt.ventatipoid
      LEFT JOIN vendedor vd ON v.vendedorid = vd.vendedorid
      LEFT JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE v.ventatipoid IN (138, 139, 140, 141)
        AND v.activo = true
      ORDER BY vd.nombre, v.fechaactivacion DESC
    `;

    const result = await legacyPool.query(query);

    console.log(`Total de registros: ${result.rows.length}\n`);

    const tabla = result.rows.map((row, idx) => ({
      '#': idx + 1,
      VentaID: row.ventaid,
      Fecha: row.fechaactivacion?.toISOString().split('T')[0],
      Vendedor: row.vendedor || 'Sin vendedor',
      Cliente: row.cliente || 'N/A',
      BAN: row.ban || 'N/A',
      Telefono: row.telefono || 'N/A',
      TipoVenta: row.tipo_venta?.replace('PYMES ', ''),
      ComisionClaro: `$${parseFloat(row.comisionclaro || 0).toFixed(2)}`,
      ComisionVendedor: `$${parseFloat(row.comisionvendedor || 0).toFixed(2)}`,
      TipoServicio: row.tipo_servicio
    }));

    console.table(tabla);

    // Resumen por vendedor con totales
    console.log('\n📊 RESUMEN POR VENDEDOR:\n');
    const porVendedor = result.rows.reduce((acc, row) => {
      const vendedor = row.vendedor || 'Sin vendedor';
      if (!acc[vendedor]) {
        acc[vendedor] = {
          ventas: 0,
          comision_claro: 0,
          moviles: 0,
          fijas: 0
        };
      }
      acc[vendedor].ventas++;
      acc[vendedor].comision_claro += parseFloat(row.comisionclaro || 0);
      if (row.tipo_servicio === 'FIJO') {
        acc[vendedor].fijas++;
      } else {
        acc[vendedor].moviles++;
      }
      return acc;
    }, {});

    const resumen = Object.entries(porVendedor).map(([vendedor, stats]) => ({
      Vendedor: vendedor,
      TotalVentas: stats.ventas,
      Moviles: stats.moviles,
      Fijas: stats.fijas,
      ComisionClaro: `$${stats.comision_claro.toFixed(2)}`
    })).sort((a, b) => b.TotalVentas - a.TotalVentas);

    console.table(resumen);

    // Totales generales
    const totales = result.rows.reduce((acc, row) => {
      acc.comision_claro += parseFloat(row.comisionclaro || 0);
      acc.comision_vendedor += parseFloat(row.comisionvendedor || 0);
      return acc;
    }, { comision_claro: 0, comision_vendedor: 0 });

    console.log('\n💰 TOTALES GENERALES:');
    console.log(`   Total ventas: ${result.rows.length}`);
    console.log(`   Comisión Claro: $${totales.comision_claro.toFixed(2)}`);
    console.log(`   Comisión Vendedor: $${totales.comision_vendedor.toFixed(2)}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
  }
}

generarTablaCompleta();
