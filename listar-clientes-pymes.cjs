const { Pool } = require('pg');

// Legacy CORRECTO
const legacyPool = new Pool({
  host: '167.99.12.125',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'fF00JIRFXc'
});

async function listarClientesPymes() {
  try {
    console.log('📋 LISTADO COMPLETO DE VENTAS PYMES\n');

    const query = `
      SELECT 
        v.ventaid,
        v.fechaactivacion,
        vt.nombre as tipo_venta,
        v.ban,
        v.numerocelularactivado as telefono,
        cc.nombre as cliente_nombre,
        cc.apellido as cliente_apellido,
        vd.nombre as vendedor_nombre,
        v.comisionclaro,
        v.comisionvendedor,
        v.fijo
      FROM venta v
      LEFT JOIN ventatipo vt ON v.ventatipoid = vt.ventatipoid
      LEFT JOIN vendedor vd ON v.vendedorid = vd.vendedorid
      LEFT JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE v.ventatipoid IN (138, 139, 140, 141)
        AND v.activo = true
      ORDER BY v.fechaactivacion DESC
    `;

    const result = await legacyPool.query(query);

    console.log(`Total de ventas PYMES: ${result.rows.length}\n`);

    // Mostrar todas
    console.log('📄 LISTADO COMPLETO:');
    console.table(result.rows.map(r => ({
      ID: r.ventaid,
      Fecha: r.fechaactivacion?.toISOString().split('T')[0],
      Tipo: r.tipo_venta,
      BAN: r.ban,
      Telefono: r.telefono,
      Cliente: `${r.cliente_nombre || ''} ${r.cliente_apellido || ''}`.trim() || 'N/A',
      Vendedor: r.vendedor_nombre || 'N/A',
      ComisionClaro: `$${parseFloat(r.comisionclaro || 0).toFixed(2)}`,
      ComisionVendedor: `$${parseFloat(r.comisionvendedor || 0).toFixed(2)}`,
      Tipo_Servicio: r.fijo ? 'FIJO' : 'MOVIL'
    })));

    // Resumen por vendedor
    console.log('\n👤 RESUMEN POR VENDEDOR:');
    const porVendedor = result.rows.reduce((acc, row) => {
      const vendedor = row.vendedor_nombre || 'Sin vendedor';
      if (!acc[vendedor]) {
        acc[vendedor] = { ventas: 0, comision_claro: 0, comision_vendedor: 0 };
      }
      acc[vendedor].ventas++;
      acc[vendedor].comision_claro += parseFloat(row.comisionclaro || 0);
      acc[vendedor].comision_vendedor += parseFloat(row.comisionvendedor || 0);
      return acc;
    }, {});

    const vendedoresTable = Object.entries(porVendedor).map(([vendedor, stats]) => ({
      Vendedor: vendedor,
      Ventas: stats.ventas,
      ComisionClaro: `$${stats.comision_claro.toFixed(2)}`,
      ComisionVendedor: `$${stats.comision_vendedor.toFixed(2)}`
    }));
    console.table(vendedoresTable);

    // Resumen por tipo
    console.log('\n📊 RESUMEN POR TIPO DE VENTA:');
    const porTipo = result.rows.reduce((acc, row) => {
      const tipo = row.tipo_venta;
      if (!acc[tipo]) {
        acc[tipo] = { ventas: 0, comision_claro: 0 };
      }
      acc[tipo].ventas++;
      acc[tipo].comision_claro += parseFloat(row.comisionclaro || 0);
      return acc;
    }, {});

    const tiposTable = Object.entries(porTipo).map(([tipo, stats]) => ({
      Tipo: tipo,
      Ventas: stats.ventas,
      ComisionClaro: `$${stats.comision_claro.toFixed(2)}`
    }));
    console.table(tiposTable);

    // BANs únicos
    const bansUnicos = [...new Set(result.rows.map(r => r.ban).filter(Boolean))];
    console.log(`\n📞 Total BANs únicos: ${bansUnicos.length}`);
    console.log('Primeros 10 BANs:', bansUnicos.slice(0, 10).join(', '));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
  }
}

listarClientesPymes();
