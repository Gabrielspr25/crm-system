import { query } from '../database/db.js';
import { serverError } from '../middlewares/errorHandler.js';

// ---------------------------------------------------------------------------
// Helpers: mapeo a nombre canónico de producto.
// Prioridad: lineKind (Tango ventatipoid, fuente de verdad) → fallback heurístico
// por accountType. CONVERGENTE NO define el producto: solo es atributo del BAN.
// ---------------------------------------------------------------------------
function getProductCategory(lineKind, accountType, lineType) {
    const lt = String(lineType || '').toUpperCase().trim();
    const isRen = lt === 'REN' || lt === 'RENOVACION';

    const kind = String(lineKind || '').toLowerCase().trim();
    if (kind === 'fijo')  return isRen ? 'Fijo Ren'  : 'Fijo New';
    if (kind === 'movil') return isRen ? 'Movil Ren' : 'Movil New';

    // Fallback (subscribers sin line_kind clasificado todavía)
    const at = String(accountType || '').toUpperCase().trim().replace(/^CONVERGENTE$/, 'MOVIL');
    if (at === 'FIJO' || at === 'FIXED' || at === 'PYMES') {
        return isRen ? 'Fijo Ren' : 'Fijo New';
    }
    if (at === 'MOVIL' || at === 'MÓVIL' || at === 'MOBILE' || at === 'UPDATE') {
        return isRen ? 'Movil Ren' : 'Movil New';
    }
    if (at === 'RESIDENCIAL') {
        return 'Claro TV';
    }
    return null;
}

// Normaliza el nombre de un producto de la tabla `products` al mismo conjunto canónico
function matchProductByName(name) {
    const n = String(name || '').toLowerCase().trim();
    if (n.includes('fijo') && (n.includes('ren') || n.includes('renov'))) return 'Fijo Ren';
    if (n.includes('fijo') && n.includes('new')) return 'Fijo New';
    if ((n.includes('movil') || n.includes('móvil') || n.includes('movil')) && (n.includes('ren') || n.includes('renov'))) return 'Movil Ren';
    if ((n.includes('movil') || n.includes('móvil')) && n.includes('new')) return 'Movil New';
    if (n.includes('mpls')) return 'MPLS';
    if (n.includes('cloud')) return 'Cloud';
    if (n.includes('tv') || n.includes('claro tv')) return 'Claro TV';
    return name; // fallback: usar nombre original
}

const MONEY_PRODUCT_NAMES = new Set(['Fijo New', 'Fijo Ren', 'MPLS']);
const QUANTITY_PRODUCT_NAMES = new Set(['Movil New', 'Movil Ren', 'Claro TV', 'Cloud']);

function getProductUnit(productName) {
    return MONEY_PRODUCT_NAMES.has(productName) ? 'money' : 'quantity';
}

function emptyProductStat(name, target = 0) {
    const unit = getProductUnit(name);
    const numericTarget = parseFloat(target) || 0;
    return {
        product_name: name,
        unit,
        target: numericTarget,
        target_money: unit === 'money' ? numericTarget : 0,
        target_lines: unit === 'quantity' ? numericTarget : 0,
        actual: 0,
        actual_money: 0,
        actual_lines: 0,
        revenue: 0,
        pct: 0,
    };
}

function applyDisplayActual(product) {
    product.actual = product.unit === 'money' ? product.actual_money : product.actual_lines;
    product.target = product.unit === 'money' ? product.target_money : product.target_lines;
    product.pct = product.target > 0
        ? Math.min(Math.round((product.actual / product.target) * 100), 999)
        : 0;
}

// ---------------------------------------------------------------------------
// GET /api/dashboard/resumen?year=YYYY&month=MM
// ---------------------------------------------------------------------------
export async function getDashboardResumen(req, res) {
    try {
        const { year, month } = req.query;
        if (!year || !month) return res.status(400).json({ error: 'year y month requeridos' });
        const y = parseInt(year, 10);
        const m = parseInt(month, 10);

        // 1. Productos disponibles
        const productRows = await query(`SELECT id::text, name FROM products ORDER BY name`);
        const productMap = {}; // uuid → nombre canónico
        productRows.forEach(p => { productMap[p.id] = matchProductByName(p.name); });

        // 2. Metas del negocio para el período
        const bizGoalRows = await query(
            `SELECT product_id, target_amount FROM business_goals
             WHERE period_year=$1 AND period_month=$2`,
            [y, m]
        );
        const businessGoalByProduct = {}; // nombre canónico → target
        bizGoalRows.forEach(r => {
            const canonical = productMap[r.product_id];
            if (canonical) businessGoalByProduct[canonical] = parseFloat(r.target_amount);
        });

        // 3. Ventas reales del período (subscribers creados en el mes)
        const salesRows = await query(`
            SELECT
                b.account_type,
                s.line_type,
                s.line_kind,
                sp.name   AS salesperson_name,
                v.id      AS vendor_id,
                v.name    AS vendor_name,
                COUNT(s.id)::int           AS sale_count,
                COALESCE(SUM(s.monthly_value), 0)::numeric AS total_revenue
            FROM subscribers s
            JOIN bans b         ON b.id  = s.ban_id
            JOIN clients c      ON c.id  = b.client_id
            LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
            LEFT JOIN vendors v
                ON UPPER(TRIM(v.name)) = UPPER(TRIM(sp.name))
            WHERE EXTRACT(YEAR  FROM s.created_at) = $1
              AND EXTRACT(MONTH FROM s.created_at) = $2
            GROUP BY b.account_type, s.line_type, s.line_kind, sp.name, v.id, v.name
            ORDER BY v.name NULLS LAST
        `, [y, m]);

        // 4. Metas individuales por vendedor (product_goals)
        const vendorGoalRows = await query(`
            SELECT
                pg.vendor_id,
                v.name   AS vendor_name,
                pg.description AS product_id,
                pg.target_revenue AS amount
            FROM product_goals pg
            JOIN vendors v ON v.id = pg.vendor_id
            WHERE pg.period_year=$1 AND pg.period_month=$2
              AND pg.product_id IS NOT NULL
        `, [y, m]);
        // { vendor_id → { vendor_name, goals: { canonical → amount } } }
        const vendorGoals = {};
        vendorGoalRows.forEach(r => {
            if (!vendorGoals[r.vendor_id]) {
                vendorGoals[r.vendor_id] = { vendor_name: r.vendor_name, goals: {} };
            }
            const canonical = productMap[r.product_id] || matchProductByName(r.product_id);
            vendorGoals[r.vendor_id].goals[canonical] = parseFloat(r.amount);
        });

        // 5. Armar resumen por producto (negocio)
        const byProduct = {};
        // Inicializar con metas
        Object.entries(businessGoalByProduct).forEach(([name, target]) => {
            byProduct[name] = emptyProductStat(name, target);
        });
        // Sumar ventas reales
        salesRows.forEach(r => {
            const cat = getProductCategory(r.line_kind, r.account_type, r.line_type);
            if (!cat) return;
            if (!byProduct[cat]) byProduct[cat] = emptyProductStat(cat, 0);
            const count = parseInt(r.sale_count, 10) || 0;
            const revenue = parseFloat(r.total_revenue) || 0;
            byProduct[cat].actual_lines += count;
            byProduct[cat].actual_money += revenue;
            byProduct[cat].revenue += revenue;
        });
        // Calcular % cumplimiento
        Object.values(byProduct).forEach(p => {
            applyDisplayActual(p);
        });

        // 6. Armar resumen por vendedor
        const byVendor = {};
        salesRows.forEach(r => {
            const vid  = r.vendor_id  ?? `sp__${r.salesperson_name}`;
            const vname = r.vendor_name || r.salesperson_name || 'Sin asignar';
            if (!byVendor[vid]) {
                byVendor[vid] = {
                    vendor_id:     vid,
                    vendor_name:   vname,
                    total_sales:   0,
                    total_revenue: 0,
                    new_count:     0,
                    ren_count:     0,
                    by_product:    {},
                    total_target:  0,
                    total_target_money: 0,
                    total_target_lines: 0,
                    total_actual_money: 0,
                    total_actual_lines: 0,
                };
            }
            const cat   = getProductCategory(r.line_kind, r.account_type, r.line_type);
            const count = parseInt(r.sale_count, 10);
            const revenue = parseFloat(r.total_revenue) || 0;
            byVendor[vid].total_sales   += count;
            byVendor[vid].total_revenue += revenue;
            byVendor[vid].total_actual_lines += count;
            byVendor[vid].total_actual_money += revenue;

            const lt = String(r.line_type || '').toUpperCase().trim();
            if (lt === 'REN' || lt === 'RENOVACION') byVendor[vid].ren_count += count;
            else byVendor[vid].new_count += count;

            if (cat) {
                if (!byVendor[vid].by_product[cat]) {
                    byVendor[vid].by_product[cat] = emptyProductStat(cat, 0);
                }
                byVendor[vid].by_product[cat].actual_lines += count;
                byVendor[vid].by_product[cat].actual_money += revenue;
                byVendor[vid].by_product[cat].revenue += revenue;
            }
        });

        // Mezclar metas individuales en el resumen por vendedor
        Object.entries(vendorGoals).forEach(([vid, vg]) => {
            if (!byVendor[vid]) {
                byVendor[vid] = {
                    vendor_id:     vid,
                    vendor_name:   vg.vendor_name,
                    total_sales:   0,
                    total_revenue: 0,
                    new_count:     0,
                    ren_count:     0,
                    by_product:    {},
                    total_target:  0,
                    total_target_money: 0,
                    total_target_lines: 0,
                    total_actual_money: 0,
                    total_actual_lines: 0,
                };
            }
            Object.entries(vg.goals).forEach(([pname, tgt]) => {
                if (!byVendor[vid].by_product[pname]) {
                    byVendor[vid].by_product[pname] = emptyProductStat(pname, 0);
                }
                const product = byVendor[vid].by_product[pname];
                if (product.unit === 'money') product.target_money = parseFloat(tgt) || 0;
                else product.target_lines = parseFloat(tgt) || 0;
                applyDisplayActual(product);
            });
            const products = Object.values(byVendor[vid].by_product);
            byVendor[vid].total_target_money = products.reduce((s, p) => s + (p.target_money || 0), 0);
            byVendor[vid].total_target_lines = products.reduce((s, p) => s + (p.target_lines || 0), 0);
            byVendor[vid].total_target = byVendor[vid].total_target_money + byVendor[vid].total_target_lines;
        });

        // % cumplimiento por vendedor
        Object.values(byVendor).forEach(v => {
            Object.values(v.by_product).forEach(p => {
                applyDisplayActual(p);
            });
            v.total_target_money = Object.values(v.by_product).reduce((s, p) => s + (p.target_money || 0), 0);
            v.total_target_lines = Object.values(v.by_product).reduce((s, p) => s + (p.target_lines || 0), 0);
            v.total_actual_money = Object.values(v.by_product).reduce((s, p) => s + (p.actual_money || 0), 0);
            v.total_actual_lines = Object.values(v.by_product).reduce((s, p) => s + (p.actual_lines || 0), 0);
            v.total_target = v.total_target_money + v.total_target_lines;
            const productPcts = Object.values(v.by_product)
                .filter(p => p.target > 0)
                .map(p => p.pct);
            v.pct_total = productPcts.length > 0
                ? Math.min(Math.round(productPcts.reduce((s, pct) => s + pct, 0) / productPcts.length), 999)
                : 0;
        });

        // 7. KPIs globales
        const totalActual  = Object.values(byProduct).reduce((s, p) => s + p.actual,  0);
        const totalTarget  = Object.values(byProduct).reduce((s, p) => s + p.target,  0);
        const totalMoneyActual = Object.values(byProduct).reduce((s, p) => s + (p.unit === 'money' ? (p.actual_money || 0) : 0), 0);
        const totalMoneyGoal = Object.values(byProduct).reduce((s, p) => s + (p.target_money || 0), 0);
        const totalQuantityActual = Object.values(byProduct).reduce((s, p) => s + (p.actual_lines || 0), 0);
        const totalQuantityGoal = Object.values(byProduct).reduce((s, p) => s + (p.target_lines || 0), 0);
        const totalRevenue = Object.values(byProduct).reduce((s, p) => s + p.revenue, 0);

        const newClientsRes = await query(
            `SELECT COUNT(DISTINCT id)::int AS cnt FROM clients
             WHERE EXTRACT(YEAR  FROM created_at) = $1
               AND EXTRACT(MONTH FROM created_at) = $2`,
            [y, m]
        );
        const newClients = parseInt(newClientsRes[0]?.cnt ?? 0, 10);

        res.json({
            period: { year: y, month: m },
            kpis: {
                total_goal:    totalTarget,
                total_actual:  totalActual,
                pct_complied:  totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0,
                total_vendors: Object.keys(byVendor).length,
                new_clients:   newClients,
                total_revenue: Math.round(totalRevenue * 100) / 100,
                total_money_goal: Math.round(totalMoneyGoal * 100) / 100,
                total_money_actual: Math.round(totalMoneyActual * 100) / 100,
                total_quantity_goal: totalQuantityGoal,
                total_quantity_actual: totalQuantityActual,
            },
            by_product: Object.values(byProduct)
                .sort((a, b) => a.product_name.localeCompare(b.product_name)),
            by_vendor: Object.values(byVendor)
                .sort((a, b) => b.total_sales - a.total_sales),
        });
    } catch (err) {
        serverError(res, err, 'Error generando resumen del dashboard');
    }
}

// ---------------------------------------------------------------------------
// GET /api/dashboard/active-lines-expiration?year=YYYY&month=MM
// Lineas activas por mes/anio de vencimiento de contrato.
// ---------------------------------------------------------------------------
export async function getActiveLinesExpiration(req, res) {
    try {
        const { year, month } = req.query;
        const y = parseInt(year, 10);
        const m = parseInt(month, 10);
        if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
            return res.status(400).json({ error: 'year y month requeridos' });
        }

        const monthStart = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
        const nextMonthStart = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

        const rows = await query(`
            SELECT
                c.id::text AS client_id,
                COALESCE(NULLIF(TRIM(c.business_name), ''), NULLIF(TRIM(c.name), ''), 'Sin nombre') AS client_name,
                b.ban_number,
                COALESCE(sp.name, v.name, 'Sin vendedor') AS vendor_name,
                MIN(s.contract_end_date)::date AS contract_end_date,
                COUNT(s.id)::int AS active_lines,
                COUNT(*) FILTER (
                    WHERE COALESCE(LOWER(s.line_kind::text), '') = 'fijo'
                       OR UPPER(COALESCE(b.account_type::text, '')) IN ('FIJO', 'FIXED')
                )::int AS fixed_active_lines,
                COUNT(*) FILTER (
                    WHERE COALESCE(LOWER(s.line_kind::text), '') = 'movil'
                       OR UPPER(COALESCE(b.account_type::text, '')) IN ('MOVIL', 'MÓVIL', 'MOBILE', 'UPDATE', 'CONVERGENTE')
                )::int AS mobile_active_lines,
                COALESCE(SUM(COALESCE(s.monthly_value, 0)), 0)::numeric AS monthly_revenue,
                COALESCE(SUM(CASE
                    WHEN COALESCE(LOWER(s.line_kind::text), '') = 'fijo'
                      OR UPPER(COALESCE(b.account_type::text, '')) IN ('FIJO', 'FIXED')
                    THEN COALESCE(s.monthly_value, 0)
                    ELSE 0
                END), 0)::numeric AS fixed_monthly_revenue
            FROM subscribers s
            JOIN bans b ON b.id = s.ban_id
            JOIN clients c ON c.id = b.client_id
            LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
            LEFT JOIN vendors v ON UPPER(TRIM(v.name)) = UPPER(TRIM(sp.name))
            WHERE s.contract_end_date IS NOT NULL
              AND s.contract_end_date >= $1
              AND s.contract_end_date < $2
              AND COALESCE(LOWER(s.status::text), 'activo')
                  NOT IN ('cancelado','cancelled','c','inactivo','inactive','no_renueva_ahora')
            GROUP BY c.id, client_name, b.ban_number, vendor_name
            ORDER BY monthly_revenue DESC, active_lines DESC, client_name ASC
        `, [monthStart, nextMonthStart]);

        const normalizedRows = rows.map((row) => ({
            ...row,
            active_lines: Number(row.active_lines || 0),
            fixed_active_lines: Number(row.fixed_active_lines || 0),
            mobile_active_lines: Number(row.mobile_active_lines || 0),
            monthly_revenue: Number(row.monthly_revenue || 0),
            fixed_monthly_revenue: Number(row.fixed_monthly_revenue || 0),
        }));

        const summary = normalizedRows.reduce((acc, row) => {
            acc.active_lines += row.active_lines;
            acc.fixed_active_lines += row.fixed_active_lines;
            acc.mobile_active_lines += row.mobile_active_lines;
            acc.monthly_revenue += row.monthly_revenue;
            acc.fixed_monthly_revenue += row.fixed_monthly_revenue;
            return acc;
        }, { active_lines: 0, fixed_active_lines: 0, mobile_active_lines: 0, monthly_revenue: 0, fixed_monthly_revenue: 0 });

        res.json({
            period: { year: y, month: m },
            summary: {
                active_lines: summary.active_lines,
                fixed_active_lines: summary.fixed_active_lines,
                mobile_active_lines: summary.mobile_active_lines,
                monthly_revenue: Math.round(summary.monthly_revenue * 100) / 100,
                fixed_monthly_revenue: Math.round(summary.fixed_monthly_revenue * 100) / 100,
            },
            rows: normalizedRows,
        });
    } catch (err) {
        serverError(res, err, 'Error generando lineas activas por vencimiento');
    }
}
