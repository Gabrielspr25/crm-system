const { Pool } = require('pg');

// ✅ LEGACY CORRECTO
const legacyPool = new Pool({
  host: '167.99.12.125',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'fF00JIRFXc'
});

async function verificarPymesLegacy() {
  try {
    console.log('🔍 VERIFICANDO PYMES EN LEGACY CORRECTO (167.99.12.125)\n');

    // 1. Verificar que tipos 138-141 EXISTEN
    console.log('📋 1. TIPOS PYMES (138-141):');
    const tiposQuery = `
      SELECT 
        ventatipoid,
        nombre,
        activo
      FROM ventatipo
      WHERE ventatipoid IN (138, 139, 140, 141)
      ORDER BY ventatipoid
    `;
    const tipos = await legacyPool.query(tiposQuery);
    console.table(tipos.rows);

    if (tipos.rows.length === 0) {
      console.log('❌ Los tipos PYMES 138-141 NO EXISTEN en esta BD tampoco\n');
      
      // Mostrar el rango real
      const rangoQuery = `
        SELECT 
          MIN(ventatipoid) as min_id,
          MAX(ventatipoid) as max_id,
          COUNT(*) as total_tipos
        FROM ventatipo
      `;
      const rango = await legacyPool.query(rangoQuery);
      console.log('📊 Rango real de ventatipoid:');
      console.table(rango.rows);
      
      return;
    }

    // 2. Contar ventas PYMES
    console.log('\n📊 2. VENTAS PYMES:');
    const ventasQuery = `
      SELECT 
        v.ventatipoid,
        vt.nombre as tipo_nombre,
        COUNT(*) as total_ventas,
        COUNT(CASE WHEN v.activo = true THEN 1 END) as activas,
        SUM(v.comisionclaro) as comision_claro_total,
        MIN(v.fechaactivacion) as fecha_primera,
        MAX(v.fechaactivacion) as fecha_ultima
      FROM venta v
      LEFT JOIN ventatipo vt ON v.ventatipoid = vt.ventatipoid
      WHERE v.ventatipoid IN (138, 139, 140, 141)
      GROUP BY v.ventatipoid, vt.nombre
      ORDER BY v.ventatipoid
    `;
    const ventas = await legacyPool.query(ventasQuery);
    console.table(ventas.rows);

    // 3. Totales
    const totales = ventas.rows.reduce((acc, row) => {
      acc.total += parseInt(row.total_ventas || 0);
      acc.activas += parseInt(row.activas || 0);
      acc.comision += parseFloat(row.comision_claro_total || 0);
      return acc;
    }, { total: 0, activas: 0, comision: 0 });

    console.log('\n💰 TOTALES PYMES:');
    console.log(`  Total ventas: ${totales.total.toLocaleString()}`);
    console.log(`  Activas: ${totales.activas.toLocaleString()}`);
    console.log(`  Comisión Claro: $${totales.comision.toFixed(2)}`);

    // 4. Sample
    if (totales.total > 0) {
      console.log('\n📄 SAMPLE 5 VENTAS PYMES:');
      const sampleQuery = `
        SELECT 
          v.ventaid,
          v.fechaactivacion,
          vt.nombre as tipo,
          v.ban,
          v.numerocelularactivado,
          v.comisionclaro,
          v.fijo
        FROM venta v
        LEFT JOIN ventatipo vt ON v.ventatipoid = vt.ventatipoid
        WHERE v.ventatipoid IN (138, 139, 140, 141)
        ORDER BY v.fechaactivacion DESC
        LIMIT 5
      `;
      const sample = await legacyPool.query(sampleQuery);
      console.table(sample.rows);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
  }
}

verificarPymesLegacy();
