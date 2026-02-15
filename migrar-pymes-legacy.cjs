/**
 * MIGRACIÓN PYMES: Legacy Tango → CRM VentasPro
 * 
 * Trae ventas PYMES (ventatipoid 138-141) de legacy a CRM.
 * 
 * Flujo:
 *   1. Lee ventas PYMES de legacy con datos de cliente y vendedor
 *   2. Para cada venta:
 *      a. Busca/crea CLIENTE en CRM (por nombre, ON CONFLICT no duplica)
 *      b. Busca/crea BAN en CRM (por ban_number, ON CONFLICT no duplica)
 *      c. Busca/crea SUSCRIPTOR en CRM (por phone+ban, ON CONFLICT no duplica)
 *      d. Upsert SUBSCRIBER_REPORT (company_earnings = comisionclaro)
 *   3. Si ya existe, ACTUALIZA. Si no, CREA.
 * 
 * Modo: DRY_RUN=true → solo muestra qué haría, sin escribir
 *        DRY_RUN=false → ejecuta la migración
 * 
 * Uso:
 *   node migrar-pymes-legacy.cjs              # dry-run
 *   node migrar-pymes-legacy.cjs --execute    # ejecutar real
 */

const { Pool } = require('pg');

// ═══════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════
const DRY_RUN = !process.argv.includes('--execute');

const legacyPool = new Pool({
  host: '167.99.12.125',
  port: 5432,
  user: 'postgres',
  password: 'fF00JIRFXc',
  database: 'claropr'
});

const crmPool = new Pool({
  host: '143.244.191.139',
  port: 5432,
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro'
});

// Mapeo vendedorid legacy → salesperson_id CRM (UUID)
const VENDOR_MAP = {
  299: '97233c21-2110-4399-9d4d-d97332baf6da', // Yaritza → YARITZA
  66:  '181a77b4-583c-4455-8e83-3147f540db68', // Gabriel → Gabriel Sanchez
  300: 'c57f897e-5259-4c4e-b8cc-6b19f36c5ed0', // Dayana → DAYANA
  32:  '181a77b4-583c-4455-8e83-3147f540db68', // Gabriel Sanchez → Gabriel Sanchez
  67:  'dcc8bbc7-d322-4190-bae0-3006d894a98e', // Hernan Sanchez → HERNAN
  298: 'c57f897e-5259-4c4e-b8cc-6b19f36c5ed0', // Dayane → DAYANA (mismo)
};

// Tipo venta legible
const TIPO_VENTA = {
  138: 'PYMES Update REN',
  139: 'PYMES Update NEW',
  140: 'PYMES Fijo REN',
  141: 'PYMES Fijo NEW',
};

// ═══════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════

/**
 * Busca o crea un cliente en CRM por nombre exacto
 */
async function findOrCreateClient(crmClient, { nombre, telefono, email, salespersonId }) {
  // Buscar por nombre exacto (case-insensitive)
  const existing = await crmClient.query(
    `SELECT id FROM clients WHERE UPPER(TRIM(name)) = UPPER(TRIM($1)) LIMIT 1`,
    [nombre]
  );

  if (existing.rows.length > 0) {
    const clientId = existing.rows[0].id;
    // Actualizar teléfono y vendedor si no tiene
    await crmClient.query(`
      UPDATE clients SET
        phone = COALESCE(NULLIF(phone, ''), $2),
        salesperson_id = COALESCE(salesperson_id, $3),
        updated_at = NOW()
      WHERE id = $1
    `, [clientId, telefono, salespersonId]);
    return { id: clientId, action: 'EXISTENTE' };
  }

  // Crear nuevo
  const inserted = await crmClient.query(`
    INSERT INTO clients (name, phone, email, salesperson_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    RETURNING id
  `, [nombre, telefono, email, salespersonId]);

  return { id: inserted.rows[0].id, action: 'CREADO' };
}

/**
 * Busca o crea un BAN en CRM por ban_number
 */
async function findOrCreateBan(crmClient, { banNumber, clientId, accountType }) {
  const existing = await crmClient.query(
    `SELECT id, client_id FROM bans WHERE ban_number = $1 LIMIT 1`,
    [banNumber]
  );

  if (existing.rows.length > 0) {
    const banId = existing.rows[0].id;
    // Si el BAN ya existe pero apunta a otro cliente, solo loguear
    if (existing.rows[0].client_id !== clientId) {
      console.log(`    ⚠️  BAN ${banNumber} existe pero apunta a otro client_id (${existing.rows[0].client_id}), no se reasigna`);
    }
    return { id: banId, action: 'EXISTENTE' };
  }

  const inserted = await crmClient.query(`
    INSERT INTO bans (client_id, ban_number, account_type, status, created_at, updated_at)
    VALUES ($1, $2, $3, 'A', NOW(), NOW())
    RETURNING id
  `, [clientId, banNumber, accountType]);

  return { id: inserted.rows[0].id, action: 'CREADO' };
}

/**
 * Busca o crea un suscriptor en CRM por phone + ban_id
 * REGLA ANTI-DUPLICADOS: Si el teléfono ya existe en CUALQUIER BAN, no lo crea de nuevo
 */
async function findOrCreateSubscriber(crmClient, { banId, phone, plan, contractTerm, contractEndDate, monthlyValue }) {
  // PRIMERO: Buscar si el teléfono ya existe en CUALQUIER BAN (anti-duplicados)
  const globalCheck = await crmClient.query(
    `SELECT s.id, s.ban_id, b.ban_number, c.name as client_name
     FROM subscribers s 
     JOIN bans b ON b.id = s.ban_id
     JOIN clients c ON c.id = b.client_id
     WHERE s.phone = $1`,
    [phone]
  );

  if (globalCheck.rows.length > 0) {
    const existing = globalCheck.rows[0];
    if (existing.ban_id === banId) {
      // Mismo BAN, actualizar plan
      await crmClient.query(`
        UPDATE subscribers SET
          plan = COALESCE($2, plan),
          contract_term = COALESCE($3, contract_term),
          contract_end_date = COALESCE($4, contract_end_date),
          monthly_value = COALESCE($5, monthly_value),
          updated_at = NOW()
        WHERE id = $1
      `, [existing.id, plan, contractTerm, contractEndDate, monthlyValue]);
      return { id: existing.id, action: 'ACTUALIZADO' };
    } else {
      // DUPLICADO en otro BAN - no crear, solo avisar
      console.log(`    ⚠️  DUPLICADO: Tel ${phone} ya existe en BAN ${existing.ban_number} (${existing.client_name}), se salta`);
      return { id: existing.id, action: 'DUPLICADO_SKIP' };
    }
  }

  // No existe en ningún BAN, crear nuevo
  const inserted = await crmClient.query(`
    INSERT INTO subscribers (ban_id, phone, plan, contract_term, contract_end_date, monthly_value, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    RETURNING id
  `, [banId, phone, plan, contractTerm, contractEndDate, monthlyValue]);

  return { id: inserted.rows[0].id, action: 'CREADO' };
}

/**
 * Upsert subscriber_report (ganancia empresa)
 */
async function upsertSubscriberReport(crmClient, { subscriberId, reportMonth, companyEarnings }) {
  if (companyEarnings === null || companyEarnings === undefined) return { action: 'SKIP (sin comisión)' };

  const existing = await crmClient.query(
    `SELECT subscriber_id FROM subscriber_reports WHERE subscriber_id = $1 AND report_month = $2`,
    [subscriberId, reportMonth]
  );

  if (existing.rows.length > 0) {
    await crmClient.query(`
      UPDATE subscriber_reports SET
        company_earnings = $3,
        updated_at = NOW()
      WHERE subscriber_id = $1 AND report_month = $2
    `, [subscriberId, reportMonth, companyEarnings]);
    return { action: 'ACTUALIZADO' };
  }

  await crmClient.query(`
    INSERT INTO subscriber_reports (subscriber_id, report_month, company_earnings, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
  `, [subscriberId, reportMonth, companyEarnings]);

  return { action: 'CREADO' };
}

// ═══════════════════════════════════════════
// SCRIPT PRINCIPAL
// ═══════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  MIGRACIÓN PYMES LEGACY → CRM   ${DRY_RUN ? '[ DRY RUN ]' : '[ EJECUCIÓN REAL ]'}       ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const stats = {
    total: 0,
    clientes: { creados: 0, existentes: 0 },
    bans: { creados: 0, existentes: 0 },
    subscribers: { creados: 0, actualizados: 0, duplicados: 0 },
    reports: { creados: 0, actualizados: 0, skipped: 0 },
    errores: 0,
  };

  try {
    // 1. Leer todas las ventas PYMES de legacy
    console.log('📥 Leyendo ventas PYMES de legacy...\n');
    const ventasResult = await legacyPool.query(`
      SELECT 
        v.ventaid,
        v.ventatipoid,
        v.vendedorid,
        v.ban,
        v.numerocelularactivado,
        v.codigovoz,
        v.meses,
        v.fechaactivacion,
        v.comisionclaro,
        v.anio,
        v.mesid,
        v.fijo,
        v.activo,
        cc.nombre AS cliente_nombre,
        cc.telefonocontacto AS cliente_telefono,
        cc.email AS cliente_email,
        cc.clientecreditoid
      FROM venta v
      JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
      WHERE v.ventatipoid IN (138, 139, 140, 141)
        AND v.activo = true
      ORDER BY v.fechaactivacion DESC
    `);

    const ventas = ventasResult.rows;
    stats.total = ventas.length;
    console.log(`  Total ventas PYMES activas: ${ventas.length}\n`);

    if (DRY_RUN) {
      console.log('🔍 MODO DRY RUN - Solo se muestra qué se haría:\n');
    }

    // 2. Procesar cada venta
    const crmClient = await crmPool.connect();

    try {
      if (!DRY_RUN) {
        await crmClient.query('BEGIN');
      }

      for (const venta of ventas) {
        const tipoNombre = TIPO_VENTA[venta.ventatipoid] || `Tipo ${venta.ventatipoid}`;
        const salespersonId = VENDOR_MAP[venta.vendedorid] || null;
        const phone = venta.numerocelularactivado ? String(venta.numerocelularactivado) : null;
        const banNumber = venta.ban ? String(venta.ban).trim() : null;

        console.log(`── Venta #${venta.ventaid} | ${tipoNombre} | BAN: ${banNumber} | Tel: ${phone}`);

        if (!banNumber) {
          console.log(`    ❌ Sin BAN, skip\n`);
          stats.errores++;
          continue;
        }

        // Determinar account_type según tipo venta
        const accountType = venta.fijo ? 'FIJO' : 'UPDATE';

        // Calcular fecha fin contrato
        let contractEndDate = null;
        if (venta.fechaactivacion && venta.meses) {
          const fecha = new Date(venta.fechaactivacion);
          fecha.setMonth(fecha.getMonth() + Number(venta.meses));
          contractEndDate = fecha.toISOString().split('T')[0];
        }

        // Calcular report_month (primer día del mes de la venta)
        let reportMonth = null;
        if (venta.anio && venta.mesid) {
          reportMonth = `${venta.anio}-${String(venta.mesid).padStart(2, '0')}-01`;
        }

        if (DRY_RUN) {
          // Solo mostrar
          console.log(`    Cliente: "${venta.cliente_nombre}" → ${salespersonId ? 'vendedor mapeado' : '⚠️ SIN VENDEDOR'}`);
          console.log(`    BAN: ${banNumber} (${accountType})`);
          if (phone) console.log(`    Suscriptor: ${phone} | Plan: ${venta.codigovoz} | ${venta.meses}m`);
          if (venta.comisionclaro !== null) console.log(`    Ganancia Empresa: $${venta.comisionclaro}`);
          console.log('');
          continue;
        }

        // ── EJECUCIÓN REAL ──

        try {
          // a. Cliente
          const clientResult = await findOrCreateClient(crmClient, {
            nombre: venta.cliente_nombre.trim(),
            telefono: venta.cliente_telefono ? String(venta.cliente_telefono) : null,
            email: venta.cliente_email || null,
            salespersonId,
          });
          console.log(`    Cliente: ${clientResult.action} (${clientResult.id.substring(0, 8)}...)`);
          if (clientResult.action === 'CREADO') stats.clientes.creados++;
          else stats.clientes.existentes++;

          // b. BAN
          const banResult = await findOrCreateBan(crmClient, {
            banNumber,
            clientId: clientResult.id,
            accountType,
          });
          console.log(`    BAN: ${banResult.action} (${banResult.id.substring(0, 8)}...)`);
          if (banResult.action === 'CREADO') stats.bans.creados++;
          else stats.bans.existentes++;

          // c. Suscriptor (solo si tiene teléfono - ventas Update)
          if (phone) {
            const subResult = await findOrCreateSubscriber(crmClient, {
              banId: banResult.id,
              phone,
              plan: venta.codigovoz,
              contractTerm: venta.meses ? Number(venta.meses) : null,
              contractEndDate,
              monthlyValue: null, // No tenemos valor mensual directo en legacy
            });
            console.log(`    Suscriptor: ${subResult.action} (${subResult.id.substring(0, 8)}...)`);
            if (subResult.action === 'CREADO') stats.subscribers.creados++;
            else if (subResult.action === 'DUPLICADO_SKIP') stats.subscribers.duplicados++;
            else stats.subscribers.actualizados++;

            // d. Subscriber Report (ganancia empresa) - no crear si fue duplicado
            if (subResult.action === 'DUPLICADO_SKIP') {
              console.log(`    Report: SKIP (suscriptor duplicado)`);
              stats.reports.skipped++;
            } else if (reportMonth && venta.comisionclaro !== null) {
              const reportResult = await upsertSubscriberReport(crmClient, {
                subscriberId: subResult.id,
                reportMonth,
                companyEarnings: Number(venta.comisionclaro),
              });
              console.log(`    Report: ${reportResult.action} | $${venta.comisionclaro}`);
              if (reportResult.action === 'CREADO') stats.reports.creados++;
              else if (reportResult.action === 'ACTUALIZADO') stats.reports.actualizados++;
              else stats.reports.skipped++;
            }
          } else {
            // Ventas Fijo sin teléfono: crear suscriptor placeholder con BAN como referencia
            const fijoPhone = `FIJO-${banNumber}`;
            const subResult = await findOrCreateSubscriber(crmClient, {
              banId: banResult.id,
              phone: fijoPhone,
              plan: venta.codigovoz,
              contractTerm: venta.meses ? Number(venta.meses) : null,
              contractEndDate,
              monthlyValue: null,
            });
            console.log(`    Suscriptor Fijo: ${subResult.action} (${subResult.id.substring(0, 8)}...)`);
            if (subResult.action === 'CREADO') stats.subscribers.creados++;
            else if (subResult.action === 'DUPLICADO_SKIP') stats.subscribers.duplicados++;
            else stats.subscribers.actualizados++;

            // Report para fijo también - no crear si fue duplicado
            if (reportMonth && venta.comisionclaro !== null) {
              const reportResult = await upsertSubscriberReport(crmClient, {
                subscriberId: subResult.id,
                reportMonth,
                companyEarnings: Number(venta.comisionclaro),
              });
              console.log(`    Report Fijo: ${reportResult.action} | $${venta.comisionclaro}`);
              if (reportResult.action === 'CREADO') stats.reports.creados++;
              else if (reportResult.action === 'ACTUALIZADO') stats.reports.actualizados++;
              else stats.reports.skipped++;
            }
          }
          console.log('');

        } catch (ventaErr) {
          console.log(`    ❌ Error: ${ventaErr.message}\n`);
          stats.errores++;
        }
      }

      if (!DRY_RUN) {
        await crmClient.query('COMMIT');
        console.log('✅ COMMIT exitoso\n');
      }

    } catch (txErr) {
      if (!DRY_RUN) {
        await crmClient.query('ROLLBACK');
        console.log('❌ ROLLBACK por error:', txErr.message);
      }
      throw txErr;
    } finally {
      crmClient.release();
    }

    // 3. Resumen
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                        RESUMEN                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`  Total ventas PYMES procesadas: ${stats.total}`);
    console.log(`  Clientes:     ${stats.clientes.creados} creados, ${stats.clientes.existentes} existentes`);
    console.log(`  BANs:         ${stats.bans.creados} creados, ${stats.bans.existentes} existentes`);
    console.log(`  Suscriptores: ${stats.subscribers.creados} creados, ${stats.subscribers.actualizados} actualizados, ${stats.subscribers.duplicados} duplicados (skip)`);
    console.log(`  Reports:      ${stats.reports.creados} creados, ${stats.reports.actualizados} actualizados, ${stats.reports.skipped} skipped`);
    console.log(`  Errores:      ${stats.errores}`);

    if (DRY_RUN) {
      console.log('\n  ⚡ Para ejecutar de verdad: node migrar-pymes-legacy.cjs --execute');
    }

  } catch (e) {
    console.log('Error fatal:', e.message);
    console.log(e.stack);
  } finally {
    await legacyPool.end();
    await crmPool.end();
  }
}

main();
