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

async function completarReportes() {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  COMPLETAR REPORTES: Legacy VENTA → subscriber_reports  ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // 1. Primero ver estructura de tabla venta
    console.log('1️⃣  Analizando estructura tabla VENTA (legacy)...\n');
    
    const ventaCols = await legacyPool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'venta'
      ORDER BY ordinal_position
    `);
    
    console.log(`   Total columnas: ${ventaCols.rows.length}`);
    
    // Buscar columnas relevantes
    const relevantCols = ventaCols.rows.filter(c => {
      const name = c.column_name.toLowerCase();
      return name.includes('comision') ||
             name.includes('valor') ||
             name.includes('precio') ||
             name.includes('renta') ||
             name.includes('mensual') ||
             name.includes('ganancia') ||
             name.includes('pago');
    });
    
    console.log('\n   Columnas relevantes para migración:');
    relevantCols.forEach(col => {
      console.log(`     • ${col.column_name} (${col.data_type})`);
    });

    // 2. Ver muestra de datos
    console.log('\n\n2️⃣  Muestra de datos en VENTA (legacy):');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const sampleVenta = await legacyPool.query(`
      SELECT * FROM venta 
      WHERE ban IS NOT NULL 
      LIMIT 3
    `);
    
    if (sampleVenta.rows.length > 0) {
      const v = sampleVenta.rows[0];
      console.log('   Ejemplo de registro:');
      console.log(`     BAN: ${v.ban || 'N/A'}`);
      console.log(`     Columnas disponibles: ${Object.keys(v).length}`);
      console.log('\n   Primeras 20 columnas:');
      Object.keys(v).slice(0, 20).forEach(key => {
        console.log(`     ${key}: ${v[key]}`);
      });
    }

    // 3. Verificar cuántos subscribers ya tienen reportes
    console.log('\n\n3️⃣  Estado actual en CRM_PRO:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const subsTotal = await currentPool.query('SELECT COUNT(*) FROM subscribers');
    console.log(`   Total subscribers: ${subsTotal.rows[0].count}`);
    
    const reportsTotal = await currentPool.query('SELECT COUNT(*) FROM subscriber_reports');
    console.log(`   Reportes existentes: ${reportsTotal.rows[0].count}`);
    
    const subsWithReports = await currentPool.query(`
      SELECT COUNT(DISTINCT s.id)
      FROM subscribers s
      WHERE EXISTS (
        SELECT 1 FROM subscriber_reports sr 
        WHERE sr.subscriber_id = s.id
      )
    `);
    console.log(`   Subscribers con reportes: ${subsWithReports.rows[0].count}`);
    console.log(`   Subscribers SIN reportes: ${subsTotal.rows[0].count - subsWithReports.rows[0].count}`);

    // 4. Verificar follow_up_prospects completados
    const completedProspects = await currentPool.query(`
      SELECT COUNT(*) 
      FROM follow_up_prospects 
      WHERE completed_date IS NOT NULL
    `);
    console.log(`\n   Follow-ups completados: ${completedProspects.rows[0].count}`);

    // 5. Intentar matchear un registro
    console.log('\n\n4️⃣  Intentando MATCH de datos:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const subsWithBan = await currentPool.query(`
      SELECT s.id as subscriber_id, s.phone, b.ban_number, c.name as client_name,
             s.monthly_value
      FROM subscribers s
      JOIN bans b ON s.ban_id = b.id
      JOIN clients c ON b.client_id = c.id
      WHERE b.ban_number IS NOT NULL
      LIMIT 1
    `);
    
    if (subsWithBan.rows.length > 0) {
      const sub = subsWithBan.rows[0];
      console.log('   Subscriber en CRM:');
      console.log(`     ID: ${sub.subscriber_id}`);
      console.log(`     BAN: ${sub.ban_number}`);
      console.log(`     Teléfono: ${sub.phone || 'N/A'}`);
      console.log(`     Cliente: ${sub.client_name}`);
      console.log(`     Valor mensual actual: $${sub.monthly_value || 'N/A'}`);
      
      // Buscar en legacy
      console.log('\n   Buscando en LEGACY por BAN...');
      const ventaMatch = await legacyPool.query(`
        SELECT * FROM venta WHERE ban = $1 LIMIT 1
      `, [sub.ban_number]);
      
      if (ventaMatch.rows.length > 0) {
        console.log('   ✅ MATCH encontrado en legacy!');
        const v = ventaMatch.rows[0];
        console.log('\n   Datos disponibles para migrar:');
        Object.keys(v).forEach(key => {
          const val = v[key];
          if (val !== null && val !== '') {
            console.log(`     ${key}: ${val}`);
          }
        });
      } else {
        console.log('   ❌ No encontrado en legacy por BAN');
      }
    }

    console.log('\n\n════════════════════════════════════════════════════════════');
    console.log('📋 PRÓXIMO PASO:');
    console.log('   Confirma qué campos de la tabla VENTA quieres migrar');
    console.log('   a subscriber_reports (company_earnings, vendor_commission, etc.)');
    console.log('════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
    await currentPool.end();
  }
}

completarReportes();
