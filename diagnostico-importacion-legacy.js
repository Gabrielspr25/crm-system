import pkg from 'pg';
const { Pool } = pkg;

// BD Legacy
const legacyPool = new Pool({
  host: '159.203.70.5',
  user: 'postgres',
  password: 'p0stmu7t1',
  database: 'claropr',
  port: 5432
});

// BD Actual (remoto)
const currentPool = new Pool({
  host: '143.244.191.139',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

async function diagnosticar() {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  DIAGNÓSTICO: MIGRACIÓN LEGACY → CRM_PRO                ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // 1. Contar ventas en legacy
    console.log('1️⃣  DATOS EN BD LEGACY (claropr/venta):');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const legacyCount = await legacyPool.query('SELECT COUNT(*) FROM venta');
    console.log(`   Total ventas: ${legacyCount.rows[0].count}`);
    
    // Obtener columnas de venta
    const ventaCols = await legacyPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'venta'
      ORDER BY ordinal_position
    `);
    console.log(`   Columnas disponibles: ${ventaCols.rows.length}`);
    console.log(`   Columnas clave: ${ventaCols.rows.slice(0, 10).map(c => c.column_name).join(', ')}...`);

    // Muestra de datos
    const sampleVenta = await legacyPool.query(`
      SELECT ban, codigovoz, meses, preciofinanciado, comisionarecibirclaro,
             numerocelularactivado, cliente
      FROM venta 
      WHERE ban IS NOT NULL 
      LIMIT 3
    `);
    console.log('\n   Muestra de datos legacy:');
    sampleVenta.rows.forEach((v, i) => {
      console.log(`   [${i+1}] BAN: ${v.ban} | Teléfono: ${v.numerocelularactivado || 'N/A'} | Cliente: ${v.cliente || 'N/A'}`);
    });

    // 2. Contar datos en CRM actual
    console.log('\n\n2️⃣  DATOS EN CRM_PRO ACTUAL:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const clientsCount = await currentPool.query('SELECT COUNT(*) FROM clients');
    console.log(`   Clientes: ${clientsCount.rows[0].count}`);
    
    const bansCount = await currentPool.query('SELECT COUNT(*) FROM bans');
    console.log(`   BANs: ${bansCount.rows[0].count}`);
    
    const subsCount = await currentPool.query('SELECT COUNT(*) FROM subscribers');
    console.log(`   Suscriptores: ${subsCount.rows[0].count}`);
    
    const reportsCount = await currentPool.query('SELECT COUNT(*) FROM subscriber_reports');
    console.log(`   Reportes generados: ${reportsCount.rows[0].count}`);

    // 3. Verificar datos sin completar
    console.log('\n\n3️⃣  ANÁLISIS DE DATOS INCOMPLETOS:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const subsWithoutMonthly = await currentPool.query(`
      SELECT COUNT(*) 
      FROM subscribers 
      WHERE monthly_value IS NULL OR monthly_value = 0
    `);
    console.log(`   ⚠️  Suscriptores SIN valor mensual: ${subsWithoutMonthly.rows[0].count}`);

    const subsWithoutActivation = await currentPool.query(`
      SELECT COUNT(*) 
      FROM subscribers 
      WHERE created_at IS NULL
    `);
    console.log(`   ⚠️  Suscriptores SIN fecha activación: ${subsWithoutActivation.rows[0].count}`);

    const subsInReports = await currentPool.query(`
      SELECT COUNT(DISTINCT s.id)
      FROM subscribers s
      JOIN bans b ON s.ban_id = b.id
      JOIN clients c ON b.client_id = c.id
      JOIN follow_up_prospects fup ON fup.client_id = c.id
      WHERE fup.completed_date IS NOT NULL
    `);
    console.log(`   ✓ Suscriptores que deberían estar en reportes: ${subsInReports.rows[0].count}`);

    const reportsWithMissing = await currentPool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE company_earnings IS NULL) as sin_company_earnings,
        COUNT(*) FILTER (WHERE vendor_commission IS NULL) as sin_comision,
        COUNT(*) FILTER (WHERE paid_amount IS NULL) as sin_monto_pagado
      FROM subscriber_reports
    `);
    const missing = reportsWithMissing.rows[0];
    console.log(`   ⚠️  Reportes sin company_earnings: ${missing.sin_company_earnings}`);
    console.log(`   ⚠️  Reportes sin vendor_commission: ${missing.sin_comision}`);
    console.log(`   ⚠️  Reportes sin paid_amount: ${missing.sin_monto_pagado}`);

    // 4. Comparar BAN específico
    console.log('\n\n4️⃣  COMPARACIÓN BAN ESPECÍFICO (719400825):');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const ventaLegacy = await legacyPool.query(`
      SELECT * FROM venta WHERE ban = '719400825' LIMIT 1
    `);
    
    if (ventaLegacy.rows.length > 0) {
      const v = ventaLegacy.rows[0];
      console.log('   LEGACY (venta):');
      console.log(`     BAN: ${v.ban}`);
      console.log(`     Teléfono: ${v.numerocelularactivado}`);
      console.log(`     Cliente: ${v.cliente}`);
      console.log(`     Código Voz: ${v.codigovoz}`);
      console.log(`     Meses: ${v.meses}`);
      console.log(`     Comisión: ${v.comisionarecibirclaro}`);
    } else {
      console.log('   ❌ BAN no encontrado en legacy');
    }

    const banActual = await currentPool.query(`
      SELECT b.*, s.phone, s.monthly_value, c.name as client_name
      FROM bans b
      LEFT JOIN subscribers s ON s.ban_id = b.id
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.ban_number = '719400825'
    `);

    if (banActual.rows.length > 0) {
      console.log('\n   ACTUAL (crm_pro):');
      banActual.rows.forEach((row, i) => {
        console.log(`     [${i+1}] BAN: ${row.ban_number}`);
        console.log(`         Cliente: ${row.client_name || 'N/A'}`);
        console.log(`         Teléfono: ${row.phone || 'N/A'}`);
        console.log(`         Valor mensual: $${row.monthly_value || 'N/A'}`);
      });
    } else {
      console.log('\n   ❌ BAN no encontrado en CRM actual');
    }

    console.log('\n\n════════════════════════════════════════════════════════════');
    console.log('✓ Diagnóstico completado');
    console.log('════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
    await currentPool.end();
  }
}

diagnosticar();
