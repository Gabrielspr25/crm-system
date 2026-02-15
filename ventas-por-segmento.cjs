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
    console.log('║     ANÁLISIS VENTAS POR SEGMENTO Y TIPO (ENE-FEB 2026)    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // Clasificar ventas por tipo
    const ventasPorTipo = await legacyPool.query(`
      SELECT 
        CASE 
          WHEN fijo = true AND renovacion = false THEN 'Fijo NEW'
          WHEN fijo = true AND renovacion = true THEN 'Fijo REN'
          WHEN fijo = false AND renovacion = true THEN 'Móvil REN'
          WHEN fijo = false AND renovacion = false THEN 'Móvil NEW'
          ELSE 'Otro'
        END as tipo_servicio,
        COUNT(*) as cantidad,
        SUM(comisionclaro) as comision_total,
        SUM(subsidio) as subsidio_total
      FROM venta
      WHERE fechaactivacion >= '2026-01-01'
        AND fechaactivacion <= '2026-02-04'
      GROUP BY tipo_servicio
      ORDER BY cantidad DESC
    `);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('POR TIPO DE SERVICIO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    let totalGeneral = 0;
    ventasPorTipo.rows.forEach(row => {
      totalGeneral += parseInt(row.cantidad);
      console.log(`📌 ${row.tipo_servicio}`);
      console.log(`   Ventas: ${row.cantidad}`);
      console.log(`   Comisión: $${Number(row.comision_total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`);
      console.log(`   Subsidio: $${Number(row.subsidio_total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`);
      console.log('');
    });
    
    console.log(`TOTAL: ${totalGeneral} ventas\n`);
    
    // Buscar si hay tabla de segmentos o clientes
    const tables = await legacyPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%cliente%'
        OR table_name LIKE '%segmento%'
        OR table_name LIKE '%pyme%'
        OR table_name LIKE '%corp%'
      ORDER BY table_name
    `);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TABLAS RELACIONADAS CON CLIENTES/SEGMENTOS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    tables.rows.forEach(t => {
      console.log(`  - ${t.table_name}`);
    });
    
    // Ver estructura de clientecredito para ver si tiene segmento
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('COLUMNAS EN clientecredito:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const clienteColumns = await legacyPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'clientecredito'
      ORDER BY ordinal_position
    `);
    
    clienteColumns.rows.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type})`);
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
