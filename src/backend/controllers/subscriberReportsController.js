import { query } from '../database/db.js';
import { getTangoPool } from '../database/externalPools.js';
import { serverError } from '../middlewares/errorHandler.js';

/**
 * GET /api/subscriber-reports?month=YYYY-MM
 * Devuelve todos los reportes del mes con datos de subscriber, BAN, cliente y vendedor
 */
export const getSubscriberReports = async (req, res) => {
    const { month } = req.query;
    const role = String(req.user?.role || '').trim().toLowerCase();
    const salespersonId = req.user?.salespersonId == null ? '' : String(req.user.salespersonId).trim();

    try {
        const params = [];
        const conditions = [];

        if (month) {
            params.push(month);
            conditions.push(`TO_CHAR(sr.report_month, 'YYYY-MM') = $${params.length}`);
        }

        if (role === 'vendedor' && !salespersonId) {
            return res.json([]);
        }

        if (role === 'vendedor' && salespersonId) {
            params.push(salespersonId);
            conditions.push(`c.salesperson_id::text = $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sql = `
            SELECT
                sr.subscriber_id,
                sr.report_month,
                sr.company_earnings,
                sr.vendor_commission,
                COALESCE(sr.portability_bonus, 0) AS portability_bonus,
                sr.paid_amount,
                sr.paid_date,
                s.phone,
                s.line_type,
                s.line_kind,
                s.plan,
                s.monthly_value,
                NULL::text AS sale_type,
                NULL::date AS activation_date,
                b.ban_number,
                b.account_type,
                c.id       AS client_id,
                c.name     AS client_name,
                c.owner_name AS client_business_name,
                sp.id      AS vendor_id,
                sp.name    AS vendor_name,
                v.commission_percentage AS salesperson_commission_percentage,
                CASE
                    WHEN sr.paid_amount IS NOT NULL AND sr.paid_amount > 0 THEN true
                    ELSE false
                END AS is_paid,
                sr.paid_date        AS paid_at,
                COALESCE(sr.is_audited, false) AS is_audited,
                sr.audited_at,
                COALESCE(sr.withholding_applies, true) AS withholding_applies,
                NULL::numeric       AS effective_vendor_commission,
                NULL::numeric       AS suggested_vendor_commission
            FROM subscriber_reports sr
            JOIN subscribers s  ON s.id  = sr.subscriber_id
            JOIN bans b         ON b.id  = s.ban_id
            JOIN clients c      ON c.id  = b.client_id
            LEFT JOIN salespeople sp ON sp.id = c.salesperson_id
            LEFT JOIN vendors v      ON UPPER(TRIM(v.name)) = UPPER(TRIM(sp.name))
            ${whereClause}
            ORDER BY c.name, b.ban_number, s.phone
        `;

        const rows = await query(sql, params);
        res.json(rows);
    } catch (error) {
        serverError(res, error, 'Error obteniendo reportes de suscriptores');
    }
};

/**
 * PUT /api/subscriber-reports/:subscriberId
 * Actualiza o crea un reporte para un suscriptor en un mes dado.
 * Body: { report_month, company_earnings, vendor_commission, paid_amount, paid_date }
 */
export const updateSubscriberReport = async (req, res) => {
    const { subscriberId } = req.params;
    const { report_month, vendor_commission, company_earnings, paid_amount, paid_date, is_audited } = req.body;
    const userId = req.user?.id || null;

    if (!report_month) {
        return res.status(400).json({ error: 'report_month es requerido' });
    }

    // Si llega is_audited en el body, lo persistimos. audited_at/audited_by se setean
    // automáticamente cuando se marca true; se limpian cuando se marca false.
    const auditedFlag = (typeof is_audited === 'boolean') ? is_audited : null;

    try {
        const rows = await query(
            `INSERT INTO subscriber_reports
                (subscriber_id, report_month, company_earnings, vendor_commission, paid_amount, paid_date,
                 is_audited, audited_at, audited_by, created_at, updated_at)
             VALUES ($1, $2::date, $3, $4, $5, $6,
                 COALESCE($7, false),
                 CASE WHEN $7 = true THEN NOW() ELSE NULL END,
                 CASE WHEN $7 = true THEN $8::uuid ELSE NULL END,
                 NOW(), NOW())
             ON CONFLICT (subscriber_id, report_month) DO UPDATE SET
                company_earnings  = EXCLUDED.company_earnings,
                vendor_commission = EXCLUDED.vendor_commission,
                paid_amount       = EXCLUDED.paid_amount,
                paid_date         = EXCLUDED.paid_date,
                is_audited        = CASE WHEN $7 IS NOT NULL THEN $7 ELSE subscriber_reports.is_audited END,
                audited_at        = CASE
                                       WHEN $7 = true  THEN NOW()
                                       WHEN $7 = false THEN NULL
                                       ELSE subscriber_reports.audited_at
                                    END,
                audited_by        = CASE
                                       WHEN $7 = true  THEN $8::uuid
                                       WHEN $7 = false THEN NULL
                                       ELSE subscriber_reports.audited_by
                                    END,
                updated_at        = NOW()
             RETURNING *`,
            [subscriberId, report_month, company_earnings ?? null, vendor_commission ?? null, paid_amount ?? null, paid_date ?? null, auditedFlag, userId]
        );

        res.json(rows[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando reporte de suscriptor');
    }
};

/**
 * GET /api/subscriber-reports/comparison
 * Compara ventas Tango PYMES vs CRM subscriber_reports por mes.
 * Si Tango no está disponible, devuelve solo datos CRM con Tango en 0.
 */
export const getReportsComparison = async (req, res) => {
    try {
        const role = String(req.user?.role || '').trim().toLowerCase();
        if (role === 'vendedor') {
            return res.status(403).json({ error: 'Solo administradores y supervisores pueden ver la comparacion global' });
        }

        // 1. CRM: totales por mes desde subscriber_reports
        const crmRows = await query(`
            SELECT
                TO_CHAR(sr.report_month, 'YYYY-MM') AS month,
                COUNT(*)::int                        AS ventas,
                COALESCE(SUM(sr.company_earnings), 0)::float  AS empresa,
                COALESCE(SUM(sr.vendor_commission), 0)::float AS comision
            FROM subscriber_reports sr
            GROUP BY TO_CHAR(sr.report_month, 'YYYY-MM')
            ORDER BY month DESC
        `);

        // 2. Tango: totales por mes (opcional)
        let tangoByMonth = [];
        let tangoDetail  = [];

        try {
            const tangoPool = getTangoPool();

            const tangoMonthRes = await tangoPool.query(`
                SELECT
                    TO_CHAR(v.fechaactivacion, 'YYYY-MM') AS month,
                    COUNT(*)::int                           AS ventas,
                    COALESCE(SUM(v.comisionclaro), 0)       AS empresa
                FROM venta v
                WHERE v.ventatipoid IN (138, 139, 140, 141)
                  AND v.activo = true
                  AND (v.ventatipoid IN (138, 139) OR v.fechaactivacion >= '2026-01-01')
                GROUP BY TO_CHAR(v.fechaactivacion, 'YYYY-MM')
                ORDER BY month DESC
            `);
            tangoByMonth = tangoMonthRes.rows;

            const tangoDetailRes = await tangoPool.query(`
                SELECT v.ventaid, v.ban, v.status AS linea,
                       v.ventatipoid, v.meses, v.fechaactivacion,
                       COALESCE(v.comisionclaro, 0)    AS comisionclaro,
                       COALESCE(v.comisionvendedor, 0) AS comisionvendedor,
                       COALESCE(cc.nombre, 'SIN NOMBRE') AS cliente,
                       vt.nombre AS tipo, vd.nombre AS vendedor
                FROM venta v
                JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
                LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
                LEFT JOIN vendedor vd ON vd.vendedorid = v.vendedorid
                WHERE v.ventatipoid IN (138, 139, 140, 141)
                  AND v.activo = true
                  AND (v.ventatipoid IN (138, 139) OR v.fechaactivacion >= '2026-01-01')
                ORDER BY v.fechaactivacion DESC
            `);
            tangoDetail = tangoDetailRes.rows;
        } catch (tangoErr) {
            console.warn('[subscriber-reports/comparison] Tango no disponible:', tangoErr.message);
        }

        // 3. Armar comparación por mes
        const allMonths = new Set([
            ...crmRows.map(r => r.month),
            ...tangoByMonth.map(r => r.month)
        ]);

        const crmMap   = new Map(crmRows.map(r => [r.month, r]));
        const tangoMap = new Map(tangoByMonth.map(r => [r.month, r]));

        const comparison = Array.from(allMonths)
            .sort()
            .reverse()
            .map(month => ({
                month,
                tango: {
                    ventas:  Number(tangoMap.get(month)?.ventas  || 0),
                    empresa: Number(tangoMap.get(month)?.empresa || 0)
                },
                crm: {
                    ventas:  Number(crmMap.get(month)?.ventas  || 0),
                    empresa: Number(crmMap.get(month)?.empresa || 0),
                    comision: Number(crmMap.get(month)?.comision || 0)
                }
            }));

        res.json({ comparison, detail: tangoDetail });
    } catch (error) {
        serverError(res, error, 'Error generando comparación de reportes');
    }
};
