import { getClient, query } from '../database/db.js';
import { businessDaysRemaining } from '../utils/businessDays.js';

const SOV2_PRODUCTS = [
  { product_key: 'fijo_ren', label: 'Fijo Ren', type: 'money' },
  { product_key: 'fijo_new', label: 'Fijo New', type: 'money' },
  { product_key: 'movil_ren', label: 'Movil Ren', type: 'quantity' },
  { product_key: 'movil_new', label: 'Movil New', type: 'quantity' },
  { product_key: 'claro_tv', label: 'Claro TV', type: 'quantity' },
  { product_key: 'cloud', label: 'Cloud', type: 'quantity' },
  { product_key: 'mpls', label: 'MPLS', type: 'money' },
];

const PRODUCT_KEYS = new Set(SOV2_PRODUCTS.map((product) => product.product_key));
const MONEY_KEYS = new Set(SOV2_PRODUCTS.filter((product) => product.type === 'money').map((product) => product.product_key));
const QUANTITY_KEYS = new Set(SOV2_PRODUCTS.filter((product) => product.type === 'quantity').map((product) => product.product_key));

const normalizeRole = (value) => String(value || '').trim().toLowerCase();
const cleanText = (value) => String(value || '').trim();
const isUuidLike = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const PRODUCT_TEMPLATE_STEP_ID_PREFIX = 'product-template:';

function resolveMetricPeriod(req) {
  const today = new Date();
  const rawMonth = cleanText(req.query.month);
  const rawYear = Number(req.query.year);
  const rawMonthNumber = Number(req.query.month_number || req.query.period_month);

  if (/^\d{4}-\d{2}$/.test(rawMonth)) {
    const [year, month] = rawMonth.split('-').map(Number);
    return { year, month };
  }

  if (Number.isInteger(rawYear) && Number.isInteger(rawMonthNumber) && rawMonthNumber >= 1 && rawMonthNumber <= 12) {
    return { year: rawYear, month: rawMonthNumber };
  }

  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

function inferMonthlyValueFromPlan(plan) {
  const matches = String(plan || '').match(/\b\d{1,4}\.\d{2}\b/g);
  if (!matches?.length) return 0;
  return Number(matches[matches.length - 1]) || 0;
}

function normalizeProductKey(...values) {
  const source = values
    .map((value) => String(value || '').toLowerCase())
    .filter(Boolean)
    .join(' ');

  if (source.includes('mpls')) return 'mpls';
  if (source.includes('cloud')) return 'cloud';
  if (source.includes('claro') && source.includes('tv')) return 'claro_tv';
  if (source.includes('movil') || source.includes('móvil') || source.includes('mobile')) {
    if (source.includes('ren')) return 'movil_ren';
    if (source.includes('new') || source.includes('nueva') || source.includes('nuevo')) return 'movil_new';
  }
  if (source.includes('fijo') || source.includes('fixed')) {
    if (source.includes('ren')) return 'fijo_ren';
    if (source.includes('new') || source.includes('nueva') || source.includes('nuevo')) return 'fijo_new';
  }

  return null;
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeSubscriberProductKey(row) {
  const source = normalizeSearchText([
    row.line_kind,
    row.account_type,
    row.plan,
  ].join(' '));
  const saleType = normalizeSearchText(row.line_type);

  let family = null;
  if (source.includes('mpls')) family = 'mpls';
  else if (source.includes('cloud')) family = 'cloud';
  else if (source.includes('claro') && source.includes('tv')) family = 'claro_tv';
  else if (source.includes('fijo') || /\b(a8|720|volt)/.test(source)) family = 'fijo';
  else if (source.includes('movil') || source.includes('mobile') || source.includes('pymes') || source.includes('convergente')) family = 'movil';

  if (family === 'mpls' || family === 'cloud' || family === 'claro_tv') return family;
  if (family === 'fijo') return saleType.includes('ren') ? 'fijo_ren' : 'fijo_new';
  if (family === 'movil') return saleType.includes('ren') ? 'movil_ren' : 'movil_new';
  return null;
}

export function applySubscriberSummariesWithoutDuplicatingSavedValues(opportunity, productSummaries = new Map()) {
  const hasSavedQuantity = [...QUANTITY_KEYS].some((key) => Number(opportunity.products[key]?.quantity_value || 0) > 0);
  const hasSavedMoney = [...MONEY_KEYS].some((key) => Number(opportunity.products[key]?.money_value || 0) > 0);

  for (const [key, summary] of productSummaries.entries()) {
    const [opportunityId, productKey] = key.split(':');
    if (String(opportunity.id) !== opportunityId || !PRODUCT_KEYS.has(productKey)) continue;

    const product = opportunity.products[productKey];
    const savedQuantity = Number(product.quantity_value || 0);
    const savedMoney = Number(product.money_value || 0);
    const summaryQuantity = Number(summary.quantity_value || 0);
    const summaryMoney = round2(summary.money_value);

    if (QUANTITY_KEYS.has(productKey) && (hasSavedQuantity || savedQuantity > 0)) continue;
    if (MONEY_KEYS.has(productKey) && savedMoney > 0 && summaryMoney > savedMoney && savedMoney <= summaryQuantity) {
      product.money_value = summaryMoney;
      product.ban_count = summary.banIds?.size || 0;
      product.subscriber_count = summary.subscriberIds?.size || 0;
      continue;
    }
    if (MONEY_KEYS.has(productKey) && (hasSavedMoney || savedMoney > 0)) continue;

    product.quantity_value = summaryQuantity;
    if (MONEY_KEYS.has(productKey)) product.money_value = summaryMoney;
    product.ban_count = summary.banIds?.size || 0;
    product.subscriber_count = summary.subscriberIds?.size || 0;
  }
}

function cleanProductTemplateKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function templateMatchesProduct(productKey, templateKey, templateName) {
  const key = cleanProductTemplateKey(templateKey || templateName);
  const name = cleanProductTemplateKey(templateName);
  const candidates = new Set([key, name].filter(Boolean));
  const aliases = {
    fijo_ren: ['fijo_ren', 'fijo_renovacion', 'fixed_ren', 'fixed_renovacion'],
    fijo_new: ['fijo_new', 'fijo_nuevo', 'fixed_new', 'new_fijo', 'new'],
    movil_ren: ['movil_ren', 'movil_renovacion', 'mobile_ren', 'mobile_renovacion'],
    movil_new: ['movil_new', 'movil_nuevo', 'movil_nueva', 'mobile_new', 'new_movil', 'new'],
    claro_tv: ['claro_tv', 'clarotv', 'tv'],
    cloud: ['cloud'],
    mpls: ['mpls'],
  };

  return (aliases[productKey] || [productKey]).some((alias) => candidates.has(alias));
}

function normalizeProductTemplateSteps(value) {
  const parsed = typeof value === 'string' ? (() => {
    try { return JSON.parse(value); } catch { return []; }
  })() : value;

  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const label = cleanText(entry);
        return label ? { id: `step-${index + 1}`, label } : null;
      }
      const label = cleanText(entry?.label || entry?.name || entry?.title);
      if (!label) return null;
      return {
        id: cleanText(entry?.id) || `step-${index + 1}`,
        label,
        is_active: entry?.is_active !== false,
      };
    })
    .filter(Boolean);
}

function encodeProductTemplateStepId(templateId, stepId) {
  return `${PRODUCT_TEMPLATE_STEP_ID_PREFIX}${templateId}:${encodeURIComponent(stepId)}`;
}

function decodeProductTemplateStepId(value) {
  const text = cleanText(value);
  if (!text.startsWith(PRODUCT_TEMPLATE_STEP_ID_PREFIX)) return null;
  const payload = text.slice(PRODUCT_TEMPLATE_STEP_ID_PREFIX.length);
  const separator = payload.indexOf(':');
  if (separator < 1) return null;
  return {
    templateId: Number(payload.slice(0, separator)),
    stepId: decodeURIComponent(payload.slice(separator + 1)),
  };
}

function normalizeProductKeyFromGoal(row) {
  const explicit = normalizeProductKey(row.product_key, row.product_type, row.sale_type, row.product_name, row.description);
  if (explicit) return explicit;

  const productType = String(row.product_type || '').trim().toUpperCase();
  const saleType = String(row.sale_type || '').trim().toUpperCase();
  if (productType === 'FIJO') return saleType === 'REN' ? 'fijo_ren' : 'fijo_new';
  if (productType === 'MOVIL') return saleType === 'REN' ? 'movil_ren' : 'movil_new';
  if (productType === 'CLARO_TV') return 'claro_tv';
  if (productType === 'CLOUD') return 'cloud';
  if (productType === 'MPLS') return 'mpls';

  return null;
}

function emptyProduct(product) {
  return {
    product_key: product.product_key,
    label: product.label,
    type: product.type,
    line_id: null,
    product_id: null,
    category_id: null,
    money_value: 0,
    quantity_value: 0,
    current_step: null,
    steps: [],
    notes: null,
    updated_at: null,
  };
}

function productKeyParts(productKey) {
  const parts = {
    fijo_ren: { product_type: 'fijo', sale_type: 'ren' },
    fijo_new: { product_type: 'fijo', sale_type: 'new' },
    movil_ren: { product_type: 'movil', sale_type: 'ren' },
    movil_new: { product_type: 'movil', sale_type: 'new' },
    claro_tv: { product_type: 'claro_tv', sale_type: 'new' },
    cloud: { product_type: 'cloud', sale_type: 'new' },
    mpls: { product_type: 'mpls', sale_type: 'new' },
  };
  return parts[productKey] || { product_type: productKey, sale_type: 'new' };
}

async function fetchActiveProductTemplateSteps(productKey) {
  const rows = await query(
    `SELECT id, product_key, product_name, steps
       FROM crm_product_task_templates
      WHERE is_active = TRUE
      ORDER BY LOWER(product_name) ASC`,
    []
  );

  return rows
    .filter((row) => templateMatchesProduct(productKey, row.product_key, row.product_name))
    .flatMap((row) => normalizeProductTemplateSteps(row.steps).map((step, index) => ({
      template_id: row.id,
      step_order: index + 1,
      name: step.label,
      description: null,
      is_active: step.is_active !== false,
    })))
    .filter((step) => step.is_active !== false);
}

async function ensureOpportunityNotesTable() {
  const tableRows = await query(`SELECT to_regclass('public.opportunity_notes') AS table_name`);
  if (tableRows[0]?.table_name) return;

  await query(`
    CREATE TABLE IF NOT EXISTS opportunity_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      opportunity_id UUID NOT NULL REFERENCES sales_opportunities(id) ON DELETE CASCADE,
      product_key TEXT NULL,
      step_id UUID NULL REFERENCES opportunity_steps(id) ON DELETE SET NULL,
      step_name TEXT NULL,
      note TEXT NOT NULL,
      created_by_user_id UUID NULL REFERENCES users_auth(id) ON DELETE SET NULL,
      created_by_username TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT opportunity_notes_product_key_chk CHECK (
        product_key IS NULL
        OR product_key IN ('fijo_ren', 'fijo_new', 'movil_ren', 'movil_new', 'claro_tv', 'cloud', 'mpls')
      )
    )`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_opportunity_notes_opportunity_created
       ON opportunity_notes(opportunity_id, created_at DESC)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_opportunity_notes_product_created
       ON opportunity_notes(opportunity_id, product_key, created_at DESC)`
  );
}

function parseBooleanFilter(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'si', 'sí', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return null;
}

function numericOrNull(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function buildOpportunityWhere(req) {
  const params = [];
  const conditions = [
    'so.archived_at IS NULL',
    "COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c.business_name), '')) IS NOT NULL",
    `(so.source = 'opportunity_manual' OR c.source = 'opportunity_manual' OR EXISTS (
      SELECT 1
        FROM follow_up_prospects f
       WHERE f.client_id = c.id
         AND f.completed_date IS NULL
         AND COALESCE(f.is_active::text, 'true') IN ('true', '1', 't')
    ))`,
    `(so.source = 'opportunity_manual' OR c.source = 'opportunity_manual' OR EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id))`,
  ];

  const role = normalizeRole(req.user?.role);
  const authSalespersonId = cleanText(req.user?.salespersonId);
  if (role === 'vendedor') {
    if (!authSalespersonId) {
      conditions.push('FALSE');
    } else {
      params.push(authSalespersonId);
      conditions.push(`COALESCE(so.salesperson_id, c.salesperson_id)::text = $${params.length}`);
    }
  }

  const vendedorId = cleanText(req.query.vendedor_id);
  if (vendedorId) {
    params.push(vendedorId);
    conditions.push(`COALESCE(so.salesperson_id, c.salesperson_id)::text = $${params.length}`);
  }

  const productKey = cleanText(req.query.product_key);
  if (productKey) {
    if (!PRODUCT_KEYS.has(productKey)) {
      return { error: 'product_key invalido' };
    }
    params.push(productKey);
    conditions.push(`EXISTS (
      SELECT 1
        FROM opportunity_lines ol_filter
       WHERE ol_filter.opportunity_id = so.id
         AND COALESCE(ol_filter.product_key, '') = $${params.length}
    )`);
  }

  const stepId = cleanText(req.query.step_id);
  if (stepId) {
    params.push(stepId);
    conditions.push(`EXISTS (
      SELECT 1
        FROM opportunity_steps os_filter
       WHERE os_filter.opportunity_id = so.id
         AND os_filter.id::text = $${params.length}
    )`);
  }

  const blocked = parseBooleanFilter(req.query.blocked);
  if (blocked !== null) {
    params.push(blocked);
    conditions.push(`COALESCE(so.blocked, FALSE) = $${params.length}`);
  }

  const search = cleanText(req.query.search);
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(
      COALESCE(c.name, '') ILIKE $${params.length}
      OR COALESCE(c.business_name, '') ILIKE $${params.length}
      OR COALESCE(sp.name, '') ILIKE $${params.length}
      OR COALESCE(so.title, '') ILIKE $${params.length}
      OR EXISTS (
        SELECT 1
          FROM opportunity_lines ol_search
         WHERE ol_search.opportunity_id = so.id
           AND COALESCE(ol_search.notes, '') ILIKE $${params.length}
      )
    )`);
  }

  return { whereClause: conditions.join(' AND '), params };
}

async function fetchOpportunityRows(req, onlyId = null) {
  const built = buildOpportunityWhere(req);
  if (built.error) {
    const error = new Error(built.error);
    error.statusCode = 400;
    throw error;
  }

  const params = [...built.params];
  const conditions = [built.whereClause];
  if (onlyId) {
    params.push(String(onlyId));
    conditions.push(`so.id::text = $${params.length}`);
  }

  const baseSelect = `SELECT
       so.id,
       so.client_id,
       so.salesperson_id AS opportunity_salesperson_id,
       so.title,
       so.description,
       so.opportunity_type,
       so.status,
       so.priority,
       COALESCE(so.blocked, FALSE) AS blocked,
       so.expected_monthly_value,
       so.expected_close_date,
       so.next_action_at,
       so.last_activity_at,
       so.created_at,
       so.updated_at,
       c.name AS client_name,
       c.business_name AS client_business_name,
       COALESCE(NULLIF(c.phone, ''), NULLIF(c.additional_phone, ''), NULLIF(c.cellular, ''), primary_subscriber.phone) AS client_phone,
       c.source AS client_source,
       COALESCE(c.pendiente_validacion, FALSE) AS client_pending_validation,
       c.salesperson_id AS client_salesperson_id,
       sp.id AS vendor_id,
       COALESCE(sp.name, 'Sin asignar') AS vendor_name
     FROM sales_opportunities so
     JOIN clients c ON c.id = so.client_id
     LEFT JOIN salespeople sp ON sp.id = COALESCE(so.salesperson_id, c.salesperson_id)
     LEFT JOIN LATERAL (
       SELECT NULLIF(s.phone, '') AS phone
         FROM bans b_phone
         JOIN subscribers s ON s.ban_id = b_phone.id
        WHERE b_phone.client_id = c.id
          AND NULLIF(TRIM(s.phone), '') IS NOT NULL
          AND s.phone !~* '^(FIJO|LINEA|SIN-TEL)-'
          AND COALESCE(LOWER(s.status::text), 'activo') NOT IN (
            'cancelado', 'cancelled', 'c', 'inactivo', 'inactive', 'no_renueva_ahora'
          )
        ORDER BY s.contract_end_date ASC NULLS LAST, s.created_at ASC NULLS LAST
        LIMIT 1
     ) primary_subscriber ON TRUE
     WHERE ${conditions.join(' AND ')}`;

  if (onlyId) {
    return query(
      `${baseSelect}
       ORDER BY so.updated_at DESC NULLS LAST, so.created_at DESC NULLS LAST`,
      params
    );
  }

  return query(
    `WITH filtered AS (
       ${baseSelect}
     ),
     ranked AS (
       SELECT filtered.*,
              ROW_NUMBER() OVER (
                PARTITION BY filtered.client_id
                ORDER BY filtered.updated_at DESC NULLS LAST, filtered.created_at DESC NULLS LAST
              ) AS client_rank
         FROM filtered
     )
     SELECT *
       FROM ranked
      WHERE client_rank = 1
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST`,
    params
  );
}

async function fetchLines(opportunityIds) {
  if (opportunityIds.length === 0) return [];
  return query(
    `SELECT
       ol.id,
       ol.opportunity_id,
       ol.client_id,
       ol.product_key,
       ol.product_id,
       ol.category_id,
       ol.line_mode,
       ol.product_type,
       ol.sale_type,
       ol.current_monthly_value,
       ol.target_monthly_value,
       ol.money_value,
       ol.quantity_value,
       ol.status,
       ol.notes,
       ol.updated_at,
       p.name AS product_name,
       c.name AS category_name
     FROM opportunity_lines ol
     LEFT JOIN products p ON p.id = ol.product_id
     LEFT JOIN categories c ON c.id = ol.category_id
     WHERE ol.opportunity_id = ANY($1::uuid[])
     ORDER BY ol.updated_at DESC NULLS LAST, ol.created_at DESC NULLS LAST`,
    [opportunityIds]
  );
}

async function fetchSubscriberProductSummaries(opportunityRows) {
  if (opportunityRows.length === 0) return { productSummaries: new Map(), serviceSummaries: new Map() };
  const opportunityIds = opportunityRows.map((row) => row.id);
  const rows = await query(
    `SELECT
       so.id AS opportunity_id,
       so.client_id,
       b.id AS ban_id,
       s.id AS subscriber_id,
       b.account_type,
       s.line_type,
       s.line_kind,
       s.plan,
       s.monthly_value,
       s.status
     FROM sales_opportunities so
     JOIN bans b ON b.client_id = so.client_id
     JOIN subscribers s ON s.ban_id = b.id
     WHERE so.id = ANY($1::uuid[])
       AND COALESCE(LOWER(s.status::text), 'activo') NOT IN (
         'cancelado', 'cancelled', 'c', 'inactivo', 'inactive', 'no_renueva_ahora'
       )`,
    [opportunityIds]
  );

  const productSummaries = new Map();
  const serviceSummaries = new Map();
  for (const row of rows) {
    const opportunityId = String(row.opportunity_id);
    if (!serviceSummaries.has(opportunityId)) {
      serviceSummaries.set(opportunityId, { banIds: new Set(), subscriberCount: 0 });
    }
    const service = serviceSummaries.get(opportunityId);
    if (row.ban_id) service.banIds.add(String(row.ban_id));
    if (row.subscriber_id) service.subscriberCount += 1;

    const productKey = normalizeSubscriberProductKey(row);
    if (!productKey || !PRODUCT_KEYS.has(productKey)) continue;

    const key = `${opportunityId}:${productKey}`;
    if (!productSummaries.has(key)) {
      productSummaries.set(key, {
        quantity_value: 0,
        money_value: 0,
        banIds: new Set(),
        subscriberIds: new Set(),
      });
    }
    const summary = productSummaries.get(key);
    summary.quantity_value += 1;
    const monthlyValue = Number(row.monthly_value || 0);
    summary.money_value += monthlyValue > 0 ? monthlyValue : inferMonthlyValueFromPlan(row.plan);
    if (row.ban_id) summary.banIds.add(String(row.ban_id));
    if (row.subscriber_id) summary.subscriberIds.add(String(row.subscriber_id));
  }

  return { productSummaries, serviceSummaries };
}

async function fetchSteps(opportunityIds) {
  if (opportunityIds.length === 0) return [];
  return query(
    `SELECT
       os.id,
       os.opportunity_id,
       os.line_id,
       os.product_key,
       os.product_id,
       os.category_id,
       os.step_order,
       os.name,
       os.description,
       os.status,
       os.due_at,
       os.completed_at,
       os.assigned_to,
       os.notes,
       os.updated_at
     FROM opportunity_steps os
     WHERE os.opportunity_id = ANY($1::uuid[])
     ORDER BY
       CASE WHEN os.status IN ('pendiente', 'en_progreso') THEN 0 ELSE 1 END,
       os.step_order ASC,
       os.updated_at DESC NULLS LAST`,
    [opportunityIds]
  );
}

async function fetchNoteSummaries(opportunityIds) {
  if (opportunityIds.length === 0) return new Map();
  await ensureOpportunityNotesTable();
  const rows = await query(
    `WITH ranked AS (
       SELECT
         opportunity_id,
         note,
         created_at,
         COUNT(*) OVER (PARTITION BY opportunity_id) AS note_count,
         ROW_NUMBER() OVER (PARTITION BY opportunity_id ORDER BY created_at DESC, id DESC) AS note_rank
       FROM opportunity_notes
       WHERE opportunity_id = ANY($1::uuid[])
     )
     SELECT opportunity_id, note AS last_note, note_count
       FROM ranked
      WHERE note_rank = 1`,
    [opportunityIds]
  );

  return new Map(rows.map((row) => [
    String(row.opportunity_id),
    {
      count: Number(row.note_count || 0),
      last_note: row.last_note || null,
    },
  ]));
}

async function fetchSov2GoalMetrics(req) {
  const today = new Date();
  const { year, month } = resolveMetricPeriod(req);
  const role = normalizeRole(req.user?.role);
  const requestedSalespersonId = cleanText(req.query.vendedor_id || req.query.salesperson_id);
  const authSalespersonId = cleanText(req.user?.salespersonId);
  const scopedSalespersonId = role === 'vendedor' ? authSalespersonId : requestedSalespersonId;
  const remainingBusinessDays = Math.max(1, businessDaysRemaining(today, year, month));

  const params = [year, month];
  const conditions = [
    'pg.period_year = $1',
    'pg.period_month = $2',
    'COALESCE(pg.is_active, 1) = 1',
  ];

  if (scopedSalespersonId) {
    params.push(scopedSalespersonId);
    conditions.push(`(
      vsm.salesperson_id::text = $${params.length}
      OR sp.id::text = $${params.length}
    )`);
  } else if (role === 'vendedor') {
    conditions.push('FALSE');
  }

  const rows = await query(
    `SELECT
       pg.product_type,
       pg.sale_type,
       pg.description,
       COALESCE(pg.target_revenue, 0)::numeric AS target_revenue,
       COALESCE(pg.target_units, 0)::numeric AS target_units,
       p.name AS product_name,
       v.id AS vendor_id,
       vsm.salesperson_id AS mapped_salesperson_id,
       sp.id AS name_salesperson_id
     FROM product_goals pg
     LEFT JOIN vendors v ON v.id = pg.vendor_id
     LEFT JOIN vendor_salesperson_mapping vsm ON vsm.vendor_id = v.id
     LEFT JOIN salespeople sp ON UPPER(TRIM(sp.name)) = UPPER(TRIM(v.name))
     LEFT JOIN products p ON p.id::text = COALESCE(pg.product_id::text, pg.description)
     WHERE ${conditions.join(' AND ')}`,
    params
  );

  let metaMoney = 0;
  let metaQuantity = 0;
  for (const row of rows) {
    const productKey = normalizeProductKeyFromGoal(row);
    if (!productKey) continue;

    const targetRevenue = Number(row.target_revenue || 0);
    const targetUnits = Number(row.target_units || 0);
    const fallbackAmount = targetRevenue || targetUnits;
    if (MONEY_KEYS.has(productKey)) {
      metaMoney += targetRevenue || fallbackAmount;
    } else if (QUANTITY_KEYS.has(productKey)) {
      metaQuantity += targetUnits || fallbackAmount;
    }
  }

  const metricScopeParams = [year, month];
  const metricScopeConditions = [
    'sr.report_month >= make_date($1::int, $2::int, 1)',
    "sr.report_month < (make_date($1::int, $2::int, 1) + INTERVAL '1 month')",
    "COALESCE(sr.validation_status, '') = 'confirmed'",
  ];
  if (scopedSalespersonId) {
    metricScopeParams.push(scopedSalespersonId);
    metricScopeConditions.push(`c.salesperson_id::text = $${metricScopeParams.length}`);
  } else if (role === 'vendedor') {
    metricScopeConditions.push('FALSE');
  }

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
         COALESCE(sr.company_earnings, 0)::numeric AS earnings
       FROM subscriber_reports sr
       JOIN subscribers s ON s.id = sr.subscriber_id
       JOIN bans b ON b.id = s.ban_id
       JOIN clients c ON c.id = b.client_id
       WHERE ${metricScopeConditions.join(' AND ')}
     )
     SELECT
       COALESCE(SUM(CASE
         WHEN haystack LIKE '%MPLS%' THEN earnings
         WHEN haystack LIKE '%FIJO%' OR haystack LIKE '%FIXED%' OR haystack LIKE '%INTERNET%' THEN earnings
         ELSE 0
       END), 0)::numeric AS real_sold_money,
       COALESCE(SUM(CASE
         WHEN haystack LIKE '%MPLS%' THEN 0
         WHEN haystack LIKE '%FIJO%' OR haystack LIKE '%FIXED%' OR haystack LIKE '%INTERNET%' THEN 0
         ELSE 1
       END), 0)::numeric AS real_sold_quantity
     FROM classified`,
    metricScopeParams
  );

  const projectionParams = [];
  const projectionConditions = [
    'so.archived_at IS NULL',
    "so.status NOT IN ('ganada', 'perdida', 'cerrada_no_trabajar')",
    "COALESCE(ol.status, 'incluida') NOT IN ('excluida', 'ganada', 'perdida', 'no_trabajar_ahora')",
  ];
  if (scopedSalespersonId) {
    projectionParams.push(scopedSalespersonId);
    projectionConditions.push(`COALESCE(so.salesperson_id, c.salesperson_id)::text = $${projectionParams.length}`);
  } else if (role === 'vendedor') {
    projectionConditions.push('FALSE');
  }

  const projectionRows = await query(
    `SELECT
       COALESCE(SUM(CASE
         WHEN ol.product_key = ANY($${projectionParams.length + 1}::text[])
           THEN COALESCE(ol.money_value, ol.target_monthly_value, ol.current_monthly_value, 0)
         ELSE 0
       END), 0)::numeric AS projection_money,
       COALESCE(SUM(CASE
         WHEN ol.product_key = ANY($${projectionParams.length + 2}::text[])
           THEN COALESCE(ol.quantity_value, 1)
         ELSE 0
       END), 0)::numeric AS projection_quantity
     FROM sales_opportunities so
     JOIN clients c ON c.id = so.client_id
     JOIN opportunity_lines ol ON ol.opportunity_id = so.id
     WHERE ${projectionConditions.join(' AND ')}`,
    [...projectionParams, [...MONEY_KEYS], [...QUANTITY_KEYS]]
  );

  const sold = soldRows[0] || {};
  const projection = projectionRows[0] || {};

  return {
    period: { year, month },
    scope: { salesperson_id: scopedSalespersonId || null },
    meta_money: round2(metaMoney),
    meta_quantity: round2(metaQuantity),
    real_sold_money: round2(sold.real_sold_money),
    real_sold_quantity: round2(sold.real_sold_quantity),
    projection_money: round2(projection.projection_money),
    projection_quantity: round2(projection.projection_quantity),
    remaining_business_days: remainingBusinessDays,
  };
}

async function fetchProductTemplateStep(productKey, stepId) {
  const decoded = decodeProductTemplateStepId(stepId);
  if (!decoded || !Number.isFinite(decoded.templateId)) return null;

  const rows = await query(
    `SELECT id, product_key, product_name, steps
       FROM crm_product_task_templates
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1`,
    [decoded.templateId]
  );
  const template = rows[0];
  if (!template || !templateMatchesProduct(productKey, template.product_key, template.product_name)) return null;

  const steps = normalizeProductTemplateSteps(template.steps);
  const stepIndex = steps.findIndex((step) => String(step.id) === String(decoded.stepId));
  if (stepIndex < 0) return null;

  return {
    id: stepId,
    template_id: template.id,
    step_order: stepIndex + 1,
    name: steps[stepIndex].label,
    description: null,
  };
}

async function fetchOpportunityProductSteps(opportunityId, productKey) {
  const rows = await query(
    `SELECT
       os.id,
       os.opportunity_id,
       os.line_id,
       os.product_key,
       os.product_id,
       os.category_id,
       os.step_order,
       os.name,
       os.description,
       os.status,
       os.due_at,
       os.completed_at,
       os.assigned_to,
       os.source,
       os.notes,
       os.created_at,
       os.updated_at,
       ol.product_key AS line_product_key,
       ol.product_type,
       ol.sale_type,
       p.name AS product_name,
       c.name AS category_name
     FROM opportunity_steps os
     LEFT JOIN opportunity_lines ol ON ol.id = os.line_id
     LEFT JOIN products p ON p.id = COALESCE(os.product_id, ol.product_id)
     LEFT JOIN categories c ON c.id = COALESCE(os.category_id, ol.category_id)
     WHERE os.opportunity_id = $1
     ORDER BY os.step_order ASC, os.created_at ASC`,
    [opportunityId]
  );

  return rows.filter((row) => normalizeProductKey(
    row.product_key,
    row.line_product_key,
    row.product_type,
    row.sale_type,
    row.product_name,
    row.category_name
  ) === productKey);
}

async function fetchCurrentProductStep(opportunityId, productKey) {
  if (!PRODUCT_KEYS.has(productKey)) return null;
  const productSteps = await fetchOpportunityProductSteps(opportunityId, productKey);
  return productSteps.find((step) => step.status === 'en_progreso')
    || productSteps.find((step) => ['pendiente', 'en_progreso'].includes(String(step.status || '')))
    || productSteps[0]
    || null;
}

async function setOpportunityProductStep(opportunityId, productKey, requestedStepId) {
  if (!PRODUCT_KEYS.has(productKey)) {
    const error = new Error('product_key invalido');
    error.statusCode = 400;
    throw error;
  }
  if (!isUuidLike(requestedStepId) && !decodeProductTemplateStepId(requestedStepId)) {
    const error = new Error('step_id invalido');
    error.statusCode = 400;
    throw error;
  }

  const opportunityRows = await query(
    `SELECT id
       FROM sales_opportunities
      WHERE id = $1
        AND archived_at IS NULL
      LIMIT 1`,
    [opportunityId]
  );
  if (opportunityRows.length === 0) {
    const error = new Error('Oportunidad no encontrada');
    error.statusCode = 404;
    throw error;
  }

  let productSteps = await fetchOpportunityProductSteps(opportunityId, productKey);
  let targetStep = productSteps.find((step) => String(step.id) === String(requestedStepId));

  if (!targetStep) {
    const templateStep = await fetchProductTemplateStep(productKey, requestedStepId);
    if (!templateStep) {
      const error = new Error('Paso no encontrado para el producto');
      error.statusCode = 404;
      throw error;
    }

    const existingByTemplate = productSteps.find((step) => (
      Number(step.step_order) === Number(templateStep.step_order)
      && cleanText(step.name).toLowerCase() === cleanText(templateStep.name).toLowerCase()
    ));

    if (existingByTemplate) {
      targetStep = existingByTemplate;
    } else {
      const orderRows = await query(
        `SELECT COALESCE(MAX(step_order), 0) + 1 AS next_order
           FROM opportunity_steps
          WHERE opportunity_id = $1`,
        [opportunityId]
      );
      const nextOrder = Number(orderRows[0]?.next_order || templateStep.step_order || 1);
      const insertedRows = await query(
        `INSERT INTO opportunity_steps (
           opportunity_id, category_id, product_id, product_key, step_order, name, description, status, source, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente', 'manual', NOW(), NOW())
         RETURNING id, opportunity_id, line_id, product_key, product_id, category_id, step_order, name, description, status,
                   due_at, completed_at, assigned_to, source, notes, created_at, updated_at`,
        [
          opportunityId,
          null,
          null,
          productKey,
          nextOrder,
          templateStep.name,
          templateStep.description || null,
        ]
      );
      targetStep = insertedRows[0];
      productSteps = await fetchOpportunityProductSteps(opportunityId, productKey);
    }
  }

  const targetOrder = Number(targetStep.step_order || 0);
  for (const step of productSteps) {
    if (String(step.id) === String(targetStep.id)) {
      await query(
        `UPDATE opportunity_steps
            SET status = 'en_progreso',
                completed_at = NULL,
                updated_at = NOW()
          WHERE id = $1`,
        [step.id]
      );
    } else if (Number(step.step_order || 0) < targetOrder) {
      await query(
        `UPDATE opportunity_steps
            SET status = 'completado',
                completed_at = COALESCE(completed_at, NOW()),
                updated_at = NOW()
          WHERE id = $1`,
        [step.id]
      );
    } else {
      await query(
        `UPDATE opportunity_steps
            SET status = 'pendiente',
                completed_at = NULL,
                updated_at = NOW()
          WHERE id = $1`,
        [step.id]
      );
    }
  }

  await query(`UPDATE sales_opportunities SET updated_at = NOW() WHERE id = $1`, [opportunityId]);
}

function mapOpportunities(opportunityRows, lineRows, stepRows, noteSummaries = new Map(), subscriberSummaries = null) {
  const byOpportunity = new Map();

  for (const row of opportunityRows) {
    const products = Object.fromEntries(SOV2_PRODUCTS.map((product) => [product.product_key, emptyProduct(product)]));
    byOpportunity.set(String(row.id), {
      id: row.id,
      client_id: row.client_id,
      client_name: row.client_name || row.client_business_name || 'Sin nombre',
      client_phone: row.client_phone || null,
      client_source: row.client_source || null,
      client_pending_validation: Boolean(row.client_pending_validation),
      ban_count: 0,
      subscriber_count: 0,
      vendor_id: row.vendor_id || null,
      vendor_name: row.vendor_name || 'Sin asignar',
      title: row.title,
      status: row.status,
      priority: row.priority,
      blocked: Boolean(row.blocked),
      products,
      total_lines: 0,
      total_money: 0,
      notes_summary: null,
      updated_at: row.updated_at,
      created_at: row.created_at,
      _noteCount: 0,
      _lastNote: null,
    });
  }

  const lineProductKey = new Map();
  for (const line of lineRows) {
    const opportunity = byOpportunity.get(String(line.opportunity_id));
    if (!opportunity) continue;

    const productKey = normalizeProductKey(line.product_key, line.product_type, line.sale_type, line.product_name, line.category_name);
    if (!productKey || !PRODUCT_KEYS.has(productKey)) continue;

    lineProductKey.set(String(line.id), productKey);

    const product = opportunity.products[productKey];
    product.line_id = line.id;
    product.product_id = line.product_id;
    product.category_id = line.category_id;
    product.money_value = Number(line.money_value ?? line.target_monthly_value ?? line.current_monthly_value ?? 0);
    product.quantity_value = Number(line.quantity_value ?? (QUANTITY_KEYS.has(productKey) ? 1 : 0));
    product.notes = line.notes || null;
    product.updated_at = line.updated_at;

    if (line.notes) {
      opportunity._noteCount += 1;
      opportunity._lastNote = line.notes;
    }
  }

  for (const step of stepRows) {
    const opportunity = byOpportunity.get(String(step.opportunity_id));
    if (!opportunity) continue;

    const productKey = normalizeProductKey(
      step.product_key,
      step.line_id ? lineProductKey.get(String(step.line_id)) : null
    );
    if (!productKey || !PRODUCT_KEYS.has(productKey)) continue;

    const product = opportunity.products[productKey];
    product.steps.push({
      id: step.id,
      name: step.name,
      status: step.status,
      due_at: step.due_at,
      completed_at: step.completed_at,
      step_order: step.step_order,
      notes: step.notes || null,
    });

    if (!product.current_step) {
      product.current_step = {
        id: step.id,
        name: step.name,
        status: step.status,
        due_at: step.due_at,
        completed_at: step.completed_at,
        step_order: step.step_order,
        notes: step.notes || null,
      };
    }

    if (step.notes) {
      opportunity._noteCount += 1;
      opportunity._lastNote = step.notes;
    }
  }

  if (subscriberSummaries?.serviceSummaries) {
    for (const [opportunityId, service] of subscriberSummaries.serviceSummaries.entries()) {
      const opportunity = byOpportunity.get(String(opportunityId));
      if (!opportunity) continue;
      opportunity.ban_count = service.banIds.size;
      opportunity.subscriber_count = service.subscriberCount;
    }
  }

  if (subscriberSummaries?.productSummaries) {
    for (const opportunity of byOpportunity.values()) {
      applySubscriberSummariesWithoutDuplicatingSavedValues(opportunity, subscriberSummaries.productSummaries);
    }
  }

  const mapped = [...byOpportunity.values()];
  for (const opportunity of mapped) {
    opportunity.total_money = Number(
      [...MONEY_KEYS].reduce((sum, key) => sum + Number(opportunity.products[key]?.money_value || 0), 0).toFixed(2)
    );
    opportunity.total_lines = SOV2_PRODUCTS.reduce(
      (sum, product) => sum + Number(opportunity.products[product.product_key]?.quantity_value || 0),
      0
    );
    const noteSummary = noteSummaries.get(String(opportunity.id));
    opportunity.notes_summary = noteSummary || (
      opportunity._noteCount > 0
        ? { count: opportunity._noteCount, last_note: opportunity._lastNote }
        : { count: 0, last_note: null }
    );
    delete opportunity._noteCount;
    delete opportunity._lastNote;
  }

  return mapped;
}

export async function getSov2Opportunities(req, res) {
  try {
    const opportunityRows = await fetchOpportunityRows(req);
    const opportunityIds = opportunityRows.map((row) => row.id);
    const [lineRows, stepRows, noteSummaries, subscriberSummaries] = await Promise.all([
      fetchLines(opportunityIds),
      fetchSteps(opportunityIds),
      fetchNoteSummaries(opportunityIds),
      fetchSubscriberProductSummaries(opportunityRows),
    ]);

    return res.json(mapOpportunities(opportunityRows, lineRows, stepRows, noteSummaries, subscriberSummaries));
  } catch (error) {
    console.error('[SOV2] get opportunities error:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Error obteniendo oportunidades SOV2' });
  }
}

export async function createSov2Opportunity(req, res) {
  const client = await getClient();
  try {
    const clientName = cleanText(req.body?.client_name || req.body?.name);
    const clientPhone = cleanText(req.body?.phone);
    const productKey = cleanText(req.body?.product_key || 'fijo_new');
    const note = cleanText(req.body?.note);
    const rawSalespersonId = cleanText(req.body?.salesperson_id);
    const role = normalizeRole(req.user?.role);
    const authSalespersonId = cleanText(req.user?.salespersonId);
    const salespersonId = role === 'vendedor' ? authSalespersonId : rawSalespersonId || authSalespersonId || null;

    if (!clientName) {
      return res.status(400).json({ error: 'Nombre del cliente requerido' });
    }
    if (!PRODUCT_KEYS.has(productKey)) {
      return res.status(400).json({ error: 'Producto invalido' });
    }
    if (salespersonId && !isUuidLike(salespersonId)) {
      return res.status(400).json({ error: 'Vendedor invalido' });
    }

    if (salespersonId) {
      const salespersonRows = await query(`SELECT id FROM salespeople WHERE id = $1 LIMIT 1`, [salespersonId]);
      if (salespersonRows.length === 0) {
        return res.status(400).json({ error: 'Vendedor no encontrado' });
      }
    }

    const parts = productKeyParts(productKey);
    const product = SOV2_PRODUCTS.find((item) => item.product_key === productKey);
    const title = cleanText(req.body?.title) || `${product?.label || productKey} - ${clientName}`;
    const opportunityType = parts.sale_type === 'ren' ? 'renovacion' : (parts.product_type === 'fijo' ? 'internet' : 'nueva_linea');
    const lineValue = numericOrNull(req.body?.value);
    const safeValue = Number.isFinite(lineValue) ? Number(lineValue) : 0;
    const lineQuantity = numericOrNull(req.body?.quantity);
    const safeQuantity = Number.isFinite(lineQuantity)
      ? Math.max(1, Math.round(Number(lineQuantity)))
      : (MONEY_KEYS.has(productKey) ? 2 : Math.max(1, Math.round(safeValue || 1)));

    await client.query('BEGIN');

    const clientRows = await client.query(
      `INSERT INTO clients (
         name, phone, salesperson_id, source, pendiente_validacion, is_active, notes, created_at, updated_at
       )
       VALUES ($1, $2, $3, 'opportunity_manual', TRUE, TRUE, $4, NOW(), NOW())
       RETURNING id`,
      [
        clientName,
        clientPhone || null,
        salespersonId || null,
        note ? `Cliente provisional creado desde oportunidad. Nota inicial: ${note}` : 'Cliente provisional creado desde oportunidad.',
      ]
    );
    const newClientId = clientRows.rows[0].id;

    const opportunityRows = await client.query(
      `INSERT INTO sales_opportunities (
         client_id, salesperson_id, title, description, opportunity_type, status, priority,
         expected_monthly_value, source, created_by, product_type, sale_type, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, 'activa', 'media', $6, 'opportunity_manual', $2, $7, $8, NOW(), NOW())
       RETURNING id`,
      [
        newClientId,
        salespersonId || null,
        title,
        note || 'Cliente nuevo pendiente de completar en CRM.',
        opportunityType,
        MONEY_KEYS.has(productKey) ? safeValue : 0,
        parts.product_type,
        parts.sale_type,
      ]
    );
    const opportunityId = opportunityRows.rows[0].id;

    const lineRows = await client.query(
      `INSERT INTO opportunity_lines (
         opportunity_id, client_id, line_mode, product_key, product_type, sale_type,
         temp_label, money_value, quantity_value, status, notes, created_at, updated_at
       )
       VALUES ($1, $2, 'nueva_sin_numero', $3, $4, $5, $6, $7, $8, 'incluida', $9, NOW(), NOW())
       RETURNING id`,
      [
        opportunityId,
        newClientId,
        productKey,
        parts.product_type,
        parts.sale_type,
        'Cliente nuevo sin BAN',
        MONEY_KEYS.has(productKey) ? safeValue : 0,
        safeQuantity,
        note || 'Linea nueva creada desde Seguimiento SOV2',
      ]
    );
    const lineId = lineRows.rows[0].id;

    const templateSteps = await fetchActiveProductTemplateSteps(productKey);
    for (const [index, step] of templateSteps.entries()) {
      await client.query(
        `INSERT INTO opportunity_steps (
           opportunity_id, line_id, product_key, step_order, name, description,
           status, assigned_to, source, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'auto', NOW(), NOW())`,
        [
          opportunityId,
          lineId,
          productKey,
          step.step_order || index + 1,
          step.name,
          step.description || null,
          index === 0 ? 'en_progreso' : 'pendiente',
          salespersonId || null,
        ]
      );
    }

    await client.query('COMMIT');

    const opportunityRowsForResponse = await fetchOpportunityRows(req, opportunityId);
    const [lineRowsForResponse, stepRowsForResponse, noteSummaries, subscriberSummaries] = await Promise.all([
      fetchLines([opportunityId]),
      fetchSteps([opportunityId]),
      fetchNoteSummaries([opportunityId]),
      fetchSubscriberProductSummaries(opportunityRowsForResponse),
    ]);

    return res.status(201).json(mapOpportunities(
      opportunityRowsForResponse,
      lineRowsForResponse,
      stepRowsForResponse,
      noteSummaries,
      subscriberSummaries
    )[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    console.error('[SOV2] create opportunity error:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Error creando oportunidad SOV2' });
  } finally {
    client.release();
  }
}

export async function getSov2Metrics(req, res) {
  try {
    const goalMetrics = await fetchSov2GoalMetrics(req);
    return res.json(goalMetrics);
  } catch (error) {
    console.error('[SOV2] get metrics error:', error);
    return res.status(500).json({ error: 'Error obteniendo metricas SOV2' });
  }
}

export async function getSov2OpportunityById(req, res) {
  try {
    if (!isUuidLike(req.params.id)) {
      return res.status(400).json({ error: 'ID de oportunidad invalido' });
    }

    const opportunityRows = await fetchOpportunityRows(req, req.params.id);
    if (opportunityRows.length === 0) {
      return res.status(404).json({ error: 'Oportunidad no encontrada' });
    }

    const opportunityIds = opportunityRows.map((row) => row.id);
    const [lineRows, stepRows, noteSummaries, subscriberSummaries] = await Promise.all([
      fetchLines(opportunityIds),
      fetchSteps(opportunityIds),
      fetchNoteSummaries(opportunityIds),
      fetchSubscriberProductSummaries(opportunityRows),
    ]);

    return res.json(mapOpportunities(opportunityRows, lineRows, stepRows, noteSummaries, subscriberSummaries)[0]);
  } catch (error) {
    console.error('[SOV2] get opportunity detail error:', error);
    return res.status(500).json({ error: 'Error obteniendo detalle SOV2' });
  }
}

export async function updateSov2Opportunity(req, res) {
  try {
    if (!isUuidLike(req.params.id)) {
      return res.status(400).json({ error: 'ID de oportunidad invalido' });
    }

    const updates = [];
    const params = [];
    const productKey = cleanText(req.body?.product_key);
    const stepId = cleanText(req.body?.step_id || req.body?.current_step_id);

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'blocked')) {
      params.push(Boolean(req.body.blocked));
      updates.push(`blocked = $${params.length}`);
    }

    if (updates.length === 0 && !(productKey && stepId)) {
      return res.status(400).json({ error: 'No hay campos permitidos para actualizar' });
    }

    if (updates.length > 0) {
      params.push(req.params.id);
      const rows = await query(
        `UPDATE sales_opportunities
            SET ${updates.join(', ')}, updated_at = NOW()
          WHERE id = $${params.length}
            AND archived_at IS NULL
          RETURNING id`,
        params
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Oportunidad no encontrada' });
      }
    }

    if (productKey && stepId) {
      await setOpportunityProductStep(req.params.id, productKey, stepId);
    }

    const opportunityRows = await fetchOpportunityRows(req, req.params.id);
    const [lineRows, stepRows, noteSummaries, subscriberSummaries] = await Promise.all([
      fetchLines([req.params.id]),
      fetchSteps([req.params.id]),
      fetchNoteSummaries([req.params.id]),
      fetchSubscriberProductSummaries(opportunityRows),
    ]);

    return res.json(mapOpportunities(opportunityRows, lineRows, stepRows, noteSummaries, subscriberSummaries)[0]);
  } catch (error) {
    console.error('[SOV2] update opportunity error:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Error actualizando oportunidad SOV2' });
  }
}

export async function updateSov2OpportunityLine(req, res) {
  try {
    if (!isUuidLike(req.params.id) || !isUuidLike(req.params.lineId)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const currentRows = await query(
      `SELECT id, opportunity_id, product_key, product_type, sale_type
         FROM opportunity_lines
        WHERE id = $1
          AND opportunity_id = $2`,
      [req.params.lineId, req.params.id]
    );
    if (currentRows.length === 0) {
      return res.status(404).json({ error: 'Linea no encontrada' });
    }

    const productKey = normalizeProductKey(currentRows[0].product_key, currentRows[0].product_type, currentRows[0].sale_type);
    const updates = [];
    const params = [];

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'money_value')) {
      if (!MONEY_KEYS.has(productKey)) {
        return res.status(400).json({ error: 'money_value solo aplica a productos de dinero' });
      }
      const value = numericOrNull(req.body.money_value);
      if (Number.isNaN(value)) return res.status(400).json({ error: 'money_value invalido' });
      params.push(value);
      updates.push(`money_value = $${params.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'quantity_value')) {
      if (!QUANTITY_KEYS.has(productKey)) {
        return res.status(400).json({ error: 'quantity_value solo aplica a productos de cantidad' });
      }
      const value = numericOrNull(req.body.quantity_value);
      if (Number.isNaN(value)) return res.status(400).json({ error: 'quantity_value invalido' });
      params.push(value);
      updates.push(`quantity_value = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos permitidos para actualizar' });
    }

    params.push(req.params.lineId, req.params.id);
    await query(
      `UPDATE opportunity_lines
          SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${params.length - 1}
          AND opportunity_id = $${params.length}`,
      params
    );

    const opportunityRows = await fetchOpportunityRows(req, req.params.id);
    const [lineRows, stepRows, noteSummaries, subscriberSummaries] = await Promise.all([
      fetchLines([req.params.id]),
      fetchSteps([req.params.id]),
      fetchNoteSummaries([req.params.id]),
      fetchSubscriberProductSummaries(opportunityRows),
    ]);

    return res.json(mapOpportunities(opportunityRows, lineRows, stepRows, noteSummaries, subscriberSummaries)[0]);
  } catch (error) {
    console.error('[SOV2] update line error:', error);
    return res.status(500).json({ error: 'Error actualizando linea SOV2' });
  }
}

export async function updateSov2OpportunityProductValue(req, res) {
  try {
    const productKey = cleanText(req.params.productKey);
    if (!isUuidLike(req.params.id) || !PRODUCT_KEYS.has(productKey)) {
      return res.status(400).json({ error: 'ID o producto invalido' });
    }

    const opportunityRows = await query(
      `SELECT id, client_id
         FROM sales_opportunities
        WHERE id = $1
          AND archived_at IS NULL
        LIMIT 1`,
      [req.params.id]
    );
    if (opportunityRows.length === 0) {
      return res.status(404).json({ error: 'Oportunidad no encontrada' });
    }

    const isMoney = MONEY_KEYS.has(productKey);
    const expectedField = isMoney ? 'money_value' : 'quantity_value';
    const rawValue = req.body?.[expectedField];
    const value = numericOrNull(rawValue);
    if (Number.isNaN(value) || value === undefined) {
      return res.status(400).json({ error: `${expectedField} invalido` });
    }

    const existingRows = await query(
      `SELECT id
         FROM opportunity_lines
        WHERE opportunity_id = $1
          AND product_key = $2
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1`,
      [req.params.id, productKey]
    );

    if (existingRows.length > 0) {
      await query(
        `UPDATE opportunity_lines
            SET ${expectedField} = $1,
                updated_at = NOW()
          WHERE id = $2
            AND opportunity_id = $3`,
        [value, existingRows[0].id, req.params.id]
      );
    } else {
      const parts = productKeyParts(productKey);
      await query(
        `INSERT INTO opportunity_lines (
           opportunity_id,
           client_id,
           line_mode,
           product_key,
           product_type,
           sale_type,
           money_value,
           quantity_value,
           status,
           notes
         )
         VALUES ($1, $2, 'otro', $3, $4, $5, $6, $7, 'incluida', 'Creado desde Seguimiento SOV2')`,
        [
          req.params.id,
          opportunityRows[0].client_id,
          productKey,
          parts.product_type,
          parts.sale_type,
          isMoney ? value : 0,
          isMoney ? 0 : value,
        ]
      );
    }

    const refreshedOpportunityRows = await fetchOpportunityRows(req, req.params.id);
    const [lineRows, stepRows, noteSummaries, subscriberSummaries] = await Promise.all([
      fetchLines([req.params.id]),
      fetchSteps([req.params.id]),
      fetchNoteSummaries([req.params.id]),
      fetchSubscriberProductSummaries(refreshedOpportunityRows),
    ]);

    return res.json(mapOpportunities(refreshedOpportunityRows, lineRows, stepRows, noteSummaries, subscriberSummaries)[0]);
  } catch (error) {
    console.error('[SOV2] update product value error:', error);
    return res.status(500).json({ error: 'Error actualizando producto SOV2' });
  }
}

export async function updateSov2OpportunityStep(req, res) {
  try {
    if (!isUuidLike(req.params.id) || !isUuidLike(req.params.stepId)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const allowedStatuses = new Set(['pendiente', 'en_progreso', 'completado', 'saltado', 'cancelado']);
    const updates = [];
    const params = [];

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'status')) {
      const status = cleanText(req.body.status);
      if (!allowedStatuses.has(status)) {
        return res.status(400).json({ error: 'status invalido' });
      }
      params.push(status);
      updates.push(`status = $${params.length}`);
      if (status === 'completado') {
        updates.push('completed_at = COALESCE(completed_at, NOW())');
      } else {
        updates.push('completed_at = NULL');
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'due_at')) {
      params.push(req.body.due_at || null);
      updates.push(`due_at = $${params.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'notes')) {
      params.push(req.body.notes || null);
      updates.push(`notes = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos permitidos para actualizar' });
    }

    params.push(req.params.stepId, req.params.id);
    const rows = await query(
      `UPDATE opportunity_steps
          SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${params.length - 1}
          AND opportunity_id = $${params.length}
        RETURNING id`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Paso no encontrado' });
    }

    const opportunityRows = await fetchOpportunityRows(req, req.params.id);
    const [lineRows, stepRows, noteSummaries] = await Promise.all([
      fetchLines([req.params.id]),
      fetchSteps([req.params.id]),
      fetchNoteSummaries([req.params.id]),
    ]);

    return res.json(mapOpportunities(opportunityRows, lineRows, stepRows, noteSummaries)[0]);
  } catch (error) {
    console.error('[SOV2] update step error:', error);
    return res.status(500).json({ error: 'Error actualizando paso SOV2' });
  }
}

export async function getSov2OpportunityNotes(req, res) {
  try {
    if (!isUuidLike(req.params.id)) {
      return res.status(400).json({ error: 'ID de oportunidad invalido' });
    }

    await ensureOpportunityNotesTable();

    const opportunityRows = await fetchOpportunityRows(req, req.params.id);
    if (opportunityRows.length === 0) {
      return res.status(404).json({ error: 'Oportunidad no encontrada' });
    }

    const rows = await query(
      `SELECT
         id,
         opportunity_id,
         product_key,
         step_id,
         step_name,
         note,
         created_by_user_id,
         COALESCE(created_by_username, 'Sistema') AS created_by_username,
         created_at
       FROM opportunity_notes
       WHERE opportunity_id = $1
       ORDER BY created_at ASC, id ASC`,
      [req.params.id]
    );

    return res.json(rows);
  } catch (error) {
    console.error('[SOV2] get notes error:', error);
    return res.status(500).json({ error: 'Error obteniendo notas SOV2' });
  }
}

export async function createSov2OpportunityNote(req, res) {
  try {
    if (!isUuidLike(req.params.id)) {
      return res.status(400).json({ error: 'ID de oportunidad invalido' });
    }

    const note = cleanText(req.body?.note);
    const productKey = cleanText(req.body?.product_key) || null;
    if (!note) {
      return res.status(400).json({ error: 'La nota es requerida' });
    }
    if (productKey && !PRODUCT_KEYS.has(productKey)) {
      return res.status(400).json({ error: 'product_key invalido' });
    }

    await ensureOpportunityNotesTable();

    const opportunityRows = await fetchOpportunityRows(req, req.params.id);
    if (opportunityRows.length === 0) {
      return res.status(404).json({ error: 'Oportunidad no encontrada' });
    }

    const currentStep = productKey ? await fetchCurrentProductStep(req.params.id, productKey) : null;
    const userId = isUuidLike(req.user?.userId) ? req.user.userId : null;
    const username = cleanText(req.user?.salespersonName) || cleanText(req.user?.username) || 'Sistema';

    const rows = await query(
      `INSERT INTO opportunity_notes (
         opportunity_id, product_key, step_id, step_name, note, created_by_user_id, created_by_username, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING
         id,
         opportunity_id,
         product_key,
         step_id,
         step_name,
         note,
         created_by_user_id,
         COALESCE(created_by_username, 'Sistema') AS created_by_username,
         created_at`,
      [
        req.params.id,
        productKey,
        currentStep?.id || null,
        currentStep?.name || null,
        note,
        userId,
        username,
      ]
    );

    await query(`UPDATE sales_opportunities SET updated_at = NOW() WHERE id = $1`, [req.params.id]);

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[SOV2] create note error:', error);
    return res.status(500).json({ error: 'Error creando nota SOV2' });
  }
}

export async function getSov2Products(_req, res) {
  return res.json(SOV2_PRODUCTS);
}

export async function getSov2ProductSteps(req, res) {
  const productKey = cleanText(req.params.productKey);
  if (!PRODUCT_KEYS.has(productKey)) {
    return res.status(400).json({ error: 'productKey invalido' });
  }

  try {
    const rows = await query(
      `SELECT id, product_key, product_name, steps
         FROM crm_product_task_templates
        WHERE is_active = TRUE
        ORDER BY LOWER(product_name) ASC`,
      []
    );

    const mapped = rows
      .filter((row) => templateMatchesProduct(productKey, row.product_key, row.product_name))
      .flatMap((row) => normalizeProductTemplateSteps(row.steps).map((step, index) => ({
        id: encodeProductTemplateStepId(row.id, step.id),
        template_id: row.id,
        product_key: productKey,
        step_order: index + 1,
        name: step.label,
        description: null,
        is_active: step.is_active !== false,
      })))
      .filter((step) => step.is_active !== false);

    return res.json(mapped);
  } catch (error) {
    console.error('[SOV2] get product steps error:', error);
    return res.status(500).json({ error: 'Error obteniendo pasos de producto SOV2' });
  }
}
