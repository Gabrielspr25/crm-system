import { query } from '../database/db.js';
import {
  businessDaysInMonth,
  businessDaysRemaining,
  businessDaysElapsed,
} from '../utils/businessDays.js';

// =====================================================================
// Panel Director — Overview del equipo
// =====================================================================
// GET /api/director/overview?month=YYYY-MM
//
// Devuelve, en una sola respuesta:
//   - summary: KPIs equipo (meta, vendido, %, tareas atrasadas, tango review)
//   - vendors: lista con métricas + breakdown por producto (solo con meta > 0)
//   - alerts: derivadas (sin venta, saturados, en riesgo, sin asignar)
//
// Solo admin/supervisor. Read-only.
// =====================================================================

const DEMO_NAMES = new Set([
  'juan pérez', 'juan perez', 'maría gonzález', 'maria gonzalez',
]);

// Reglas estado (mismo criterio que /api/goals/my-day)
function computeEstado(pct, pctEsperado) {
  if (pct >= pctEsperado * 0.9) return 'en_ritmo';
  if (pct >= pctEsperado * 0.5) return 'empuja';
  return 'enfoque_hoy';
}

function estadoToHealth(estado) {
  if (estado === 'en_ritmo') return 'good';
  if (estado === 'empuja') return 'warn';
  return 'danger';
}

function diffDays(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - target.getTime()) / 86400000);
}

function lastSaleLabel(dateStr) {
  const days = diffDays(dateStr);
  if (days === null) return 'Sin ventas';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `${days} días`;
  if (days < 30) return `${Math.floor(days / 7)} sem`;
  return `${Math.floor(days / 30)} mes`;
}

// Clasifica un haystack a (product_type, sale_type) — misma heurística que goals/my-day
function classifyHaystack(haystack, lineType) {
  const h = (haystack || '').toUpperCase();
  const lt = (lineType || '').toUpperCase();
  let product_type, sale_type;
  if (h.includes('MPLS')) { product_type = 'MPLS'; sale_type = 'NEW'; }
  else if (h.includes('CLOUD')) { product_type = 'CLOUD'; sale_type = 'NEW'; }
  else if (h.includes('CLARO TV') || h.includes('CLAROTV')) { product_type = 'CLARO_TV'; sale_type = 'NEW'; }
  else if (h.includes('FIJO') || h.includes('FIXED') || h.includes('INTERNET')) {
    product_type = 'FIJO';
    sale_type = ['REN', 'RENOVACION', 'RENOVATION', 'RENEWAL'].includes(lt) || h.includes('RENOV') ? 'REN' : 'NEW';
  } else {
    product_type = 'MOVIL';
    sale_type = ['REN', 'RENOVACION', 'RENOVATION', 'RENEWAL'].includes(lt) || h.includes('RENOV') ? 'REN' : 'NEW';
  }
  return { product_type, sale_type };
}

function getGoalType(product_type) {
  return ['FIJO', 'MPLS'].includes(product_type) ? 'money' : 'units';
}

const PRODUCT_LABEL = {
  'FIJO|NEW': 'Fijo New',
  'FIJO|REN': 'Fijo Ren',
  'MPLS|NEW': 'MPLS',
  'MOVIL|NEW': 'Movil New',
  'MOVIL|REN': 'Movil Ren',
  'CLARO_TV|NEW': 'ClaroTV',
  'CLOUD|NEW': 'Cloud',
};

// =====================================================================
// PATCH /api/director/goal
// Body: { salesperson_id, product_type, sale_type, year, month, amount }
// Actualiza target_revenue de product_goals para (vendor, producto, periodo).
// Solo admin. Resuelve vendor_id desde salesperson_id via mapeo existente.
// =====================================================================
const PRODUCT_NAME_BY_TYPE = {
  'FIJO|NEW':   'Fijo New',
  'FIJO|REN':   'Fijo Ren',
  'MPLS|NEW':   'MPLS',
  'MOVIL|NEW':  'Movil New',
  'MOVIL|REN':  'Movil Ren',
  'CLARO_TV|NEW': 'Claro TV',
  'CLOUD|NEW':  'Cloud',
};

export const patchDirectorGoal = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'supervisor') {
      return res.status(403).json({ error: 'Solo admin/supervisor' });
    }
    const { salesperson_id, product_type, sale_type, year, month, amount } = req.body || {};
    if (!salesperson_id || !product_type || !sale_type || !year || !month) {
      return res.status(400).json({ error: 'salesperson_id, product_type, sale_type, year, month requeridos' });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) {
      return res.status(400).json({ error: 'amount debe ser >= 0' });
    }
    const key = `${product_type}|${sale_type}`;
    const productName = PRODUCT_NAME_BY_TYPE[key];
    if (!productName) {
      return res.status(400).json({ error: `product_type+sale_type inválido: ${key}` });
    }

    // Resolver vendor_id desde salesperson_id (via mapping o nombre)
    const vRows = await query(
      `SELECT v.id AS vendor_id
         FROM vendors v
         LEFT JOIN vendor_salesperson_mapping vsm ON vsm.vendor_id = v.id
         LEFT JOIN salespeople sp ON UPPER(TRIM(sp.name)) = UPPER(TRIM(v.name))
        WHERE vsm.salesperson_id::text = $1::text OR sp.id::text = $1::text
        ORDER BY (CASE WHEN vsm.salesperson_id::text = $1::text THEN 0 ELSE 1 END)
        LIMIT 1`,
      [String(salesperson_id)]
    );
    const vendorId = vRows[0]?.vendor_id;
    if (!vendorId) {
      return res.status(404).json({ error: 'Vendedor sin vendor_id mapeado' });
    }

    // Buscar product uuid por nombre canónico
    const pRows = await query(
      `SELECT id::text AS product_uuid FROM products WHERE UPPER(TRIM(name)) = UPPER(TRIM($1)) LIMIT 1`,
      [productName],
    );
    const productUuid = pRows[0]?.product_uuid;
    if (!productUuid) {
      return res.status(404).json({ error: `Producto '${productName}' no existe en tabla products` });
    }

    // UPSERT del product_goal
    await query(
      `INSERT INTO product_goals (vendor_id, period_year, period_month, description, target_revenue, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())
       ON CONFLICT (vendor_id, period_year, period_month, description)
       DO UPDATE SET target_revenue = EXCLUDED.target_revenue, is_active = 1, updated_at = NOW()`,
      [vendorId, Number(year), Number(month), productUuid, amt],
    );

    return res.json({ ok: true, vendor_id: vendorId, product_uuid: productUuid, target_revenue: amt });
  } catch (err) {
    console.error('[director.patchGoal] error:', err);
    return res.status(500).json({ error: err.message || 'Error actualizando meta' });
  }
};

// =====================================================================
// POST /api/director/mark-paid
// Body: { salesperson_id, year, month, paid: bool }
// Marca/desmarca como pagadas TODAS las subscriber_reports confirmadas del
// vendedor en ese mes. Setea paid_date = NOW() y paid_amount = vendor_commission.
// Si paid=false, limpia paid_date y paid_amount.
// =====================================================================
export const markCommissionPaid = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'supervisor') {
      return res.status(403).json({ error: 'Solo admin/supervisor' });
    }
    const { salesperson_id, year, month, paid } = req.body || {};
    if (!salesperson_id || !year || !month || typeof paid !== 'boolean') {
      return res.status(400).json({ error: 'salesperson_id, year, month, paid (bool) requeridos' });
    }

    if (paid) {
      const result = await query(
        `UPDATE subscriber_reports sr
            SET paid_date  = NOW(),
                paid_amount = COALESCE(sr.vendor_commission, 0),
                updated_at  = NOW()
           FROM subscribers s
           JOIN bans b ON b.id = s.ban_id
           JOIN clients c ON c.id = b.client_id
          WHERE sr.subscriber_id = s.id
            AND c.salesperson_id::text = $1::text
            AND sr.report_month >= make_date($2::int, $3::int, 1)
            AND sr.report_month <  (make_date($2::int, $3::int, 1) + INTERVAL '1 month')
            AND COALESCE(sr.validation_status,'') = 'confirmed'`,
        [String(salesperson_id), Number(year), Number(month)],
      );
      return res.json({ ok: true, action: 'paid', rows_affected: result.length ?? 0 });
    } else {
      const result = await query(
        `UPDATE subscriber_reports sr
            SET paid_date  = NULL,
                paid_amount = NULL,
                updated_at  = NOW()
           FROM subscribers s
           JOIN bans b ON b.id = s.ban_id
           JOIN clients c ON c.id = b.client_id
          WHERE sr.subscriber_id = s.id
            AND c.salesperson_id::text = $1::text
            AND sr.report_month >= make_date($2::int, $3::int, 1)
            AND sr.report_month <  (make_date($2::int, $3::int, 1) + INTERVAL '1 month')`,
        [String(salesperson_id), Number(year), Number(month)],
      );
      return res.json({ ok: true, action: 'unpaid', rows_affected: result.length ?? 0 });
    }
  } catch (err) {
    console.error('[director.markPaid] error:', err);
    return res.status(500).json({ error: err.message || 'Error marcando pago' });
  }
};

export const getDirectorOverview = async (req, res) => {
  try {
    const role = String(req.user?.role || '').trim().toLowerCase();
    if (role !== 'admin' && role !== 'supervisor') {
      return res.status(403).json({ error: 'Solo admin/supervisor' });
    }

    // Período (default = mes actual)
    const monthParam = String(req.query?.month || '').trim();
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth() + 1;
    if (/^\d{4}-\d{1,2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number);
      year = y; month = m;
    }
    const businessDays = {
      total: businessDaysInMonth(year, month),
      elapsed: businessDaysElapsed(today, year, month),
      remaining: businessDaysRemaining(today, year, month),
    };
    const pctEsperado = businessDays.total > 0
      ? Math.round((businessDays.elapsed / businessDays.total) * 10000) / 100
      : 0;

    // 1) Salespeople activos no demo
    const salespeopleRows = await query(
      `SELECT id::text AS salesperson_id, name, role
       FROM salespeople
       WHERE LOWER(TRIM(name)) NOT IN ('juan pérez','juan perez','maría gonzález','maria gonzalez')
       ORDER BY name ASC`,
    );
    const salespeople = salespeopleRows.filter(r => !DEMO_NAMES.has(String(r.name || '').trim().toLowerCase()));

    // 2) Metas por (vendor, producto) — luego mapeamos vendor → salesperson
    const goalsRows = await query(
      `WITH product_categories AS (
        SELECT
          p.id::text AS product_uuid,
          CASE
            WHEN UPPER(TRIM(p.name)) IN ('FIJO NEW','FIJO REN') THEN 'FIJO'
            WHEN UPPER(TRIM(p.name)) IN ('MOVIL NEW','MOVIL REN','MÓVIL NEW','MÓVIL REN') THEN 'MOVIL'
            WHEN UPPER(TRIM(p.name)) IN ('CLARO TV','CLAROTV','TV') THEN 'CLARO_TV'
            WHEN UPPER(TRIM(p.name)) = 'CLOUD' THEN 'CLOUD'
            WHEN UPPER(TRIM(p.name)) = 'MPLS' THEN 'MPLS'
            ELSE NULL
          END AS product_type,
          CASE
            WHEN UPPER(TRIM(p.name)) IN ('FIJO REN','MOVIL REN','MÓVIL REN') THEN 'REN'
            ELSE 'NEW'
          END AS sale_type
        FROM products p
      ),
      vendor_to_sp AS (
        SELECT v.id AS vendor_id,
               COALESCE(mapped.salesperson_id, sp.id)::text AS salesperson_id
        FROM vendors v
        LEFT JOIN LATERAL (
          SELECT vsm.salesperson_id FROM vendor_salesperson_mapping vsm
          WHERE vsm.vendor_id = v.id
          ORDER BY vsm.created_at DESC NULLS LAST LIMIT 1
        ) mapped ON true
        LEFT JOIN salespeople sp ON UPPER(TRIM(sp.name)) = UPPER(TRIM(v.name))
      )
      SELECT vts.salesperson_id, pc.product_type, pc.sale_type,
             COALESCE(pg.target_revenue, 0)::numeric AS meta_amount
      FROM product_goals pg
      JOIN vendor_to_sp vts ON vts.vendor_id = pg.vendor_id
      JOIN product_categories pc ON pc.product_uuid = pg.description
      WHERE pg.period_year = $1 AND pg.period_month = $2
        AND COALESCE(pg.is_active, 1) = 1
        AND pc.product_type IS NOT NULL
        AND vts.salesperson_id IS NOT NULL
        AND COALESCE(pg.target_revenue, 0) > 0`,
      [year, month],
    );

    // 3) Ventas confirmadas por (salesperson, producto)
    //    + agregamos vendor_commission para "A pagar" y paid_date para "Pagado"
    const soldRows = await query(
      `WITH classified AS (
        SELECT
          c.salesperson_id::text AS salesperson_id,
          UPPER(CONCAT_WS(' ',
            COALESCE(b.account_type,''),
            COALESCE(s.plan,''),
            COALESCE(s.line_type,''),
            COALESCE(s.line_kind,''),
            COALESCE(s.phone,'')
          )) AS haystack,
          UPPER(COALESCE(s.line_type,'')) AS lt,
          COALESCE(sr.company_earnings, 0)::numeric AS earnings,
          COALESCE(sr.vendor_commission, 0)::numeric AS commission,
          sr.paid_date
        FROM subscriber_reports sr
        JOIN subscribers s ON s.id = sr.subscriber_id
        JOIN bans b ON b.id = s.ban_id
        JOIN clients c ON c.id = b.client_id
        WHERE c.salesperson_id IS NOT NULL
          AND sr.report_month >= make_date($1::int, $2::int, 1)
          AND sr.report_month <  (make_date($1::int, $2::int, 1) + INTERVAL '1 month')
          AND COALESCE(sr.validation_status,'') = 'confirmed'
      )
      SELECT salesperson_id, haystack, lt, earnings, commission, paid_date FROM classified`,
      [year, month],
    );

    // 4) Última venta por salesperson (a nivel created_at)
    const lastSaleRows = await query(
      `SELECT c.salesperson_id::text AS salesperson_id,
              MAX(sr.created_at)::text AS last_sale_at
       FROM subscriber_reports sr
       JOIN subscribers s ON s.id = sr.subscriber_id
       JOIN bans b ON b.id = s.ban_id
       JOIN clients c ON c.id = b.client_id
       WHERE COALESCE(sr.validation_status,'') = 'confirmed'
         AND c.salesperson_id IS NOT NULL
       GROUP BY c.salesperson_id`,
    );
    const lastSaleMap = new Map(lastSaleRows.map(r => [r.salesperson_id, r.last_sale_at]));

    // 5) Tareas por salesperson (pending/in_progress)
    const tasksRows = await query(
      `SELECT t.assigned_to::text AS salesperson_id,
              COUNT(*) FILTER (WHERE t.status IN ('pending','in_progress')) AS pendientes,
              COUNT(*) FILTER (WHERE t.status IN ('pending','in_progress') AND t.due_date IS NOT NULL AND t.due_date::date < CURRENT_DATE) AS atrasadas
       FROM crm_deal_tasks t
       WHERE t.status IN ('pending','in_progress')
       GROUP BY t.assigned_to`,
    );
    const tasksMap = new Map(tasksRows.map(r => [r.salesperson_id, { pendientes: Number(r.pendientes || 0), atrasadas: Number(r.atrasadas || 0) }]));

    // 6) Tango en revisión (count global del mes)
    const tangoRows = await query(
      `SELECT COUNT(*)::int AS cnt
       FROM subscriber_reports sr
       WHERE sr.report_month >= make_date($1::int, $2::int, 1)
         AND sr.report_month <  (make_date($1::int, $2::int, 1) + INTERVAL '1 month')
         AND COALESCE(sr.validation_status,'') = 'needs_review'`,
      [year, month],
    );
    const tangoInReview = Number(tangoRows[0]?.cnt || 0);

    // 7) Clientes en follow_up sin salesperson asignado
    const unassignedRows = await query(
      `SELECT COUNT(DISTINCT p.client_id)::int AS cnt
       FROM follow_up_prospects p
       JOIN clients c ON c.id = p.client_id
       WHERE p.completed_date IS NULL
         AND c.salesperson_id IS NULL
         AND TRIM(COALESCE(c.name, c.business_name,'')) <> ''`,
    );
    const unassignedClients = Number(unassignedRows[0]?.cnt || 0);

    // ====== Agregar metas por (salesperson, producto) ======
    const goalsBySpProd = new Map(); // key: sp|prod_type|sale_type -> { meta }
    for (const g of goalsRows) {
      const k = `${g.salesperson_id}|${g.product_type}|${g.sale_type}`;
      goalsBySpProd.set(k, Number(g.meta_amount || 0));
    }

    // ====== Agregar ventas + comisión + estado pagado por (salesperson, producto) ======
    const soldBySpProd = new Map();        // key: sp|prod_type|sale_type -> { units, revenue }
    const commissionBySp = new Map();      // sp -> { total, paid_total, all_paid }
    for (const r of soldRows) {
      const sp = r.salesperson_id;
      const { product_type, sale_type } = classifyHaystack(r.haystack, r.lt);
      const k = `${sp}|${product_type}|${sale_type}`;
      const goalType = getGoalType(product_type);
      const prev = soldBySpProd.get(k) || { units: 0, revenue: 0 };
      prev.units += 1;
      prev.revenue += Number(r.earnings || 0);
      soldBySpProd.set(k, prev);
      const totalKey = `${sp}|TOTAL|${goalType}`;
      const totalPrev = soldBySpProd.get(totalKey) || { units: 0, revenue: 0 };
      totalPrev.units += 1;
      totalPrev.revenue += Number(r.earnings || 0);
      soldBySpProd.set(totalKey, totalPrev);

      // Comisiones por vendedor (suma de vendor_commission)
      const commission = Number(r.commission || 0);
      const isPaid = !!r.paid_date;
      const cPrev = commissionBySp.get(sp) || { total: 0, paid_total: 0, total_count: 0, paid_count: 0 };
      cPrev.total += commission;
      cPrev.total_count += 1;
      if (isPaid) {
        cPrev.paid_total += commission;
        cPrev.paid_count += 1;
      }
      commissionBySp.set(sp, cPrev);
    }

    // ====== Construir vendors ======
    const vendors = salespeople.map(sp => {
      const spId = sp.salesperson_id;

      // Productos asignados (con meta > 0)
      const products = [];
      let metaTotalMoney = 0;
      let vendidoTotalMoney = 0;
      let metaTotalUnits = 0;
      let vendidoTotalUnits = 0;

      // Iteramos categorías canónicas
      const cats = [
        ['FIJO', 'NEW'], ['FIJO', 'REN'], ['MPLS', 'NEW'],
        ['MOVIL', 'NEW'], ['MOVIL', 'REN'], ['CLARO_TV', 'NEW'], ['CLOUD', 'NEW'],
      ];
      for (const [pt, st] of cats) {
        const metaKey = `${spId}|${pt}|${st}`;
        const meta = goalsBySpProd.get(metaKey) || 0;
        if (meta <= 0) continue; // solo productos asignados

        const sold = soldBySpProd.get(metaKey) || { units: 0, revenue: 0 };
        const goalType = getGoalType(pt);
        const vendido = goalType === 'money' ? sold.revenue : sold.units;
        const faltan = Math.max(0, meta - vendido);
        const pct = meta > 0 ? Math.round((vendido / meta) * 10000) / 100 : 0;

        products.push({
          product_type: pt,
          sale_type: st,
          label: PRODUCT_LABEL[`${pt}|${st}`] || `${pt} ${st}`,
          goal_type: goalType,
          meta: Math.round(meta * 100) / 100,
          vendido: Math.round(vendido * 100) / 100,
          faltan: Math.round(faltan * 100) / 100,
          porcentaje: pct,
        });

        if (goalType === 'money') {
          metaTotalMoney += meta;
          vendidoTotalMoney += vendido;
        } else {
          metaTotalUnits += meta;
          vendidoTotalUnits += vendido;
        }
      }

      const pctMoney = metaTotalMoney > 0 ? Math.round((vendidoTotalMoney / metaTotalMoney) * 100) : 0;
      const pctUnits = metaTotalUnits > 0 ? Math.round((vendidoTotalUnits / metaTotalUnits) * 100) : 0;
      const activeBuckets = [
        metaTotalMoney > 0 ? pctMoney : null,
        metaTotalUnits > 0 ? pctUnits : null,
      ].filter(v => v !== null);
      const pctGlobal = activeBuckets.length > 0
        ? Math.round(activeBuckets.reduce((s, v) => s + v, 0) / activeBuckets.length)
        : 0;

      const estado = (metaTotalMoney + metaTotalUnits) > 0 ? computeEstado(pctGlobal, pctEsperado) : 'en_ritmo';
      const tasks = tasksMap.get(spId) || { pendientes: 0, atrasadas: 0 };
      const lastSaleAt = lastSaleMap.get(spId) || null;

      const com = commissionBySp.get(spId) || { total: 0, paid_total: 0, total_count: 0, paid_count: 0 };
      const allPaid = com.total_count > 0 && com.paid_count === com.total_count;
      // HOY (cuota proyectada) = (Meta − Vendido) / días hábiles restantes
      const faltanMoney = Math.max(0, metaTotalMoney - vendidoTotalMoney);
      const faltanUnits = Math.max(0, metaTotalUnits - vendidoTotalUnits);
      const hoyMoney = businessDays.remaining > 0 ? faltanMoney / businessDays.remaining : faltanMoney;
      const hoyUnits = businessDays.remaining > 0 ? faltanUnits / businessDays.remaining : faltanUnits;

      return {
        salesperson_id: spId,
        name: sp.name,
        role: sp.role || 'vendedor',
        meta_money: Math.round(metaTotalMoney * 100) / 100,
        vendido_money: Math.round(vendidoTotalMoney * 100) / 100,
        meta_units: metaTotalUnits,
        vendido_units: vendidoTotalUnits,
        porcentaje: pctGlobal,
        porcentaje_esperado: pctEsperado,
        estado,
        health: estadoToHealth(estado),
        tareas_pendientes: tasks.pendientes,
        tareas_atrasadas: tasks.atrasadas,
        last_sale_at: lastSaleAt,
        last_sale_label: lastSaleLabel(lastSaleAt),
        days_since_last_sale: diffDays(lastSaleAt),
        // Fase 2B: comisión + HOY + pagado
        a_pagar: Math.round(com.total * 100) / 100,           // suma vendor_commission
        a_pagar_pagado: Math.round(com.paid_total * 100) / 100,
        ventas_pagadas: com.paid_count,
        ventas_totales: com.total_count,
        all_paid: allPaid,
        hoy_money: Math.round(hoyMoney * 100) / 100,
        hoy_units: Math.round(hoyUnits * 10) / 10,
        products,
      };
    });

    // ====== Summary equipo ======
    const teamGoalMoney = vendors.reduce((s, v) => s + v.meta_money, 0);
    const teamSoldMoney = vendors.reduce((s, v) => s + v.vendido_money, 0);
    const teamGoalUnits = vendors.reduce((s, v) => s + v.meta_units, 0);
    const teamSoldUnits = vendors.reduce((s, v) => s + v.vendido_units, 0);
    const teamPctMoney = teamGoalMoney > 0 ? Math.round((teamSoldMoney / teamGoalMoney) * 100) : 0;
    const teamOverdueTasks = vendors.reduce((s, v) => s + v.tareas_atrasadas, 0);
    const teamPendingTasks = vendors.reduce((s, v) => s + v.tareas_pendientes, 0);
    const teamAPagar = vendors.reduce((s, v) => s + v.a_pagar, 0);
    const teamAPagarPagado = vendors.reduce((s, v) => s + v.a_pagar_pagado, 0);
    const vendorsConMeta = vendors.filter(v => (v.meta_money + v.meta_units) > 0);
    const health = {
      good: vendorsConMeta.filter(v => v.health === 'good').length,
      warn: vendorsConMeta.filter(v => v.health === 'warn').length,
      danger: vendorsConMeta.filter(v => v.health === 'danger').length,
    };

    // ====== Alertas derivadas ======
    const alerts = [];
    // Sin venta hace mucho
    for (const v of vendorsConMeta) {
      const d = v.days_since_last_sale;
      if (d === null || d >= 7) {
        alerts.push({
          type: 'no_sales',
          severity: d === null || d >= 14 ? 'danger' : 'warn',
          vendor_id: v.salesperson_id,
          vendor_name: v.name,
          message: d === null
            ? `${v.name} sin ventas confirmadas este mes`
            : `${v.name} sin venta hace ${d} días`,
        });
      }
    }
    // Saturados (muchas tareas atrasadas)
    for (const v of vendorsConMeta) {
      if (v.tareas_atrasadas >= 5) {
        alerts.push({
          type: 'overloaded_tasks',
          severity: v.tareas_atrasadas >= 15 ? 'danger' : 'warn',
          vendor_id: v.salesperson_id,
          vendor_name: v.name,
          message: `${v.name} tiene ${v.tareas_atrasadas} tareas atrasadas (${v.tareas_pendientes} pendientes)`,
        });
      }
    }
    // En riesgo
    for (const v of vendorsConMeta) {
      if (v.health === 'danger') {
        alerts.push({
          type: 'at_risk',
          severity: 'danger',
          vendor_id: v.salesperson_id,
          vendor_name: v.name,
          message: `${v.name} en riesgo: ${v.porcentaje}% vs ${pctEsperado.toFixed(0)}% esperado`,
        });
      }
    }
    // Tango en revisión
    if (tangoInReview > 0) {
      alerts.push({
        type: 'tango_review',
        severity: 'info',
        message: `${tangoInReview} venta${tangoInReview === 1 ? '' : 's'} de Tango en revisión (no suman a metas)`,
      });
    }
    // Sin asignar
    if (unassignedClients > 0) {
      alerts.push({
        type: 'unassigned_clients',
        severity: 'warn',
        message: `${unassignedClients} cliente${unassignedClients === 1 ? '' : 's'} en seguimiento sin vendedor asignado`,
      });
    }

    res.json({
      period: { year, month },
      business_days: businessDays,
      summary: {
        total_vendors: vendors.length,
        vendors_con_meta: vendorsConMeta.length,
        team_goal_money: Math.round(teamGoalMoney * 100) / 100,
        team_sold_money: Math.round(teamSoldMoney * 100) / 100,
        team_remaining_money: Math.round(Math.max(0, teamGoalMoney - teamSoldMoney) * 100) / 100,
        team_goal_units: teamGoalUnits,
        team_sold_units: teamSoldUnits,
        team_pct_money: teamPctMoney,
        team_overdue_tasks: teamOverdueTasks,
        team_pending_tasks: teamPendingTasks,
        team_a_pagar: Math.round(teamAPagar * 100) / 100,
        team_a_pagar_pagado: Math.round(teamAPagarPagado * 100) / 100,
        team_a_pagar_pendiente: Math.round(Math.max(0, teamAPagar - teamAPagarPagado) * 100) / 100,
        tango_in_review: tangoInReview,
        unassigned_clients: unassignedClients,
        pct_esperado: pctEsperado,
        health,
      },
      // Solo vendedores con metas asignadas este mes. Los sin meta no
      // se muestran (eran ruido en la tabla del director).
      vendors: vendors
        .filter(v => (v.meta_money + v.meta_units) > 0)
        .sort((a, b) => b.porcentaje - a.porcentaje),
      alerts,
    });
  } catch (err) {
    console.error('[directorController] error:', err);
    return res.status(500).json({ error: 'Error obteniendo panel director' });
  }
};
