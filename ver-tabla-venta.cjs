// Script para ver estructura completa y datos de muestra de tabla venta
const { Client } = require('pg');

const legacyDB = {
  host: '159.203.70.5',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'p0stmu7t1'
};

async function verTablaVenta() {
  const client = new Client(legacyDB);
  
  try {
    await client.connect();
    console.log('✅ Conectado a BD Legacy Tango\n');

    // 1. Ver estructura de la tabla
    console.log('📋 ESTRUCTURA DE LA TABLA venta:');
    console.log('='.repeat(80));
    const structure = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'venta'
      ORDER BY ordinal_position
    `);
    
    console.table(structure.rows);

    // 2. Ver total de registros
    const countResult = await client.query('SELECT COUNT(*) as total FROM venta');
    console.log(`\n📊 Total registros: ${countResult.rows[0].total}`);

    // 3. Ver registros activos
    const activeResult = await client.query(`
      SELECT COUNT(*) as activos 
      FROM venta 
      WHERE activo = true
    `);
    console.log(`✅ Activos: ${activeResult.rows[0].activos}`);

    // 4. Ver muestra de 5 ventas recientes
    console.log('\n🔍 MUESTRA DE 5 VENTAS RECIENTES:');
    console.log('='.repeat(80));
    const sample = await client.query(`
      SELECT 
        ventaid,
        clientecreditoid,
        vendedorid,
        fechaactivacion,
        ban,
        numerocelularactivado,
        comisionclaro,
        comisionvendedor,
        codigovoz,
        activo
      FROM venta
      WHERE activo = true
      ORDER BY fechaactivacion DESC
      LIMIT 5
    `);
    
    console.table(sample.rows);

    // 5. Ver distribución por años
    console.log('\n📅 DISTRIBUCIÓN POR AÑO:');
    console.log('='.repeat(80));
    const byYear = await client.query(`
      SELECT 
        EXTRACT(YEAR FROM fechaactivacion) as anio,
        COUNT(*) as cantidad,
        SUM(comisionclaro) as total_claro,
        SUM(comisionvendedor) as total_vendedor
      FROM venta
      WHERE activo = true
      GROUP BY EXTRACT(YEAR FROM fechaactivacion)
      ORDER BY anio DESC
    `);
    
    console.table(byYear.rows);

    // 6. Ver ventas con BAN vs sin BAN
    console.log('\n📞 DISTRIBUCIÓN BAN / TELÉFONO:');
    console.log('='.repeat(80));
    const banStats = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE ban IS NOT NULL AND ban != '') as con_ban,
        COUNT(*) FILTER (WHERE ban IS NULL OR ban = '') as sin_ban,
        COUNT(*) FILTER (WHERE numerocelularactivado IS NOT NULL) as con_telefono,
        COUNT(*) FILTER (WHERE numerocelularactivado IS NULL) as sin_telefono
      FROM venta
      WHERE activo = true
    `);
    
    console.table(banStats.rows);

    // 7. Ver vendedores con más ventas
    console.log('\n👥 TOP 10 VENDEDORES:');
    console.log('='.repeat(80));
    const topVendors = await client.query(`
      SELECT 
        v.vendedorid,
        vd.nombre as vendedor_nombre,
        COUNT(*) as ventas,
        SUM(v.comisionclaro) as total_comision_claro,
        SUM(v.comisionvendedor) as total_comision_vendedor
      FROM venta v
      LEFT JOIN vendedor vd ON v.vendedorid = vd.vendedorid
      WHERE v.activo = true
      GROUP BY v.vendedorid, vd.nombre
      ORDER BY ventas DESC
      LIMIT 10
    `);
    
    console.table(topVendors.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Conexión cerrada');
  }
}

verTablaVenta();
