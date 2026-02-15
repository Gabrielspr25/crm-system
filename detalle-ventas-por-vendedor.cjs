const { Pool } = require('pg');

// Legacy CORRECTO
const legacyPool = new Pool({
  host: '167.99.12.125',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'fF00JIRFXc'
});

async function detalleVentasPorVendedor() {
  try {
    console.log('📊 DETALLE DE VENTAS PYMES POR VENDEDOR\n');

    const query = `
      SELECT 
        vd.nombre as vendedor,
        v.ventaid,
        v.fechaactivacion,
        cc.nombre as cliente,
        vt.nombre as tipo_venta,
        v.ban,
        v.numerocelularactivado as telefono,
        v.comisionclaro,
        v.comisionvendedor,
        v.fijo
      FROM venta v
      LEFT JOIN ventatipo vt ON v.ventatipoid = vt.ventatipoid
      LEFT JOIN vendedor vd ON v.vendedorid = vd.vendedorid
      LEFT JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE v.ventatipoid IN (138, 139, 140, 141)
        AND v.activo = true
      ORDER BY vd.nombre, v.fechaactivacion DESC
    `;

    const result = await legacyPool.query(query);

    // Agrupar por vendedor
    const porVendedor = result.rows.reduce((acc, row) => {
      const vendedor = row.vendedor || 'Sin vendedor';
      if (!acc[vendedor]) {
        acc[vendedor] = [];
      }
      acc[vendedor].push(row);
      return acc;
    }, {});

    // Mostrar por cada vendedor
    Object.entries(porVendedor).forEach(([vendedor, ventas]) => {
      console.log(`\n${'='.repeat(100)}`);
      console.log(`👤 VENDEDOR: ${vendedor}`);
      console.log(`   Total ventas: ${ventas.length}`);
      
      const totalClaro = ventas.reduce((sum, v) => sum + parseFloat(v.comisionclaro || 0), 0);
      const totalVendedor = ventas.reduce((sum, v) => sum + parseFloat(v.comisionvendedor || 0), 0);
      
      console.log(`   Comisión Claro: $${totalClaro.toFixed(2)}`);
      console.log(`   Comisión Vendedor: $${totalVendedor.toFixed(2)}`);
      console.log(`${'='.repeat(100)}\n`);

      // Tabla de ventas del vendedor
      const tablaVentas = ventas.map((v, idx) => ({
        '#': idx + 1,
        VentaID: v.ventaid,
        Fecha: v.fechaactivacion?.toISOString().split('T')[0],
        Cliente: v.cliente?.substring(0, 35) || 'N/A',
        TipoVenta: v.tipo_venta?.replace('PYMES ', '') || '',
        BAN: v.ban,
        Telefono: v.telefono || 'N/A',
        ComisionClaro: `$${parseFloat(v.comisionclaro || 0).toFixed(2)}`,
        ComisionVendedor: `$${parseFloat(v.comisionvendedor || 0).toFixed(2)}`,
        Servicio: v.fijo ? 'FIJO' : 'MOVIL'
      }));

      console.table(tablaVentas);
    });

    // Resumen final
    console.log(`\n${'='.repeat(100)}`);
    console.log('📊 RESUMEN GLOBAL');
    console.log(`${'='.repeat(100)}\n`);

    const resumenGlobal = Object.entries(porVendedor).map(([vendedor, ventas]) => {
      const totalClaro = ventas.reduce((sum, v) => sum + parseFloat(v.comisionclaro || 0), 0);
      const totalVendedor = ventas.reduce((sum, v) => sum + parseFloat(v.comisionvendedor || 0), 0);
      
      return {
        Vendedor: vendedor,
        TotalVentas: ventas.length,
        ComisionClaro: `$${totalClaro.toFixed(2)}`,
        ComisionVendedor: `$${totalVendedor.toFixed(2)}`,
        Moviles: ventas.filter(v => !v.fijo).length,
        Fijas: ventas.filter(v => v.fijo).length
      };
    }).sort((a, b) => b.TotalVentas - a.TotalVentas);

    console.table(resumenGlobal);

    const totalGeneral = result.rows.reduce((acc, row) => {
      acc.comisionClaro += parseFloat(row.comisionclaro || 0);
      acc.comisionVendedor += parseFloat(row.comisionvendedor || 0);
      return acc;
    }, { comisionClaro: 0, comisionVendedor: 0 });

    console.log(`\n💰 TOTAL GENERAL:`);
    console.log(`   Total ventas: ${result.rows.length}`);
    console.log(`   Comisión Claro: $${totalGeneral.comisionClaro.toFixed(2)}`);
    console.log(`   Comisión Vendedor: $${totalGeneral.comisionVendedor.toFixed(2)}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
  }
}

detalleVentasPorVendedor();
