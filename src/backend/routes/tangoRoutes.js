import { Router } from 'express';
import crmPool from '../database/db.js';
import { getTangoPool } from '../database/externalPools.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = Router();

// Normaliza fechas a string ISO 'YYYY-MM-DD'. El driver pg devuelve columnas
// `date` como objetos Date — String(Date) produce 'Day Mon DD …' que rompe
// comparaciones cross-formato. Esta utilidad las uniforma.
function toIsoDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  return String(val).slice(0, 10);
}

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
    tango_ventas_validas: 0,
    tango_ventas_external: 0,
    clients_created: 0,
    clients_matched: 0,
    clients_auto_created: 0,
    bans_created: 0,
    bans_matched: 0,
    bans_auto_created: 0,
    subscribers_created: 0,
    subscribers_updated: 0,
    subscribers_merged: 0,
    subscribers_deactivated: 0,
    subscribers_would_have_deactivated: 0,
    reports_upserted: 0,
    errors: 0,
  };

  // Flag opt-in: si AUTO_CREATE_FROM_TANGO=true, cuando una venta Tango trae un
  // BAN que no existe en CRM, creamos cliente + BAN automáticamente y la venta
  // sigue el flujo normal de sync (subs + report). Sin flag, esa venta cae en
  // external_sales con motivo 'ban_no_existe_en_crm' (comportamiento histórico).
  const AUTO_CREATE_FROM_TANGO = String(process.env.AUTO_CREATE_FROM_TANGO || '').toLowerCase() === 'true';

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

    // ── 0b. Tipos permitidos (FASE FINAL — 2026-04-30) ──
    // Solo PYMES Update (138/139) y PYMES Fijo (140/141) desde 2026-01-01.
    // Quedan EXCLUIDOS: Claro Update (25/26), 2 Play (121), 3 Play (41-50)
    // y todo lo anterior a 2026-01-01. Eso refleja la regla operativa real
    // del CRM (decisión de Gabriel, 2026-04-30).
    const MOBILE_TIPOS = [138, 139];
    const FIJO_TIPOS = [140, 141];
    const REN_TIPOS = [138, 140];
    // NEW por default: 139 y 141.

    // ── 1. Pre-load CRM bans + clients ANTES del fetch Tango ──
    // Necesario para aplicar el filtro 2 (BAN debe existir en CRM).
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

    // ── 2. Fetch ventas Tango con filtro 1 ──
    // Solo PYMES (138-141) y solo desde 2026-01-01 — regla operativa del CRM.
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
        COALESCE(v.bonoportabilidad, 0)::numeric(10,2) AS portability_bonus,
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
        AND v.fechaactivacion >= '2026-01-01'
      ORDER BY COALESCE(TRIM(cc.nombre), 'SIN NOMBRE'), TRIM(v.ban::text), v.ventaid
    `);
    console.log(`[SYNC] ${tangoResult.rows.length} ventas Tango pasaron filtro 1 (ventatipoid)`);

    // ── 3. Filtro 2 en JS: BAN debe existir en CRM. Las que no, van a external_sales. ──
    // Si AUTO_CREATE_FROM_TANGO=true, antes de descartarlas se intenta crear
    // cliente + BAN en CRM y la venta pasa al flujo normal.
    const externalSales = [];
    const ventasValidas = [];
    const ventasBanNuevo = []; // candidatas a auto-create (agrupadas luego)

    for (const v of tangoResult.rows) {
      const banNum = String(v.ban || '').trim();
      if (!banNum) {
        externalSales.push({
          tango_ventaid: Number(v.ventaid),
          ban: '',
          ventatipoid: Number(v.ventatipoid),
          fechaactivacion: v.fechaactivacion ? String(v.fechaactivacion).slice(0, 10) : null,
          vendedor: v.vendedor || null,
          cliente: v.cliente || null,
          com_empresa: Number(v.com_empresa || 0),
          com_vendedor: Number(v.com_vendedor || 0),
          motivo: 'sin_ban',
        });
        continue;
      }
      if (!banByNumber.has(banNum)) {
        if (AUTO_CREATE_FROM_TANGO) {
          ventasBanNuevo.push(v);
        } else {
          externalSales.push({
            tango_ventaid: Number(v.ventaid),
            ban: banNum,
            ventatipoid: Number(v.ventatipoid),
            fechaactivacion: v.fechaactivacion ? String(v.fechaactivacion).slice(0, 10) : null,
            vendedor: v.vendedor || null,
            cliente: v.cliente || null,
            com_empresa: Number(v.com_empresa || 0),
            com_vendedor: Number(v.com_vendedor || 0),
            motivo: 'ban_no_existe_en_crm',
          });
        }
        continue;
      }
      ventasValidas.push(v);
    }

    // ── 3b. AUTO-CREATE clientes/BANs desde Tango ──
    // Agrupa ventasBanNuevo por banNum, decide nombre cliente y account_type,
    // y crea cliente + BAN. Después mueve las ventas a ventasValidas para que
    // el flujo normal genere subscriber + report.
    if (AUTO_CREATE_FROM_TANGO && ventasBanNuevo.length > 0) {
      const ventasPorBan = new Map();
      for (const v of ventasBanNuevo) {
        const banNum = String(v.ban || '').trim();
        if (!ventasPorBan.has(banNum)) ventasPorBan.set(banNum, []);
        ventasPorBan.get(banNum).push(v);
      }
      console.log(`[SYNC][AUTO] ${ventasPorBan.size} BANs nuevos de Tango — intentando auto-create`);

      for (const [banNum, ventasDelBan] of ventasPorBan) {
        try {
          // 1) Determinar account_type del BAN según ventatipoids del grupo
          let hasMobile = false;
          let hasFijo = false;
          for (const v of ventasDelBan) {
            const t = Number(v.ventatipoid);
            if (MOBILE_TIPOS.includes(t)) hasMobile = true;
            if (FIJO_TIPOS.includes(t)) hasFijo = true;
          }
          const accountType = (hasFijo && hasMobile) ? 'CONVERGENTE'
                            : hasFijo ? 'FIJO'
                            : hasMobile ? 'PYMES'
                            : 'PYMES';

          // 2) Determinar nombre de cliente (priorizar cc.nombre Tango si existe y != 'SIN NOMBRE')
          const sampleVenta = ventasDelBan[0];
          const tangoClientName = String(sampleVenta.cliente || '').trim();
          const usePlaceholder = !tangoClientName || tangoClientName.toUpperCase() === 'SIN NOMBRE';
          const clientName = usePlaceholder ? `TANGO BAN ${banNum}` : tangoClientName;

          // 3) Resolver salesperson_id desde mapping del vendedor Tango
          const spId = findSalesperson(sampleVenta.vendedor, sampleVenta.tango_vendor_id, banNum);

          // 4) Dedupe: si nombre real (no placeholder), buscar cliente existente
          let clientId = null;
          if (!usePlaceholder) {
            const existing = clientByName.get(clientName.toUpperCase());
            if (existing) {
              clientId = existing.id;
              alert('info', banNum, `[AUTO] Cliente existente reutilizado por nombre: ${clientName}`);
            }
          }

          // 5) Crear cliente si no hubo match
          if (!clientId) {
            const ventaid = sampleVenta.ventaid;
            const fechaIso = toIsoDate(sampleVenta.fechaactivacion) || toYmd(new Date());
            const notes = `auto-creado desde tango sync · ventaid=${ventaid} · ${fechaIso}`;
            const newClient = await crmPool.query(
              `INSERT INTO clients (name, owner_name, salesperson_id, source, pendiente_validacion, notes, created_at, updated_at)
               VALUES ($1, $1, $2, 'tango', true, $3, NOW(), NOW())
               RETURNING id, name, salesperson_id`,
              [clientName, spId || null, notes]
            );
            clientId = newClient.rows[0].id;
            const created = newClient.rows[0];
            clientByName.set(clientName.toUpperCase(), { id: clientId, name: created.name, salesperson_id: created.salesperson_id });
            clientById.set(clientId, { id: clientId, name: created.name, salesperson_id: created.salesperson_id });
            stats.clients_auto_created++;
            alert('info', banNum, `[AUTO] Cliente creado: ${clientName}${usePlaceholder ? ' (placeholder, requiere validación)' : ''}`);
          }

          // 6) Crear BAN
          const newBan = await crmPool.query(
            `INSERT INTO bans (ban_number, client_id, account_type, status, source, created_at, updated_at)
             VALUES ($1, $2, $3, 'A', 'tango', NOW(), NOW())
             RETURNING id, ban_number, client_id, account_type`,
            [banNum, clientId, accountType]
          );
          const banRecord = newBan.rows[0];
          banByNumber.set(banNum, banRecord);
          stats.bans_auto_created++;
          alert('info', banNum, `[AUTO] BAN creado tipo ${accountType} → cliente ${clientName}`);

          // 7) Mover ventas del BAN al flujo normal
          for (const v of ventasDelBan) ventasValidas.push(v);
        } catch (autoErr) {
          // Falla en auto-create → mandar TODAS las ventas del BAN a external_sales
          // con motivo distinto para diagnóstico, no bloquea el resto del sync.
          alert('error', banNum, `[AUTO] Falló auto-create: ${autoErr.message}`);
          console.error(`[SYNC][AUTO] Error auto-create BAN ${banNum}:`, autoErr);
          for (const v of ventasDelBan) {
            externalSales.push({
              tango_ventaid: Number(v.ventaid),
              ban: banNum,
              ventatipoid: Number(v.ventatipoid),
              fechaactivacion: v.fechaactivacion ? String(v.fechaactivacion).slice(0, 10) : null,
              vendedor: v.vendedor || null,
              cliente: v.cliente || null,
              com_empresa: Number(v.com_empresa || 0),
              com_vendedor: Number(v.com_vendedor || 0),
              motivo: 'auto_create_fallo',
            });
          }
        }
      }
    }
    stats.tango_ventas = tangoResult.rows.length;
    stats.tango_ventas_validas = ventasValidas.length;
    stats.tango_ventas_external = externalSales.length;
    console.log(`[SYNC] ${stats.tango_ventas} totales | ${stats.tango_ventas_validas} válidas | ${stats.tango_ventas_external} external (BAN no existe en CRM)`);

    // ── 4. Pre-procesamiento sobre ventasValidas ──
    const banTypeByBan = new Map();
    const activePhonesByBan = new Map();
    for (const row of ventasValidas) {
      const banNum = String(row.ban || '').trim();
      if (!banNum) continue;

      const ventaTipo = Number(row.ventatipoid);
      const current = banTypeByBan.get(banNum) || { hasMobile: false, hasFijo: false };
      if (MOBILE_TIPOS.includes(ventaTipo)) current.hasMobile = true;
      if (FIJO_TIPOS.includes(ventaTipo)) current.hasFijo = true;
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

    // ── 3. Pre-load existing tango_ventaid subscribers ──
    const existingSubs = await crmPool.query(
      `SELECT id, tango_ventaid, ban_id, phone, plan, line_type, line_kind, monthly_value, contract_term, contract_end_date, status
       FROM subscribers
       WHERE tango_ventaid IS NOT NULL`
    );
    const subByVentaId = new Map();
    for (const s of existingSubs.rows) subByVentaId.set(Number(s.tango_ventaid), s);

    // ── 3a. Pre-cargar fechaactivacion de Tango para los tango_ventaid existentes en CRM. ──
    // Usado por PASO 1.5 (resolución de conflictos por phone_norm: la fecha más reciente gana).
    const fechaByVentaid = new Map();
    const existingVentaids = [...subByVentaId.keys()].filter((vid) => Number.isFinite(vid));
    if (existingVentaids.length > 0) {
      const fechaResult = await legacyPool.query(
        `SELECT ventaid, fechaactivacion FROM venta WHERE ventaid = ANY($1::bigint[])`,
        [existingVentaids]
      );
      for (const r of fechaResult.rows) {
        const f = toIsoDate(r.fechaactivacion);
        if (f) fechaByVentaid.set(Number(r.ventaid), f);
      }
    }

    // ── 3a.bis: Pre-cargar commission_percentage por salesperson ──
    // Usado para calcular vendor_commission cuando Tango trae com_vendedor=NULL/0.
    // La regla: si Tango omite comision pero hay company_earnings > 0, completar
    // con vendor.commission_percentage del salesperson asignado al cliente.
    // No cambia categoria (line_kind/account_type sigue intacto).
    const vendorPctBySpId = new Map();
    try {
      const pctRows = await crmPool.query(`
        SELECT vsm.salesperson_id::text AS sp_id, v.commission_percentage::numeric AS pct
          FROM vendors v
          JOIN vendor_salesperson_mapping vsm ON vsm.vendor_id = v.id
         WHERE v.commission_percentage IS NOT NULL
           AND v.commission_percentage > 0
      `);
      for (const r of pctRows.rows) {
        vendorPctBySpId.set(String(r.sp_id), Number(r.pct));
      }
    } catch (err) {
      // tabla puede no existir en alguna instalación — sigue sin map (regla = no calcula)
      console.warn('[SYNC] No se pudo pre-cargar vendor commission_percentage:', err.message);
    }

    // ── 3b. Cleanup DESACTIVADO TEMPORALMENTE ──
    // Solo loguea lo que hubiera borrado. NO ejecuta DELETE.
    // Para reactivar, descomentar las queries DELETE y restaurar subByVentaId.delete().
    const activeVentaIds = new Set(tangoResult.rows.map(v => Number(v.ventaid)));
    const wouldDelete = [];
    for (const [ventaId, sub] of subByVentaId) {
      if (!activeVentaIds.has(ventaId)) {
        wouldDelete.push({ ventaid: ventaId, subscriber_id: sub.id, phone: sub.phone || null });
        alert('warn', sub.phone || '', `[CLEANUP DESACTIVADO] Venta ${ventaId} ya no activa en Tango — habria eliminado subscriber id ${sub.id}`);
      }
    }
    stats.subscribers_would_have_deactivated = wouldDelete.length;
    if (wouldDelete.length > 0) {
      console.log(`[SYNC] CLEANUP DESACTIVADO: habria eliminado ${wouldDelete.length} subscribers`);
    }

    // ── 5. Process each venta valida ──
    for (const v of ventasValidas) {
      try {
        const banNum = v.ban;
        const ventaTipo = Number(v.ventatipoid);
        const isMobile = MOBILE_TIPOS.includes(ventaTipo);
        const isFijo = FIJO_TIPOS.includes(ventaTipo);
        const lineType = REN_TIPOS.includes(ventaTipo) ? 'REN' : 'NEW';
        // Tipo real de línea según ventatipoid Tango (independiente del account_type
        // del BAN). Manda en comisiones/metas; CONVERGENTE solo es atributo del BAN.
        const lineKind = isMobile ? 'movil' : (isFijo ? 'fijo' : null);
        const monthVal = v.fechaactivacion
          ? new Date(v.fechaactivacion).toISOString().slice(0, 7) + '-01'
          : null;
        const monthlyValue = v.mensualidad ? parseFloat(v.mensualidad) : 0;
        const contractTerm = Number.isFinite(Number(v.meses)) ? Number(v.meses) : null;
        const contractEndDate = contractTerm && contractTerm > 0 ? addMonthsYmd(v.fechaactivacion, contractTerm) : null;
        const comEmpresa = parseFloat(v.com_empresa);
        const comVendedor = parseFloat(v.com_vendedor);
        const portabilityBonus = parseFloat(v.portability_bonus) || 0;
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
        // El filtro 2 garantiza que banByNumber.has(banNum) === true.
        // Defensa: si no se encuentra, se loguea como bug y se salta (no se crea nada).
        const banRecord = banByNumber.get(banNum);
        if (!banRecord) {
          alert('error', banNum, `Bug: venta ${v.ventaid} paso filtro 2 pero BAN no encontrado al procesar`);
          externalSales.push({
            tango_ventaid: Number(v.ventaid),
            ban: banNum,
            ventatipoid: Number(v.ventatipoid),
            fechaactivacion: v.fechaactivacion ? String(v.fechaactivacion).slice(0, 10) : null,
            vendedor: v.vendedor || null,
            cliente: v.cliente || null,
            com_empresa: Number(v.com_empresa || 0),
            com_vendedor: Number(v.com_vendedor || 0),
            motivo: 'bug_ban_perdido_en_loop',
          });
          continue;
        }
        const clientId = banRecord.client_id;
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
          if ((existingSub.line_kind || null) !== lineKind) changes.push(`line_kind: '${existingSub.line_kind || '∅'}'→'${lineKind || '∅'}'`);

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
                  line_kind=$8,
                  status='activo',
                  cancel_reason=NULL,
                  updated_at=NOW()
              WHERE id=$9
            `, [banRecord.id, actualPhone, planCode, lineType, monthlyValue, contractTerm, contractEndDate, lineKind, subscriberId]);
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
                    line_kind=$7,
                    status='activo',
                    cancel_reason=NULL,
                    updated_at=NOW()
                WHERE id=$8
              `, [v.ventaid, planCode, lineType, monthlyValue, contractTerm, contractEndDate, lineKind, subscriberId]);
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
                    line_kind=$8,
                    status='activo',
                    cancel_reason=NULL,
                    updated_at=NOW()
                WHERE id=$9
              `, [v.ventaid, newPhone, planCode, lineType, monthlyValue, contractTerm, contractEndDate, lineKind, subscriberId]);
              subByVentaId.set(Number(v.ventaid), { id: subscriberId, tango_ventaid: v.ventaid });
              stats.subscribers_updated++;
              matched = true;
              alert('info', banNum, `Subscriber vinculado por comisión: ${oldPhone} → ventaid ${v.ventaid}${phone ? ` (phone: ${phone})` : ''}`);
            }
          }

          // ── PASO 1.5: Resolver conflicto por phone_norm (última fecha gana) ──
          // Constraint phone_norm_uniq es GLOBAL: el mismo phone NO puede existir en
          // dos filas. Antes del INSERT, verificamos si existe otro subscriber con ese
          // phone en otro tango_ventaid (mismo BAN o no). Si Tango trae fecha más
          // reciente con margen >3 días, movemos/actualizamos el existente. Si Tango
          // es más viejo o equivalente, se ignora como histórico.
          if (!matched && phone) {
            const conflict = await crmPool.query(
              `SELECT s.id, s.ban_id, s.tango_ventaid, s.created_at, s.updated_at, b.ban_number
                 FROM subscribers s
                 LEFT JOIN bans b ON b.id = s.ban_id
                WHERE s.phone_norm = $1
                  AND (s.tango_ventaid IS NULL OR s.tango_ventaid <> $2)
                LIMIT 1`,
              [phone, v.ventaid]
            );

            if (conflict.rows.length > 0) {
              const c = conflict.rows[0];

              // 1) Obtener fecha existente (PRIORIDAD: tango_ventaid → created_at → updated_at)
              let existingDate = null;
              if (c.tango_ventaid && fechaByVentaid.get(Number(c.tango_ventaid))) {
                existingDate = fechaByVentaid.get(Number(c.tango_ventaid));
              } else if (c.created_at) {
                existingDate = toIsoDate(c.created_at);
              } else if (c.updated_at) {
                existingDate = toIsoDate(c.updated_at);
              }

              const newDate = toIsoDate(v.fechaactivacion);

              const sameBan = String(c.ban_id) === String(banRecord.id);

              if (!newDate || !existingDate) {
                alert('warn', banNum, `No se pudo comparar fechas para phone ${phone}`);
                continue;
              }

              const newDateObj = new Date(newDate);
              const existingDateObj = new Date(existingDate);

              // Filtro de seguridad: solo mover si la diferencia supera 3 días
              const diffDays = Math.abs((newDateObj - existingDateObj) / (1000 * 60 * 60 * 24));

              if (newDateObj > existingDateObj && diffDays > 3) {
                // Tango más reciente → UPDATE del existente
                await crmPool.query(
                  `UPDATE subscribers
                     SET ban_id=$1,
                         phone=$2,
                         plan=$3,
                         line_type=$4,
                         monthly_value=$5,
                         tango_ventaid=$6,
                         contract_term=$7,
                         contract_end_date=$8,
                         line_kind=$9,
                         status='activo',
                         cancel_reason=NULL,
                         updated_at=NOW()
                   WHERE id=$10`,
                  [
                    banRecord.id,
                    phone,
                    planCode,
                    lineType,
                    monthlyValue,
                    v.ventaid,
                    contractTerm,
                    contractEndDate,
                    lineKind,
                    c.id,
                  ]
                );

                subscriberId = c.id;
                subByVentaId.set(Number(v.ventaid), { id: c.id, tango_ventaid: v.ventaid });
                stats.subscribers_updated++;
                matched = true;

                alert(
                  sameBan ? 'info' : 'warn',
                  banNum,
                  sameBan
                    ? `Renovación: ventaid ${c.tango_ventaid || '∅'} → ${v.ventaid} (${existingDate} → ${newDate})`
                    : `Movimiento: phone ${phone} de BAN ${c.ban_number} → ${banNum} (${existingDate} → ${newDate})`
                );
              } else {
                // Venta vieja o diferencia <= 3 días → ignorar
                alert(
                  'info',
                  banNum,
                  `Histórico ignorado: phone ${phone} ya en BAN ${c.ban_number} (${existingDate}) vs Tango ${newDate}`
                );
                continue;
              }
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
              INSERT INTO subscribers (ban_id, phone, plan, line_type, monthly_value, tango_ventaid, contract_term, contract_end_date, line_kind, status)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'activo')
              ON CONFLICT (tango_ventaid) DO UPDATE SET
                ban_id = EXCLUDED.ban_id,
                phone = CASE WHEN subscribers.phone LIKE 'LINEA-%' OR subscribers.phone LIKE 'SIN-TEL-%' OR subscribers.phone LIKE 'FIJO-%'
                             THEN EXCLUDED.phone ELSE COALESCE(NULLIF(EXCLUDED.phone, subscribers.phone), subscribers.phone) END,
                plan = EXCLUDED.plan,
                line_type = EXCLUDED.line_type,
                monthly_value = EXCLUDED.monthly_value,
                contract_term = EXCLUDED.contract_term,
                contract_end_date = EXCLUDED.contract_end_date,
                line_kind = EXCLUDED.line_kind,
                status = 'activo',
                cancel_reason = NULL,
                updated_at = NOW()
              RETURNING id, (xmax = 0) AS was_inserted
            `, [banRecord.id, subPhone, planCode, lineType, monthlyValue, v.ventaid, contractTerm, contractEndDate, lineKind]);
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
        // Protege company_earnings cargado manualmente: solo se actualiza si es NULL o = 0.
        //
        // vendor_commission: si Tango trae comVendedor > 0, se usa tal cual.
        // Si Tango trae 0/NULL Y hay company_earnings > 0 Y conocemos el % del
        // vendor asignado al cliente, calculamos: company * (pct/100). No cambia
        // categoria (line_kind/account_type intactos), solo completa el monto.
        let effectiveVendorCommission = comVendedor;
        let pctUsed = null;
        if ((!comVendedor || comVendedor <= 0) && comEmpresa > 0) {
          const spIdForVendor = clientRecord?.salesperson_id || spId || null;
          if (spIdForVendor) {
            const pct = vendorPctBySpId.get(String(spIdForVendor));
            if (pct && pct > 0) {
              pctUsed = pct;
              effectiveVendorCommission = Math.round(comEmpresa * (pct / 100) * 100) / 100;
              alert('info', banNum,
                `Venta ${v.ventaid}: vendor_commission calculado ${effectiveVendorCommission} (${pct}% de ${comEmpresa})`);
            }
          }
        }
        // Pre-leer valores actuales en CRM para detectar cambios desde Tango.
        // Tango es fuente de verdad: cuando trae un valor > 0, sobreescribe.
        // Si Tango trae 0/NULL, se preserva el valor existente en CRM (ediciones).
        const prevReport = await crmPool.query(
          `SELECT company_earnings, vendor_commission FROM subscriber_reports
           WHERE subscriber_id = $1 AND report_month = $2::date`,
          [subscriberId, monthVal]
        );
        const prevCompany = prevReport.rows[0]?.company_earnings != null ? Number(prevReport.rows[0].company_earnings) : null;
        const prevVendor = prevReport.rows[0]?.vendor_commission != null ? Number(prevReport.rows[0].vendor_commission) : null;

        await crmPool.query(`
          INSERT INTO subscriber_reports (subscriber_id, report_month, company_earnings, vendor_commission, portability_bonus, created_at, updated_at)
          VALUES ($1, $2::date, $3, $4, $5, NOW(), NOW())
          ON CONFLICT (subscriber_id, report_month)
          DO UPDATE SET
            company_earnings = CASE
              WHEN EXCLUDED.company_earnings IS NOT NULL AND EXCLUDED.company_earnings > 0
                THEN EXCLUDED.company_earnings
              ELSE subscriber_reports.company_earnings
            END,
            vendor_commission = CASE
              WHEN EXCLUDED.vendor_commission IS NOT NULL AND EXCLUDED.vendor_commission > 0
                THEN EXCLUDED.vendor_commission
              ELSE subscriber_reports.vendor_commission
            END,
            portability_bonus = CASE
              WHEN EXCLUDED.portability_bonus IS NOT NULL AND EXCLUDED.portability_bonus > 0
                THEN EXCLUDED.portability_bonus
              ELSE subscriber_reports.portability_bonus
            END,
            updated_at = NOW()
        `, [subscriberId, monthVal, comEmpresa, effectiveVendorCommission, portabilityBonus]);

        // Alertar si se actualizó algún valor existente desde Tango.
        if (prevCompany !== null && comEmpresa > 0 && Math.abs(prevCompany - comEmpresa) > 0.001) {
          alert('info', banNum, `Ganancia empresa actualizada desde Tango: ${prevCompany} → ${comEmpresa} (ventaid ${v.ventaid})`);
          stats.reports_company_updated = (stats.reports_company_updated || 0) + 1;
        }
        if (prevVendor !== null && effectiveVendorCommission > 0 && Math.abs(prevVendor - effectiveVendorCommission) > 0.001) {
          alert('info', banNum, `Comisión vendedor actualizada desde Tango: ${prevVendor} → ${effectiveVendorCommission} (ventaid ${v.ventaid})`);
          stats.reports_vendor_updated = (stats.reports_vendor_updated || 0) + 1;
        }
        stats.reports_upserted++;
        if (pctUsed !== null) {
          stats.vendor_commission_calculated = (stats.vendor_commission_calculated || 0) + 1;
        }

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

    // ── 6. Summary ──
    console.log(`[SYNC] Completado:`, JSON.stringify(stats));

    const externalMotivos = externalSales.reduce((acc, e) => {
      acc[e.motivo] = (acc[e.motivo] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      stats,
      alerts,
      external_sales: {
        count: externalSales.length,
        sample: externalSales.slice(0, 200),
        truncated: externalSales.length > 200,
        motivos: externalMotivos,
      },
      cleanup_disabled: {
        would_have_deactivated: wouldDelete.length,
        sample: wouldDelete.slice(0, 200),
        truncated: wouldDelete.length > 200,
      },
    });

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
