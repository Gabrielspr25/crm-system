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
    console.log('║      VENTAS POR SEGMENTO: 1 ENE - 4 FEB 2026             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // Clasificar ventas por PYMES vs Corporativo/Consumer y tipo de servicio
    const ventasDetalladas = await legacyPool.query(`
      SELECT 
        CASE 
          WHEN cc.pyme = true THEN 'PYMES'
          ELSE 'CORPORATIVO/CONSUMER'
        END as segmento,
        CASE 
          WHEN v.fijo = true AND v.renovacion = false THEN 'Fijo NEW'
          WHEN v.fijo = true AND v.renovacion = true THEN 'Fijo REN'
          WHEN v.fijo = false AND v.renovacion = true THEN 'Móvil REN'
          WHEN v.fijo = false AND v.renovacion = false THEN 'Móvil NEW'
          ELSE 'Update/Otro'
        END as tipo_servicio,
        COUNT(*) as cantidad,
        SUM(v.comisionclaro) as comision_total,
        SUM(v.subsidio) as subsidio_total
      FROM venta v
      LEFT JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      WHERE v.fechaactivacion >= '2026-01-01'
        AND v.fechaactivacion <= '2026-02-04'
      GROUP BY segmento, tipo_servicio
      ORDER BY segmento, cantidad DESC
    `);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('VENTAS POR SEGMENTO Y TIPO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    let currentSegmento = '';
    let totalPorSegmento = {};
    
    ventasDetalladas.rows.forEach(row => {
      if (row.segmento !== currentSegmento) {
        if (currentSegmento !== '') {
          console.log(`  Subtotal: ${totalPorSegmento[currentSegmento]} ventas\n`);
        }
        currentSegmento = row.segmento;
        totalPorSegmento[currentSegmento] = 0;
        console.log(`🏢 ${row.segmento}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
      
      totalPorSegmento[currentSegmento] += parseInt(row.cantidad);
      
      console.log(`  📌 ${row.tipo_servicio}: ${row.cantidad} ventas`);
      console.log(`     Comisión: $${Number(row.comision_total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`);
      console.log(`     Subsidio: $${Number(row.subsidio_total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`);
      console.log('');
    });
    
    if (currentSegmento !== '') {
      console.log(`  Subtotal: ${totalPorSegmento[currentSegmento]} ventas\n`);
    }
    
    // Resumen final
    const totalGeneral = ventasDetalladas.rows.reduce((sum, row) => 
      sum + parseInt(row.cantidad), 0
    );
    
    console.log('══════════════════════════════════════════════════════════════');
    console.log(`📊 TOTAL GENERAL: ${totalGeneral} ventas\n`);
    
    // Matriz resumida
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('MATRIZ RESUMIDA:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const matriz = {};
    ventasDetalladas.rows.forEach(row => {
      if (!matriz[row.tipo_servicio]) {
        matriz[row.tipo_servicio] = { PYMES: 0, 'CORPORATIVO/CONSUMER': 0 };
      }
      matriz[row.tipo_servicio][row.segmento] = parseInt(row.cantidad);
    });
    
    console.log('                         PYMES    CORP/CONSUMER    TOTAL');
    console.log('─────────────────────────────────────────────────────────────');
    
    Object.keys(matriz).forEach(tipo => {
      const pymes = matriz[tipo].PYMES || 0;
      const corp = matriz[tipo]['CORPORATIVO/CONSUMER'] || 0;
      const total = pymes + corp;
      console.log(`${tipo.padEnd(20)} ${String(pymes).padStart(7)}  ${String(corp).padStart(13)}  ${String(total).padStart(7)}`);
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
