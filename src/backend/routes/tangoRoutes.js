import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import crmPool from '../database/db.js';
import { getTangoPool } from '../database/externalPools.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import {
    detectStaleLock,
    acquireSyncLock,
    releaseSyncLock,
    touchHeartbeat,
    computeIncrementalRange,
    createSyncLog,
    closeSyncLog,
} from '../services/tangoSyncService.js';
import {
  buildTangoCommissionPendingSale,
  classifyTangoVentaTipo,
  isAllowedPymesCommissionVentaTipo,
  isPymesAutocreateVentaTipo,
  mergeTangoApiV2RowsWithLegacyRows,
  shouldIncludeTangoV2SaleForCommissions,
} from '../services/tangoV2SyncMapper.js';

const router = Router();

// Normaliza fechas a string ISO 'YYYY-MM-DD'. El driver pg devuelve columnas
// `date` como objetos Date â€” String(Date) produce 'Day Mon DD â€¦' que rompe
// comparaciones cross-formato. Esta utilidad las uniforma.
function toIsoDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  return String(val).slice(0, 10);
}

const normalizePlanLookup = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');

function planLookupTerms(planCode) {
  const full = normalizePlanLookup(planCode);
  if (!full) return [];
  const withoutTrailingRate = full.replace(/\s+\d{1,4}(?:\.\d{1,2})?\s*$/, '').trim();
  return [...new Set([full, withoutTrailingRate].filter(Boolean))];
}

function extractTrailingRate(planCode) {
  const match = String(planCode || '').trim().match(/\b(\d{1,4}\.\d{2})\s*$/);
  const value = match ? Number(match[1]) : 0;
  return value > 0 ? value : null;
}

function normalizePositiveRate(value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function readRateFromPlanPayload(plan) {
  return normalizePositiveRate(
    plan?.rate ?? plan?.monthly_value ?? plan?.monthlyValue ?? plan?.price ?? plan?.precio ?? plan?.amount
  );
}

async function resolveRateFromTangoApi(planCode) {
  const baseUrl = String(process.env.TANGO_API_BASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = String(process.env.TANGO_API_KEY || '').trim();
  if (!baseUrl || !apiKey) return null;

  const terms = planLookupTerms(planCode);
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey,
    Accept: 'application/json',
  };

  for (const term of terms) {
    const urls = [
      `${baseUrl}/api/external/planes`,
      `${baseUrl}/api/external/planes?search=${encodeURIComponent(term)}`,
      `${baseUrl}/api/external/planes?codigovoz=${encodeURIComponent(term)}`,
      `${baseUrl}/api/external/planes?codigo=${encodeURIComponent(term)}`,
      `${baseUrl}/plans?search=${encodeURIComponent(term)}`,
      `${baseUrl}/plans?code=${encodeURIComponent(term)}`,
      `${baseUrl}/planes?search=${encodeURIComponent(term)}`,
      `${baseUrl}/planes?code=${encodeURIComponent(term)}`,
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, { headers });
        if (!response.ok) continue;
        const payload = await response.json().catch(() => null);
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.plans)
              ? payload.plans
              : Array.isArray(payload?.planes)
                ? payload.planes
                : payload ? [payload] : [];

        const normalizedTerm = normalizePlanLookup(term);
        const match = rows.find((plan) => {
          const values = [
            plan?.code,
            plan?.codigo,
            plan?.codigovoz,
            plan?.codigo_voz,
            plan?.pricecode,
            plan?.name,
            plan?.nombre,
            plan?.description,
            plan?.descripcion,
          ].map(normalizePlanLookup);
          return values.some((value) => value === normalizedTerm || value.includes(normalizedTerm));
        }) || rows[0];

        const rate = readRateFromPlanPayload(match);
        if (rate != null) return { value: rate, source: 'tango-api-v2' };
      } catch (error) {
        console.warn('[TANGO API V2] No se pudo consultar plan:', error?.message || error);
      }
    }
  }

  return null;
}

function rowsFromTangoApiPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.ventas)) return payload.ventas;
  if (Array.isArray(payload?.comisiones)) return payload.comisiones;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function normalizeTangoApiPhone(row) {
  const value = row?.telefono ?? row?.phone ?? row?.numerocelularactivado ?? row?.status ?? row?.numero ?? null;
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readTangoApiCommission(row) {
  const commission = row?.comisiones || row?.comision || {};
  return {
    company: numberOrNull(row?.comisionclaro ?? commission?.comisionclaro),
    vendor: numberOrNull(row?.comisionvendedor ?? commission?.comisionvendedor),
    total: numberOrNull(row?.total ?? commission?.total),
  };
}

function normalizePendingStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return ['needs_review', 'linked', 'ignored'].includes(status) ? status : null;
}

function pendingSaleSelectSql() {
  return `
    SELECT
      p.*,
      lc.name AS linked_client_name,
      lb.ban_number AS linked_ban_number,
      ls.phone AS linked_subscriber_phone
    FROM tango_commission_pending_sales p
    LEFT JOIN clients lc ON lc.id = p.linked_client_id
    LEFT JOIN bans lb ON lb.id = p.linked_ban_id
    LEFT JOIN subscribers ls ON ls.id = p.linked_subscriber_id
  `;
}

function monthStartFromDate(value) {
  const iso = toIsoDate(value);
  return iso ? `${iso.slice(0, 7)}-01` : null;
}

async function fetchTangoApiV2Range(from, to) {
  const baseUrl = String(process.env.TANGO_API_BASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = String(process.env.TANGO_API_KEY || '').trim();
  if (!baseUrl || !apiKey || !from || !to) {
    return { salesById: new Map(), commissionsById: new Map(), warnings: ['api_v2_not_configured'] };
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey,
    Accept: 'application/json',
  };
  const result = { salesById: new Map(), commissionsById: new Map(), salesRows: [], commissionRows: [], warnings: [] };

  for (const [kind, target] of [['ventas', result.salesById], ['comisiones', result.commissionsById]]) {
    let offset = 0;
    const limit = 200;
    let guard = 0;
    do {
      const url = `${baseUrl}/api/external/${kind}?desde=${encodeURIComponent(from)}&hasta=${encodeURIComponent(to)}&limit=${limit}&offset=${offset}`;
      try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          result.warnings.push(`${kind}_http_${response.status}`);
          break;
        }
        const payload = await response.json().catch(() => null);
        const rows = rowsFromTangoApiPayload(payload);
        for (const row of rows) {
          const ventaid = Number(row?.ventaid ?? row?.id ?? row?.venta_id);
          if (Number.isFinite(ventaid) && ventaid > 0) target.set(ventaid, row);
        }
        if (kind === 'ventas') result.salesRows.push(...rows);
        else result.commissionRows.push(...rows);
        const pagination = payload?.pagination || {};
        const hasMore = Boolean(pagination.hasMore);
        const nextOffset = Number(pagination.offset ?? offset) + Number(pagination.limit ?? limit);
        if (!hasMore || !rows.length || nextOffset <= offset) break;
        offset = nextOffset;
      } catch (error) {
        result.warnings.push(`${kind}_error:${error?.message || error}`);
        break;
      }
      guard++;
    } while (guard < 20);
  }

  return result;
}

function pendingFallbackSaleFromExternal(externalSale) {
  return {
    ventaid: externalSale?.tango_ventaid,
    ban: externalSale?.ban,
    telefono: externalSale?.phone,
    ventatipoid: externalSale?.ventatipoid,
    fechaactivacion: externalSale?.fechaactivacion,
    cliente: externalSale?.cliente,
    vendedor: externalSale?.vendedor,
    com_empresa: externalSale?.com_empresa,
    com_vendedor: externalSale?.com_vendedor,
  };
}

async function upsertTangoCommissionPendingSales(externalSales, apiV2) {
  const stats = { attempted: 0, upserted: 0, skipped: 0 };
  for (const externalSale of externalSales || []) {
    const ventaid = Number(externalSale?.tango_ventaid);
    if (!Number.isFinite(ventaid) || ventaid <= 0) {
      stats.skipped++;
      continue;
    }

    const sale = apiV2?.salesById?.get(ventaid) || pendingFallbackSaleFromExternal(externalSale);
    const commission = apiV2?.commissionsById?.get(ventaid) || pendingFallbackSaleFromExternal(externalSale);
    const pendingSale = buildTangoCommissionPendingSale(sale, commission, externalSale?.motivo || 'ban_no_existe_en_crm');
    if (!isAllowedPymesCommissionVentaTipo(pendingSale.ventatipo_id, pendingSale.ventatipo_nombre)) {
      stats.skipped++;
      continue;
    }
    if (!(Number(pendingSale.company_earnings) > 0)) {
      stats.skipped++;
      continue;
    }

    stats.attempted++;
    const result = await crmPool.query(
      `
        INSERT INTO tango_commission_pending_sales (
          ventaid,
          ban_tango,
          cliente_tango,
          telefono_tango,
          ventatipo_id,
          ventatipo_nombre,
          fecha_activacion,
          company_earnings,
          vendor_commission,
          raw_payload,
          motivo,
          status,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7::date,
          $8, $9, $10::jsonb, $11, 'needs_review',
          NOW(), NOW()
        )
        ON CONFLICT (ventaid)
        DO UPDATE SET
          ban_tango = EXCLUDED.ban_tango,
          cliente_tango = EXCLUDED.cliente_tango,
          telefono_tango = EXCLUDED.telefono_tango,
          ventatipo_id = EXCLUDED.ventatipo_id,
          ventatipo_nombre = EXCLUDED.ventatipo_nombre,
          fecha_activacion = EXCLUDED.fecha_activacion,
          company_earnings = EXCLUDED.company_earnings,
          vendor_commission = EXCLUDED.vendor_commission,
          raw_payload = EXCLUDED.raw_payload,
          motivo = EXCLUDED.motivo,
          updated_at = NOW()
        WHERE tango_commission_pending_sales.status = 'needs_review'
      `,
      [
        pendingSale.ventaid,
        pendingSale.ban_tango,
        pendingSale.cliente_tango,
        pendingSale.telefono_tango,
        pendingSale.ventatipo_id,
        pendingSale.ventatipo_nombre,
        pendingSale.fecha_activacion,
        pendingSale.company_earnings,
        pendingSale.vendor_commission,
        JSON.stringify(pendingSale.raw_payload),
        pendingSale.motivo,
      ]
    );
    stats.upserted += result.rowCount;
  }
  return stats;
}

async function resolveMonthlyValueForPlan(crmPool, legacyPool, planCode, legacyRate) {
  const legacyRateValue = normalizePositiveRate(legacyRate);
  if (legacyRateValue != null) return { value: legacyRateValue, source: 'legacy-tipoplan' };

  const terms = planLookupTerms(planCode);
  if (terms.length === 0) return { value: null, source: null };

  const apiRate = await resolveRateFromTangoApi(planCode);
  if (apiRate?.value != null) return apiRate;

  try {
    const localResult = await crmPool.query(
      `SELECT COALESCE(price, price_autopay) AS rate
         FROM plans
        WHERE UPPER(TRIM(COALESCE(code, ''))) = ANY($1::text[])
           OR UPPER(TRIM(COALESCE(alpha_code, ''))) = ANY($1::text[])
           OR UPPER(TRIM(COALESCE(name, ''))) = ANY($1::text[])
           OR UPPER(TRIM(COALESCE(description, ''))) = ANY($1::text[])
        ORDER BY id ASC
        LIMIT 1`,
      [terms]
    );
    const localRate = normalizePositiveRate(localResult.rows[0]?.rate);
    if (localRate != null) return { value: localRate, source: 'plans-local' };
  } catch (error) {
    console.warn('[TANGO SYNC] No se pudo consultar plans local:', error?.message || error);
  }

  try {
    const legacyResult = await legacyPool.query(
      `SELECT rate
         FROM tipoplan
        WHERE UPPER(TRIM(COALESCE(codigovoz, ''))) = ANY($1::text[])
        ORDER BY tipoplanid ASC
        LIMIT 1`,
      [terms]
    );
    const exactLegacyRate = normalizePositiveRate(legacyResult.rows[0]?.rate);
    if (exactLegacyRate != null) return { value: exactLegacyRate, source: 'legacy-tipoplan-variant' };
  } catch (error) {
    console.warn('[TANGO SYNC] No se pudo consultar tipoplan:', error?.message || error);
  }

  const trailingRate = extractTrailingRate(planCode);
  if (trailingRate != null) return { value: trailingRate, source: 'plan-code-trailing-rate' };

  return { value: null, source: null };
}

function ensureAuthenticated(req, res, next) {
  if (req.user) return next();
  return authenticateToken(req, res, next);
}

router.use(ensureAuthenticated);

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

async function ensureSubscriberReportsTraceabilityColumns(client) {
  try {
    await client.query(`
      ALTER TABLE subscriber_reports
      ADD COLUMN IF NOT EXISTS source TEXT,
      ADD COLUMN IF NOT EXISTS external_sale_id TEXT NULL,
      ADD COLUMN IF NOT EXISTS sync_log_id TEXT NULL,
      ADD COLUMN IF NOT EXISTS source_activation_date DATE NULL,
      ADD COLUMN IF NOT EXISTS source_report_month DATE NULL,
      ADD COLUMN IF NOT EXISTS raw_payload JSONB NULL,
      ADD COLUMN IF NOT EXISTS validation_status TEXT NULL,
      ADD COLUMN IF NOT EXISTS validation_notes TEXT NULL,
      ADD COLUMN IF NOT EXISTS portability_bonus NUMERIC(10,2) NULL
    `);
    await client.query(`
      ALTER TABLE subscriber_reports
      ALTER COLUMN sync_log_id TYPE TEXT USING sync_log_id::text
    `);
    await client.query(`
      ALTER TABLE subscriber_reports
      ALTER COLUMN validation_status SET DEFAULT 'confirmed'
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriber_reports_source ON subscriber_reports (source)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriber_reports_external_sale_id ON subscriber_reports (external_sale_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriber_reports_sync_log_id ON subscriber_reports (sync_log_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriber_reports_validation_status ON subscriber_reports (validation_status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriber_reports_source_report_month ON subscriber_reports (source_report_month)`);
  } catch (error) {
    if (error?.code !== '42501') throw error;
    console.warn('[schema] Sin permisos para agregar columnas traceability en subscriber_reports; se usarÃ¡ fallback.');
  }
}

async function ensureTangoSyncCrmColumns(client) {
  try {
    await client.query(`
      ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS owner_name TEXT NULL,
      ADD COLUMN IF NOT EXISTS source TEXT NULL,
      ADD COLUMN IF NOT EXISTS pendiente_validacion BOOLEAN NOT NULL DEFAULT false
    `);
    await client.query(`
      ALTER TABLE bans
      ADD COLUMN IF NOT EXISTS source TEXT NULL
    `);
    await client.query(`
      ALTER TABLE subscribers
      ADD COLUMN IF NOT EXISTS tango_ventaid BIGINT NULL,
      ADD COLUMN IF NOT EXISTS phone_number TEXT NULL,
      ADD COLUMN IF NOT EXISTS contract_term INTEGER NULL,
      ADD COLUMN IF NOT EXISTS cancel_reason TEXT NULL
    `);
    await client.query(`
      ALTER TABLE subscribers
      ALTER COLUMN phone_number DROP NOT NULL
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS subscribers_tango_ventaid_key
      ON subscribers (tango_ventaid)
      WHERE tango_ventaid IS NOT NULL
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subscribers_tango_ventaid ON subscribers (tango_ventaid)`);
  } catch (error) {
    if (error?.code !== '42501') throw error;
    console.warn('[schema] Sin permisos para preparar columnas CRM del sync Tango; se usara el esquema existente.');
  }
}

async function ensureSyncLogsTable(client) {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sync_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        details JSONB NULL,
        stats JSONB NULL,
        created_by UUID NULL,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
  } catch (error) {
    if (error?.code !== '42501') {
      // No tirar â€” la tabla puede preexistir con esquema legacy incompatible.
      console.warn('[schema] sync_logs: no se pudo asegurar la tabla:', error?.message);
    } else {
      console.warn('[schema] Sin permisos para crear sync_logs; se usara fallback sin log persistente.');
    }
  }
  // Cada Ã­ndice en su propio try/catch: la tabla legacy puede no tener las columnas referenciadas.
  const indices = [
    [`idx_sync_logs_sync_type`, `CREATE INDEX IF NOT EXISTS idx_sync_logs_sync_type ON sync_logs (sync_type)`],
    [`idx_sync_logs_started_at`, `CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs (started_at DESC)`],
    [`idx_sync_logs_status`, `CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs (status)`],
  ];
  for (const [name, sql] of indices) {
    try {
      await client.query(sql);
    } catch (idxErr) {
      console.warn(`[schema] sync_logs: no se pudo crear ${name} (${idxErr?.code}): ${idxErr?.message}`);
    }
  }
}

// ======================================================
// GET /api/tango/compare â€” Comparativa completa Tango vs CRM
// ======================================================
router.get('/pending-sales', requireRole(['admin', 'supervisor']), async (req, res) => {
  const { status, ban, cliente, tipo, ventatipo_id: ventaTipoId, from, to, limit = '100', offset = '0' } = req.query || {};
  const filters = [];
  const params = [];
  const normalizedStatus = normalizePendingStatus(status);
  if (status && !normalizedStatus) return res.status(400).json({ error: 'status invalido' });

  if (normalizedStatus) {
    params.push(normalizedStatus);
    filters.push(`p.status = $${params.length}`);
  }
  if (ban) {
    params.push(`%${String(ban).replace(/\D/g, '') || String(ban).trim()}%`);
    filters.push(`regexp_replace(COALESCE(p.ban_tango, ''), '\\D', '', 'g') LIKE $${params.length}`);
  }
  if (cliente) {
    params.push(`%${String(cliente).trim()}%`);
    filters.push(`p.cliente_tango ILIKE $${params.length}`);
  }
  const tipoValue = ventaTipoId || tipo;
  if (tipoValue) {
    params.push(Number(tipoValue));
    filters.push(`p.ventatipo_id = $${params.length}`);
  }
  if (from) {
    params.push(String(from).slice(0, 10));
    filters.push(`p.fecha_activacion >= $${params.length}::date`);
  }
  if (to) {
    params.push(String(to).slice(0, 10));
    filters.push(`p.fecha_activacion <= $${params.length}::date`);
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const totalResult = await crmPool.query(`SELECT COUNT(*)::int AS total FROM tango_commission_pending_sales p ${whereSql}`, params);
    const listParams = [...params, safeLimit, safeOffset];
    const rowsResult = await crmPool.query(
      `${pendingSaleSelectSql()}
       ${whereSql}
       ORDER BY p.fecha_activacion DESC NULLS LAST, p.ventaid DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    return res.json({ rows: rowsResult.rows, total: Number(totalResult.rows[0]?.total || 0), limit: safeLimit, offset: safeOffset });
  } catch (error) {
    console.error('[TANGO PENDING] Error listando pendientes:', error);
    return res.status(500).json({ error: 'Error listando pendientes Tango' });
  }
});

router.get('/pending-sales/:ventaid', requireRole(['admin', 'supervisor']), async (req, res) => {
  const ventaid = Number(req.params.ventaid);
  if (!Number.isFinite(ventaid) || ventaid <= 0) return res.status(400).json({ error: 'ventaid invalido' });

  try {
    const result = await crmPool.query(`${pendingSaleSelectSql()} WHERE p.ventaid = $1 LIMIT 1`, [ventaid]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Venta pendiente no encontrada' });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[TANGO PENDING] Error obteniendo detalle:', error);
    return res.status(500).json({ error: 'Error obteniendo venta pendiente' });
  }
});

router.patch('/pending-sales/:ventaid/link', requireRole(['admin', 'supervisor']), async (req, res) => {
  const ventaid = Number(req.params.ventaid);
  const { client_id: clientId, ban_id: banId, subscriber_id: subscriberId } = req.body || {};
  if (!Number.isFinite(ventaid) || ventaid <= 0) return res.status(400).json({ error: 'ventaid invalido' });
  if (!clientId || !banId || !subscriberId) return res.status(400).json({ error: 'client_id, ban_id y subscriber_id son requeridos' });

  const client = await crmPool.connect();
  try {
    await client.query('BEGIN');
    const relation = await client.query(
      `SELECT c.id AS client_id, c.name AS client_name, b.id AS ban_id, b.ban_number, s.id AS subscriber_id, s.phone AS subscriber_phone
         FROM clients c
         JOIN bans b ON b.client_id = c.id
         JOIN subscribers s ON s.ban_id = b.id
        WHERE c.id = $1 AND b.id = $2 AND s.id = $3
        LIMIT 1`,
      [clientId, banId, subscriberId]
    );
    if (relation.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La relacion cliente/BAN/suscriptor no es valida' });
    }

    const pending = await client.query(
      `UPDATE tango_commission_pending_sales
          SET status = 'linked',
              linked_client_id = $2,
              linked_ban_id = $3,
              linked_subscriber_id = $4,
              updated_at = NOW()
        WHERE ventaid = $1
          AND status <> 'ignored'
        RETURNING *`,
      [ventaid, clientId, banId, subscriberId]
    );
    if (pending.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Venta pendiente no encontrada o ignorada' });
    }

    await client.query('COMMIT');
    return res.json({ success: true, row: { ...pending.rows[0], ...relation.rows[0] } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[TANGO PENDING] Error vinculando venta:', error);
    return res.status(500).json({ error: 'Error vinculando venta pendiente' });
  } finally {
    client.release();
  }
});

router.patch('/pending-sales/:ventaid/ignore', requireRole(['admin', 'supervisor']), async (req, res) => {
  const ventaid = Number(req.params.ventaid);
  const motivo = String(req.body?.motivo_exclusion || req.body?.motivo || '').trim();
  if (!Number.isFinite(ventaid) || ventaid <= 0) return res.status(400).json({ error: 'ventaid invalido' });
  if (motivo.length < 3) return res.status(400).json({ error: 'motivo_exclusion requerido' });

  try {
    const result = await crmPool.query(
      `UPDATE tango_commission_pending_sales
          SET status = 'ignored',
              motivo = $2,
              updated_at = NOW()
        WHERE ventaid = $1
        RETURNING *`,
      [ventaid, motivo]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Venta pendiente no encontrada' });
    return res.json({ success: true, row: result.rows[0] });
  } catch (error) {
    console.error('[TANGO PENDING] Error ignorando venta:', error);
    return res.status(500).json({ error: 'Error ignorando venta pendiente' });
  }
});

router.post('/pending-sales/:ventaid/convert', requireRole(['admin', 'supervisor']), async (req, res) => {
  const ventaid = Number(req.params.ventaid);
  if (!Number.isFinite(ventaid) || ventaid <= 0) return res.status(400).json({ error: 'ventaid invalido' });

  const client = await crmPool.connect();
  try {
    await client.query('BEGIN');
    const pendingResult = await client.query(`SELECT * FROM tango_commission_pending_sales WHERE ventaid = $1 FOR UPDATE`, [ventaid]);
    const pending = pendingResult.rows[0];
    if (!pending) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Venta pendiente no encontrada' });
    }
    if (pending.status !== 'linked' || !pending.linked_subscriber_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La venta debe estar linked y tener linked_subscriber_id' });
    }

    const existingBySale = await client.query(
      `SELECT subscriber_id, report_month, external_sale_id
         FROM subscriber_reports
        WHERE external_sale_id = $1 OR tango_ventaid = $2
        LIMIT 1`,
      [String(ventaid), ventaid]
    );
    if (existingBySale.rows.length > 0) {
      await client.query('COMMIT');
      return res.json({ success: true, already_exists: true, report: existingBySale.rows[0] });
    }

    const reportMonth = monthStartFromDate(pending.fecha_activacion);
    if (!reportMonth) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'fecha_activacion requerida para convertir' });
    }

    const rawPayload = { ...(pending.raw_payload || {}), pending_sale_id: pending.id, converted_from_pending: true };
    const reportResult = await client.query(
      `INSERT INTO subscriber_reports (
         subscriber_id, report_month, source, external_sale_id,
         source_activation_date, source_report_month, raw_payload,
         validation_status, validation_notes,
         company_earnings, vendor_commission, created_at, updated_at
       )
       VALUES (
         $1, $2::date, 'tango-api-v2-pending', $3,
         $4::date, $2::date, $5::jsonb,
         'confirmed', 'convertida_desde_pending_sales',
         $6, $7, NOW(), NOW()
       )
       ON CONFLICT (subscriber_id, report_month)
       DO UPDATE SET
         source = EXCLUDED.source,
         external_sale_id = COALESCE(subscriber_reports.external_sale_id, EXCLUDED.external_sale_id),
         source_activation_date = COALESCE(subscriber_reports.source_activation_date, EXCLUDED.source_activation_date),
         source_report_month = COALESCE(subscriber_reports.source_report_month, EXCLUDED.source_report_month),
         raw_payload = COALESCE(subscriber_reports.raw_payload, EXCLUDED.raw_payload),
         validation_status = CASE WHEN subscriber_reports.validation_status = 'confirmed' THEN 'confirmed' ELSE EXCLUDED.validation_status END,
         validation_notes = COALESCE(subscriber_reports.validation_notes, EXCLUDED.validation_notes),
         company_earnings = CASE WHEN COALESCE(subscriber_reports.company_earnings, 0) = 0 THEN EXCLUDED.company_earnings ELSE subscriber_reports.company_earnings END,
         vendor_commission = CASE WHEN COALESCE(subscriber_reports.vendor_commission, 0) = 0 THEN EXCLUDED.vendor_commission ELSE subscriber_reports.vendor_commission END,
         updated_at = NOW()
       RETURNING *`,
      [
        pending.linked_subscriber_id,
        reportMonth,
        String(ventaid),
        pending.fecha_activacion,
        JSON.stringify(rawPayload),
        pending.company_earnings,
        pending.vendor_commission,
      ]
    );

    await client.query(`UPDATE tango_commission_pending_sales SET status = 'linked', updated_at = NOW() WHERE ventaid = $1`, [ventaid]);
    await client.query('COMMIT');
    return res.json({ success: true, already_exists: false, report: reportResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[TANGO PENDING] Error convirtiendo venta:', error);
    return res.status(500).json({ error: 'Error convirtiendo venta pendiente' });
  } finally {
    client.release();
  }
});

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
// GET /api/tango/detail/:ban â€” Detalle de un BAN especÃ­fico
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
// GET /api/tango/summary â€” Resumen mensual Tango vs CRM
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
// POST /api/tango/sync â€” Sync incremental controlado
// Lee desde max(sync_from_date, last_successful_sync) hasta hoy.
// NO ejecuta cleanup destructivo (solo lectura/upsert seguro).
// Lock con heartbeat: auto-release si previo estÃ¡ stale >30min.
// Tango es SOURCE OF TRUTH. Overrides gerenciales (Fase 3) viven aparte.
// ======================================================
router.post('/sync', requireRole(['admin', 'supervisor']), async (req, res) => {
  return runTangoSync({
    req, res,
    mode: 'incremental',
    allowCleanup: false,
    customRange: null, // se calcula desde tango_sync_config
    reason: null,
  });
});

// ======================================================
// POST /api/tango/sync-range â€” Re-sync controlado por rango (admin)
// Body: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', reason: 'texto', cleanup?: bool }
// No cambia sync_from_date global. No borra overrides. Cleanup opt-in.
// ======================================================
router.post('/sync-range', requireRole(['admin', 'supervisor']), async (req, res) => {
  const { from, to, reason, cleanup } = req.body || {};
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: 'from y to requeridos (YYYY-MM-DD)' });
  }
  if (from > to) {
    return res.status(400).json({ error: 'from no puede ser posterior a to' });
  }
  if (!reason || String(reason).trim().length < 5) {
    return res.status(400).json({ error: 'reason requerido (min 5 chars) para resync por rango' });
  }
  return runTangoSync({
    req, res,
    mode: 'resync_range',
    allowCleanup: !!cleanup, // opt-in, default false
    customRange: { from, to },
    reason: String(reason).trim(),
  });
});

async function runTangoSync({ req, res, mode, allowCleanup, customRange, reason }) {
  const alerts = [];
  const rejectedRows = [];
  let syncLogId = randomUUID();
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
    reports_rejected: 0,
    pending_sales_attempted: 0,
    pending_sales_upserted: 0,
    pending_sales_skipped: 0,
    errors: 0,
  };

  // Flag opt-in: si AUTO_CREATE_FROM_TANGO=true, cuando una venta Tango trae un
  // BAN que no existe en CRM, creamos cliente + BAN automÃ¡ticamente y la venta
  // sigue el flujo normal de sync (subs + report). Sin flag, esa venta cae en
  // external_sales con motivo 'ban_no_existe_en_crm' (comportamiento histÃ³rico).
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

  const startedAtMs = Date.now();
  const warnings = [];
  let syncRange = null;
  let lockHeld = false;

  try {
    const legacyPool = getTangoPool();
    await ensureSubscriberReportsTraceabilityColumns(crmPool);
    await ensureTangoSyncCrmColumns(crmPool);
    await ensureSyncLogsTable(crmPool);

    // â”€â”€ Lock + range + log estructurado (Fase 2A) â”€â”€
    // Si la migraciÃ³n 2026-05-17-tango-sync-config.sql no fue aplicada,
    // computeIncrementalRange() lanza error claro y abortamos sin tocar nada.
    const stale = await detectStaleLock();
    if (stale) {
      warnings.push({ type: 'auto_released_lock', ...stale });
      console.warn('[SYNC] Lock previo auto-liberado (heartbeat stale):', stale);
    }
    const lockResult = await acquireSyncLock({ syncLogId });
    if (!lockResult.acquired) {
      return res.status(409).json({
        success: false,
        error: 'Sync ya en ejecuciÃ³n',
        current_log_id: lockResult.owner_log_id,
        heartbeat_at: lockResult.heartbeat_at,
      });
    }
    lockHeld = true;

    // Rango efectivo: incremental usa config; resync_range usa el body.
    syncRange = customRange
      ? { from: customRange.from, to: customRange.to, sync_mode: mode }
      : await computeIncrementalRange();

    try {
      const logEntry = await createSyncLog({
        syncMode: mode,
        rangeStart: syncRange.from,
        rangeEnd: syncRange.to,
        reason,
        userId: req.user?.id || null,
        userRole: req.user?.role || null,
      });
      syncLogId = logEntry.id; // sobrescribimos con el id real persistido
    } catch (syncLogErr) {
      console.warn('[SYNC] No se pudo crear sync_log estructurado (continuando con UUID en memoria):', syncLogErr.message);
    }
    console.log(`[SYNC] mode=${mode} range=${syncRange.from}â†’${syncRange.to} allowCleanup=${allowCleanup}`);

    // â”€â”€ 0. Load salespeople for vendedor mapping â”€â”€
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

    // 0b. Tipos Tango: no se usa allowlist local para decidir si una venta existe.
    // Tango V2 decide existencia y comision; el CRM solo clasifica el tipo.
    const getSaleTypeClassification = (sale) => classifyTangoVentaTipo(sale?.ventatipoid, sale?.ventatipo_nombre || sale?.tipo || sale?.nombre);
    const isMobileSale = (sale) => getSaleTypeClassification(sale).family === 'movil';
    const isFixedLikeSale = (sale) => !isMobileSale(sale);

    // â”€â”€ 1. Pre-load CRM bans + clients ANTES del fetch Tango â”€â”€
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

    // â”€â”€ 2. Fetch ventas Tango con filtro 1 â”€â”€
    // Fuente oficial: Tango API V2. Legacy/POS queda como fallback/comparacion
    // historica y para completar campos cuando V2 no trae algun dato.
    // Rango dinamico (Fase 2A):
    //   incremental: max(sync_from_date, last_successful_sync) -> hoy
    //   resync_range: rango manual del admin
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
        AND v.fechaactivacion >= $1::date
        AND v.fechaactivacion <  ($2::date + INTERVAL '1 day')
      ORDER BY COALESCE(TRIM(cc.nombre), 'SIN NOMBRE'), TRIM(v.ban::text), v.ventaid
    `, [syncRange.from, syncRange.to]);
    const legacyRows = tangoResult.rows;
    console.log(`[SYNC] ${legacyRows.length} ventas legacy/POS pasaron filtro 1 (ventatipoid)`);

    const apiV2 = await fetchTangoApiV2Range(syncRange.from, syncRange.to);
    stats.tango_api_v2_sales = apiV2.salesById.size;
    stats.tango_api_v2_commissions = apiV2.commissionsById.size;
    stats.tango_ventas_legacy = legacyRows.length;
    stats.tango_api_v2_only = 0;
    stats.tango_legacy_fallback_only = 0;
    if (apiV2.warnings.length > 0) {
      for (const warning of apiV2.warnings) alert('warn', '', `API V2 Tango: ${warning}`);
    }

    const mergedRowsRaw = mergeTangoApiV2RowsWithLegacyRows({
      apiRows: apiV2.salesRows,
      legacyRows,
      commissionsById: apiV2.commissionsById,
    });
    const mergedRows = mergedRowsRaw.filter((row) => shouldIncludeTangoV2SaleForCommissions(row, row));
    stats.tango_v2_first_excluded_by_tipo = mergedRowsRaw.length - mergedRows.length;
    const legacyVentaIds = new Set(
      legacyRows
        .map((row) => Number(row.ventaid))
        .filter((ventaid) => Number.isFinite(ventaid) && ventaid > 0)
    );
    stats.tango_api_v2_only = mergedRows.filter((row) => row.source_priority === 'api_v2' && !legacyVentaIds.has(Number(row.ventaid))).length;
    stats.tango_legacy_fallback_only = mergedRows.filter((row) => row.source_priority === 'legacy_fallback').length;
    tangoResult.rows = mergedRows;
    console.log(`[SYNC] ${tangoResult.rows.length} ventas Tango V2-first para procesar (${stats.tango_api_v2_only} solo V2, ${stats.tango_legacy_fallback_only} solo legacy)`);

    // â”€â”€ 3. Filtro 2 en JS: BAN debe existir en CRM. Las que no, van a external_sales. â”€â”€
    // Si AUTO_CREATE_FROM_TANGO=true, antes de descartarlas se intenta crear
    // cliente + BAN en CRM y la venta pasa al flujo normal.
    const externalSales = [];
    const ventasValidas = [];
    const ventasBanNuevo = []; // candidatas a auto-create (agrupadas luego)
    const pymesAutocreatedVentaIds = new Set();

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
        const isPymesAutocreate = isPymesAutocreateVentaTipo(v.ventatipoid, v.ventatipo_nombre || v.tipo || v.nombre) && Number(v.com_empresa || 0) > 0;
        if (AUTO_CREATE_FROM_TANGO || isPymesAutocreate) {
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

    // â”€â”€ 3b. AUTO-CREATE clientes/BANs desde Tango â”€â”€
    // Agrupa ventasBanNuevo por banNum, decide nombre cliente y account_type,
    // y crea cliente + BAN. DespuÃ©s mueve las ventas a ventasValidas para que
    // el flujo normal genere subscriber + report.
    if (ventasBanNuevo.length > 0) {
      const ventasPorBan = new Map();
      for (const v of ventasBanNuevo) {
        const banNum = String(v.ban || '').trim();
        if (!ventasPorBan.has(banNum)) ventasPorBan.set(banNum, []);
        ventasPorBan.get(banNum).push(v);
      }
      console.log(`[SYNC][AUTO] ${ventasPorBan.size} BANs nuevos de Tango â€” intentando auto-create`);

      for (const [banNum, ventasDelBan] of ventasPorBan) {
        try {
          const isPymesAutoCreateGroup = ventasDelBan.some((row) => isPymesAutocreateVentaTipo(row.ventatipoid, row.ventatipo_nombre || row.tipo || row.nombre));
          const autoSource = isPymesAutoCreateGroup ? 'tango_v2_autocreate' : 'tango';

          // 1) Determinar account_type del BAN segÃºn ventatipoids del grupo
          let hasMobile = false;
          let hasFijo = false;
          for (const v of ventasDelBan) {
            const t = Number(v.ventatipoid);
            if (isMobileSale(v)) hasMobile = true;
            if (isFixedLikeSale(v)) hasFijo = true;
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
            const notes = `auto-creado desde tango sync Â· ventaid=${ventaid} Â· ${fechaIso}`;
            const newClient = await crmPool.query(
              `INSERT INTO clients (name, owner_name, salesperson_id, source, pendiente_validacion, notes, created_at, updated_at)
               VALUES ($1::text, $2::text, $3::uuid, $5::text, true, $4::text, NOW(), NOW())
               RETURNING id, name, salesperson_id`,
              [clientName, clientName, spId || null, notes, autoSource]
            );
            clientId = newClient.rows[0].id;
            const created = newClient.rows[0];
            clientByName.set(clientName.toUpperCase(), { id: clientId, name: created.name, salesperson_id: created.salesperson_id });
            clientById.set(clientId, { id: clientId, name: created.name, salesperson_id: created.salesperson_id });
            stats.clients_auto_created++;
            alert('info', banNum, `[AUTO] Cliente creado: ${clientName}${usePlaceholder ? ' (placeholder, requiere validaciÃ³n)' : ''}`);
          }

          // 6) Crear BAN
          const newBan = await crmPool.query(
            `INSERT INTO bans (ban_number, client_id, account_type, status, source, created_at, updated_at)
             VALUES ($1::text, $2::uuid, $3::text, 'A', $4::text, NOW(), NOW())
             RETURNING id, ban_number, client_id, account_type`,
            [banNum, clientId, accountType, autoSource]
          );
          const banRecord = newBan.rows[0];
          banByNumber.set(banNum, banRecord);
          stats.bans_auto_created++;
          alert('info', banNum, `[AUTO] BAN creado tipo ${accountType} â†’ cliente ${clientName}`);

          // 7) Mover ventas del BAN al flujo normal
          for (const v of ventasDelBan) {
            ventasValidas.push(v);
            if (isPymesAutoCreateGroup) pymesAutocreatedVentaIds.add(Number(v.ventaid));
          }
        } catch (autoErr) {
          // Falla en auto-create â†’ mandar TODAS las ventas del BAN a external_sales
          // con motivo distinto para diagnÃ³stico, no bloquea el resto del sync.
          alert('error', banNum, `[AUTO] FallÃ³ auto-create: ${autoErr.message}`);
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
    console.log(`[SYNC] ${stats.tango_ventas} totales | ${stats.tango_ventas_validas} vÃ¡lidas | ${stats.tango_ventas_external} external (BAN no existe en CRM)`);

    // â”€â”€ 4. Pre-procesamiento sobre ventasValidas â”€â”€
    const banTypeByBan = new Map();
    const activePhonesByBan = new Map();
    for (const row of ventasValidas) {
      const banNum = String(row.ban || '').trim();
      if (!banNum) continue;

      const ventaTipo = Number(row.ventatipoid);
      const current = banTypeByBan.get(banNum) || { hasMobile: false, hasFijo: false };
      if (isMobileSale(row)) current.hasMobile = true;
      if (isFixedLikeSale(row)) current.hasFijo = true;
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

    const fixedBundleKeyFromSale = (sale) => {
      const classification = getSaleTypeClassification(sale);
      if (classification.family !== 'fijo') return null;
      const ban = String(sale?.ban || '').trim();
      const activationDate = toYmd(sale?.fechaactivacion);
      const vendor = String(sale?.tango_vendor_id || sale?.vendedor || '').trim().toUpperCase();
      const saleType = classification.lineType;
      if (!ban || !activationDate || !vendor) return null;
      return [ban, activationDate, vendor, saleType].join('|');
    };

    const paidFixedBundleKeys = new Set();
    for (const sale of ventasValidas) {
      const key = fixedBundleKeyFromSale(sale);
      if (!key) continue;
      const company = Number(sale.com_empresa || 0);
      const vendor = Number(sale.com_vendedor || 0);
      if (company > 0 || vendor > 0) paidFixedBundleKeys.add(key);
    }

    // â”€â”€ 3. Pre-load existing tango_ventaid subscribers â”€â”€
    const existingSubs = await crmPool.query(
      `SELECT id, tango_ventaid, ban_id, phone, plan, line_type, line_kind, monthly_value, contract_term, contract_end_date, status
       FROM subscribers
       WHERE tango_ventaid IS NOT NULL`
    );
    const subByVentaId = new Map();
    for (const s of existingSubs.rows) subByVentaId.set(Number(s.tango_ventaid), s);

    const subscriberColumnRows = await crmPool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'subscribers'
    `);
    const subscriberColumns = new Set(subscriberColumnRows.rows.map((row) => row.column_name));

    // â”€â”€ 3a. Pre-cargar fechaactivacion de Tango para los tango_ventaid existentes en CRM. â”€â”€
    // Usado por PASO 1.5 (resoluciÃ³n de conflictos por phone_norm: la fecha mÃ¡s reciente gana).
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

    // â”€â”€ 3a.bis: Pre-cargar commission_percentage por salesperson â”€â”€
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
      // tabla puede no existir en alguna instalaciÃ³n â€” sigue sin map (regla = no calcula)
      console.warn('[SYNC] No se pudo pre-cargar vendor commission_percentage:', err.message);
    }

    // â”€â”€ 3b. Cleanup DESACTIVADO TEMPORALMENTE â”€â”€
    // Solo loguea lo que hubiera borrado. NO ejecuta DELETE.
    // Para reactivar, descomentar las queries DELETE y restaurar subByVentaId.delete().
    const activeVentaIds = new Set(tangoResult.rows.map(v => Number(v.ventaid)));
    const wouldDelete = [];
    for (const [ventaId, sub] of subByVentaId) {
      if (!activeVentaIds.has(ventaId)) {
        wouldDelete.push({ ventaid: ventaId, subscriber_id: sub.id, phone: sub.phone || null });
        alert('warn', sub.phone || '', `[CLEANUP DESACTIVADO] Venta ${ventaId} ya no activa en Tango â€” habria eliminado subscriber id ${sub.id}`);
      }
    }
    stats.subscribers_would_have_deactivated = wouldDelete.length;
    if (wouldDelete.length > 0) {
      console.log(`[SYNC] CLEANUP DESACTIVADO: habria eliminado ${wouldDelete.length} subscribers`);
    }

    // â”€â”€ 5. Process each venta valida â”€â”€
    let _heartbeatCounter = 0;
    for (const v of ventasValidas) {
      // Heartbeat cada 50 ventas para que el lock no se considere stale.
      if (++_heartbeatCounter % 50 === 0) {
        await touchHeartbeat().catch(() => { /* best effort */ });
      }
      try {
        const banNum = v.ban;
        const ventaTipo = Number(v.ventatipoid);
        const classification = getSaleTypeClassification(v);
        const isMobile = classification.family === 'movil';
        const isFijo = classification.family === 'fijo';
        const isFixedLike = classification.family !== 'movil';
        const lineType = classification.lineType;
        // Tipo real de lÃ­nea segÃºn ventatipoid Tango (independiente del account_type
        // del BAN). Manda en comisiones/metas; CONVERGENTE solo es atributo del BAN.
        const lineKind = classification.family || null;
        const monthVal = v.fechaactivacion
          ? new Date(v.fechaactivacion).toISOString().slice(0, 7) + '-01'
          : null;
        const monthlyValueResolution = await resolveMonthlyValueForPlan(crmPool, legacyPool, v.plan_code, v.mensualidad);
        const monthlyValue = monthlyValueResolution.value;
        const contractTerm = Number.isFinite(Number(v.meses)) ? Number(v.meses) : null;
        const contractEndDate = contractTerm && contractTerm > 0 ? addMonthsYmd(v.fechaactivacion, contractTerm) : null;
        const comEmpresa = parseFloat(v.com_empresa);
        const comVendedor = parseFloat(v.com_vendedor);
        const portabilityBonus = parseFloat(v.portability_bonus) || 0;
        const sourceActivationDate = toYmd(v.fechaactivacion);
        // Para Fijo (140,141) phone puede ser vacÃ­o, para MÃ³vil (138,139) es obligatorio
        let phone = v.phone || null;
        if (phone) {
          const normalizedPhone = String(phone).replace(/\D/g, '');
          if (normalizedPhone.length > 0) {
            phone = normalizedPhone;
          }
        }
        if (isMobile && !phone) {
          alert('error', banNum, `Venta ${v.ventaid}: MÃ³vil sin telÃ©fono, ignorando`);
          continue;
        }
        const planCode = v.plan_code || null;

        if (!banNum) {
          alert('error', '', `Venta ${v.ventaid}: sin BAN, saltando`);
          continue;
        }
        if (!Number.isFinite(Number(v.ventaid)) || Number(v.ventaid) <= 0) {
          rejectedRows.push({
            ban: banNum,
            ventaid: null,
            phone: phone || null,
            cliente: v.cliente || null,
            motivo: 'missing_ventaid',
            fechaactivacion: sourceActivationDate,
            report_month: monthVal,
          });
          stats.reports_rejected++;
          alert('warn', banNum, `Venta sin ventaid marcada needs_review: ${banNum}`);
          continue;
        }
        if (!monthVal) {
          rejectedRows.push({
            ban: banNum,
            ventaid: v.ventaid || null,
            phone: phone || null,
            cliente: v.cliente || null,
            motivo: 'missing_fechaactivacion',
            fechaactivacion: sourceActivationDate,
            report_month: monthVal,
          });
          stats.reports_rejected++;
          alert('warn', banNum, `Venta ${v.ventaid || 'âˆ…'} marcada needs_review: missing_fechaactivacion`);
          continue;
        }

        // â”€â”€ PASO 1: Resolver Client + BAN â”€â”€
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
          alert('info', banNum, `Vendedor actualizado: ${v.vendedor} â†’ cliente ${clientRecord?.name || v.cliente}`);
          if (clientRecord) {
            clientRecord.salesperson_id = spId;
          } else {
            clientById.set(clientId, { id: clientId, name: v.cliente, salesperson_id: spId });
          }
        }

        // â”€â”€ PASO 2: Resolver Subscriber via tango_ventaid â”€â”€
        let subscriberId;
        const existingSub = subByVentaId.get(Number(v.ventaid));

        if (existingSub) {
          subscriberId = existingSub.id;
          // Check for changes and update (compare against actual values that would be written)
          // Para Fijo: phone puede ser vacÃ­o, para MÃ³vil nunca debe ser vacÃ­o
          const changes = [];
          if (existingSub.ban_id !== banRecord.id) changes.push(`ban_id`);
          if ((existingSub.plan || '') !== (planCode || '')) changes.push(`plan: '${existingSub.plan}'â†’'${planCode}'`);
          if ((existingSub.line_type || '') !== lineType) changes.push(`line_type: '${existingSub.line_type}'â†’'${lineType}'`);
          const existingPhoneDigits = String(existingSub.phone || '').replace(/\D/g, '');
          if (phone && !existingPhoneDigits) changes.push(`phone: 'vacio'â†’'${phone}'`);
          if (monthlyValue != null && parseFloat(existingSub.monthly_value || 0) !== monthlyValue) changes.push(`monthly_value: ${existingSub.monthly_value}â†’${monthlyValue}`);
          if (Number(existingSub.contract_term || 0) !== Number(contractTerm || 0)) changes.push(`contract_term: '${existingSub.contract_term}'â†’'${contractTerm}'`);
          if ((existingSub.contract_end_date ? String(existingSub.contract_end_date).slice(0, 10) : '') !== (contractEndDate || '')) {
            changes.push(`contract_end_date: '${existingSub.contract_end_date}'â†’'${contractEndDate}'`);
          }
          if ((existingSub.status || '').toLowerCase() !== 'activo') changes.push(`status: '${existingSub.status}'â†’'activo'`);
          if ((existingSub.line_kind || null) !== lineKind) changes.push(`line_kind: '${existingSub.line_kind || 'âˆ…'}'â†’'${lineKind || 'âˆ…'}'`);

          if (changes.length > 0) {
            await crmPool.query(`
              UPDATE subscribers
              SET ban_id=$1,
                  plan=$2,
                  line_type=$3,
                  phone=CASE
                    WHEN NULLIF(TRIM(COALESCE(phone, '')), '') IS NULL
                      AND $4::text IS NOT NULL
                      AND NOT EXISTS (
                        SELECT 1
                        FROM subscribers sx
                        WHERE sx.phone_norm = $4::text
                          AND sx.id <> $9
                      )
                      THEN $4::text
                    ELSE phone
                  END,
                  monthly_value=COALESCE($5, monthly_value),
                  contract_term=$6,
                  contract_end_date=$7,
                  line_kind=$8,
                  status='activo',
                  cancel_reason=NULL,
                  updated_at=NOW()
              WHERE id=$9
            `, [banRecord.id, planCode, lineType, phone, monthlyValue, contractTerm, contractEndDate, lineKind, subscriberId]);
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
                    monthly_value=COALESCE($4, monthly_value),
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
              alert('info', banNum, `Subscriber vinculado por telÃ©fono: ${phone} â†’ ventaid ${v.ventaid}`);
            }
          }

          // Fallback legacy: vincula reportes por comision si ya existe un subscriber sin telefono real.
          // Si Tango API V2 ya trajo phone, se guarda porque es dato real de la venta.
          if (!matched) {
            const fallbackResult = await crmPool.query(`
              SELECT s.id, s.phone FROM subscribers s
              JOIN subscriber_reports sr ON sr.subscriber_id = s.id
              WHERE s.ban_id = $1 AND s.tango_ventaid IS NULL
                AND sr.report_month = $2::date
                AND sr.company_earnings = $3
                AND NULLIF(TRIM(COALESCE(s.phone, '')), '') IS NULL
              LIMIT 1
            `, [banRecord.id, monthVal, comEmpresa]);
            if (fallbackResult.rows.length > 0) {
              subscriberId = fallbackResult.rows[0].id;
              await crmPool.query(`
                UPDATE subscribers
                SET tango_ventaid=$1,
                    plan=$2,
                    line_type=$3,
                    phone=CASE
                      WHEN NULLIF(TRIM(COALESCE(phone, '')), '') IS NULL AND $9::text IS NOT NULL
                        THEN $9::text
                      ELSE phone
                    END,
                    monthly_value=COALESCE($4, monthly_value),
                    contract_term=$5,
                    contract_end_date=$6,
                    line_kind=$7,
                    status='activo',
                    cancel_reason=NULL,
                    updated_at=NOW()
                WHERE id=$8
              `, [v.ventaid, planCode, lineType, monthlyValue, contractTerm, contractEndDate, lineKind, subscriberId, phone]);
              subByVentaId.set(Number(v.ventaid), { id: subscriberId, tango_ventaid: v.ventaid });
              stats.subscribers_updated++;
              matched = true;
              alert('info', banNum, `Subscriber sin numero vinculado por comision -> ventaid ${v.ventaid}${phone ? `, phone ${phone}` : ''}`);
            }
          }

          // â”€â”€ PASO 1.5: Resolver conflicto por phone_norm (Ãºltima fecha gana) â”€â”€
          // Constraint phone_norm_uniq es GLOBAL: el mismo phone NO puede existir en
          // dos filas. Antes del INSERT, verificamos si existe otro subscriber con ese
          // phone en otro tango_ventaid (mismo BAN o no). Si Tango trae fecha mÃ¡s
          // reciente con margen >3 dÃ­as, movemos/actualizamos el existente. Si Tango
          // es mÃ¡s viejo o equivalente, se ignora como histÃ³rico.
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

              // 1) Obtener fecha existente (PRIORIDAD: tango_ventaid â†’ created_at â†’ updated_at)
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

              // Filtro de seguridad: solo mover si la diferencia supera 3 dÃ­as
              const diffDays = Math.abs((newDateObj - existingDateObj) / (1000 * 60 * 60 * 24));

              if (newDateObj > existingDateObj && diffDays > 3) {
                // Tango mÃ¡s reciente â†’ UPDATE del existente
                await crmPool.query(
                  `UPDATE subscribers
                     SET ban_id=$1,
                         plan=$2,
                         line_type=$3,
                         monthly_value=COALESCE($4, monthly_value),
                         tango_ventaid=$5,
                         contract_term=$6,
                         contract_end_date=$7,
                         line_kind=$8,
                         status='activo',
                         cancel_reason=NULL,
                         updated_at=NOW()
                   WHERE id=$9`,
                  [
                    banRecord.id,
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
                    ? `RenovaciÃ³n: ventaid ${c.tango_ventaid || 'âˆ…'} â†’ ${v.ventaid} (${existingDate} â†’ ${newDate})`
                    : `Movimiento: phone ${phone} de BAN ${c.ban_number} â†’ ${banNum} (${existingDate} â†’ ${newDate})`
                );
              } else {
                // Venta vieja o diferencia <= 3 dÃ­as â†’ ignorar
                alert(
                  'info',
                  banNum,
                  `HistÃ³rico ignorado: phone ${phone} ya en BAN ${c.ban_number} (${existingDate}) vs Tango ${newDate}`
                );
                continue;
              }
            }
          }

          if (!matched) {
            const canCreateSubscriberFromTango = Boolean(
              Number.isFinite(Number(v.ventaid)) &&
              Number(v.ventaid) > 0 &&
              (phone || isFixedLike)
            );
            if (canCreateSubscriberFromTango) {
              const hasPhoneNumberColumn = subscriberColumns.has('phone_number');
              const phoneColumns = hasPhoneNumberColumn ? 'phone_number, phone,' : 'phone,';
              const phoneValues = hasPhoneNumberColumn ? '$2::text, $2::text,' : '$2::text,';
              const phoneNumberUpdate = hasPhoneNumberColumn
                ? `phone_number = CASE
                    WHEN NULLIF(TRIM(COALESCE(subscribers.phone_number, '')), '') IS NULL
                      THEN EXCLUDED.phone_number
                    ELSE subscribers.phone_number
                  END,`
                : '';
              const createdSub = await crmPool.query(`
                INSERT INTO subscribers (
                  ban_id, ${phoneColumns} plan, line_type, monthly_value,
                  contract_term, contract_end_date, line_kind, tango_ventaid,
                  status, cancel_reason, created_at, updated_at
                )
                VALUES (
                  $1::uuid, ${phoneValues} $3::text, $4::text, $5::numeric,
                  $6::integer, $7::date, $8::text, $9::bigint,
                  'activo', NULL, NOW(), NOW()
                )
                ON CONFLICT (tango_ventaid) WHERE tango_ventaid IS NOT NULL
                DO UPDATE SET
                  ban_id = EXCLUDED.ban_id,
                  phone = CASE
                    WHEN NULLIF(TRIM(COALESCE(subscribers.phone, '')), '') IS NULL
                      THEN EXCLUDED.phone
                    ELSE subscribers.phone
                  END,
                  ${phoneNumberUpdate}
                  plan = EXCLUDED.plan,
                  line_type = EXCLUDED.line_type,
                  monthly_value = COALESCE(EXCLUDED.monthly_value, subscribers.monthly_value),
                  contract_term = EXCLUDED.contract_term,
                  contract_end_date = EXCLUDED.contract_end_date,
                  line_kind = EXCLUDED.line_kind,
                  status = 'activo',
                  cancel_reason = NULL,
                  updated_at = NOW()
                RETURNING id
              `, [
                banRecord.id,
                phone || null,
                planCode,
                lineType,
                monthlyValue,
                contractTerm,
                contractEndDate,
                lineKind,
                Number(v.ventaid),
              ]);
              subscriberId = createdSub.rows[0].id;
              subByVentaId.set(Number(v.ventaid), { id: subscriberId, tango_ventaid: v.ventaid });
              stats.subscribers_created++;
              matched = true;
              alert('info', banNum, `Subscriber creado desde Tango V2: ventaid ${v.ventaid}${phone ? `, phone ${phone}` : ''}`);
            }
          }

          if (!matched) {
            externalSales.push({
              tango_ventaid: Number(v.ventaid),
              ban: banNum,
              ventatipoid: Number(v.ventatipoid),
              fechaactivacion: v.fechaactivacion ? String(v.fechaactivacion).slice(0, 10) : null,
              vendedor: v.vendedor || null,
              cliente: v.cliente || null,
              com_empresa: Number(v.com_empresa || 0),
              com_vendedor: Number(v.com_vendedor || 0),
              motivo: 'subscriber_no_existe_en_crm',
            });
            stats.reports_rejected++;
            alert('warn', banNum, `Venta ${v.ventaid}: sin subscriber CRM existente; Tango no crea ni modifica telefonos`);
            continue;
          }
        }

        // â”€â”€ PASO 3: Upsert subscriber_report â”€â”€
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
        const reportSource = pymesAutocreatedVentaIds.has(Number(v.ventaid)) ? 'tango_v2_autocreate' : 'tango';
        const rawPayload = {
          ventaid: Number(v.ventaid),
          ban: banNum,
          phone,
          plan_code: planCode,
          months: v.meses,
          ventatipoid: ventaTipo,
          mensualidad: monthlyValue,
          mensualidad_source: monthlyValueResolution.source,
          com_empresa: comEmpresa,
          com_vendedor: comVendedor,
          portability_bonus: portabilityBonus,
          fechaactivacion: sourceActivationDate,
          vendedorid: v.tango_vendor_id || null,
          cliente: v.cliente || null,
          vendedor: v.vendedor || null,
          source: reportSource,
          sync_log_id: syncLogId,
          report_month: monthVal,
        };

        const fixedBundleKey = fixedBundleKeyFromSale(v);
        const isIncludedFixedBundle =
          Boolean(isFijo && fixedBundleKey && paidFixedBundleKeys.has(fixedBundleKey))
          && !(comEmpresa > 0)
          && !(effectiveVendorCommission > 0);
        if (isIncludedFixedBundle) {
          rawPayload.included_in_fixed_bundle = true;
          rawPayload.fixed_bundle_key = fixedBundleKey;
        }

        // Regla de negocio: una venta Tango entra como 'confirmed' SOLO si
        // tiene todos los datos crÃ­ticos completos. Si falta cualquiera,
        // queda como 'needs_review' y NO suma a metas hasta validaciÃ³n manual.
        const validationIssues = [];
        if (!isIncludedFixedBundle) {
          if (!(comEmpresa > 0)) validationIssues.push('com_empresa<=0');
          if (!(effectiveVendorCommission > 0)) validationIssues.push('com_vendedor<=0');
          if (!(monthlyValue > 0)) validationIssues.push('mensualidad_sin_rate');
        }
        if (!spId && !String(v.vendedor || '').trim()) validationIssues.push('vendedor_no_mapeado');
        const validationStatus = validationIssues.length === 0 ? 'confirmed' : 'needs_review';
        const validationNotes = isIncludedFixedBundle ? 'incluida_paquete_fijo' : (validationIssues.length > 0 ? validationIssues.join('; ') : null);
        if (validationStatus === 'needs_review') {
          alert('warn', banNum, `Venta ${v.ventaid} marcada needs_review: ${validationIssues.join(', ')}`);
        }

        await crmPool.query(`
          INSERT INTO subscriber_reports (
            subscriber_id, report_month,
            source, external_sale_id, sync_log_id,
            source_activation_date, source_report_month, raw_payload,
            validation_status, validation_notes,
            company_earnings, vendor_commission, portability_bonus,
            created_at, updated_at
          )
          VALUES (
            $1, $2::date,
            $3, $4, $5,
            $6::date, $7::date, $8::jsonb,
            $9, $10,
            $11, $12, $13,
            NOW(), NOW()
          )
          ON CONFLICT (subscriber_id, report_month)
          DO UPDATE SET
            source = EXCLUDED.source,
            external_sale_id = COALESCE(EXCLUDED.external_sale_id, subscriber_reports.external_sale_id),
            sync_log_id = COALESCE(EXCLUDED.sync_log_id, subscriber_reports.sync_log_id),
            source_activation_date = COALESCE(EXCLUDED.source_activation_date, subscriber_reports.source_activation_date),
            source_report_month = COALESCE(EXCLUDED.source_report_month, subscriber_reports.source_report_month),
            raw_payload = COALESCE(EXCLUDED.raw_payload, subscriber_reports.raw_payload),
            -- Tanda C: transiciÃ³n automÃ¡tica del workflow needs_review.
            -- Nueva sync vÃ¡lida â†’ confirmed siempre.
            -- Si fila ya estaba confirmed â†’ mantener confirmed (no degradar).
            -- Si fila estaba resolved_pending_sync y nueva sigue invÃ¡lida â†’ volver a needs_review.
            validation_status = CASE
              WHEN EXCLUDED.validation_status = 'confirmed' THEN 'confirmed'
              WHEN subscriber_reports.validation_status = 'confirmed' THEN 'confirmed'
              WHEN subscriber_reports.validation_status = 'resolved_pending_sync'
                   AND EXCLUDED.validation_status = 'needs_review' THEN 'needs_review'
              ELSE COALESCE(subscriber_reports.validation_status, EXCLUDED.validation_status)
            END,
            retry_count = CASE
              WHEN subscriber_reports.validation_status = 'resolved_pending_sync'
                   AND EXCLUDED.validation_status = 'needs_review'
              THEN COALESCE(subscriber_reports.retry_count, 0) + 1
              ELSE COALESCE(subscriber_reports.retry_count, 0)
            END,
            last_review_attempt_at = CASE
              WHEN subscriber_reports.validation_status = 'resolved_pending_sync'
              THEN NOW()
              ELSE subscriber_reports.last_review_attempt_at
            END,
            validation_notes = COALESCE(EXCLUDED.validation_notes, subscriber_reports.validation_notes),
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
        `, [
          subscriberId,
          monthVal,
          reportSource,
          String(v.ventaid),
          syncLogId,
          sourceActivationDate,
          monthVal,
          rawPayload,
          validationStatus,
          validationNotes,
          comEmpresa,
          effectiveVendorCommission,
          portabilityBonus
        ]);

        // Alertar si se actualizÃ³ algÃºn valor existente desde Tango.
        if (reportSource === 'tango_v2_autocreate') {
          await crmPool.query(
            `UPDATE tango_commission_pending_sales
                SET status = 'linked',
                    linked_client_id = $2,
                    linked_ban_id = $3,
                    linked_subscriber_id = $4,
                    updated_at = NOW()
              WHERE ventaid = $1
                AND status = 'needs_review'`,
            [Number(v.ventaid), clientId, banRecord.id, subscriberId]
          );
        }

        if (prevCompany !== null && comEmpresa > 0 && Math.abs(prevCompany - comEmpresa) > 0.001) {
          alert('info', banNum, `Ganancia empresa actualizada desde Tango: ${prevCompany} â†’ ${comEmpresa} (ventaid ${v.ventaid})`);
          stats.reports_company_updated = (stats.reports_company_updated || 0) + 1;
        }
        if (prevVendor !== null && effectiveVendorCommission > 0 && Math.abs(prevVendor - effectiveVendorCommission) > 0.001) {
          alert('info', banNum, `ComisiÃ³n vendedor actualizada desde Tango: ${prevVendor} â†’ ${effectiveVendorCommission} (ventaid ${v.ventaid})`);
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

    // Regla oficial: Tango API V2 manda. En el rango procesado, cualquier
    // reporte Tango que no exista en API V2 sobra y se elimina del informe.
    if (allowCleanup && apiV2.salesById.size > 0) {
      const apiVentaIds = [...apiV2.salesById.keys()].map(String);
      const obsoleteReports = await crmPool.query(`
        DELETE FROM subscriber_reports sr
        WHERE COALESCE(sr.source, 'tango') = 'tango'
          AND sr.source_activation_date >= $1::date
          AND sr.source_activation_date < ($2::date + INTERVAL '1 day')
          AND COALESCE(sr.external_sale_id, sr.tango_ventaid::text, '') <> ''
          AND NOT (COALESCE(sr.external_sale_id, sr.tango_ventaid::text) = ANY($3::text[]))
        RETURNING sr.subscriber_id, sr.external_sale_id
      `, [syncRange.from, syncRange.to, apiVentaIds]);

      if (obsoleteReports.rows.length > 0) {
        stats.tango_api_v2_obsolete_reports_deleted = obsoleteReports.rows.length;
        const obsoleteSubscriberIds = [...new Set(obsoleteReports.rows.map((row) => row.subscriber_id).filter(Boolean))];
        const obsoleteSaleIds = obsoleteReports.rows.map((row) => row.external_sale_id).filter(Boolean).join(', ');
        alert('warn', '', `API V2 manda: reportes fuera de Tango eliminados (${obsoleteSaleIds})`);

        if (obsoleteSubscriberIds.length > 0) {
          const obsoleteSubscribers = await crmPool.query(`
            DELETE FROM subscribers s
            WHERE s.id = ANY($1::uuid[])
              AND s.tango_ventaid IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM subscriber_reports sr
                WHERE sr.subscriber_id = s.id
              )
            RETURNING s.id, s.tango_ventaid, s.phone
          `, [obsoleteSubscriberIds]);
          stats.tango_api_v2_obsolete_subscribers_deleted = obsoleteSubscribers.rows.length;
        }
      }
    }

    // â”€â”€ 4b. Cleanup duplicates from legacy sync (same BAN+phone, keep canonical tango_ventaid row) â”€â”€
    // Solo se ejecuta si allowCleanup=true (resync_range con flag, o full sync).
    // En sync incremental se omite para evitar merges destructivos silenciosos.
    if (!allowCleanup) {
      console.log('[SYNC] Cleanup destructivo OMITIDO (modo=' + mode + ', allowCleanup=false)');
    } else try {
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
              source,
              external_sale_id,
              sync_log_id,
              source_activation_date,
              source_report_month,
              raw_payload,
              validation_status,
              validation_notes,
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
              sr.source,
              sr.external_sale_id,
              sr.sync_log_id,
              sr.source_activation_date,
              sr.source_report_month,
              sr.raw_payload,
              sr.validation_status,
              sr.validation_notes,
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
              source = COALESCE(subscriber_reports.source, EXCLUDED.source),
              external_sale_id = COALESCE(subscriber_reports.external_sale_id, EXCLUDED.external_sale_id),
              sync_log_id = COALESCE(subscriber_reports.sync_log_id, EXCLUDED.sync_log_id),
              source_activation_date = COALESCE(subscriber_reports.source_activation_date, EXCLUDED.source_activation_date),
              source_report_month = COALESCE(subscriber_reports.source_report_month, EXCLUDED.source_report_month),
              raw_payload = COALESCE(subscriber_reports.raw_payload, EXCLUDED.raw_payload),
              validation_status = CASE
                WHEN EXCLUDED.validation_status = 'confirmed' THEN 'confirmed'
                ELSE COALESCE(subscriber_reports.validation_status, EXCLUDED.validation_status)
              END,
              validation_notes = COALESCE(subscriber_reports.validation_notes, EXCLUDED.validation_notes),
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

      // 4c. Cleanup legacy placeholder subscribers if real Tango line exists.
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
      alert('error', '', `Cleanup duplicados fallÃ³: ${mergeErr.message}`);
      console.error('[SYNC] Error limpiando duplicados legacy:', mergeErr);
    }

    // â”€â”€ 6. Summary â”€â”€
    const pendingSalesStats = await upsertTangoCommissionPendingSales(externalSales, apiV2);
    stats.pending_sales_attempted = pendingSalesStats.attempted;
    stats.pending_sales_upserted = pendingSalesStats.upserted;
    stats.pending_sales_skipped = pendingSalesStats.skipped;

    console.log(`[SYNC] Completado:`, JSON.stringify(stats));

    const externalMotivos = externalSales.reduce((acc, e) => {
      acc[e.motivo] = (acc[e.motivo] || 0) + 1;
      return acc;
    }, {});

    const summaryDetails = {
      alerts,
      external_sales_count: externalSales.length,
      rejected_rows: rejectedRows,
      external_motivos: externalMotivos,
      finished_at: new Date().toISOString(),
      mode,
      range_from: syncRange?.from || null,
      range_to: syncRange?.to || null,
      reason: reason || null,
    };
    const durationMs = Date.now() - startedAtMs;
    const structuredStats = {
      ...stats,
      ...summaryDetails,
      // MÃ©tricas estructuradas que el panel admin lee
      rows_new: stats.reports_upserted,    // upserted = new + updated; pg planner no diferencia trivialmente
      rows_updated: 0,
      rows_ignored: (rejectedRows?.length || 0) + (externalSales?.length || 0),
      errors_count: stats.errors,
    };

    try {
      await closeSyncLog({
        id: syncLogId,
        status: 'finished',
        stats: structuredStats,
        warnings,
        durationMs,
      });
    } catch (closeErr) {
      console.warn('[SYNC] No se pudo cerrar sync_log estructurado:', closeErr.message);
    }
    if (lockHeld) {
      await releaseSyncLock({ success: true }).catch(err =>
        console.warn('[SYNC] No se pudo liberar lock:', err.message));
    }

    res.json({
      success: true,
      mode,
      range: syncRange,
      warnings,
      duration_ms: durationMs,
      stats,
      alerts,
      rejected_rows: rejectedRows,
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
    const durationMs = Date.now() - startedAtMs;
    try {
      await closeSyncLog({
        id: syncLogId,
        status: 'failed',
        stats: { ...stats, error: error.message, rows_ignored: (rejectedRows?.length || 0), errors_count: (stats.errors || 0) + 1 },
        warnings,
        durationMs,
      });
    } catch (_) {}
    if (lockHeld) {
      await releaseSyncLock({ success: false }).catch(() => {});
    }
    res.status(500).json({ success: false, error: 'Error en sync Tangoâ†’CRM', details: error.message, stats, alerts, warnings });
  }
}

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

