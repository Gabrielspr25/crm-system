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

async function migrarReportesLegacy() {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  MIGRAR REPORTES: Legacy VENTA → subscriber_reports     ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // 1. Buscar BANs que existan en AMBAS bases
    console.log('1️⃣  Buscando BANs comunes entre Legacy y CRM...\n');
    
    const currentBans = await currentPool.query(`
      SELECT DISTINCT b.ban_number 
      FROM bans b
      WHERE b.ban_number IS NOT NULL
      ORDER BY b.ban_number
      LIMIT 100
    `);
    
    console.log(`   BANs en CRM actual: ${currentBans.rows.length} (muestra de 100)`);
    
    // Tomar los primeros 10 para prueba
    const bansToCheck = currentBans.rows.slice(0, 10).map(r => r.ban_number);
    console.log(`\n   Verificando primeros 10 BANs en legacy...`);
    
    let matches = [];
    for (const ban of bansToCheck) {
      const legacyCheck = await legacyPool.query(
        `SELECT ban FROM venta WHERE ban = $1 LIMIT 1`,
        [ban]
      );
      
      if (legacyCheck.rows.length > 0) {
        matches.push(ban);
        process.stdout.write(`\r   ✓ Matches encontrados: ${matches.length}`);
      }
    }
    
    console.log(`\n\n   Total matches: ${matches.length}/${bansToCheck.length}\n`);
    
    if (matches.length === 0) {
      console.log('   ⚠️  NO hay BANs comunes en la muestra.');
      console.log('   Esto significa que los BANs en CRM son NUEVOS, no vienen del legacy.\n');
      
      // Verificar schema de bans
      console.log('   📋 Verificando origen de datos en CRM...\n');
      
      const sampleBans = await currentPool.query(`
        SELECT b.ban_number, c.name as client_name, c.created_at,
               COUNT(s.id) as subs_count
        FROM bans b
        JOIN clients c ON b.client_id = c.id
        LEFT JOIN subscribers s ON s.ban_id = b.id
        GROUP BY b.ban_number, c.name, c.created_at
        ORDER BY c.created_at DESC
        LIMIT 5
      `);
      
      console.log('   BANs más recientes en CRM:');
      sampleBans.rows.forEach(r => {
        console.log(`     • BAN ${r.ban_number} | Cliente: ${r.client_name}`);
        console.log(`       Creado: ${r.created_at} | Suscriptores: ${r.subs_count}`);
      });
      
      console.log('\n\n   ❓ PREGUNTA:');
      console.log('   ¿Los datos legacy YA fueron importados antes?');
      console.log('   ¿O están importando desde el Excel "UNIFICADO_CLIENTES_HERNAN.xlsx"?\n');
      
      return;
    }

    // 2. Si hay matches, proceder con migración
    console.log('\n2️⃣  Preparando migración de datos...\n');
    
    for (const ban of matches.slice(0, 3)) { // Primeros 3 como prueba
      console.log(`\n   📦 Procesando BAN ${ban}:`);
      
      // Datos legacy
      const ventaData = await legacyPool.query(`
        SELECT 
          ban,
          numerocelularactivado,
          fechaactivacion,
          comisionclaro,
          comisionvendedor,
          comisionextra,
          codigovoz,
          meses
        FROM venta 
        WHERE ban = $1
        LIMIT 1
      `, [ban]);
      
      if (ventaData.rows.length === 0) continue;
      
      const legacy = ventaData.rows[0];
      console.log(`      Legacy data:`);
      console.log(`        Teléfono: ${legacy.numerocelularactivado || 'N/A'}`);
      console.log(`        Comisión Claro: $${legacy.comisionclaro || '0'}`);
      console.log(`        Comisión Vendedor: $${legacy.comisionvendedor || '0'}`);
      console.log(`        Fecha activación: ${legacy.fechaactivacion || 'N/A'}`);
      console.log(`        Plan: ${legacy.codigovoz || 'N/A'}`);
      
      // Buscar subscriber en CRM
      const subscriber = await currentPool.query(`
        SELECT s.id, s.phone, s.monthly_value, c.name as client_name
        FROM subscribers s
        JOIN bans b ON s.ban_id = b.id
        JOIN clients c ON b.client_id = c.id
        WHERE b.ban_number = $1
        LIMIT 1
      `, [ban]);
      
      if (subscriber.rows.length === 0) {
        console.log(`      ⚠️  No se encontró subscriber en CRM para este BAN`);
        continue;
      }
      
      const sub = subscriber.rows[0];
      console.log(`\n      CRM subscriber:`);
      console.log(`        ID: ${sub.id}`);
      console.log(`        Cliente: ${sub.client_name}`);
      console.log(`        Teléfono: ${sub.phone || 'N/A'}`);
      console.log(`        Valor mensual: $${sub.monthly_value || '0'}`);
    }

    console.log('\n\n════════════════════════════════════════════════════════════');
    console.log('✓ Análisis completado');
    console.log('\n💡 SIGUIENTE PASO:');
    console.log('   Si hay matches, confirma el mapeo de campos:');
    console.log('     ● comisionclaro → company_earnings');
    console.log('     ● comisionvendedor → vendor_commission');
    console.log('   Y crearé el script de migración final.');
    console.log('════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
    await currentPool.end();
  }
}

migrarReportesLegacy();
