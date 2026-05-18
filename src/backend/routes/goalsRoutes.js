import express from 'express';
import { query } from '../database/db.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import {
    businessDaysInMonth,
    businessDaysRemaining,
    businessDaysElapsed,
} from '../utils/businessDays.js';

const router = express.Router();

router.use(authenticateToken);

// Categorías canónicas usadas por el módulo de metas operativas.
// CLARO_TV / CLOUD / MPLS no diferencian NEW vs REN — siempre NEW.
const PRODUCT_CATEGORIES = [
    { product_type: 'FIJO',     sale_type: 'NEW', label: 'Fijo New' },
    { product_type: 'FIJO',     sale_type: 'REN', label: 'Fijo Ren' },
    { product_type: 'MOVIL',    sale_type: 'NEW', label: 'Movil New' },
    { product_type: 'MOVIL',    sale_type: 'REN', label: 'Movil Ren' },
    { product_type: 'CLARO_TV', sale_type: 'NEW', label: 'ClaroTV' },
    { product_type: 'CLOUD',    sale_type: 'NEW', label: 'Cloud' },
    { product_type: 'MPLS',     sale_type: 'NEW', label: 'MPLS' },
];

const VALID_PRODUCT_TYPES = new Set(PRODUCT_CATEGORIES.map((c) => c.product_type));
const VALID_SALE_TYPES = new Set(['NEW', 'REN']);

// Tipo de meta por categoría: 'money' (target_revenue) o 'units' (target_units).
// Fijo y MPLS son metas en dólares; Móvil/ClaroTV/Cloud son metas en unidades.
const CATEGORY_GOAL_TYPE = Object.freeze({
    'FIJO|NEW':     'money',
    'FIJO|REN':     'money',
    'MOVIL|NEW':    'units',
    'MOVIL|REN':    'units',
    'CLARO_TV|NEW': 'units',
    'CLOUD|NEW':    'units',
    'MPLS|NEW':     'money',
});

function getGoalType(productType, saleType) {
    return CATEGORY_GOAL_TYPE[`${productType}|${saleType}`] || 'units';
}

let ensureSchemaPromise = null;
function ensureUnitGoalsSchema() {
    if (ensureSchemaPromise) return ensureSchemaPromise;
    ensureSchemaPromise = (async () => {
        await query(`ALTER TABLE product_goals ADD COLUMN IF NOT EXISTS target_units INTEGER DEFAULT 0`);
        await query(`ALTER TABLE product_goals ADD COLUMN IF NOT EXISTS product_type TEXT NULL`);
        await query(`ALTER TABLE product_goals ADD COLUMN IF NOT EXISTS sale_type   TEXT NULL`);
        // product_id era NOT NULL para metas de revenue. Las metas en unidades no tienen product_id.
        try { await query(`ALTER TABLE product_goals ALTER COLUMN product_id DROP NOT NULL`); } catch (_) { /* ya nullable */ }
        await query(`
            CREATE UNIQUE INDEX IF NOT EXISTS product_goals_unit_uniq
            ON product_goals (vendor_id, product_type, sale_type, period_year, period_month)
            WHERE product_type IS NOT NULL AND sale_type IS NOT NULL
        `);
    })().catch((error) => {
        ensureSchemaPromise = null;
        throw error;
    });
    return ensureSchemaPromise;
}

function isPastMonth(year, month) {
    const now = new Date();
    const currentYM = now.getFullYear() * 12 + now.getMonth();
    const requested = (Number(year) || 0) * 12 + ((Number(month) || 0) - 1);
    return requested < currentYM;
}

function classifySaleType(productType, saleType) {
    if (productType === 'CLARO_TV' || productType === 'CLOUD' || productType === 'MPLS') return 'NEW';
    return saleType === 'REN' ? 'REN' : 'NEW';
}

function computeStatus(percentDone, percentExpected) {
    const diff = percentDone - percentExpected;
    if (diff >= -5) return 'en_ritmo';
    if (diff >= -15) return 'empuja';
    return 'enfoque_hoy';
}

const mapGoalRow = (row) => ({
    id: row.id,
    vendor_id: row.vendor_id,
    vendor_name: row.vendor_name,
    salesperson_id: row.salesperson_id,
    product_id: row.product_id,
    product_name: row.product_name,
    period_type: row.period_type,
    period_year: row.period_year,
    period_month: row.period_month,
    period_quarter: row.period_quarter,
    target_amount: Number(row.target_revenue ?? 0),
    current_amount: Number(row.current_revenue ?? 0),
    description: row.description,
    is_active: row.is_active ?? 1,
    created_at: row.created_at,
    updated_at: row.updated_at
});

const parseYearMonth = (req, res) => {
    const year = Number(req.query.year ?? req.query.period_year);
    const month = Number(req.query.month ?? req.query.period_month);

    if (!Number.isInteger(year)) {
        res.status(400).json({ error: 'year requerido' });
        return null;
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
        res.status(400).json({ error: 'month requerido' });
        return null;
    }

    return { year, month };
};

router.get('/by-period', async (req, res) => {
    const period = parseYearMonth(req, res);
    if (!period) return;

    try {
        const rows = await query(
            `SELECT pg.*, p.name AS product_name, v.name AS vendor_name, sp.id AS salesperson_id
               FROM product_goals pg
               LEFT JOIN products p ON pg.product_id::text = p.id::text
               LEFT JOIN vendors v ON pg.vendor_id = v.id
               LEFT JOIN salespeople sp ON UPPER(TRIM(sp.name)) = UPPER(TRIM(v.name))
              WHERE pg.vendor_id IS NOT NULL
                AND pg.product_id IS NOT NULL
                AND COALESCE(pg.is_active, 1) = 1
                AND pg.period_year = $1
                AND pg.period_month = $2
              ORDER BY v.name ASC, p.name ASC`,
            [period.year, period.month]
        );

        let goals = rows.map(mapGoalRow);
        if (String(req.user?.role || '').toLowerCase() === 'vendedor') {
            goals = goals.filter((goal) => String(goal.salesperson_id || '') === String(req.user?.salespersonId || ''));
        }

        res.json(goals);
    } catch (error) {
        console.error('Error obteniendo metas por periodo:', error);
        res.status(500).json({ error: 'Error obteniendo metas por periodo' });
    }
});

router.get('/performance', async (req, res) => {
    const rawMonth = String(req.query.month || '').trim();
    const match = rawMonth.match(/^(\d{4})-(\d{1,2})$/);

    if (!match) {
        return res.status(400).json({ error: 'month requerido en formato YYYY-MM' });
    }

    const year = Number(match[1]);
    const month = Number(match[2]);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return res.status(400).json({ error: 'month invalido' });
    }

    try {
        const rows = await query(
            `WITH vendor_identity AS (
                SELECT
                    v.id AS vendor_id,
                    v.name AS vendor_name,
                    COALESCE(mapped.salesperson_id, sp.id) AS salesperson_id
                FROM vendors v
                LEFT JOIN LATERAL (
                    SELECT vsm.salesperson_id
                    FROM vendor_salesperson_mapping vsm
                    WHERE vsm.vendor_id = v.id
                    ORDER BY vsm.created_at DESC NULLS LAST, vsm.salesperson_id
                    LIMIT 1
                ) mapped ON true
                LEFT JOIN salespeople sp ON UPPER(TRIM(sp.name)) = UPPER(TRIM(v.name))
            ),
            goal_totals AS (
                SELECT
                    pg.vendor_id,
                    COALESCE(SUM(pg.target_revenue), 0)::numeric AS total_goal
                FROM product_goals pg
                WHERE pg.period_year = $1
                  AND pg.period_month = $2
                  AND pg.product_id IS NOT NULL
                  AND COALESCE(pg.is_active, 1) = 1
                GROUP BY pg.vendor_id
            ),
            earned_totals AS (
                SELECT
                    c.salesperson_id,
                    COALESCE(SUM(sr.company_earnings), 0)::numeric AS total_earned
                FROM subscriber_reports sr
                JOIN subscribers s ON s.id = sr.subscriber_id
                JOIN bans b ON b.id = s.ban_id
                JOIN clients c ON c.id = b.client_id
                WHERE sr.report_month >= make_date($1::int, $2::int, 1)
                  AND sr.report_month < (make_date($1::int, $2::int, 1) + INTERVAL '1 month')
                  AND (
                    COALESCE(sr.validation_status, '') = 'confirmed'
                    OR (
                      COALESCE(sr.source, '') = 'manual'
                    )
                    OR (
                      COALESCE(sr.source, '') = 'tango'
                      AND sr.external_sale_id IS NOT NULL
                      AND sr.sync_log_id IS NOT NULL
                      AND sr.source_activation_date IS NOT NULL
                      AND sr.source_report_month IS NOT NULL
                      AND sr.raw_payload IS NOT NULL
                    )
                  )
                  AND c.salesperson_id IS NOT NULL
                GROUP BY c.salesperson_id
            )
            SELECT
                vi.vendor_id,
                vi.vendor_name,
                vi.salesperson_id,
                COALESCE(gt.total_goal, 0)::numeric AS total_goal,
                COALESCE(et.total_earned, 0)::numeric AS total_earned
            FROM vendor_identity vi
            LEFT JOIN goal_totals gt ON gt.vendor_id = vi.vendor_id
            LEFT JOIN earned_totals et ON et.salesperson_id = vi.salesperson_id
            ORDER BY vi.vendor_name ASC`,
            [year, month]
        );

        let vendors = rows.map((row) => {
            const totalGoal = Number(row.total_goal ?? 0);
            const totalEarned = Number(row.total_earned ?? 0);
            return {
                vendor_id: row.vendor_id,
                vendor_name: row.vendor_name,
                salesperson_id: row.salesperson_id,
                total_goal: totalGoal,
                total_earned: totalEarned,
                percentage: totalGoal > 0 ? Math.round((totalEarned / totalGoal) * 10000) / 100 : 0,
                remaining: Math.max(0, totalGoal - totalEarned)
            };
        });

        if (String(req.user?.role || '').toLowerCase() === 'vendedor') {
            vendors = vendors.filter((vendor) => String(vendor.salesperson_id || '') === String(req.user?.salespersonId || ''));
        }

        const totalGoal = vendors.reduce((sum, vendor) => sum + vendor.total_goal, 0);
        const totalEarned = vendors.reduce((sum, vendor) => sum + vendor.total_earned, 0);

        res.json({
            period: rawMonth,
            summary: {
                total_goal: totalGoal,
                total_earned: totalEarned,
                total_percentage: totalGoal > 0 ? Math.round((totalEarned / totalGoal) * 10000) / 100 : 0
            },
            vendors
        });
    } catch (error) {
        console.error('Error obteniendo rendimiento de metas:', error);
        res.status(500).json({ error: 'Error obteniendo rendimiento de metas' });
    }
});

// =====================================================================
// Metas operativas en UNIDADES (por product_type + sale_type)
// =====================================================================

// Resuelve vendor_id a partir del salesperson_id usando los mapeos existentes.
async function resolveVendorIdFromSalesperson(salespersonId) {
    if (!salespersonId) return null;
    const rows = await query(
        `SELECT v.id AS vendor_id
           FROM vendors v
           LEFT JOIN salespeople sp ON UPPER(TRIM(sp.name)) = UPPER(TRIM(v.name))
           LEFT JOIN vendor_salesperson_mapping vsm ON vsm.vendor_id = v.id
          WHERE sp.id::text = $1::text OR vsm.salesperson_id::text = $1::text
          ORDER BY (CASE WHEN sp.id::text = $1::text THEN 0 ELSE 1 END)
          LIMIT 1`,
        [String(salespersonId)]
    );
    return rows[0]?.vendor_id ?? null;
}

router.get('/my-day', async (req, res) => {
    try {
        await ensureUnitGoalsSchema();

        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;

        const role = String(req.user?.role || '').toLowerCase();
        let salespersonId = String(req.user?.salespersonId || '').trim() || null;

        // Admin/supervisor pueden inspeccionar el día de otro vendedor por query param.
        if ((role === 'admin' || role === 'supervisor') && req.query.salesperson_id) {
            salespersonId = String(req.query.salesperson_id).trim();
        }

        if (!salespersonId) {
            return res.json({
                period: { year, month },
                business_days: {
                    total: businessDaysInMonth(year, month),
                    elapsed: businessDaysElapsed(today, year, month),
                    remaining: businessDaysRemaining(today, year, month),
                },
                items: [],
                message: 'Usuario sin salesperson_id asociado',
            });
        }

        const vendorId = await resolveVendorIdFromSalesperson(salespersonId);

        // Las metas se cargan en Gestión/Metas por producto (description=UUID,
        // target_revenue=monto). El mismo número se interpreta como dinero o
        // unidades según la categoría del producto. Acá hacemos JOIN con
        // products para inferir product_type/sale_type desde el nombre.
        const goalsByKey = new Map();
        if (vendorId) {
            const goalRows = await query(
                `WITH product_categories AS (
                    SELECT
                        p.id::text AS product_uuid,
                        CASE
                            WHEN UPPER(TRIM(p.name)) IN ('FIJO NEW', 'FIJO REN') THEN 'FIJO'
                            WHEN UPPER(TRIM(p.name)) IN ('MOVIL NEW', 'MOVIL REN', 'MÓVIL NEW', 'MÓVIL REN') THEN 'MOVIL'
                            WHEN UPPER(TRIM(p.name)) IN ('CLARO TV', 'CLAROTV', 'TV') THEN 'CLARO_TV'
                            WHEN UPPER(TRIM(p.name)) = 'CLOUD' THEN 'CLOUD'
                            WHEN UPPER(TRIM(p.name)) = 'MPLS' THEN 'MPLS'
                            ELSE NULL
                        END AS product_type,
                        CASE
                            WHEN UPPER(TRIM(p.name)) IN ('FIJO REN', 'MOVIL REN', 'MÓVIL REN') THEN 'REN'
                            ELSE 'NEW'
                        END AS sale_type
                    FROM products p
                )
                SELECT
                    pc.product_type,
                    pc.sale_type,
                    COALESCE(pg.target_revenue, 0)::numeric AS amount
                  FROM product_goals pg
                  JOIN product_categories pc ON pc.product_uuid = pg.description
                 WHERE pg.vendor_id = $1
                   AND pg.period_year = $2
                   AND pg.period_month = $3
                   AND COALESCE(pg.is_active, 1) = 1
                   AND pc.product_type IS NOT NULL`,
                [vendorId, year, month]
            );
            for (const row of goalRows) {
                const key = `${row.product_type}|${row.sale_type}`;
                const amount = Number(row.amount || 0);
                const gt = getGoalType(row.product_type, row.sale_type);
                goalsByKey.set(key, {
                    target_units: gt === 'units' ? amount : 0,
                    target_revenue: gt === 'money' ? amount : 0,
                });
            }
        }

        // Vendido = ventas que pagan comisión en el mes (mismo filtro que /performance)
        // Clasificación por categoría inferida desde el subscriber, replicando
        // la heurística de resolveSubscriberDealType en SQL.
        const soldRows = await query(
            `WITH classified AS (
                SELECT
                    UPPER(CONCAT_WS(' ',
                        COALESCE(b.account_type, ''),
                        COALESCE(s.plan, ''),
                        COALESCE(s.line_type, ''),
                        COALESCE(s.line_kind, ''),
                        COALESCE(s.phone, '')
                    )) AS haystack,
                    UPPER(COALESCE(s.line_type, '')) AS lt,
                    COALESCE(sr.company_earnings, 0)::numeric AS earnings
                FROM subscriber_reports sr
                JOIN subscribers s ON s.id = sr.subscriber_id
                JOIN bans b ON b.id = s.ban_id
                JOIN clients c ON c.id = b.client_id
                WHERE c.salesperson_id::text = $1::text
                  AND sr.report_month >= make_date($2::int, $3::int, 1)
                  AND sr.report_month <  (make_date($2::int, $3::int, 1) + INTERVAL '1 month')
                  AND COALESCE(sr.validation_status, '') = 'confirmed'
            )
            SELECT
                CASE
                    WHEN haystack LIKE '%MPLS%'                                  THEN 'MPLS'
                    WHEN haystack LIKE '%CLOUD%'                                 THEN 'CLOUD'
                    WHEN haystack LIKE '%CLARO TV%' OR haystack LIKE '%CLAROTV%' THEN 'CLARO_TV'
                    WHEN haystack LIKE '%FIJO%' OR haystack LIKE '%FIXED%'
                         OR haystack LIKE '%INTERNET%'                            THEN 'FIJO'
                    ELSE 'MOVIL'
                END AS product_type,
                CASE
                    WHEN haystack LIKE '%MPLS%' OR haystack LIKE '%CLOUD%'
                         OR haystack LIKE '%CLARO TV%' OR haystack LIKE '%CLAROTV%' THEN 'NEW'
                    WHEN lt IN ('REN','RENOVACION','RENOVATION','RENEWAL')
                         OR haystack LIKE '%RENOV%'                                  THEN 'REN'
                    ELSE 'NEW'
                END AS sale_type,
                COUNT(*)::int AS sold_units,
                COALESCE(SUM(earnings), 0)::numeric AS sold_revenue
            FROM classified
            GROUP BY 1, 2`,
            [salespersonId, year, month]
        );

        const soldByKey = new Map();
        for (const row of soldRows) {
            soldByKey.set(`${row.product_type}|${row.sale_type}`, {
                sold_units: Number(row.sold_units || 0),
                sold_revenue: Number(row.sold_revenue || 0),
            });
        }

        const totalBusinessDays = businessDaysInMonth(year, month);
        const elapsed = businessDaysElapsed(today, year, month);
        const remaining = businessDaysRemaining(today, year, month);

        const items = PRODUCT_CATEGORIES.map((cat) => {
            const key = `${cat.product_type}|${cat.sale_type}`;
            const goalType = getGoalType(cat.product_type, cat.sale_type);
            const goal = goalsByKey.get(key) || { target_units: 0, target_revenue: 0 };
            const sold = soldByKey.get(key) || { sold_units: 0, sold_revenue: 0 };
            const meta = goalType === 'money' ? goal.target_revenue : goal.target_units;
            const vendido = goalType === 'money' ? sold.sold_revenue : sold.sold_units;
            const faltan = Math.max(0, meta - vendido);
            const cuotaHoy = remaining > 0 ? faltan / remaining : faltan;
            const porcentaje = meta > 0 ? Math.round((vendido / meta) * 10000) / 100 : 0;
            const porcentajeEsperado = totalBusinessDays > 0
                ? Math.round((elapsed / totalBusinessDays) * 10000) / 100
                : 0;
            const estado = meta === 0 ? 'en_ritmo' : computeStatus(porcentaje, porcentajeEsperado);
            const round2 = (n) => Math.round(n * 100) / 100;
            return {
                product_type: cat.product_type,
                sale_type: cat.sale_type,
                label: cat.label,
                goal_type: goalType,
                meta_amount: round2(meta),
                vendido_amount: round2(vendido),
                // Compat: nombres viejos solo para 'units'
                meta_unidades: goalType === 'units' ? meta : 0,
                vendido_unidades: goalType === 'units' ? vendido : 0,
                faltan: round2(faltan),
                cuota_hoy: round2(cuotaHoy),
                porcentaje,
                porcentaje_esperado: porcentajeEsperado,
                estado,
            };
        });

        res.json({
            period: { year, month },
            business_days: { total: totalBusinessDays, elapsed, remaining },
            vendor_id: vendorId,
            salesperson_id: salespersonId,
            items,
        });
    } catch (error) {
        console.error('Error en /api/goals/my-day:', error);
        res.status(500).json({ error: 'Error obteniendo metas del día' });
    }
});

// =====================================================================
// Evolución diaria del vendido (gráfico ejecutivo de Mi Día)
// =====================================================================
// Devuelve, por cada día del mes con ventas confirmadas, cuánto se
// vendió ese día separado por dinero (FIJO + MPLS) y unidades (MOVIL +
// CLARO_TV + CLOUD). Misma clasificación y mismo filtro de validación
// que /api/goals/my-day. El acumulado y la meta acumulada se calculan
// client-side desde estos puntos + business_days + totales de meta.
router.get('/daily-evolution', async (req, res) => {
    try {
        await ensureUnitGoalsSchema();

        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;

        const role = String(req.user?.role || '').toLowerCase();
        let salespersonId = String(req.user?.salespersonId || '').trim() || null;
        if ((role === 'admin' || role === 'supervisor') && req.query.salesperson_id) {
            salespersonId = String(req.query.salesperson_id).trim();
        }

        if (!salespersonId) {
            return res.json({
                period: { year, month },
                business_days: {
                    total: businessDaysInMonth(year, month),
                    elapsed: businessDaysElapsed(today, year, month),
                    remaining: businessDaysRemaining(today, year, month),
                },
                series: [],
                message: 'Usuario sin salesperson_id asociado',
            });
        }

        // Vendido por día clasificado por categoría money/units, usando la
        // misma heurística de haystack que /api/goals/my-day.
        const rows = await query(
            `WITH classified AS (
                SELECT
                    DATE(sr.report_month) AS sale_date,
                    UPPER(CONCAT_WS(' ',
                        COALESCE(b.account_type, ''),
                        COALESCE(s.plan, ''),
                        COALESCE(s.line_type, ''),
                        COALESCE(s.line_kind, ''),
                        COALESCE(s.phone, '')
                    )) AS haystack,
                    COALESCE(sr.company_earnings, 0)::numeric AS earnings
                FROM subscriber_reports sr
                JOIN subscribers s ON s.id = sr.subscriber_id
                JOIN bans b ON b.id = s.ban_id
                JOIN clients c ON c.id = b.client_id
                WHERE c.salesperson_id::text = $1::text
                  AND sr.report_month >= make_date($2::int, $3::int, 1)
                  AND sr.report_month <  (make_date($2::int, $3::int, 1) + INTERVAL '1 month')
                  AND COALESCE(sr.validation_status, '') = 'confirmed'
            )
            SELECT
                sale_date,
                COALESCE(SUM(CASE
                    WHEN haystack LIKE '%MPLS%'                                THEN earnings
                    WHEN haystack LIKE '%FIJO%' OR haystack LIKE '%FIXED%'
                         OR haystack LIKE '%INTERNET%'                          THEN earnings
                    ELSE 0
                END), 0)::float AS money_sold_day,
                COALESCE(SUM(CASE
                    WHEN haystack LIKE '%MPLS%'                                THEN 0
                    WHEN haystack LIKE '%FIJO%' OR haystack LIKE '%FIXED%'
                         OR haystack LIKE '%INTERNET%'                          THEN 0
                    ELSE 1
                END), 0)::int AS units_sold_day
            FROM classified
            GROUP BY sale_date
            ORDER BY sale_date ASC`,
            [salespersonId, year, month]
        );

        const series = rows.map((r) => ({
            date: r.sale_date instanceof Date
                ? r.sale_date.toISOString().slice(0, 10)
                : String(r.sale_date).slice(0, 10),
            money_sold_day: Number(r.money_sold_day || 0),
            units_sold_day: Number(r.units_sold_day || 0),
        }));

        res.json({
            period: { year, month },
            business_days: {
                total: businessDaysInMonth(year, month),
                elapsed: businessDaysElapsed(today, year, month),
                remaining: businessDaysRemaining(today, year, month),
            },
            salesperson_id: salespersonId,
            series,
        });
    } catch (error) {
        console.error('Error en /api/goals/daily-evolution:', error);
        res.status(500).json({ error: 'Error obteniendo evolución diaria' });
    }
});

router.get('/units', requireRole(['admin', 'supervisor']), async (req, res) => {
    const vendorId = Number(req.query.vendor_id);
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!Number.isInteger(vendorId) || vendorId <= 0) {
        return res.status(400).json({ error: 'vendor_id requerido' });
    }
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return res.status(400).json({ error: 'year/month requeridos' });
    }

    try {
        await ensureUnitGoalsSchema();
        const rows = await query(
            `SELECT product_type, sale_type, target_units, target_revenue
               FROM product_goals
              WHERE vendor_id = $1
                AND period_year = $2
                AND period_month = $3
                AND product_type IS NOT NULL
                AND sale_type IS NOT NULL`,
            [vendorId, year, month]
        );
        const byKey = new Map();
        for (const row of rows) {
            byKey.set(`${row.product_type}|${row.sale_type}`, {
                target_units: Number(row.target_units || 0),
                target_revenue: Number(row.target_revenue || 0),
            });
        }
        const items = PRODUCT_CATEGORIES.map((cat) => {
            const goalType = getGoalType(cat.product_type, cat.sale_type);
            const stored = byKey.get(`${cat.product_type}|${cat.sale_type}`) || { target_units: 0, target_revenue: 0 };
            const amount = goalType === 'money' ? stored.target_revenue : stored.target_units;
            return {
                product_type: cat.product_type,
                sale_type: cat.sale_type,
                label: cat.label,
                goal_type: goalType,
                target_amount: amount,
                // Compat con clientes viejos del endpoint
                target_units: goalType === 'units' ? amount : 0,
            };
        });
        res.json({
            vendor_id: vendorId,
            period: { year, month },
            locked: isPastMonth(year, month),
            items,
        });
    } catch (error) {
        console.error('Error obteniendo metas en unidades:', error);
        res.status(500).json({ error: 'Error obteniendo metas en unidades' });
    }
});

router.post('/units', requireRole(['admin', 'supervisor']), async (req, res) => {
    const vendorId = Number(req.body?.vendor_id);
    const year = Number(req.body?.year);
    const month = Number(req.body?.month);
    const items = Array.isArray(req.body?.items) ? req.body.items : null;

    if (!Number.isInteger(vendorId) || vendorId <= 0) {
        return res.status(400).json({ error: 'vendor_id requerido' });
    }
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return res.status(400).json({ error: 'year/month requeridos' });
    }
    if (!items) {
        return res.status(400).json({ error: 'items requerido (array)' });
    }
    if (isPastMonth(year, month)) {
        return res.status(403).json({ error: 'No se pueden editar metas de meses pasados' });
    }

    try {
        await ensureUnitGoalsSchema();

        for (const raw of items) {
            const productType = String(raw?.product_type || '').trim().toUpperCase();
            const saleType = String(raw?.sale_type || '').trim().toUpperCase();

            if (!VALID_PRODUCT_TYPES.has(productType) || !VALID_SALE_TYPES.has(saleType)) {
                return res.status(400).json({ error: `Categoría inválida: ${productType}/${saleType}` });
            }

            const goalType = getGoalType(productType, saleType);
            // Acepta target_amount (nuevo) o target_units (legacy) según tipo.
            const rawAmount = raw?.target_amount ?? raw?.target_units ?? raw?.target_revenue ?? 0;
            const amount = Math.max(0, Number(rawAmount) || 0);
            const targetUnits = goalType === 'units' ? Math.floor(amount) : 0;
            const targetRevenue = goalType === 'money' ? amount : 0;

            await query(
                `INSERT INTO product_goals
                    (vendor_id, product_id, product_type, sale_type,
                     period_type, period_year, period_month, period_quarter,
                     target_revenue, current_revenue, target_units, description, is_active)
                 VALUES ($1, NULL, $2, $3, 'monthly', $4, $5, NULL, $6, 0, $7, '', 1)
                 ON CONFLICT (vendor_id, product_type, sale_type, period_year, period_month)
                   WHERE product_type IS NOT NULL AND sale_type IS NOT NULL
                 DO UPDATE SET target_units   = EXCLUDED.target_units,
                               target_revenue = EXCLUDED.target_revenue,
                               updated_at     = NOW(),
                               is_active      = 1`,
                [vendorId, productType, saleType, year, month, targetRevenue, targetUnits]
            );
        }

        res.json({ ok: true, updated: items.length });
    } catch (error) {
        console.error('Error guardando metas en unidades:', error);
        res.status(500).json({ error: 'Error guardando metas en unidades' });
    }
});

// =====================================================================
// GET /api/goals/admin-overview — Centro de control admin/director.
// Devuelve, para un mes, un agregado por vendedor con meta, vendido,
// pendientes, anomalías y última actividad. Solo lectura.
// Reglas:
//   - Vendido suma SOLO subscriber_reports con validation_status='confirmed'.
//   - needs_review se reporta como anomalias_count (NO suma a vendido).
// =====================================================================
router.get('/admin-overview', requireRole(['admin', 'supervisor']), async (req, res) => {
    try {
        await ensureUnitGoalsSchema();

        const monthRaw = String(req.query.month || '').trim();
        let year, month;
        if (/^\d{4}-\d{1,2}$/.test(monthRaw)) {
            year = Number(monthRaw.slice(0, 4));
            month = Number(monthRaw.split('-')[1]);
        } else {
            const today = new Date();
            year = today.getFullYear();
            month = today.getMonth() + 1;
        }

        // 1. Lista de vendedores
        const spRows = await query(`SELECT id, name, role FROM salespeople ORDER BY name`);

        // 2. Metas agregadas por salesperson_id (suma de target_revenue por mes)
        //    Solo cuenta metas con producto válido mapeable a una categoría.
        const goalRows = await query(
            `WITH product_categories AS (
                SELECT
                    p.id::text AS product_uuid,
                    CASE
                        WHEN UPPER(TRIM(p.name)) IN ('FIJO NEW', 'FIJO REN') THEN 'FIJO'
                        WHEN UPPER(TRIM(p.name)) IN ('MOVIL NEW', 'MOVIL REN', 'MÓVIL NEW', 'MÓVIL REN') THEN 'MOVIL'
                        WHEN UPPER(TRIM(p.name)) IN ('CLARO TV', 'CLAROTV', 'TV') THEN 'CLARO_TV'
                        WHEN UPPER(TRIM(p.name)) = 'CLOUD' THEN 'CLOUD'
                        WHEN UPPER(TRIM(p.name)) = 'MPLS' THEN 'MPLS'
                        ELSE NULL
                    END AS product_type,
                    CASE
                        WHEN UPPER(TRIM(p.name)) IN ('FIJO REN', 'MOVIL REN', 'MÓVIL REN') THEN 'REN'
                        ELSE 'NEW'
                    END AS sale_type
                FROM products p
            )
            SELECT
                vsm.salesperson_id::text AS salesperson_id,
                pc.product_type,
                pc.sale_type,
                COALESCE(pg.target_revenue, 0)::numeric AS amount
              FROM product_goals pg
              JOIN vendor_salesperson_mapping vsm ON vsm.vendor_id = pg.vendor_id
              JOIN product_categories pc ON pc.product_uuid = pg.description
             WHERE pg.period_year = $1
               AND pg.period_month = $2
               AND COALESCE(pg.is_active, 1) = 1
               AND pc.product_type IS NOT NULL`,
            [year, month]
        );

        // 3. Vendido confirmed agregado por vendedor + categoría
        //    Misma clasificación que /my-day.
        const soldRows = await query(
            `WITH classified AS (
                SELECT
                    c.salesperson_id::text AS salesperson_id,
                    UPPER(CONCAT_WS(' ',
                        COALESCE(b.account_type, ''),
                        COALESCE(s.plan, ''),
                        COALESCE(s.line_type, ''),
                        COALESCE(s.line_kind, ''),
                        COALESCE(s.phone, '')
                    )) AS haystack,
                    UPPER(COALESCE(s.line_type, '')) AS lt,
                    COALESCE(sr.company_earnings, 0)::numeric AS earnings
                FROM subscriber_reports sr
                JOIN subscribers s ON s.id = sr.subscriber_id
                JOIN bans b ON b.id = s.ban_id
                JOIN clients c ON c.id = b.client_id
                WHERE sr.report_month >= make_date($1::int, $2::int, 1)
                  AND sr.report_month <  (make_date($1::int, $2::int, 1) + INTERVAL '1 month')
                  AND COALESCE(sr.validation_status, '') = 'confirmed'
                  AND c.salesperson_id IS NOT NULL
            )
            SELECT
                salesperson_id,
                CASE
                    WHEN haystack LIKE '%MPLS%'                                  THEN 'MPLS'
                    WHEN haystack LIKE '%CLOUD%'                                 THEN 'CLOUD'
                    WHEN haystack LIKE '%CLARO TV%' OR haystack LIKE '%CLAROTV%' THEN 'CLARO_TV'
                    WHEN haystack LIKE '%FIJO%' OR haystack LIKE '%FIXED%'
                         OR haystack LIKE '%INTERNET%'                            THEN 'FIJO'
                    ELSE 'MOVIL'
                END AS product_type,
                CASE
                    WHEN haystack LIKE '%MPLS%' OR haystack LIKE '%CLOUD%'
                         OR haystack LIKE '%CLARO TV%' OR haystack LIKE '%CLAROTV%' THEN 'NEW'
                    WHEN lt IN ('REN','RENOVACION','RENOVATION','RENEWAL')
                         OR haystack LIKE '%RENOV%'                                  THEN 'REN'
                    ELSE 'NEW'
                END AS sale_type,
                COUNT(*)::int AS sold_units,
                COALESCE(SUM(earnings), 0)::numeric AS sold_revenue
            FROM classified
            GROUP BY 1, 2, 3`,
            [year, month]
        );

        // 4. Anomalías (needs_review) por vendedor — NO suman a vendido.
        const anomRows = await query(
            `SELECT c.salesperson_id::text AS salesperson_id,
                    COUNT(*)::int AS anomalias_count
               FROM subscriber_reports sr
               JOIN subscribers s ON s.id = sr.subscriber_id
               JOIN bans b ON b.id = s.ban_id
               JOIN clients c ON c.id = b.client_id
              WHERE sr.report_month >= make_date($1::int, $2::int, 1)
                AND sr.report_month <  (make_date($1::int, $2::int, 1) + INTERVAL '1 month')
                AND COALESCE(sr.validation_status, '') = 'needs_review'
                AND c.salesperson_id IS NOT NULL
              GROUP BY c.salesperson_id`,
            [year, month]
        );

        // 5. Tareas pendientes por vendedor (agent_tasks + crm_tasks)
        const tasksRows = await query(
            `WITH agent_pending AS (
                SELECT assigned_salesperson_id::text AS salesperson_id, COUNT(*)::int AS cnt
                  FROM agent_tasks
                 WHERE COALESCE(LOWER(status), '') NOT IN ('completed','done','cancelled','closed')
                   AND assigned_salesperson_id IS NOT NULL
                 GROUP BY assigned_salesperson_id
            ),
            crm_pending AS (
                SELECT u.salesperson_id::text AS salesperson_id, COUNT(*)::int AS cnt
                  FROM crm_tasks t
                  JOIN users_auth u ON u.id::text = t.assigned_user_id::text
                 WHERE COALESCE(LOWER(t.status), '') NOT IN ('completed','done','cancelled','closed')
                   AND u.salesperson_id IS NOT NULL
                 GROUP BY u.salesperson_id
            ),
            unioned AS (
                SELECT * FROM agent_pending
                UNION ALL
                SELECT * FROM crm_pending
            )
            SELECT salesperson_id, SUM(cnt)::int AS total
              FROM unioned
             GROUP BY salesperson_id`
        );

        // 6. Última actividad: máximo entre subscriber_reports.updated_at y tasks
        const activityRows = await query(
            `WITH sr_act AS (
                SELECT c.salesperson_id::text AS salesperson_id, MAX(sr.updated_at) AS ts
                  FROM subscriber_reports sr
                  JOIN subscribers s ON s.id = sr.subscriber_id
                  JOIN bans b ON b.id = s.ban_id
                  JOIN clients c ON c.id = b.client_id
                 WHERE c.salesperson_id IS NOT NULL
                 GROUP BY c.salesperson_id
            ),
            agent_act AS (
                SELECT assigned_salesperson_id::text AS salesperson_id, MAX(updated_at) AS ts
                  FROM agent_tasks
                 WHERE assigned_salesperson_id IS NOT NULL
                 GROUP BY assigned_salesperson_id
            ),
            crm_act AS (
                SELECT u.salesperson_id::text AS salesperson_id, MAX(t.updated_at) AS ts
                  FROM crm_tasks t
                  JOIN users_auth u ON u.id::text = t.assigned_user_id::text
                 WHERE u.salesperson_id IS NOT NULL
                 GROUP BY u.salesperson_id
            )
            SELECT salesperson_id, MAX(ts) AS ultima_actividad_at
              FROM (
                SELECT * FROM sr_act
                UNION ALL SELECT * FROM agent_act
                UNION ALL SELECT * FROM crm_act
              ) u
             WHERE ts IS NOT NULL
             GROUP BY salesperson_id`
        );

        // Combinación en JS
        const goalsBySp = new Map();
        for (const row of goalRows) {
            const key = String(row.salesperson_id);
            const acc = goalsBySp.get(key) || { meta_money_total: 0, meta_units_total: 0 };
            const goalType = getGoalType(row.product_type, row.sale_type);
            const amount = Number(row.amount || 0);
            if (goalType === 'money') acc.meta_money_total += amount;
            else acc.meta_units_total += amount;
            goalsBySp.set(key, acc);
        }

        const soldBySp = new Map();
        for (const row of soldRows) {
            const key = String(row.salesperson_id);
            const acc = soldBySp.get(key) || { vendido_money: 0, vendido_units: 0 };
            const goalType = getGoalType(row.product_type, row.sale_type);
            if (goalType === 'money') acc.vendido_money += Number(row.sold_revenue || 0);
            else acc.vendido_units += Number(row.sold_units || 0);
            soldBySp.set(key, acc);
        }

        const anomBySp = new Map(anomRows.map((r) => [String(r.salesperson_id), Number(r.anomalias_count || 0)]));
        const tasksBySp = new Map(tasksRows.map((r) => [String(r.salesperson_id), Number(r.total || 0)]));
        const activityBySp = new Map(activityRows.map((r) => [String(r.salesperson_id), r.ultima_actividad_at]));

        const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

        const items = spRows.map((sp) => {
            const id = String(sp.id);
            const g = goalsBySp.get(id) || { meta_money_total: 0, meta_units_total: 0 };
            const s = soldBySp.get(id) || { vendido_money: 0, vendido_units: 0 };
            const pctMoney = g.meta_money_total > 0
                ? Math.round((s.vendido_money / g.meta_money_total) * 10000) / 100
                : 0;
            const pctUnits = g.meta_units_total > 0
                ? Math.round((s.vendido_units / g.meta_units_total) * 10000) / 100
                : 0;
            // Porcentaje combinado: promedio ponderado simple (cuando hay ambas dimensiones).
            const denom = (g.meta_money_total > 0 ? 1 : 0) + (g.meta_units_total > 0 ? 1 : 0);
            const pctCombined = denom > 0
                ? Math.round(((pctMoney + pctUnits) / denom) * 100) / 100
                : 0;
            return {
                salesperson_id: id,
                salesperson_name: sp.name,
                role: sp.role || null,
                meta_money_total: round2(g.meta_money_total),
                meta_units_total: Math.round(g.meta_units_total),
                vendido_money: round2(s.vendido_money),
                vendido_units: Math.round(s.vendido_units),
                porcentaje_money: pctMoney,
                porcentaje_units: pctUnits,
                porcentaje_combinado: pctCombined,
                pendientes_count: tasksBySp.get(id) || 0,
                anomalias_count: anomBySp.get(id) || 0,
                ultima_actividad_at: activityBySp.get(id) || null,
            };
        });

        res.json({ period: { year, month }, items });
    } catch (error) {
        console.error('Error en /api/goals/admin-overview:', error);
        res.status(500).json({ error: 'Error obteniendo overview', details: error.message });
    }
});

export default router;
