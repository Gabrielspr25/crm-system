import express from 'express';
import { query } from '../database/db.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

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

export default router;
