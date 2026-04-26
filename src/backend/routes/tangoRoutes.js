import { Router } from 'express';
import crmPool from '../database/db.js';
import { getTangoPool } from '../database/externalPools.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = Router();

function ensureAuthenticated(req, res, next) {
  if (req.user) return next();
  return authenticateToken(req, res, next);
}

router.use(ensureAuthenticated);

// ======================================================
// GET /api/tango/compare — Comparativa completa Tango vs CRM
// ======================================================
router.get('/compare', async (req, res) => {
  try {
    const { search, month } = req.query;
    const legacyPool = getTangoPool();

    // 1. Ventas PYMES de Tango
    let tangoQuery = `
      SELECT v.ventaid, v.ban, v.status as linea,
             v.ventatipoid, v.meses, v.fechaactivacion,
             COALESCE(v.comisionclaro, 0) as comisionclaro,
             COALESCE(v.comisionvendedor, 0) as comisionvendedor,
             v.codigovoz, v.activo, v.nota,
             COALESCE(cc.nombre, 'SIN NOMBRE') as cliente,
             vt.nombre as tipo, vd.nombre as vendedor
      FROM venta v
      JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
      LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
      LEFT JOIN vendedor vd ON vd.vendedorid = v.vendedorid
      WHERE v.ventatipoid IN (138, 139, 140, 141)
        AND v.activo = true
        AND (v.ventatipoid IN (138, 139) OR v.fechaactivacion >= '2026-01-01')
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      tangoQuery += ` AND (cc.nombre ILIKE $${params.length} OR v.ban ILIKE $${params.length} OR v.status ILIKE $${params.length})`;
    }
    if (month) {
      params.push(month);
      tangoQuery += ` AND TO_CHAR(v.fechaactivacion, 'YYYY-MM') = $${params.length}`;
    }
    tangoQuery += ` ORDER BY cc.nombre, v.ban, v.ventaid`;

    const tangoResult = await legacyPool.query(tangoQuery, params);

    // 2. CRM subscribers + reports para esos BANs
    const allBANs = [...new Set(tangoResult.rows.map(v => (v.ban || '').trim()).filter(Boolean))];

    let crmSubs = [];
    if (allBANs.length > 0) {
      const crmResult = await crmPool.query(`
        SELECT s.id as sub_id, s.phone, s.line_type,
               b.ban_number, b.id as ban_id, b.account_type,
               c.name as client_name, c.id as client_id,
               sr.report_month, sr.company_earnings, sr.vendor_commission, sr.paid_amount
        FROM subscribers s
        JOIN bans b ON b.id = s.ban_id
        JOIN clients c ON c.id = b.client_id
        LEFT JOIN subscriber_reports sr ON sr.subscriber_id = s.id
        WHERE b.ban_number = ANY($1)
        ORDER BY b.ban_number, s.phone, sr.report_month
      `, [allBANs]);
      crmSubs = crmResult.rows;
    }

    // Also get CRM data for search that may not be in Tango
    let extraCrm = [];
    if (search) {
      const extraResult = await crmPool.query(`
        SELECT s.id as sub_id, s.phone, s.line_type,
               b.ban_number, b.id as ban_id, b.account_type,
               c.name as client_name, c.id as client_id,
               sr.report_month, sr.company_earnings, sr.vendor_commission, sr.paid_amount
        FROM subscribers s
        JOIN bans b ON b.id = s.ban_id
        JOIN clients c ON c.id = b.client_id
        LEFT JOIN subscriber_reports sr ON sr.subscriber_id = s.id
        WHERE (c.name ILIKE $1 OR b.ban_number ILIKE $1 OR s.phone ILIKE $1)
          AND b.ban_number != ALL($2)
        ORDER BY b.ban_number, s.phone
      `, [`%${search}%`, allBANs]);
      extraCrm = extraResult.rows;
    }

    // 3. Build comparison by BAN+Month
    const comparison = buildComparison(tangoResult.rows, crmSubs, extraCrm);

    res.json({
      success: true,
      tango_total: tangoResult.rows.length,
      crm_total: crmSubs.length,
      comparison
    });

  } catch (error) {
    console.error('[TANGO-COMPARE] Error:', error);
    res.status(500).json({ error: 'Error comparando Tango vs CRM', details: error.message });
  }
});

// ======================================================
// GET /api/tango/detail/:ban — Detalle de un BAN específico
// ======================================================
router.get('/detail/:ban', async (req, res) => {
  try {
    const { ban } = req.params;
    const legacyPool = getTangoPool();

    // Tango ventas para este BAN (incluye inactivas)
    const tangoResult = await legacyPool.query(`
      SELECT v.ventaid, v.ban, v.status as linea,
             v.ventatipoid, v.meses, v.fechaactivacion,
             COALESCE(v.comisionclaro, 0) as comisionclaro,
             COALESCE(v.comisionvendedor, 0) as comisionvendedor,
             v.codigovoz, v.activo, v.nota, v.renovacion, v.fijo,
             COALESCE(cc.nombre, 'SIN NOMBRE') as cliente,
             vt.nombre as tipo, vd.nombre as vendedor
      FROM venta v
      JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
      LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
      LEFT JOIN vendedor vd ON vd.vendedorid = v.vendedorid
      WHERE v.ban = $1
        AND v.ventatipoid IN (138, 139, 140, 141)
        AND (v.ventatipoid IN (138, 139) OR v.fechaactivacion >= '2026-01-01')
      ORDER BY v.fechaactivacion, v.ventaid
    `, [ban]);

    // Buscar comision de tabla comision para cada venta
    const ventasConComision = [];
    for (const v of tangoResult.rows) {
      // Buscar rate del plan
      const tpResult = await legacyPool.query(
        `SELECT rate FROM tipoplan WHERE codigovoz = $1 LIMIT 1`, [v.codigovoz]
      );
      let comisionTabla = null;
      if (tpResult.rows.length > 0) {
        const rate = parseFloat(tpResult.rows[0].rate);
        const comResult = await legacyPool.query(`
          SELECT comisionclaro, meses as com_meses, ratemin, ratemax, fechadesde, fechahasta
          FROM comision
          WHERE ventatipoid = $1
            AND ratemin <= $2 AND ratemax >= $2
            AND ($3::int = meses OR meses = 0)
            AND fechadesde <= $4 AND fechahasta >= $4
          ORDER BY meses DESC LIMIT 1
        `, [v.ventatipoid, rate, v.meses, v.fechaactivacion]);
        if (comResult.rows.length > 0) {
          comisionTabla = parseFloat(comResult.rows[0].comisionclaro);
        }
      }

      ventasConComision.push({
        ...v,
        plan_rate: tpResult.rows.length > 0 ? parseFloat(tpResult.rows[0].rate) : null,
        comision_calculada: comisionTabla
      });
    }

    // CRM data for this BAN
    const crmResult = await crmPool.query(`
      SELECT s.id as sub_id, s.phone, s.line_type, s.created_at,
             b.ban_number, b.account_type,
             c.name as client_name,
             sr.report_month, sr.company_earnings, sr.vendor_commission, sr.paid_amount
      FROM subscribers s
      JOIN bans b ON b.id = s.ban_id
      JOIN clients c ON c.id = b.client_id
      LEFT JOIN subscriber_reports sr ON sr.subscriber_id = s.id
      WHERE b.ban_number = $1
      ORDER BY s.phone, sr.report_month
    `, [ban]);

    res.json({
      success: true,
      ban,
      tango: ventasConComision,
      crm: crmResult.rows
    });

  } catch (error) {
    console.error('[TANGO-DETAIL] Error:', error);
    res.status(500).json({ error: 'Error obteniendo detalle', details: error.message });
  }
});

// ======================================================
// GET /api/tango/summary — Resumen mensual Tango vs CRM
// ======================================================
router.get('/summary', async (req, res) => {
  try {
    const legacyPool = getTangoPool();

    const tangoResult = await legacyPool.query(`
      SELECT TO_CHAR(v.fechaactivacion, 'YYYY-MM') as month,
             vt.nombre as tipo, v.ventatipoid,
             COUNT(*) as count
      FROM venta v
      JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
      WHERE v.ventatipoid IN (138, 139, 140, 141) AND v.activo = true
        AND (v.ventatipoid IN (138, 139) OR v.fechaactivacion >= '2026-01-01')
      GROUP BY TO_CHAR(v.fechaactivacion, 'YYYY-MM'), vt.nombre, v.ventatipoid
      ORDER BY month, v.ventatipoid
    `);

    const crmResult = await crmPool.query(`
      SELECT TO_CHAR(sr.report_month, 'YYYY-MM') as month,
             s.line_type,
             b.account_type,
             COUNT(*) as count
      FROM subscriber_reports sr
      JOIN subscribers s ON s.id = sr.subscriber_id
      JOIN bans b ON b.id = s.ban_id
      GROUP BY TO_CHAR(sr.report_month, 'YYYY-MM'), s.line_type, b.account_type
      ORDER BY month
    `);

    // Group by month
    const months = {};

    for (const r of tangoResult.rows) {
      if (!months[r.month]) months[r.month] = { tango: {}, crm: {}, tango_total: 0, crm_total: 0 };
      const key = `${r.tipo} (${r.ventatipoid})`;
      months[r.month].tango[key] = parseInt(r.count);
      months[r.month].tango_total += parseInt(r.count);
    }

    for (const r of crmResult.rows) {
      if (!months[r.month]) months[r.month] = { tango: {}, crm: {}, tango_total: 0, crm_total: 0 };
      const key = `${r.account_type || 'N/A'} ${r.line_type || 'N/A'}`;
      months[r.month].crm[key] = (months[r.month].crm[key] || 0) + parseInt(r.count);
      months[r.month].crm_total += parseInt(r.count);
    }

    res.json({ success: true, months });

  } catch (error) {
    console.error('[TANGO-SUMMARY] Error:', error);
    res.status(500).json({ error: 'Error generando resumen', details: error.message });
  }
});

// ======================================================
// POST /api/tango/sync — Sincronizar Tango → CRM
// Tango es SOURCE OF TRUTH. Idempotente via tango_ventaid UNIQUE.
// ======================================================
router.post('/sync', requireRole(['admin', 'supervisor']), async (req, res) => {
  const alerts = [];
  const stats = {
    tango_ventas: 0,
    clients_created: 0,
    clients_matched: 0,
    bans_created: 0,
    bans_matched: 0,
    subscribers_created: 0,
    subscribers_updated: 0,
    subscribers_merged: 0,
    subscribers_deactivated: 0,
    reports_upserted: 0,
    errors: 0,
  };

  function alert(level, ban, msg) {
    alerts.push({ level, ban: ban || '', msg });
    if (level === 'error') stats.errors++;
  }

  function toYmd(dateLike) {
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function addMonthsYmd(dateLike, months) {
    if (!dateLike || !months || months <= 0) return null;
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return null;
    d.setMonth(d.getMonth() + months);
    return toYmd(d);
  }

  try {
    const legacyPool = getTangoPool();

    // ── 0. Load salespeople for vendedor mapping ──
    const spResult = await crmPool.query(`SELECT id, name FROM salespeople`);
    const salespeople = spResult.rows; // [{id, name}, ...]
    const vendorResult = await crmPool.query(`SELECT id, name FROM vendors`);
    const vendors = vendorResult.rows; // [{id, name}, ...]
    const vendorByName = new Map();

    function normalizeName(name) {
      return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    for (const vendor of vendors) {
      const key = normalizeName(vendor.name);
      if (key && !vendorByName.has(key)) vendorByName.set(key, vendor);
    }

    const mappingResult = await crmPool.query(`
      SELECT
        vsm.vendor_id,
        vsm.salesperson_id,
        v.name AS vendor_name,
        sp.name AS salesperson_name
      FROM vendor_salesperson_mapping vsm
      JOIN vendors v ON v.id = vsm.vendor_id
      JOIN salespeople sp ON sp.id = vsm.salesperson_id
      ORDER BY vsm.vendor_id, vsm.created_at DESC NULLS LAST, sp.name ASC
    `);
    const salespersonByVendorId = new Map();
    const duplicateMappingVendors = new Set();
    for (const mapping of mappingResult.rows) {
      const vendorId = String(mapping.vendor_id);
      if (salespersonByVendorId.has(vendorId)) {
        duplicateMappingVendors.add(vendorId);
        continue;
      }
      salespersonByVendorId.set(vendorId, mapping);
    }
    for (const vendorId of duplicateMappingVendors) {
      const mapping = salespersonByVendorId.get(vendorId);
      console.warn(
        `[SYNC] vendor_salesperson_mapping tiene multiples filas para vendor_id ${vendorId}; ` +
        `se usara ${mapping?.salesperson_name || mapping?.salesperson_id || 'primer mapping'}`
      );
    }

    const missingVendorMappingKeys = new Set();
    function logMissingVendorMapping(vendorId, vendorName, banNum) {
      const key = `${vendorId || ''}|${normalizeName(vendorName)}`;
      if (missingVendorMappingKeys.has(key)) return;
      missingVendorMappingKeys.add(key);
      const label = vendorName || (vendorId ? `vendor_id ${vendorId}` : 'vendedor sin nombre');
      const msg = `Vendedor Tango sin vendor_salesperson_mapping: ${label}${vendorId ? ` (${vendorId})` : ''}`;
      console.warn(`[SYNC] ${msg}`);
      alert('warn', banNum || '', msg);
    }

    function findSalesperson(vendedorTango, tangoVendorId, banNum) {
      const vendorId = tangoVendorId === null || tangoVendorId === undefined ? '' : String(tangoVendorId).trim();
      if (vendorId) {
        const mapping = salespersonByVendorId.get(vendorId);
        if (mapping?.salesperson_id) return mapping.salesperson_id;
        logMissingVendorMapping(vendorId, vendedorTango, banNum);
      }

      if (!vendedorTango) return null;
      const vt = normalizeName(vendedorTango);

      const vendor = vendorByName.get(vt);
      if (vendor) {
        const mapping = salespersonByVendorId.get(String(vendor.id));
        if (mapping?.salesperson_id) return mapping.salesperson_id;
        logMissingVendorMapping(vendor.id, vendedorTango, banNum);
      }

      // Fallback by salesperson name only when there is no official mapping.
      let sp = salespeople.find(s => normalizeName(s.name) === vt);
      if (sp) return sp.id;
      const firstName = vt.split(' ')[0];
      sp = salespeople.find(s => normalizeName(s.name).startsWith(firstName));
      if (sp) return sp.id;
      return null;
    }

    // ── 1. Fetch ALL active PYMES ventas from Tango ──
    const tangoResult = await legacyPool.query(`
      SELECT DISTINCT
        v.ventaid,
        TRIM(v.ban::text) AS ban,
        CASE
          WHEN v.ventatipoid IN (138, 139)
            THEN COALESCE(NULLIF(TRIM(v.numerocelularactivado::text), ''), NULLIF(TRIM(v.status), ''))
          ELSE COALESCE(NULLIF(TRIM(v.status), ''), NULLIF(TRIM(v.numerocelularactivado::text), ''))
        END AS phone,
        v.codigovoz AS plan_code,
        v.meses,
        v.ventatipoid,
        tp.rate AS mensualidad,
        COALESCE(v.comisionclaro, 0)::numeric(12,2) AS com_empresa,
        COALESCE(v.comisionvendedor, 0)::numeric(12,2) AS com_vendedor,
        v.fechaactivacion,
        v.vendedorid AS tango_vendor_id,
        COALESCE(TRIM(cc.nombre), 'SIN NOMBRE') AS cliente,
        COALESCE(TRIM(vd.nombre), '') AS vendedor
      FROM venta v
      LEFT JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
      LEFT JOIN tipoplan tp ON v.codigovoz = tp.codigovoz
      LEFT JOIN vendedor vd ON v.vendedorid = vd.vendedorid
      WHERE v.ventatipoid IN (138, 139, 140, 141)
        AND v.activo = true
        AND (v.ventatipoid IN (138, 139) OR v.fechaactivacion >= '2026-01-01')
      ORDER BY COALESCE(TRIM(cc.nombre), 'SIN NOMBRE'), TRIM(v.ban::text), v.ventaid
    `);
    stats.tango_ventas = tangoResult.rows.length;
    console.log(`[SYNC] ${stats.tango_ventas} ventas activas en Tango`);

    const banTypeByBan = new Map();
    const activePhonesByBan = new Map();
    for (const row of tangoResult.rows) {
      const banNum = String(row.ban || '').trim();
      if (!banNum) continue;

      const ventaTipo = Number(row.ventatipoid);
      const current = banTypeByBan.get(banNum) || { hasMobile: false, hasFijo: false };
      if (ventaTipo === 138 || ventaTipo === 139) current.hasMobile = true;
      if (ventaTipo === 140 || ventaTipo === 141) current.hasFijo = true;
      banTypeByBan.set(banNum, current);

      const normalizedPhone = String(row.phone || '').replace(/\D/g, '');
      if (normalizedPhone) {
        if (!activePhonesByBan.has(banNum)) activePhonesByBan.set(banNum, new Set());
        activePhonesByBan.get(banNum).add(normalizedPhone);
      }
    }

    const desiredAccountTypeForBan = (banNum) => {
      const types = banTypeByBan.get(banNum);
      if (!types) return null;
      if (types.hasFijo && types.hasMobile) return 'CONVERGENTE';
      if (types.hasFijo) return 'FIJO';
      if (types.hasMobile) return 'PYMES';
      return null;
    };

    // ── 2. Pre-load CRM bans + clients for fast lookup ──
    const banRows = await crmPool.query(
      `SELECT id, ban_number, client_id, account_type FROM bans`
    );
    const banByNumber = new Map();
    for (const b of banRows.rows) banByNumber.set(b.ban_number, b);

    const clientRows = await crmPool.query(
      `SELECT id, name, salesperson_id FROM clients`
    );
    const clientByName = new Map();
    const clientById = new Map();
    for (const c of clientRows.rows) {
      clientByName.set((c.name || '').trim().toUpperCase(), c);
      clientById.set(c.id, c);
    }

    // ── 3. Pre-load existing tango_ventaid subscribers ──
    const existingSubs = await crmPool.query(
      `SELECT id, tango_ventaid, ban_id, phone, plan, line_type, monthly_value, contract_term, contract_end_date, status
       FROM subscribers
       WHERE tango_ventaid IS NOT NULL`
    );
    const subByVentaId = new Map();
    for (const s of existingSubs.rows) subByVentaId.set(Number(s.tango_ventaid), s);

    // ── 3b. Cleanup: remove CRM subscribers whose Tango ventas are now inactive ──
    const activeVentaIds = new Set(tangoResult.rows.map(v => Number(v.ventaid)));
    let deactivated = 0;
    for (const [ventaId, sub] of subByVentaId) {
      if (!activeVentaIds.has(ventaId)) {
        // This subscriber's Tango venta is no longer active — remove report + subscriber
        await crmPool.query(`DELETE FROM subscriber_reports WHERE subscriber_id = $1`, [sub.id]);
        await crmPool.query(`DELETE FROM subscribers WHERE id = $1`, [sub.id]);
        subByVentaId.delete(ventaId);
        deactivated++;
        alert('warn', sub.phone || '', `Venta ${ventaId} ya no activa en Tango → subscriber eliminado`);
      }
    }
    if (deactivated > 0) {
      stats.subscribers_deactivated = deactivated;
      console.log(`[SYNC] ${deactivated} subscribers eliminados (ventas inactivas en Tango)`);
    }

    // ── 4. Process each venta ──
    for (const v of tangoResult.rows) {
      try {
        const banNum = v.ban;
        const ventaTipo = Number(v.ventatipoid);
        const isMobile = ventaTipo === 138 || ventaTipo === 139;
        const isFijo = ventaTipo === 140 || ventaTipo === 141;
        const lineType = (ventaTipo === 138 || ventaTipo === 140) ? 'REN' : 'NEW';
        const monthVal = v.fechaactivacion
          ? new Date(v.fechaactivacion).toISOString().slice(0, 7) + '-01'
          : null;
        const monthlyValue = v.mensualidad ? parseFloat(v.mensualidad) : 0;
        const contractTerm = Number.isFinite(Number(v.meses)) ? Number(v.meses) : null;
        const contractEndDate = contractTerm && contractTerm > 0 ? addMonthsYmd(v.fechaactivacion, contractTerm) : null;
        const comEmpresa = parseFloat(v.com_empresa);
        const comVendedor = parseFloat(v.com_vendedor);
        // Para Fijo (140,141) phone puede ser vacío, para Móvil (138,139) es obligatorio
        let phone = v.phone || null;
        if (phone) {
          const normalizedPhone = String(phone).replace(/\D/g, '');
          if (normalizedPhone.length > 0) {
            phone = normalizedPhone;
          }
        }
        if (isMobile && !phone) {
          alert('error', banNum, `Venta ${v.ventaid}: Móvil sin teléfono, ignorando`);
          continue;
        }
        const planCode = v.plan_code || null;

        if (!banNum) {
          alert('error', '', `Venta ${v.ventaid}: sin BAN, saltando`);
          continue;
        }
        if (!monthVal) {
          alert('error', banNum, `Venta ${v.ventaid}: sin fecha activación, saltando`);
          continue;
        }

        // ── PASO 1: Resolver Client + BAN ──
        let banRecord = banByNumber.get(banNum);
        let clientId;

        if (banRecord) {
          clientId = banRecord.client_id;
          stats.bans_matched++;
          const currentAccountType = String(banRecord.account_type || '').trim().toUpperCase();
          const desiredAccountType = desiredAccountTypeForBan(banNum);
          if (desiredAccountType && currentAccountType !== desiredAccountType) {
            await crmPool.query(`UPDATE bans SET account_type = $1, updated_at = NOW() WHERE id = $2`, [desiredAccountType, banRecord.id]);
            banRecord.account_type = desiredAccountType;
            alert('info', banNum, `BAN actualizado a tipo ${desiredAccountType}`);
          }
          const clientRecord = clientById.get(clientId);
          const spId = findSalesperson(v.vendedor, v.tango_vendor_id, banNum);
          const sourceClientName = String(v.cliente || '').trim();
          const currentClientName = String(clientRecord?.name || '').trim();
          const shouldBackfillClientName = Boolean(sourceClientName) && (
            !currentClientName ||
            currentClientName.toUpperCase() === 'SIN NOMBRE'
          );

          if (shouldBackfillClientName) {
            await crmPool.query(`UPDATE clients SET name = $1 WHERE id = $2`, [sourceClientName, clientId]);
            alert('info', banNum, `Nombre de cliente recuperado desde Tango: ${sourceClientName}`);
            if (clientRecord) {
              clientRecord.name = sourceClientName;
            } else {
              clientById.set(clientId, { id: clientId, name: sourceClientName, salesperson_id: spId || null });
            }
            clientByName.set(sourceClientName.toUpperCase(), clientById.get(clientId));
          }

          if (spId && (!clientRecord?.salesperson_id || clientRecord.salesperson_id !== spId)) {
            await crmPool.query(`UPDATE clients SET salesperson_id = $1 WHERE id = $2`, [spId, clientId]);
            alert('info', banNum, `Vendedor actualizado: ${v.vendedor} → cliente ${clientRecord?.name || v.cliente}`);
            if (clientRecord) {
              clientRecord.salesperson_id = spId;
            } else {
              clientById.set(clientId, { id: clientId, name: v.cliente, salesperson_id: spId });
            }
          }
        } else {
          // BAN no existe → buscar/crear cliente, luego crear BAN
          const clientNameUpper = (v.cliente || 'SIN NOMBRE').toUpperCase();
          let clientRecord = clientByName.get(clientNameUpper);

          if (clientRecord) {
            clientId = clientRecord.id;
            stats.clients_matched++;

            // Forzar update de salesperson si Tango trae vendedor y es diferente o null en CRM
            const spId = findSalesperson(v.vendedor, v.tango_vendor_id, banNum);
            if (spId && clientRecord.salesperson_id !== spId) {
              await crmPool.query(`UPDATE clients SET salesperson_id = $1 WHERE id = $2`, [spId, clientId]);
              alert('info', banNum, `Vendedor actualizado: ${v.vendedor} → cliente ${v.cliente}`);
              clientRecord.salesperson_id = spId; // Mantener actualizado en cache
            }
          } else {
            // Create client
            const spId = findSalesperson(v.vendedor, v.tango_vendor_id, banNum);
            if (!spId && v.vendedor) {
              alert('error', banNum, `Vendedor '${v.vendedor}' sin match en salespeople`);
            }
            const newClient = await crmPool.query(
              `INSERT INTO clients (name, salesperson_id) VALUES ($1, $2) RETURNING id`,
              [v.cliente, spId]
            );
            clientId = newClient.rows[0].id;
            const newClientRecord = { id: clientId, name: v.cliente, salesperson_id: spId };
            clientByName.set(clientNameUpper, newClientRecord);
            clientById.set(clientId, newClientRecord);
            stats.clients_created++;
            alert('info', banNum, `Cliente creado: ${v.cliente}`);
          }

          // Create BAN
          const accountType = desiredAccountTypeForBan(banNum) || (isFijo ? 'FIJO' : 'PYMES');
          const newBan = await crmPool.query(
            `INSERT INTO bans (client_id, ban_number, account_type, status) VALUES ($1, $2, $3, 'A') RETURNING id`,
            [clientId, banNum, accountType]
          );
          banRecord = { id: newBan.rows[0].id, ban_number: banNum, client_id: clientId, account_type: accountType };
          banByNumber.set(banNum, banRecord);
          stats.bans_created++;
          alert('info', banNum, `BAN creado: ${banNum} (${accountType}) bajo ${v.cliente}`);
        }

        // ── PASO 2: Resolver Subscriber via tango_ventaid ──
        let subscriberId;
        const existingSub = subByVentaId.get(Number(v.ventaid));

        if (existingSub) {
          subscriberId = existingSub.id;
          // Check for changes and update (compare against actual values that would be written)
          // Para Fijo: phone puede ser vacío, para Móvil nunca debe ser vacío
          const actualPhone = phone || (isFijo ? '' : `LINEA-${v.ventaid}`);
          const changes = [];
          if (existingSub.ban_id !== banRecord.id) changes.push(`ban_id`);
          if ((existingSub.phone || '') !== actualPhone) changes.push(`phone: '${existingSub.phone}'→'${actualPhone}'`);
          if ((existingSub.plan || '') !== (planCode || '')) changes.push(`plan: '${existingSub.plan}'→'${planCode}'`);
          if ((existingSub.line_type || '') !== lineType) changes.push(`line_type: '${existingSub.line_type}'→'${lineType}'`);
          if (parseFloat(existingSub.monthly_value || 0) !== monthlyValue) changes.push(`monthly_value: ${existingSub.monthly_value}→${monthlyValue}`);
          if (Number(existingSub.contract_term || 0) !== Number(contractTerm || 0)) changes.push(`contract_term: '${existingSub.contract_term}'→'${contractTerm}'`);
          if ((existingSub.contract_end_date ? String(existingSub.contract_end_date).slice(0, 10) : '') !== (contractEndDate || '')) {
            changes.push(`contract_end_date: '${existingSub.contract_end_date}'→'${contractEndDate}'`);
          }
          if ((existingSub.status || '').toLowerCase() !== 'activo') changes.push(`status: '${existingSub.status}'→'activo'`);

          if (changes.length > 0) {
            await crmPool.query(`
              UPDATE subscribers
              SET ban_id=$1,
                  phone=$2,
                  plan=$3,
                  line_type=$4,
                  monthly_value=$5,
                  contract_term=$6,
                  contract_end_date=$7,
                  status='activo',
                  cancel_reason=NULL,
                  updated_at=NOW()
              WHERE id=$8
            `, [banRecord.id, actualPhone, planCode, lineType, monthlyValue, contractTerm, contractEndDate, subscriberId]);
            stats.subscribers_updated++;
            alert('warn', banNum, `Subscriber actualizado (ventaid ${v.ventaid}): ${changes.join(', ')}`);
          }
        } else {
          // Try to find by phone+ban (for existing subscribers without tango_ventaid)
          let matched = false;
          if (phone) {
            const matchResult = await crmPool.query(
              `SELECT id FROM subscribers WHERE ban_id = $1 AND phone = $2 AND tango_ventaid IS NULL LIMIT 1`,
              [banRecord.id, phone]
            );
            if (matchResult.rows.length > 0) {
              subscriberId = matchResult.rows[0].id;
              await crmPool.query(`
                UPDATE subscribers
                SET tango_ventaid=$1,
                    plan=$2,
                    line_type=$3,
                    monthly_value=$4,
                    contract_term=$5,
                    contract_end_date=$6,
                    status='activo',
                    cancel_reason=NULL,
                    updated_at=NOW()
                WHERE id=$7
              `, [v.ventaid, planCode, lineType, monthlyValue, contractTerm, contractEndDate, subscriberId]);
              subByVentaId.set(Number(v.ventaid), { id: subscriberId, tango_ventaid: v.ventaid });
              stats.subscribers_updated++;
              matched = true;
              alert('info', banNum, `Subscriber vinculado por teléfono: ${phone} → ventaid ${v.ventaid}`);
            }
          }

          // Fallback: match by ban_id + existing report with same month+commission (for FIJO-*, SIN-TEL-* placeholders)
          if (!matched) {
            const fallbackResult = await crmPool.query(`
              SELECT s.id, s.phone FROM subscribers s
              JOIN subscriber_reports sr ON sr.subscriber_id = s.id
              WHERE s.ban_id = $1 AND s.tango_ventaid IS NULL
                AND sr.report_month = $2::date
                AND sr.company_earnings = $3
                AND (s.phone LIKE 'FIJO-%' OR s.phone LIKE 'SIN-TEL-%' OR s.phone LIKE 'LINEA-%')
              LIMIT 1
            `, [banRecord.id, monthVal, comEmpresa]);
            if (fallbackResult.rows.length > 0) {
              subscriberId = fallbackResult.rows[0].id;
              const oldPhone = fallbackResult.rows[0].phone;
              const newPhone = phone || oldPhone; // Keep old placeholder if Tango also has no phone
              await crmPool.query(`
                UPDATE subscribers
                SET tango_ventaid=$1,
                    phone=$2,
                    plan=$3,
                    line_type=$4,
                    monthly_value=$5,
                    contract_term=$6,
                    contract_end_date=$7,
                    status='activo',
                    cancel_reason=NULL,
                    updated_at=NOW()
                WHERE id=$8
              `, [v.ventaid, newPhone, planCode, lineType, monthlyValue, contractTerm, contractEndDate, subscriberId]);
              subByVentaId.set(Number(v.ventaid), { id: subscriberId, tango_ventaid: v.ventaid });
              stats.subscribers_updated++;
              matched = true;
              alert('info', banNum, `Subscriber vinculado por comisión: ${oldPhone} → ventaid ${v.ventaid}${phone ? ` (phone: ${phone})` : ''}`);
            }
          }

          if (!matched) {
            // Create new subscriber OR update existing (ON CONFLICT handles idempotency)
            // Para Fijo: phone puede ser vacío, para Móvil nunca debe ser vacío
            const subPhone = phone || (isFijo ? '' : `LINEA-${v.ventaid}`);
            if (!phone && isMobile) {
              alert('error', banNum, `Venta ${v.ventaid}: Móvil sin teléfono, ignorando`);
              continue;
            }
            if (!phone && isFijo) {
              alert('info', banNum, `Venta ${v.ventaid} Fijo sin teléfono, se deja en blanco`);
            }
            const newSub = await crmPool.query(`
              INSERT INTO subscribers (ban_id, phone, plan, line_type, monthly_value, tango_ventaid, contract_term, contract_end_date, status)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activo')
              ON CONFLICT (tango_ventaid) DO UPDATE SET
                ban_id = EXCLUDED.ban_id,
                phone = CASE WHEN subscribers.phone LIKE 'LINEA-%' OR subscribers.phone LIKE 'SIN-TEL-%' OR subscribers.phone LIKE 'FIJO-%'
                             THEN EXCLUDED.phone ELSE COALESCE(NULLIF(EXCLUDED.phone, subscribers.phone), subscribers.phone) END,
                plan = EXCLUDED.plan,
                line_type = EXCLUDED.line_type,
                monthly_value = EXCLUDED.monthly_value,
                contract_term = EXCLUDED.contract_term,
                contract_end_date = EXCLUDED.contract_end_date,
                status = 'activo',
                cancel_reason = NULL,
                updated_at = NOW()
              RETURNING id, (xmax = 0) AS was_inserted
            `, [banRecord.id, subPhone, planCode, lineType, monthlyValue, v.ventaid, contractTerm, contractEndDate]);
            subscriberId = newSub.rows[0].id;
            const wasInserted = newSub.rows[0].was_inserted;
            subByVentaId.set(Number(v.ventaid), { id: subscriberId, tango_ventaid: v.ventaid });
            if (wasInserted) {
              stats.subscribers_created++;
              alert('info', banNum, `Subscriber creado: ${subPhone} plan ${planCode} (ventaid ${v.ventaid})`);
            } else {
              stats.subscribers_updated++;
            }
          }
        }

        // ── PASO 3: Upsert subscriber_report ──
        await crmPool.query(`
          INSERT INTO subscriber_reports (subscriber_id, report_month, company_earnings, vendor_commission, created_at, updated_at)
          VALUES ($1, $2::date, $3, $4, NOW(), NOW())
          ON CONFLICT (subscriber_id, report_month)
          DO UPDATE SET company_earnings = EXCLUDED.company_earnings,
                        vendor_commission = EXCLUDED.vendor_commission,
                        updated_at = NOW()
        `, [subscriberId, monthVal, comEmpresa, comVendedor]);
        stats.reports_upserted++;

      } catch (ventaErr) {
        alert('error', v.ban || '', `Venta ${v.ventaid}: ${ventaErr.message}`);
        console.error(`[SYNC] Error procesando venta ${v.ventaid}:`, ventaErr);
      }
    }

    // ── 4b. Cleanup duplicates from legacy sync (same BAN+phone, keep canonical tango_ventaid row) ──
    try {
      const touchedBans = [...new Set(tangoResult.rows.map(v => (v.ban || '').trim()).filter(Boolean))];
      if (touchedBans.length > 0) {
        const dupRows = await crmPool.query(`
          WITH candidate AS (
            SELECT
              s.id,
              s.ban_id,
              s.phone,
              s.tango_ventaid,
              ROW_NUMBER() OVER (
                PARTITION BY s.ban_id, s.phone
                ORDER BY
                  CASE WHEN s.tango_ventaid IS NOT NULL THEN 0 ELSE 1 END,
                  COALESCE(s.updated_at, s.created_at) DESC,
                  s.id
              ) AS rn,
              BOOL_OR(s.tango_ventaid IS NOT NULL) OVER (PARTITION BY s.ban_id, s.phone) AS has_tango
            FROM subscribers s
            JOIN bans b ON b.id = s.ban_id
            WHERE b.ban_number = ANY($1)
          )
          SELECT
            d.id AS duplicate_id,
            k.id AS keep_id,
            d.phone,
            b.ban_number
          FROM candidate d
          JOIN candidate k
            ON k.ban_id = d.ban_id
           AND k.phone = d.phone
           AND k.rn = 1
          JOIN bans b ON b.id = d.ban_id
          WHERE d.rn > 1
            AND d.has_tango = true
            AND d.id <> k.id
        `, [touchedBans]);

        for (const d of dupRows.rows) {
          // Move reports from duplicate subscriber into canonical subscriber.
          await crmPool.query(`
            INSERT INTO subscriber_reports (
              subscriber_id,
              report_month,
              company_earnings,
              vendor_commission,
              paid_amount,
              paid_date,
              created_at,
              updated_at
            )
            SELECT
              $1,
              sr.report_month,
              sr.company_earnings,
              sr.vendor_commission,
              sr.paid_amount,
              sr.paid_date,
              NOW(),
              NOW()
            FROM subscriber_reports sr
            WHERE sr.subscriber_id = $2
            ON CONFLICT (subscriber_id, report_month)
            DO UPDATE SET
              company_earnings = CASE
                WHEN (subscriber_reports.company_earnings IS NULL OR subscriber_reports.company_earnings = 0)
                     AND EXCLUDED.company_earnings IS NOT NULL
                THEN EXCLUDED.company_earnings
                ELSE subscriber_reports.company_earnings
              END,
              vendor_commission = CASE
                WHEN (subscriber_reports.vendor_commission IS NULL OR subscriber_reports.vendor_commission = 0)
                     AND EXCLUDED.vendor_commission IS NOT NULL
                THEN EXCLUDED.vendor_commission
                ELSE subscriber_reports.vendor_commission
              END,
              paid_amount = COALESCE(subscriber_reports.paid_amount, EXCLUDED.paid_amount),
              paid_date = COALESCE(subscriber_reports.paid_date, EXCLUDED.paid_date),
              updated_at = NOW()
          `, [d.keep_id, d.duplicate_id]);

          await crmPool.query(`DELETE FROM subscriber_reports WHERE subscriber_id = $1`, [d.duplicate_id]);
          await crmPool.query(`DELETE FROM subscribers WHERE id = $1`, [d.duplicate_id]);
          stats.subscribers_merged++;
          alert('warn', d.ban_number, `Duplicate subscriber merged: ${d.phone} (keep ${d.keep_id}, drop ${d.duplicate_id})`);
        }
      }

      // ── 4c. Cleanup placeholder subscribers (LINEA-/SIN-TEL-/FIJO-) if real Tango line exists ──
      // Rule: if a placeholder has no tango_ventaid and there is at least one real tango_ventaid
      // line in the same BAN with same plan + line_type, drop the placeholder.
      const placeholderRows = await crmPool.query(`
        SELECT
          s.id,
          s.phone,
          s.plan,
          s.line_type,
          b.ban_number
        FROM subscribers s
        JOIN bans b ON b.id = s.ban_id
        WHERE b.ban_number = ANY($1)
          AND (
            s.phone LIKE 'LINEA-%'
            OR s.phone LIKE 'SIN-TEL-%'
            OR s.phone LIKE 'FIJO-%'
          )
          AND EXISTS (
            SELECT 1
            FROM subscribers real_s
            WHERE real_s.ban_id = s.ban_id
              AND real_s.id <> s.id
              AND COALESCE(real_s.plan, '') = COALESCE(s.plan, '')
              AND COALESCE(real_s.line_type, '') = COALESCE(s.line_type, '')
              AND regexp_replace(COALESCE(real_s.phone, ''), '[^0-9]', '', 'g') ~ '^(787|939|989)\\d{7}$'
          )
      `, [touchedBans]);

      for (const p of placeholderRows.rows) {
        await crmPool.query(`DELETE FROM subscriber_reports WHERE subscriber_id = $1`, [p.id]);
        await crmPool.query(`DELETE FROM subscribers WHERE id = $1`, [p.id]);
        stats.subscribers_merged++;
        alert('warn', p.ban_number, `Placeholder eliminado: ${p.phone} (${p.line_type || 'N/A'} ${p.plan || 'N/A'})`);
      }

      const nonActiveReportedRows = await crmPool.query(`
        SELECT
          s.id,
          s.phone,
          s.line_type,
          s.monthly_value,
          b.ban_number,
          sr.report_month,
          sr.company_earnings
        FROM subscribers s
        JOIN bans b ON b.id = s.ban_id
        JOIN subscriber_reports sr ON sr.subscriber_id = s.id
        WHERE b.ban_number = ANY($1)
          AND s.tango_ventaid IS NULL
          AND COALESCE(s.status, 'activo') <> 'activo'
          AND EXISTS (
            SELECT 1
            FROM subscribers real_s
            JOIN subscriber_reports real_sr ON real_sr.subscriber_id = real_s.id
            WHERE real_s.ban_id = s.ban_id
              AND real_s.id <> s.id
              AND real_s.tango_ventaid IS NOT NULL
              AND real_sr.report_month = sr.report_month
              AND COALESCE(real_s.line_type, '') = COALESCE(s.line_type, '')
              AND COALESCE(real_s.monthly_value, 0) = COALESCE(s.monthly_value, 0)
              AND COALESCE(real_sr.company_earnings, 0) = COALESCE(sr.company_earnings, 0)
          )
      `, [touchedBans]);

      for (const staleReported of nonActiveReportedRows.rows) {
        await crmPool.query(`DELETE FROM subscriber_reports WHERE subscriber_id = $1`, [staleReported.id]);
        await crmPool.query(`DELETE FROM subscribers WHERE id = $1`, [staleReported.id]);
        stats.subscribers_merged++;
        alert(
          'warn',
          staleReported.ban_number,
          `Subscriber legacy con reporte eliminado: ${staleReported.phone} (${staleReported.line_type || 'N/A'})`
        );
      }

      const staleRows = await crmPool.query(`
        SELECT
          s.id,
          s.phone,
          b.ban_number
        FROM subscribers s
        JOIN bans b ON b.id = s.ban_id
        WHERE b.ban_number = ANY($1)
          AND s.tango_ventaid IS NULL
          AND COALESCE(s.status, 'activo') = 'activo'
          AND regexp_replace(COALESCE(s.phone, ''), '[^0-9]', '', 'g') ~ '^(787|939|989)\\d{7}$'
          AND NOT EXISTS (
            SELECT 1
            FROM subscriber_reports sr
            WHERE sr.subscriber_id = s.id
          )
          AND EXISTS (
            SELECT 1
            FROM subscribers real_s
            WHERE real_s.ban_id = s.ban_id
              AND real_s.id <> s.id
              AND real_s.tango_ventaid IS NOT NULL
          )
      `, [touchedBans]);

      for (const stale of staleRows.rows) {
        const banNum = String(stale.ban_number || '').trim();
        const normalizedPhone = String(stale.phone || '').replace(/\D/g, '');
        const activePhones = activePhonesByBan.get(banNum) || new Set();
        if (normalizedPhone && activePhones.has(normalizedPhone)) continue;

        await crmPool.query(`DELETE FROM subscribers WHERE id = $1`, [stale.id]);
        stats.subscribers_merged++;
        alert('warn', banNum, `Subscriber legacy eliminado sin Tango/reportes: ${stale.phone}`);
      }
    } catch (mergeErr) {
      alert('error', '', `Cleanup duplicados falló: ${mergeErr.message}`);
      console.error('[SYNC] Error limpiando duplicados legacy:', mergeErr);
    }

    // ── 5. Summary ──
    console.log(`[SYNC] Completado:`, JSON.stringify(stats));
    res.json({ success: true, stats, alerts });

  } catch (error) {
    console.error('[SYNC] Error general:', error);
    res.status(500).json({ success: false, error: 'Error en sync Tango→CRM', details: error.message, stats, alerts });
  }
});

// ======================================================
// Helper: Build comparison structure
// ======================================================
function buildComparison(tangoVentas, crmSubs, extraCrm) {
  const byBanMonth = {};

  // Process Tango ventas
  for (const v of tangoVentas) {
    const ban = (v.ban || '').trim();
    const month = v.fechaactivacion ? new Date(v.fechaactivacion).toISOString().slice(0, 7) : 'unknown';
    const key = `${ban}|${month}`;

    if (!byBanMonth[key]) {
      byBanMonth[key] = {
        ban, month,
        cliente: v.cliente,
        tango_count: 0, crm_count: 0,
        tango_ventas: [],
        crm_subs: [],
        status: 'pending' // match, partial, missing_crm, missing_tango
      };
    }
    byBanMonth[key].tango_count++;
    byBanMonth[key].tango_ventas.push({
      ventaid: v.ventaid,
      tipo: v.tipo,
      ventatipoid: v.ventatipoid,
      linea: v.linea,
      codigovoz: v.codigovoz,
      comisionclaro: parseFloat(v.comisionclaro),
      vendedor: v.vendedor,
      fecha: v.fechaactivacion
    });
  }

  // Process CRM subs
  const crmProcessed = new Set();
  for (const s of crmSubs) {
    const ban = (s.ban_number || '').trim();
    const month = s.report_month ? new Date(s.report_month).toISOString().slice(0, 7) : null;
    if (!month) continue;
    const key = `${ban}|${month}`;
    const subKey = `${s.sub_id}|${month}`;
    if (crmProcessed.has(subKey)) continue;
    crmProcessed.add(subKey);

    if (!byBanMonth[key]) {
      byBanMonth[key] = {
        ban, month,
        cliente: s.client_name,
        tango_count: 0, crm_count: 0,
        tango_ventas: [],
        crm_subs: [],
        status: 'pending'
      };
    }
    byBanMonth[key].crm_count++;
    byBanMonth[key].crm_subs.push({
      sub_id: s.sub_id,
      phone: s.phone,
      line_type: s.line_type,
      account_type: s.account_type,
      company_earnings: parseFloat(s.company_earnings || 0),
      vendor_commission: parseFloat(s.vendor_commission || 0)
    });
  }

  // Extra CRM (not in Tango)
  for (const s of extraCrm) {
    const ban = (s.ban_number || '').trim();
    const month = s.report_month ? new Date(s.report_month).toISOString().slice(0, 7) : 'no-report';
    const key = `${ban}|${month}`;
    const subKey = `${s.sub_id}|${month}`;
    if (crmProcessed.has(subKey)) continue;
    crmProcessed.add(subKey);

    if (!byBanMonth[key]) {
      byBanMonth[key] = {
        ban, month,
        cliente: s.client_name,
        tango_count: 0, crm_count: 0,
        tango_ventas: [],
        crm_subs: [],
        status: 'pending'
      };
    }
    byBanMonth[key].crm_count++;
    byBanMonth[key].crm_subs.push({
      sub_id: s.sub_id,
      phone: s.phone,
      line_type: s.line_type,
      account_type: s.account_type,
      company_earnings: parseFloat(s.company_earnings || 0),
      vendor_commission: parseFloat(s.vendor_commission || 0)
    });
  }

  // Determine status
  for (const item of Object.values(byBanMonth)) {
    if (item.tango_count === item.crm_count && item.tango_count > 0) {
      item.status = 'match';
    } else if (item.tango_count > 0 && item.crm_count === 0) {
      item.status = 'missing_crm';
    } else if (item.tango_count === 0 && item.crm_count > 0) {
      item.status = 'missing_tango';
    } else if (item.tango_count !== item.crm_count) {
      item.status = 'partial';
    }
  }

  // Sort by month, then client, then ban
  return Object.values(byBanMonth).sort((a, b) => {
    if (a.month !== b.month) return a.month.localeCompare(b.month);
    if (a.cliente !== b.cliente) return a.cliente.localeCompare(b.cliente);
    return a.ban.localeCompare(b.ban);
  });
}

export default router;
