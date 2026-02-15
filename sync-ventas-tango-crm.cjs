// SYNC COMPLETO: Ventas Tango → CRM (subscriber_reports)
// Versión: 2026-02-10
// Incluye validación role='vendedor' (v2026-295)

const { Pool } = require('pg');

// ═══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════

const legacyPool = new Pool({
  host: '159.203.70.5',
  port: 5432,
  user: 'postgres',
  password: 'p0stmu7t1',
  database: 'claropr'
});

const crmPool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro'
});

// Configuración de sync
const CONFIG = {
  // Fecha desde la cual importar ventas
  FECHA_INICIO: '2024-01-01',
  
  // Límite de registros por ejecución (para pruebas iniciales)
  LIMIT: 100,
  
  // Modo de ejecución
  DRY_RUN: true, // true = solo muestra qué haría, false = ejecuta INSERT
  
  // Filtros
  SOLO_ACTIVOS: true
};

// ═══════════════════════════════════════════════════════════════════
// ESTADÍSTICAS
// ═══════════════════════════════════════════════════════════════════

const stats = {
  total_ventas_legacy: 0,
  sin_ban_ni_telefono: 0,
  subscriber_no_encontrado: 0,
  vendedor_no_admin: 0,
  vendedor_es_admin: 0,
  ya_existe_reporte: 0,
  creados_exitosos: 0,
  errores: 0
};

// ═══════════════════════════════════════════════════════════════════
// FUNCIONES PRINCIPALES
// ═══════════════════════════════════════════════════════════════════

async function syncVentasTangoACRM() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   SYNC: Ventas Tango (legacy) → CRM (subscriber_reports)   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 CONFIGURACIÓN:');
  console.log(`   Fecha inicio: ${CONFIG.FECHA_INICIO}`);
  console.log(`   Límite: ${CONFIG.LIMIT} registros`);
  console.log(`   Modo: ${CONFIG.DRY_RUN ? '🔍 DRY RUN (solo análisis)' : '✍️  EJECUCIÓN REAL'}`);
  console.log(`   Solo activos: ${CONFIG.SOLO_ACTIVOS ? 'Sí' : 'No'}\n`);

  try {
    // Paso 1: Obtener ventas de legacy
    console.log('1️⃣  Obteniendo ventas desde Tango...\n');
    
    const ventasQuery = `
      SELECT 
        v.ventaid,
        v.ban,
        v.numerocelularactivado,
        v.fechaactivacion,
        v.comisionclaro,
        v.comisionvendedor,
        v.vendedorid,
        v.clientecreditoid,
        v.codigovoz,
        v.activo,
        vd.nombre as vendedor_nombre
      FROM venta v
      LEFT JOIN vendedor vd ON v.vendedorid = vd.vendedorid
      WHERE v.fechaactivacion >= $1
        ${CONFIG.SOLO_ACTIVOS ? 'AND v.activo = true' : ''}
      ORDER BY v.fechaactivacion DESC
      LIMIT $2
    `;
    
    const ventasLegacy = await legacyPool.query(ventasQuery, [
      CONFIG.FECHA_INICIO,
      CONFIG.LIMIT
    ]);
    
    stats.total_ventas_legacy = ventasLegacy.rows.length;
    console.log(`   ✅ ${stats.total_ventas_legacy} ventas encontradas\n`);
    
    if (stats.total_ventas_legacy === 0) {
      console.log('⚠️  No hay ventas para sincronizar.');
      return;
    }

    // Paso 2: Procesar cada venta
    console.log('2️⃣  Procesando ventas...\n');
    
    for (const venta of ventasLegacy.rows) {
      await procesarVenta(venta);
    }

    // Paso 3: Mostrar resumen
    mostrarResumen();

  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error.message);
    console.error(error.stack);
  } finally {
    await legacyPool.end();
    await crmPool.end();
    console.log('\n✅ Conexiones cerradas\n');
  }
}

async function procesarVenta(venta) {
  const { ventaid, ban, numerocelularactivado, fechaactivacion, comisionclaro, comisionvendedor, vendedor_nombre } = venta;
  
  // Validación 1: Debe tener BAN o teléfono
  if (!ban && !numerocelularactivado) {
    stats.sin_ban_ni_telefono++;
    return;
  }

  // Búsqueda de subscriber en CRM
  let subscriber = null;
  
  // Intentar por BAN primero
  if (ban) {
    const subByBan = await crmPool.query(`
      SELECT 
        s.id as subscriber_id,
        c.name as client_name,
        sp.name as salesperson_name,
        sp.role as salesperson_role
      FROM subscribers s
      JOIN bans b ON s.ban_id = b.id
      JOIN clients c ON b.client_id = c.id
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      WHERE b.ban_number = $1
      LIMIT 1
    `, [ban]);
    
    if (subByBan.rows.length > 0) {
      subscriber = subByBan.rows[0];
    }
  }

  // Si no encontró por BAN, intentar por teléfono
  if (!subscriber && numerocelularactivado) {
    const subByPhone = await crmPool.query(`
      SELECT 
        s.id as subscriber_id,
        c.name as client_name,
        sp.name as salesperson_name,
        sp.role as salesperson_role
      FROM subscribers s
      JOIN bans b ON s.ban_id = b.id
      JOIN clients c ON b.client_id = c.id
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      WHERE s.phone = $1
      LIMIT 1
    `, [numerocelularactivado.toString()]);
    
    if (subByPhone.rows.length > 0) {
      subscriber = subByPhone.rows[0];
    }
  }

  // Validación 2: Subscriber debe existir en CRM
  if (!subscriber) {
    stats.subscriber_no_encontrado++;
    return;
  }

  // Validación 3: CRÍTICA - Vendedor debe tener role='vendedor' (v2026-295)
  if (!subscriber.salesperson_role || subscriber.salesperson_role !== 'vendedor') {
    stats.vendedor_es_admin++;
    console.log(`   ⚠️  SKIP ventaid ${ventaid}: Admin/sin vendedor asignado (${subscriber.client_name})`);
    return;
  }

  stats.vendedor_no_admin++;

  // Verificar si ya existe el reporte
  const reportMonth = fechaactivacion.toISOString().slice(0, 7) + '-01';
  
  const existingReport = await crmPool.query(`
    SELECT id FROM subscriber_reports
    WHERE subscriber_id = $1 AND report_month = $2
  `, [subscriber.subscriber_id, reportMonth]);

  if (existingReport.rows.length > 0) {
    stats.ya_existe_reporte++;
    return;
  }

  // Crear subscriber_report
  if (CONFIG.DRY_RUN) {
    console.log(`   🔍 [DRY RUN] Crearía reporte:`);
    console.log(`      ventaid: ${ventaid} | BAN: ${ban || 'N/A'}`);
    console.log(`      subscriber_id: ${subscriber.subscriber_id} | Cliente: ${subscriber.client_name}`);
    console.log(`      company_earnings: $${comisionclaro || 0} | vendor_commission: $${comisionvendedor || 0}`);
    console.log(`      report_month: ${reportMonth} | Vendedor: ${subscriber.salesperson_name}\n`);
    stats.creados_exitosos++;
  } else {
    try {
      await crmPool.query(`
        INSERT INTO subscriber_reports (
          subscriber_id,
          report_month,
          company_earnings,
          vendor_commission,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      `, [
        subscriber.subscriber_id,
        reportMonth,
        comisionclaro || 0,
        comisionvendedor || 0
      ]);
      
      console.log(`   ✅ Creado: ventaid ${ventaid} → subscriber ${subscriber.subscriber_id}`);
      stats.creados_exitosos++;
    } catch (error) {
      console.error(`   ❌ Error ventaid ${ventaid}:`, error.message);
      stats.errores++;
    }
  }
}

function mostrarResumen() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        RESUMEN FINAL                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📊 Total ventas procesadas: ${stats.total_ventas_legacy}`);
  console.log(`\n✅ Reportes ${CONFIG.DRY_RUN ? 'que se crearían' : 'creados'}: ${stats.creados_exitosos}`);
  console.log(`\n⚠️  Problemas encontrados:`);
  console.log(`   • Sin BAN ni teléfono: ${stats.sin_ban_ni_telefono}`);
  console.log(`   • Subscriber no encontrado en CRM: ${stats.subscriber_no_encontrado}`);
  console.log(`   • Admin/sin vendedor asignado (SKIP por v2026-295): ${stats.vendedor_es_admin}`);
  console.log(`   • Ya existe reporte: ${stats.ya_existe_reporte}`);
  console.log(`   • Errores al insertar: ${stats.errores}`);
  
  console.log(`\n🎯 Validados correctamente (vendedor real): ${stats.vendedor_no_admin}`);
  
  if (CONFIG.DRY_RUN) {
    console.log(`\n💡 PARA EJECUTAR REALMENTE:`);
    console.log(`   Cambia CONFIG.DRY_RUN = false`);
  }
  
  console.log('\n════════════════════════════════════════════════════════════════\n');
}

// ═══════════════════════════════════════════════════════════════════
// EJECUCIÓN
// ═══════════════════════════════════════════════════════════════════

syncVentasTangoACRM();
