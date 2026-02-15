const { Pool } = require('pg');
const fs = require('fs');

// Legacy CORRECTO
const legacyPool = new Pool({
  host: '167.99.12.125',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'fF00JIRFXc'
});

async function exportarConBan() {
  try {
    console.log('📊 EXPORTANDO VENTAS PYMES CON BAN\n');

    const query = `
      SELECT 
        v.ventaid,
        v.fechaactivacion,
        vd.nombre as vendedor,
        cc.nombre as cliente,
        v.ban,
        v.numerocelularactivado as telefono,
        v.comisionclaro,
        v.comisionvendedor,
        CASE WHEN v.fijo THEN 'FIJO' ELSE 'MOVIL' END as tipo_servicio
      FROM venta v
      LEFT JOIN vendedor vd ON v.vendedorid = vd.vendedorid
      LEFT JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE v.ventatipoid IN (138, 139, 140, 141)
        AND v.activo = true
      ORDER BY vd.nombre, v.fechaactivacion DESC
    `;

    const result = await legacyPool.query(query);

    // 1. Crear CSV
    const csvLines = [
      'VentaID,Fecha,Vendedor,Cliente,BAN,Telefono,ComisionClaro,ComisionVendedor,TipoServicio'
    ];

    result.rows.forEach(row => {
      const line = [
        row.ventaid,
        row.fechaactivacion?.toISOString().split('T')[0] || '',
        (row.vendedor || 'Sin vendedor').replace(/,/g, ' '),
        (row.cliente || 'N/A').replace(/,/g, ' '),
        row.ban || 'N/A',
        row.telefono || 'N/A',
        parseFloat(row.comisionclaro || 0).toFixed(2),
        parseFloat(row.comisionvendedor || 0).toFixed(2),
        row.tipo_servicio
      ].join(',');
      csvLines.push(line);
    });

    const csvContent = csvLines.join('\n');
    fs.writeFileSync('ventas-pymes-con-ban.csv', csvContent);
    console.log('✅ Archivo CSV creado: ventas-pymes-con-ban.csv\n');

    // 2. Mostrar tabla simple con BAN destacado
    console.log('📋 LISTADO CON BAN (formato simple):\n');
    console.log('='.repeat(120));
    console.log('ID    | Fecha       | Vendedor         | Cliente (primeros 25 chars)  | **BAN**     | Teléfono     | Com.Claro');
    console.log('='.repeat(120));

    result.rows.forEach(row => {
      const id = row.ventaid.toString().padEnd(5);
      const fecha = (row.fechaactivacion?.toISOString().split('T')[0] || '').padEnd(11);
      const vendedor = (row.vendedor || 'N/A').substring(0, 16).padEnd(16);
      const cliente = (row.cliente || 'N/A').substring(0, 28).padEnd(28);
      const ban = (row.ban || 'N/A').padEnd(11);
      const telefono = (row.telefono || 'N/A').padEnd(12);
      const comision = `$${parseFloat(row.comisionclaro || 0).toFixed(2)}`.padStart(10);

      console.log(`${id} | ${fecha} | ${vendedor} | ${cliente} | ${ban} | ${telefono} | ${comision}`);
    });

    console.log('='.repeat(120));

    // 3. BANs únicos
    const bansUnicos = [...new Set(result.rows.map(r => r.ban).filter(Boolean))];
    console.log('\n📞 BANS ÚNICOS ENCONTRADOS:');
    bansUnicos.forEach((ban, idx) => {
      const ventas = result.rows.filter(r => r.ban === ban).length;
      console.log(`   ${idx + 1}. ${ban} - ${ventas} ventas`);
    });

    console.log(`\n✅ Total de ventas: ${result.rows.length}`);
    console.log(`✅ Total BANs únicos: ${bansUnicos.length}`);
    console.log(`✅ Archivo exportado: ventas-pymes-con-ban.csv`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
  }
}

exportarConBan();
