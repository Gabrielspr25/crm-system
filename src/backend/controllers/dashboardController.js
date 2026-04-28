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
            byProduct[name] = { product_name: name, target, actual: 0, revenue: 0 };
        });
        // Sumar ventas reales
        salesRows.forEach(r => {
            const cat = getProductCategory(r.line_kind, r.account_type, r.line_type);
            if (!cat) return;
            if (!byProduct[cat]) byProduct[cat] = { product_name: cat, target: 0, actual: 0, revenue: 0 };
            byProduct[cat].actual += parseInt(r.sale_count, 10);
            byProduct[cat].revenue += parseFloat(r.total_revenue);
        });
        // Calcular % cumplimiento
        Object.values(byProduct).forEach(p => {
            p.pct = p.target > 0 ? Math.min(Math.round((p.actual / p.target) * 100), 999) : 0;
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
                };
            }
            const cat   = getProductCategory(r.line_kind, r.account_type, r.line_type);
            const count = parseInt(r.sale_count, 10);
            byVendor[vid].total_sales   += count;
            byVendor[vid].total_revenue += parseFloat(r.total_revenue);

            const lt = String(r.line_type || '').toUpperCase().trim();
            if (lt === 'REN' || lt === 'RENOVACION') byVendor[vid].ren_count += count;
            else byVendor[vid].new_count += count;

            if (cat) {
                if (!byVendor[vid].by_product[cat]) {
                    byVendor[vid].by_product[cat] = { actual: 0, target: 0 };
                }
                byVendor[vid].by_product[cat].actual += count;
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
                };
            }
            Object.entries(vg.goals).forEach(([pname, tgt]) => {
                if (!byVendor[vid].by_product[pname]) {
                    byVendor[vid].by_product[pname] = { actual: 0, target: 0 };
                }
                byVendor[vid].by_product[pname].target = tgt;
            });
            byVendor[vid].total_target = Object.values(vg.goals).reduce((s, v) => s + v, 0);
        });

        // % cumplimiento por vendedor
        Object.values(byVendor).forEach(v => {
            v.pct_total = v.total_target > 0
                ? Math.min(Math.round((v.total_sales / v.total_target) * 100), 999)
                : 0;
            Object.values(v.by_product).forEach(p => {
                p.pct = p.target > 0 ? Math.min(Math.round((p.actual / p.target) * 100), 999) : 0;
            });
        });

        // 7. KPIs globales
        const totalActual  = Object.values(byProduct).reduce((s, p) => s + p.actual,  0);
        const totalTarget  = Object.values(byProduct).reduce((s, p) => s + p.target,  0);
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
