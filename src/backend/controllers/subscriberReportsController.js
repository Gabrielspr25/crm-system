import { query } from '../database/db.js';
import { getTangoPool } from '../database/externalPools.js';
import { serverError } from '../middlewares/errorHandler.js';

const TRACE_VALIDATION_SQL = `
    CASE
        WHEN COALESCE(sr.validation_status, '') <> '' THEN sr.validation_status
        WHEN COALESCE(sr.source, '') = 'manual' THEN 'confirmed'
        WHEN COALESCE(sr.source, '') = 'tango'
          AND sr.external_sale_id IS NOT NULL
          AND sr.sync_log_id IS NOT NULL
          AND sr.source_activation_date IS NOT NULL
          AND sr.source_report_month IS NOT NULL
          AND sr.raw_payload IS NOT NULL
        THEN 'confirmed'
        ELSE 'needs_review'
    END
`;

async function ensureSubscriberReportsTraceabilityColumns() {
    try {
        await query(`
            ALTER TABLE subscriber_reports
            ADD COLUMN IF NOT EXISTS source TEXT,
            ADD COLUMN IF NOT EXISTS external_sale_id TEXT NULL,
            ADD COLUMN IF NOT EXISTS sync_log_id UUID NULL,
            ADD COLUMN IF NOT EXISTS source_activation_date DATE NULL,
            ADD COLUMN IF NOT EXISTS source_report_month DATE NULL,
            ADD COLUMN IF NOT EXISTS raw_payload JSONB NULL,
            ADD COLUMN IF NOT EXISTS validation_status TEXT NULL,
            ADD COLUMN IF NOT EXISTS validation_notes TEXT NULL
        `);
        // Default conservador: ninguna venta debe asumirse válida automáticamente
        // sin que el sync haya validado los datos críticos (monto, vendedor, etc).
        await query(`
            ALTER TABLE subscriber_reports
            ALTER COLUMN validation_status SET DEFAULT 'needs_review'
        `);
    } catch (error) {
        if (error?.code !== '42501') throw error;
    }
}

/**
 * GET /api/subscriber-reports?month=YYYY-MM
 * Devuelve todos los reportes del mes con datos de subscriber, BAN, cliente y vendedor
 */
export const getSubscriberReports = async (req, res) => {
    const { month } = req.query;
    const role = String(req.user?.role || '').trim().toLowerCase();
    const salespersonId = req.user?.salespersonId == null ? '' : String(req.user.salespersonId).trim();

    try {
        await ensureSubscriberReportsTraceabilityColumns();
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
                sr.source,
                sr.external_sale_id,
                sr.sync_log_id,
                sr.source_activation_date,
                sr.source_report_month,
                sr.raw_payload,
                sr.validation_notes,
                ${TRACE_VALIDATION_SQL} AS validation_status,
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
 * GET /api/subscriber-reports/needs-review-count?month=YYYY-MM
 * Devuelve la cantidad de filas en needs_review del mes (default: mes actual).
 * Filtra por rol vendedor cuando aplica.
 */
export const getNeedsReviewCount = async (req, res) => {
    const role = String(req.user?.role || '').trim().toLowerCase();
    const salespersonId = req.user?.salespersonId == null ? '' : String(req.user.salespersonId).trim();
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const month = String(req.query.month || defaultMonth).trim();

    try {
        await ensureSubscriberReportsTraceabilityColumns();

        if (role === 'vendedor' && !salespersonId) {
            return res.json({ count: 0, period: month });
        }

        const params = [month];
        const conditions = [
            `TO_CHAR(sr.report_month, 'YYYY-MM') = $1`,
            `(${TRACE_VALIDATION_SQL}) = 'needs_review'`,
        ];

        if (role === 'vendedor' && salespersonId) {
            params.push(salespersonId);
            conditions.push(`c.salesperson_id::text = $${params.length}`);
        }

        const sql = `
            SELECT COUNT(*)::int AS count
            FROM subscriber_reports sr
            JOIN subscribers s ON s.id = sr.subscriber_id
            JOIN bans b        ON b.id = s.ban_id
            JOIN clients c     ON c.id = b.client_id
            WHERE ${conditions.join(' AND ')}
        `;
        const rows = await query(sql, params);
        res.json({ count: Number(rows[0]?.count || 0), period: month });
    } catch (error) {
        serverError(res, error, 'Error obteniendo conteo de needs_review');
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
        await ensureSubscriberReportsTraceabilityColumns();
        const rows = await query(
            `INSERT INTO subscriber_reports
                (subscriber_id, report_month, source, external_sale_id, sync_log_id, source_activation_date,
                 source_report_month, raw_payload, validation_status, validation_notes,
                 company_earnings, vendor_commission, paid_amount, paid_date,
                 is_audited, audited_at, audited_by, created_at, updated_at)
             VALUES ($1, $2::date, $3, $4, $5, $6,
                 $7, $8::jsonb, COALESCE($9, 'confirmed'), $10,
                 $11, $12, $13, $14,
                 COALESCE($15, false),
                 CASE WHEN $15 = true THEN NOW() ELSE NULL END,
                 CASE WHEN $15 = true THEN $16::uuid ELSE NULL END,
                 NOW(), NOW())
             ON CONFLICT (subscriber_id, report_month) DO UPDATE SET
                source            = COALESCE(subscriber_reports.source, EXCLUDED.source),
                external_sale_id  = COALESCE(subscriber_reports.external_sale_id, EXCLUDED.external_sale_id),
                sync_log_id       = COALESCE(subscriber_reports.sync_log_id, EXCLUDED.sync_log_id),
                source_activation_date = COALESCE(subscriber_reports.source_activation_date, EXCLUDED.source_activation_date),
                source_report_month    = COALESCE(subscriber_reports.source_report_month, EXCLUDED.source_report_month),
                raw_payload       = COALESCE(subscriber_reports.raw_payload, EXCLUDED.raw_payload),
                validation_status = CASE
                                       WHEN EXCLUDED.validation_status = 'confirmed' THEN 'confirmed'
                                       ELSE COALESCE(subscriber_reports.validation_status, EXCLUDED.validation_status)
                                    END,
                validation_notes  = COALESCE(subscriber_reports.validation_notes, EXCLUDED.validation_notes),
                company_earnings  = EXCLUDED.company_earnings,
                vendor_commission = EXCLUDED.vendor_commission,
                paid_amount       = EXCLUDED.paid_amount,
                paid_date         = EXCLUDED.paid_date,
                is_audited        = CASE WHEN $15 IS NOT NULL THEN $15 ELSE subscriber_reports.is_audited END,
                audited_at        = CASE
                                       WHEN $15 = true  THEN NOW()
                                       WHEN $15 = false THEN NULL
                                       ELSE subscriber_reports.audited_at
                                    END,
                audited_by        = CASE
                                       WHEN $15 = true  THEN $16::uuid
                                       WHEN $15 = false THEN NULL
                                       ELSE subscriber_reports.audited_by
                                    END,
                updated_at        = NOW()
             RETURNING *`,
            [
                subscriberId,
                report_month,
                'manual',
                null,
                null,
                null,
                report_month,
                null,
                'confirmed',
                null,
                company_earnings ?? null,
                vendor_commission ?? null,
                paid_amount ?? null,
                paid_date ?? null,
                auditedFlag,
                userId
            ]
        );

        res.json(rows[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando reporte de suscriptor');
    }
};

/**
 * DELETE /api/subscriber-reports/:subscriberId
 * Elimina solo filas no confirmadas del mes indicado.
 * Body/query: { report_month }
 */
export const deleteSubscriberReport = async (req, res) => {
    const role = String(req.user?.role || '').trim().toLowerCase();
    if (role !== 'admin') {
        return res.status(403).json({ error: 'Solo administradores pueden eliminar filas de comisiones' });
    }

    const { subscriberId } = req.params;
    const reportMonth = String(req.body?.report_month || req.query?.report_month || '').trim();

    if (!reportMonth) {
        return res.status(400).json({ error: 'report_month es requerido' });
    }

    try {
        await ensureSubscriberReportsTraceabilityColumns();

        const existing = await query(
            `
                SELECT
                    sr.subscriber_id,
                    sr.report_month,
                    sr.validation_status,
                    ${TRACE_VALIDATION_SQL} AS computed_validation_status,
                    sr.company_earnings,
                    sr.vendor_commission
                FROM subscriber_reports sr
                WHERE sr.subscriber_id = $1
                  AND sr.report_month = $2::date
                LIMIT 1
            `,
            [subscriberId, reportMonth]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Fila de comisión no encontrada' });
        }

        const validationStatus = String(existing[0].computed_validation_status || existing[0].validation_status || '').trim().toLowerCase();
        if (validationStatus === 'confirmed') {
            return res.status(403).json({ error: 'No se puede eliminar una fila confirmada por Tango' });
        }

        const deleted = await query(
            `
                DELETE FROM subscriber_reports
                WHERE subscriber_id = $1
                  AND report_month = $2::date
                RETURNING *
            `,
            [subscriberId, reportMonth]
        );

        return res.json({
            success: true,
            deleted: deleted[0] || null
        });
    } catch (error) {
        serverError(res, error, 'Error eliminando fila de subscriber_reports');
    }
};

/**
 * GET /api/subscriber-reports/audit?from=YYYY-MM-DD
 * Devuelve filas sospechosas / sin trazabilidad para QA.
 */
export const getSubscriberReportsAudit = async (req, res) => {
    const from = String(req.query.from || '2026-01-01').trim();

    try {
        await ensureSubscriberReportsTraceabilityColumns();
        const suspiciousRows = await query(`
            SELECT
                sr.subscriber_id,
                sr.report_month,
                sr.source,
                sr.external_sale_id,
                sr.sync_log_id,
                sr.source_activation_date,
                sr.source_report_month,
                sr.validation_status,
                sr.validation_notes,
                sr.company_earnings,
                sr.vendor_commission,
                sr.paid_amount,
                sr.created_at,
                sr.updated_at,
                s.phone,
                b.ban_number,
                c.id AS client_id,
                c.name AS client_name
            FROM subscriber_reports sr
            JOIN subscribers s ON s.id = sr.subscriber_id
            JOIN bans b ON b.id = s.ban_id
            JOIN clients c ON c.id = b.client_id
            WHERE sr.report_month >= $1::date
              AND (
                ${TRACE_VALIDATION_SQL} <> 'confirmed'
                OR sr.external_sale_id IS NULL
                OR sr.raw_payload IS NULL
                OR sr.source_activation_date IS NULL
                OR sr.source_report_month IS NULL
              )
            ORDER BY sr.report_month DESC, c.name ASC, b.ban_number ASC, s.phone ASC
        `, [from]);

        const duplicateMonthRows = await query(`
            SELECT
                sr.subscriber_id,
                s.phone,
                b.ban_number,
                c.name AS client_name,
                COUNT(DISTINCT sr.report_month)::int AS month_count,
                ARRAY_AGG(DISTINCT TO_CHAR(sr.report_month, 'YYYY-MM') ORDER BY TO_CHAR(sr.report_month, 'YYYY-MM')) AS months
            FROM subscriber_reports sr
            JOIN subscribers s ON s.id = sr.subscriber_id
            JOIN bans b ON b.id = s.ban_id
            JOIN clients c ON c.id = b.client_id
            WHERE sr.report_month >= $1::date
            GROUP BY sr.subscriber_id, s.phone, b.ban_number, c.name
            HAVING COUNT(DISTINCT sr.report_month) > 1
            ORDER BY month_count DESC, c.name ASC
        `, [from]);

        const mismatchRows = await query(`
            SELECT
                sr.subscriber_id,
                s.phone,
                b.ban_number,
                c.name AS client_name,
                sr.report_month,
                sr.source_activation_date,
                sr.source_report_month,
                sr.source,
                sr.external_sale_id,
                sr.validation_status,
                sr.validation_notes
            FROM subscriber_reports sr
            JOIN subscribers s ON s.id = sr.subscriber_id
            JOIN bans b ON b.id = s.ban_id
            JOIN clients c ON c.id = b.client_id
            WHERE sr.report_month >= $1::date
              AND sr.source_activation_date IS NOT NULL
              AND sr.source_report_month IS NOT NULL
              AND DATE_TRUNC('month', sr.source_activation_date::timestamp) <> DATE_TRUNC('month', sr.source_report_month::timestamp)
            ORDER BY sr.report_month DESC, c.name ASC
        `, [from]);

        const notConfirmedWithMoney = await query(`
            SELECT
                sr.subscriber_id,
                sr.report_month,
                sr.company_earnings,
                sr.vendor_commission,
                sr.paid_amount,
                sr.source,
                sr.external_sale_id,
                sr.sync_log_id,
                sr.validation_status,
                sr.validation_notes,
                s.phone,
                b.ban_number,
                c.name AS client_name
            FROM subscriber_reports sr
            JOIN subscribers s ON s.id = sr.subscriber_id
            JOIN bans b ON b.id = s.ban_id
            JOIN clients c ON c.id = b.client_id
            WHERE sr.report_month >= $1::date
              AND (${TRACE_VALIDATION_SQL} <> 'confirmed')
              AND (COALESCE(sr.company_earnings, 0) > 0 OR COALESCE(sr.vendor_commission, 0) > 0)
            ORDER BY sr.report_month DESC, c.name ASC
        `, [from]);

        res.json({
            from,
            summary: {
                suspicious_rows: suspiciousRows.length,
                duplicate_month_rows: duplicateMonthRows.length,
                month_mismatch_rows: mismatchRows.length,
                not_confirmed_with_money: notConfirmedWithMoney.length
            },
            suspicious_rows: suspiciousRows,
            duplicate_month_rows: duplicateMonthRows,
            month_mismatch_rows: mismatchRows,
            not_confirmed_with_money: notConfirmedWithMoney
        });
    } catch (error) {
        serverError(res, error, 'Error generando auditoría de subscriber_reports');
    }
};

/**
 * GET /api/subscriber-reports/comparison
 * Compara ventas Tango PYMES vs CRM subscriber_reports por mes.
 * Si Tango no está disponible, devuelve solo datos CRM con Tango en 0.
 */
export const getReportsComparison = async (req, res) => {
    try {
        await ensureSubscriberReportsTraceabilityColumns();
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
            WHERE ${TRACE_VALIDATION_SQL} = 'confirmed'
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
