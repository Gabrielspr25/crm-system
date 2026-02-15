// Script para ver tipos de venta (ventatipo) y filtrar PYMES
const { Pool } = require('pg');

const legacyPool = new Pool({
  host: '159.203.70.5',
  port: 5432,
  user: 'postgres',
  password: 'p0stmu7t1',
  database: 'claropr'
});

async function verVentaTipos() {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║           TIPOS DE VENTA (ventatipo)                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // 1. Ver todos los tipos de venta
    console.log('📋 TODOS LOS TIPOS DE VENTA:');
    console.log('='.repeat(80));
    const allTypes = await legacyPool.query(`
      SELECT 
        ventatipoid,
        nombre,
        activo
      FROM ventatipo
      ORDER BY ventatipoid
    `);
    console.table(allTypes.rows);

    // 2. Buscar específicamente PYMES
    console.log('\n🏢 TIPOS DE VENTA PYMES:');
    console.log('='.repeat(80));
    const pymesTypes = await legacyPool.query(`
      SELECT 
        ventatipoid,
        nombre,
        activo
      FROM ventatipo
      WHERE LOWER(nombre) LIKE '%pyme%' 
        OR LOWER(nombre) LIKE '%sme%'
      ORDER BY ventatipoid
    `);
    
    if (pymesTypes.rows.length > 0) {
      console.table(pymesTypes.rows);
    } else {
      console.log('   No se encontraron tipos con "PYME" en el nombre\n');
    }

    // 3. Ver distribución de ventas por tipo
    console.log('\n📊 DISTRIBUCIÓN DE VENTAS POR TIPO (últimos 100):');
    console.log('='.repeat(80));
    const distribution = await legacyPool.query(`
      SELECT 
        vt.ventatipoid,
        vt.nombre as tipo_nombre,
        COUNT(*) as cantidad,
        SUM(v.comisionclaro) as total_comision
      FROM venta v
      JOIN ventatipo vt ON v.ventatipoid = vt.ventatipoid
      WHERE v.activo = true
      GROUP BY vt.ventatipoid, vt.nombre
      ORDER BY cantidad DESC
      LIMIT 20
    `);
    console.table(distribution.rows);

    // 4. Ver ventas PYMES específicamente
    console.log('\n🔍 VERIFICANDO VENTAS PYMES (campo fijo):');
    console.log('='.repeat(80));
    const pymesByFijo = await legacyPool.query(`
      SELECT 
        CASE WHEN v.fijo = true THEN 'FIJO' ELSE 'MÓVIL' END as tipo_servicio,
        COUNT(*) as cantidad,
        SUM(v.comisionclaro) as comision_total
      FROM venta v
      JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE cc.pyme = true
        AND v.activo = true
      GROUP BY v.fijo
      ORDER BY tipo_servicio
    `);
    
    if (pymesByFijo.rows.length > 0) {
      console.log('\n   Ventas PYMES identificadas por clientecredito.pyme:');
      console.table(pymesByFijo.rows);
    } else {
      console.log('   No hay ventas con clientecredito.pyme = true\n');
    }

    // 5. Ver muestra de ventas con ventatipoid
    console.log('\n🔍 MUESTRA DE 10 VENTAS CON TIPO:');
    console.log('='.repeat(80));
    const sampleWithType = await legacyPool.query(`
      SELECT 
        v.ventaid,
        v.ban,
        v.fechaactivacion,
        v.ventatipoid,
        vt.nombre as tipo_nombre,
        v.fijo,
        v.renovacion,
        cc.pyme,
        v.comisionclaro
      FROM venta v
      LEFT JOIN ventatipo vt ON v.ventatipoid = vt.ventatipoid
      LEFT JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE v.activo = true
      ORDER BY v.fechaactivacion DESC
      LIMIT 10
    `);
    console.table(sampleWithType.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await legacyPool.end();
    console.log('\n✅ Conexión cerrada\n');
  }
}

verVentaTipos();
