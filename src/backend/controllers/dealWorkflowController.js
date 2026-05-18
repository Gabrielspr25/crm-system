import { getClient, query } from '../database/db.js';
import { badRequest, conflict, notFound, serverError } from '../middlewares/errorHandler.js';

const PRODUCT_TYPES = new Set(['FIJO', 'MOVIL', 'CLARO_TV', 'CLOUD', 'MPLS']);
const SALE_TYPES = new Set(['NEW', 'REN']);
const DEAL_SYNC_LOG_PREFIX = '[deal-sync]';

function logDealSync(...args) {
  console.log(DEAL_SYNC_LOG_PREFIX, ...args);
}
const TASK_STATUSES = new Set(['pending', 'in_progress', 'done']);
const WORKFLOW_RULES = Object.freeze({
  FIJO: Object.freeze({ NEW: true, REN: true }),
  MOVIL: Object.freeze({ NEW: true, REN: true }),
  CLARO_TV: Object.freeze({ NEW: true, REN: true }),
  CLOUD: Object.freeze({ NEW: true, REN: true }),
  MPLS: Object.freeze({ NEW: true, REN: true })
});

let ensureDealWorkflowSchemaPromise = null;

function normalizeProductType(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (PRODUCT_TYPES.has(normalized)) return normalized;
  if (normalized.startsWith('FIJO')) return 'FIJO';
  if (normalized.startsWith('MOVIL')) return 'MOVIL';
  if (normalized === 'CLAROTV' || normalized === 'CLARO_TV') return 'CLARO_TV';
  return '';
}

function normalizeSaleType(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (SALE_TYPES.has(normalized)) return normalized;
  if (normalized.endsWith('_NEW') || normalized.endsWith('_NUEVA')) return 'NEW';
  if (normalized.endsWith('_REN') || normalized.endsWith('_RENOVACION')) return 'REN';
  return '';
}

function normalizeTaskStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'pendiente') return 'pending';
  if (normalized === 'en_proceso' || normalized === 'en proceso') return 'in_progress';
  if (normalized === 'completado' || normalized === 'completed') return 'done';
  return TASK_STATUSES.has(normalized) ? normalized : 'pending';
}

const INACTIVE_SUBSCRIBER_STATUSES = new Set(['cancelado', 'cancelled', 'inactivo', 'no_renueva_ahora']);

function isActiveSubscriberStatus(value) {
  return !INACTIVE_SUBSCRIBER_STATUSES.has(String(value || '').trim().toLowerCase());
}

function resolveSubscriberDealType(row) {
  const haystack = [
    row.ban_account_type,
    row.ban_description,
    row.product_type,
    row.product_class,
    row.service_type,
    row.plan,
    row.item_description,
    row.price_code,
    row.activity_code,
    row.line_type,
    row.sale_type,
    row.phone,
    row.phone_number,
  ].map((value) => String(value || '').trim().toUpperCase()).filter(Boolean).join(' ');

  let productType = '';
  if (haystack.includes('MPLS')) productType = 'MPLS';
  else if (haystack.includes('CLOUD')) productType = 'CLOUD';
  else if (haystack.includes('CLARO TV') || haystack.includes('CLAROTV') || (haystack.includes('CLARO') && haystack.includes('TV'))) productType = 'CLARO_TV';
  else if (haystack.includes('FIJO') || haystack.includes('FIXED') || haystack.includes('INTERNET') || String(row.phone || row.phone_number || '').toUpperCase().startsWith('FIJO-')) productType = 'FIJO';
  else productType = 'MOVIL';

  const explicitSaleType = normalizeSaleType(row.sale_type || row.line_type);
  const isRenewal = explicitSaleType === 'REN'
    || haystack.includes(' REN ')
    || haystack.includes('RENOV')
    || haystack.includes('RENEWAL');
  const saleType = productType === 'FIJO' || productType === 'MOVIL'
    ? (isRenewal ? 'REN' : 'NEW')
    : (explicitSaleType || 'NEW');

  if (!PRODUCT_TYPES.has(productType) || !SALE_TYPES.has(saleType)) return null;
  return { product_type: productType, sale_type: saleType };
}

async function loadActiveSubscribersForClient(dbQuery, clientId) {
  const rows = await dbQuery(
    `SELECT s.*,
            b.ban_number AS ban_number,
            b.account_type AS ban_account_type,
            b.account_type AS ban_description,
            b.status AS ban_status,
            b.client_id::text AS client_id
       FROM subscribers s
       JOIN bans b ON b.id = s.ban_id
      WHERE b.client_id::text = $1
      ORDER BY s.created_at DESC`,
    [clientId]
  );

  return rows
    .filter((row) => isActiveSubscriberStatus(row.status))
    .map((row) => ({ ...row, dealType: resolveSubscriberDealType(row) }))
    .filter((row) => row.dealType);
}

function normalizeStepName(value) {
  return String(value || '').trim();
}

function formatCombinationLabel(productType, saleType) {
  const saleLabel = saleType === 'REN' ? 'Renovacion' : 'Nueva';
  const productLabel = productType === 'CLARO_TV' ? 'ClaroTV' : productType;
  return `${productLabel} ${saleLabel}`;
}

function getWorkflowPolicy(productType, saleType) {
  const isEnabled = Boolean(WORKFLOW_RULES[productType]?.[saleType]);
  if (isEnabled) {
    return {
      enabled: true,
      message: null
    };
  }

  return {
    enabled: false,
    message: `La combinacion ${formatCombinationLabel(productType, saleType)} no genera workflow de tareas.`
  };
}

function normalizeSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) return [];

  return rawSteps
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const stepName = normalizeStepName(entry);
        if (!stepName) return null;
        return { step_name: stepName, step_order: index + 1 };
      }

      if (!entry || typeof entry !== 'object') return null;

      const stepName = normalizeStepName(entry.step_name || entry.label || entry.name);
      if (!stepName) return null;

      const stepOrder = Number(entry.step_order || index + 1);
      return {
        step_name: stepName,
        step_order: Number.isFinite(stepOrder) && stepOrder > 0 ? stepOrder : index + 1
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.step_order - b.step_order)
    .map((step, index) => ({
      step_name: step.step_name,
      step_order: index + 1
    }));
}

function mapTemplateRow(templateRow, steps = []) {
  return {
    id: Number(templateRow.id),
    product_type: templateRow.product_type,
    sale_type: templateRow.sale_type,
    name: templateRow.name,
    is_active: templateRow.is_active !== false,
    created_at: templateRow.created_at,
    updated_at: templateRow.updated_at,
    steps: steps.map((step) => ({
      id: Number(step.id),
      template_id: Number(step.template_id),
      step_name: step.step_name,
      step_order: Number(step.step_order)
    }))
  };
}

function buildDealMap(rows) {
  const byDealId = new Map();

  rows.forEach((row) => {
    const dealId = Number(row.deal_id);
    if (!byDealId.has(dealId)) {
      byDealId.set(dealId, {
        id: dealId,
        client_id: String(row.client_id),
        client_name: row.client_name || null,
        seller_id: row.seller_id ? String(row.seller_id) : null,
        seller_name: row.seller_name || null,
        product_type: row.product_type,
        sale_type: row.sale_type,
        source_type: row.source_type || null,
        source_ref: row.source_ref || null,
        source_label: row.source_label || null,
        subscriber_id: row.subscriber_id || null,
        ban_number: row.ban_number || null,
        phone: row.phone || null,
        is_orphan: Boolean(row.is_orphan),
        notes: row.notes || null,
        created_at: row.deal_created_at,
        updated_at: row.deal_updated_at,
        tasks: []
      });
    }

    if (row.task_id) {
      byDealId.get(dealId).tasks.push({
        id: Number(row.task_id),
        deal_id: dealId,
        step_name: row.step_name,
        step_order: Number(row.step_order),
        status: normalizeTaskStatus(row.task_status),
        assigned_to: row.assigned_to ? String(row.assigned_to) : null,
        assigned_name: row.assigned_name || null,
        due_date: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : null,
        completed_at: row.completed_at,
        created_at: row.task_created_at,
        updated_at: row.task_updated_at
      });
    }
  });

  return Array.from(byDealId.values()).map((deal) => ({
    ...deal,
    tasks: deal.tasks.sort((a, b) => a.step_order - b.step_order)
  }));
}

async function ensureDealWorkflowSchema() {
  if (ensureDealWorkflowSchemaPromise) {
    return ensureDealWorkflowSchemaPromise;
  }

  ensureDealWorkflowSchemaPromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS crm_workflow_templates (
        id BIGSERIAL PRIMARY KEY,
        product_type TEXT NOT NULL,
        sale_type TEXT NOT NULL,
        name TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT crm_workflow_templates_product_chk CHECK (product_type IN ('FIJO', 'MOVIL', 'CLARO_TV', 'CLOUD', 'MPLS')),
        CONSTRAINT crm_workflow_templates_sale_chk CHECK (sale_type IN ('NEW', 'REN')),
        CONSTRAINT crm_workflow_templates_unique UNIQUE (product_type, sale_type)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS crm_workflow_template_steps (
        id BIGSERIAL PRIMARY KEY,
        template_id BIGINT NOT NULL REFERENCES crm_workflow_templates(id) ON DELETE CASCADE,
        step_name TEXT NOT NULL,
        step_order INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT crm_workflow_template_steps_unique UNIQUE (template_id, step_order)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS crm_deals (
        id BIGSERIAL PRIMARY KEY,
        client_id TEXT NOT NULL,
        seller_id TEXT NOT NULL,
        product_type TEXT NOT NULL,
        sale_type TEXT NOT NULL,
        source_type TEXT NULL,
        source_ref TEXT NULL,
        source_label TEXT NULL,
        subscriber_id TEXT NULL,
        ban_number TEXT NULL,
        phone TEXT NULL,
        notes TEXT NULL,
        created_by TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT crm_deals_product_chk CHECK (product_type IN ('FIJO', 'MOVIL', 'CLARO_TV', 'CLOUD', 'MPLS')),
        CONSTRAINT crm_deals_sale_chk CHECK (sale_type IN ('NEW', 'REN'))
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS crm_deal_tasks (
        id BIGSERIAL PRIMARY KEY,
        deal_id BIGINT NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
        step_name TEXT NOT NULL,
        step_order INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        assigned_to TEXT NOT NULL,
        completed_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT crm_deal_tasks_status_chk CHECK (status IN ('pending', 'in_progress', 'done')),
        CONSTRAINT crm_deal_tasks_unique UNIQUE (deal_id, step_order)
      )
    `);

    await query(`CREATE INDEX IF NOT EXISTS crm_deals_client_idx ON crm_deals(client_id, created_at DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS crm_deals_seller_idx ON crm_deals(seller_id, created_at DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS crm_deal_tasks_assigned_idx ON crm_deal_tasks(assigned_to, status, created_at DESC)`);

    // Pasos por defecto para cada tipo de venta
    const DEFAULT_STEPS = {
      NEW: [
        'Contactar cliente',
        'Presentar propuesta',
        'Negociación y aprobación',
        'Firma de contrato',
        'Activación del servicio',
        'Verificación post-activación',
      ],
      REN: [
        'Contactar cliente',
        'Revisar plan actual',
        'Presentar oferta de renovación',
        'Confirmar renovación',
        'Activar renovación',
        'Verificación post-renovación',
      ],
    };

    for (const productType of PRODUCT_TYPES) {
      for (const saleType of SALE_TYPES) {
        const existingTemplate = await query(
          `SELECT id FROM crm_workflow_templates WHERE product_type = $1 AND sale_type = $2 LIMIT 1`,
          [productType, saleType]
        );

        let templateId = existingTemplate[0]?.id || null;
        if (!templateId) {
          const createdTemplate = await query(
            `INSERT INTO crm_workflow_templates (product_type, sale_type, name, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, TRUE, NOW(), NOW())
             RETURNING id`,
            [productType, saleType, `${productType} ${saleType}`]
          );
          templateId = createdTemplate[0].id;
        }

        // Agregar pasos por defecto si el template no tiene ninguno
        const existingSteps = await query(
          `SELECT id FROM crm_workflow_template_steps WHERE template_id = $1 LIMIT 1`,
          [templateId]
        );

        if (existingSteps.length === 0) {
          const defaultSteps = DEFAULT_STEPS[saleType] || DEFAULT_STEPS.NEW;
          for (let i = 0; i < defaultSteps.length; i++) {
            await query(
              `INSERT INTO crm_workflow_template_steps (template_id, step_name, step_order, created_at, updated_at)
               VALUES ($1, $2, $3, NOW(), NOW())
               ON CONFLICT (template_id, step_order) DO NOTHING`,
              [templateId, defaultSteps[i], i + 1]
            );
          }
        }

      }
    }
  })().finally(() => {
    ensureDealWorkflowSchemaPromise = null;
  });

  return ensureDealWorkflowSchemaPromise;
}

async function validateSeller(clientOrQuery, sellerId, options = {}) {
  const allowAdminSeller = options?.allowAdminSeller === true;
  const rows = await clientOrQuery(
    `SELECT id::text AS id, name, role
       FROM salespeople
      WHERE id::text = $1
      LIMIT 1`,
    [String(sellerId)]
  );

  if (rows.length === 0) {
    return { ok: false, error: 'El vendedor asignado no existe' };
  }

  const seller = rows[0];
  const sellerRole = String(seller.role || '').trim().toLowerCase();
  if (sellerRole === 'admin' && !allowAdminSeller) {
    return { ok: false, error: 'El vendedor asignado no puede tener rol admin' };
  }

  return {
    ok: true,
    seller: {
      id: String(seller.id),
      name: seller.name,
      role: sellerRole || 'vendedor'
    }
  };
}

async function resolveSellerForSync(clientOrQuery, sellerIds, options = {}) {
  const candidates = [...new Set((Array.isArray(sellerIds) ? sellerIds : [sellerIds])
    .map((value) => String(value || '').trim())
    .filter(Boolean))];

  let lastError = 'No se pudo resolver un vendedor valido para la sincronizacion';
  for (const sellerId of candidates) {
    const validation = await validateSeller(clientOrQuery, sellerId, options);
    if (validation.ok) {
      return { ok: true, seller: validation.seller, sellerId };
    }
    lastError = validation.error || lastError;
  }

  return { ok: false, error: lastError };
}

async function loadTemplateWithSteps(clientOrQuery, productType, saleType, options = {}) {
  const includeInactive = options?.includeInactive === true;
  const templateRows = await clientOrQuery(
    `SELECT *
       FROM crm_workflow_templates
      WHERE product_type = $1
        AND sale_type = $2
        ${includeInactive ? '' : 'AND is_active = TRUE'}
      LIMIT 1`,
    [productType, saleType]
  );

  if (templateRows.length === 0) return null;

  const stepRows = await clientOrQuery(
    `SELECT *
       FROM crm_workflow_template_steps
      WHERE template_id = $1
      ORDER BY step_order ASC, id ASC`,
    [templateRows[0].id]
  );

  return mapTemplateRow(templateRows[0], stepRows);
}

export const getWorkflowTemplates = async (_req, res) => {
  try {
    await ensureDealWorkflowSchema();
    const templates = await query(
      `SELECT *
         FROM crm_workflow_templates
        ORDER BY product_type ASC, sale_type ASC`
    );

    const steps = await query(
      `SELECT *
         FROM crm_workflow_template_steps
        ORDER BY template_id ASC, step_order ASC, id ASC`
    );

    const stepsByTemplateId = new Map();
    steps.forEach((step) => {
      const templateId = Number(step.template_id);
      if (!stepsByTemplateId.has(templateId)) stepsByTemplateId.set(templateId, []);
      stepsByTemplateId.get(templateId).push(step);
    });

    res.json(templates.map((template) => mapTemplateRow(template, stepsByTemplateId.get(Number(template.id)) || [])));
  } catch (error) {
    serverError(res, error, 'Error obteniendo plantillas de workflow');
  }
};

export const createWorkflowTemplate = async (req, res) => {
  const productType = normalizeProductType(req.body?.product_type);
  const saleType = normalizeSaleType(req.body?.sale_type);
  const name = String(req.body?.name || '').trim() || `${productType} ${saleType}`;
  const hasStepsUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, 'steps');
  const providedSteps = normalizeSteps(req.body?.steps);
  const steps = hasStepsUpdate ? providedSteps : [];
  const isActive = Object.prototype.hasOwnProperty.call(req.body || {}, 'is_active')
    ? Boolean(req.body.is_active)
    : true;

  if (!productType) return badRequest(res, 'product_type es requerido');
  if (!saleType) return badRequest(res, 'sale_type es requerido');
  const policy = getWorkflowPolicy(productType, saleType);
  if (!policy.enabled) return badRequest(res, policy.message);

  try {
    await ensureDealWorkflowSchema();
    const existing = await query(
      `SELECT id FROM crm_workflow_templates WHERE product_type = $1 AND sale_type = $2 LIMIT 1`,
      [productType, saleType]
    );
    if (existing.length > 0) {
      return conflict(res, 'Ya existe una plantilla para esa combinacion de producto y venta');
    }

    const dbClient = await getClient();
    try {
      await dbClient.query('BEGIN');
      const insertedTemplate = await dbClient.query(
        `INSERT INTO crm_workflow_templates (product_type, sale_type, name, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [productType, saleType, name, isActive]
      );

      const templateId = insertedTemplate.rows[0].id;
      for (const step of steps) {
        await dbClient.query(
          `INSERT INTO crm_workflow_template_steps (template_id, step_name, step_order, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [templateId, step.step_name, step.step_order]
        );
      }

      await dbClient.query('COMMIT');
      const createdTemplate = await loadTemplateWithSteps(
        (sql, params) => dbClient.query(sql, params).then((result) => result.rows),
        productType,
        saleType,
        { includeInactive: true }
      );
      res.status(201).json(createdTemplate);
    } catch (error) {
      await dbClient.query('ROLLBACK');
      throw error;
    } finally {
      dbClient.release();
    }
  } catch (error) {
    serverError(res, error, 'Error creando plantilla de workflow');
  }
};

export const updateWorkflowTemplate = async (req, res) => {
  const templateId = Number(req.params.id);
  if (Number.isNaN(templateId)) return badRequest(res, 'ID invalido');

  try {
    await ensureDealWorkflowSchema();
    const currentRows = await query(`SELECT * FROM crm_workflow_templates WHERE id = $1`, [templateId]);
    if (currentRows.length === 0) return notFound(res, 'Plantilla');

    const currentTemplate = currentRows[0];
    const productType = normalizeProductType(req.body?.product_type || currentTemplate.product_type);
    const saleType = normalizeSaleType(req.body?.sale_type || currentTemplate.sale_type);
    const name = String(req.body?.name || currentTemplate.name || '').trim() || `${productType} ${saleType}`;
    const hasStepsUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, 'steps');
    const steps = hasStepsUpdate ? normalizeSteps(req.body?.steps) : null;
    const isActive = Object.prototype.hasOwnProperty.call(req.body || {}, 'is_active')
      ? Boolean(req.body.is_active)
      : Boolean(currentTemplate.is_active);

    if (!productType) return badRequest(res, 'product_type es requerido');
    if (!saleType) return badRequest(res, 'sale_type es requerido');
    const policy = getWorkflowPolicy(productType, saleType);
    if (!policy.enabled) return badRequest(res, policy.message);

    const duplicated = await query(
      `SELECT id
         FROM crm_workflow_templates
        WHERE product_type = $1
          AND sale_type = $2
          AND id <> $3
        LIMIT 1`,
      [productType, saleType, templateId]
    );
    if (duplicated.length > 0) {
      return conflict(res, 'Ya existe otra plantilla para esa combinacion');
    }

    const dbClient = await getClient();
    try {
      await dbClient.query('BEGIN');
      await dbClient.query(
        `UPDATE crm_workflow_templates
            SET product_type = $1,
                sale_type = $2,
                name = $3,
                is_active = $4,
                updated_at = NOW()
          WHERE id = $5`,
        [productType, saleType, name, isActive, templateId]
      );

      if (hasStepsUpdate) {
        await dbClient.query(`DELETE FROM crm_workflow_template_steps WHERE template_id = $1`, [templateId]);
        for (const step of steps) {
          await dbClient.query(
            `INSERT INTO crm_workflow_template_steps (template_id, step_name, step_order, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())`,
            [templateId, step.step_name, step.step_order]
          );
        }
      }

      await dbClient.query('COMMIT');
      const updatedTemplate = await loadTemplateWithSteps(
        (sql, params) => dbClient.query(sql, params).then((result) => result.rows),
        productType,
        saleType,
        { includeInactive: true }
      );
      res.json(updatedTemplate);
    } catch (error) {
      await dbClient.query('ROLLBACK');
      throw error;
    } finally {
      dbClient.release();
    }
  } catch (error) {
    serverError(res, error, 'Error actualizando plantilla de workflow');
  }
};

export const deleteWorkflowTemplate = async (req, res) => {
  const templateId = Number(req.params.id);
  if (Number.isNaN(templateId)) return badRequest(res, 'ID invalido');

  try {
    await ensureDealWorkflowSchema();
    const rows = await query(`DELETE FROM crm_workflow_templates WHERE id = $1 RETURNING id`, [templateId]);
    if (rows.length === 0) return notFound(res, 'Plantilla');
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando plantilla de workflow');
  }
};

export const createDeal = async (req, res) => {
  const clientId = String(req.body?.client_id || '').trim();
  const sellerId = String(req.body?.seller_id || '').trim();
  const productType = normalizeProductType(req.body?.product_type);
  const saleType = normalizeSaleType(req.body?.sale_type);
  const sourceType = String(req.body?.source_type || '').trim() || null;
  const sourceRef = String(req.body?.source_ref || '').trim() || null;
  const sourceLabel = String(req.body?.source_label || '').trim() || null;
  const subscriberId = String(req.body?.subscriber_id || '').trim() || null;
  const banNumber = String(req.body?.ban_number || '').trim() || null;
  const phone = String(req.body?.phone || '').trim() || null;
  const notes = String(req.body?.notes || '').trim() || null;
  const currentUserId = String(req.user?.userId || '').trim() || null;
  const currentRole = String(req.user?.role || '').trim().toLowerCase();
  const requesterSalespersonId = String(req.user?.salespersonId || '').trim() || null;

  if (!clientId) return badRequest(res, 'client_id es requerido');
  if (!sellerId) return badRequest(res, 'seller_id es requerido');
  if (!productType) return badRequest(res, 'product_type es requerido');
  if (!saleType) return badRequest(res, 'sale_type es requerido');
  const workflowPolicy = getWorkflowPolicy(productType, saleType);
  if (!workflowPolicy.enabled) return badRequest(res, workflowPolicy.message);
  if (currentRole === 'vendedor' && requesterSalespersonId && requesterSalespersonId !== sellerId) {
    return res.status(403).json({ error: 'No puedes crear ventas para otro vendedor' });
  }

  try {
    await ensureDealWorkflowSchema();
    const sellerValidation = await validateSeller(query, sellerId, {
      allowAdminSeller: ['admin', 'supervisor'].includes(currentRole) && requesterSalespersonId === sellerId
    });
    if (!sellerValidation.ok) return badRequest(res, sellerValidation.error);

    const clientRows = await query(
      `SELECT id::text AS id, name
         FROM clients
        WHERE id::text = $1
        LIMIT 1`,
      [clientId]
    );
    if (clientRows.length === 0) return notFound(res, 'Cliente');

    const template = await loadTemplateWithSteps(query, productType, saleType);
    if (!template) return badRequest(res, 'No existe workflow configurado para esa combinacion');

    let createdDealId = null;
    const dbClient = await getClient();
    try {
      await dbClient.query('BEGIN');

      const dealResult = await dbClient.query(
        `INSERT INTO crm_deals (
           client_id, seller_id, product_type, sale_type,
           source_type, source_ref, source_label, subscriber_id, ban_number, phone, notes, created_by, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
         )
         RETURNING *`,
        [
          clientId,
          sellerId,
          productType,
          saleType,
          sourceType,
          sourceRef,
          sourceLabel,
          subscriberId,
          banNumber,
          phone,
          notes,
          currentUserId
        ]
      );

      const dealId = dealResult.rows[0].id;
      createdDealId = dealId;
      for (const step of template.steps) {
        await dbClient.query(
          `INSERT INTO crm_deal_tasks (
             deal_id, step_name, step_order, status, assigned_to, completed_at, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, NULL, NOW(), NOW())`,
          [dealId, step.step_name, step.step_order, step.step_order === 1 ? 'in_progress' : 'pending', sellerId]
        );
      }

      await dbClient.query('COMMIT');
    } catch (error) {
      await dbClient.query('ROLLBACK');
      throw error;
    } finally {
      dbClient.release();
    }

    const createdDeals = await query(
      `SELECT d.id AS deal_id,
              d.client_id,
              c.name AS client_name,
              d.seller_id,
              s.name AS seller_name,
              d.product_type,
              d.sale_type,
              d.source_type,
              d.source_ref,
              d.source_label,
              d.subscriber_id,
              d.ban_number,
              d.phone,
              d.notes,
              d.created_at AS deal_created_at,
              d.updated_at AS deal_updated_at,
              t.id AS task_id,
              t.step_name,
              t.step_order,
              t.status AS task_status,
              t.assigned_to,
              assignee.name AS assigned_name,
              t.due_date,
              t.completed_at,
              t.created_at AS task_created_at,
              t.updated_at AS task_updated_at
         FROM crm_deals d
         LEFT JOIN clients c ON c.id::text = d.client_id
         LEFT JOIN salespeople s ON s.id::text = d.seller_id
         LEFT JOIN crm_deal_tasks t ON t.deal_id = d.id
         LEFT JOIN salespeople assignee ON assignee.id::text = t.assigned_to
        WHERE d.id = $1
        ORDER BY t.step_order ASC, t.id ASC`,
      [createdDealId]
    );

    res.status(201).json(buildDealMap(createdDeals)[0]);
  } catch (error) {
    serverError(res, error, 'Error creando venta con workflow');
  }
};

export const getDeals = async (req, res) => {
  const clientId = String(req.query?.client_id || '').trim();
  const sellerIdFilter = String(req.query?.seller_id || '').trim();
  const includeOrphans = String(req.query?.include_orphans || '').trim() === '1';
  const currentRole = String(req.user?.role || '').trim().toLowerCase();
  const requesterSalespersonId = String(req.user?.salespersonId || '').trim() || null;

  try {
    await ensureDealWorkflowSchema();
    const conditions = [];
    const params = [];

    if (clientId) {
      params.push(clientId);
      conditions.push(`d.client_id = $${params.length}`);
    }

    if (sellerIdFilter) {
      params.push(sellerIdFilter);
      conditions.push(`d.seller_id = $${params.length}`);
    }

    if (currentRole === 'vendedor' && requesterSalespersonId) {
      params.push(requesterSalespersonId);
      conditions.push(`d.seller_id = $${params.length}`);
    }

    if (!includeOrphans) {
      conditions.push(`
        d.subscriber_id IS NOT NULL
        AND sub.id IS NOT NULL
        AND ban.client_id::text = d.client_id
        AND LOWER(COALESCE(sub.status, '')) NOT IN ('cancelado', 'cancelled', 'inactivo', 'no_renueva_ahora')
      `);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query(
      `SELECT d.id AS deal_id,
              d.client_id,
              c.name AS client_name,
              d.seller_id,
              s.name AS seller_name,
              d.product_type,
              d.sale_type,
              d.source_type,
              d.source_ref,
              d.source_label,
              d.subscriber_id,
              d.ban_number,
              d.phone,
              CASE
                WHEN d.subscriber_id IS NULL THEN TRUE
                WHEN sub.id IS NULL THEN TRUE
                WHEN ban.client_id::text <> d.client_id THEN TRUE
                WHEN LOWER(COALESCE(sub.status, '')) IN ('cancelado', 'cancelled', 'inactivo', 'no_renueva_ahora') THEN TRUE
                ELSE FALSE
              END AS is_orphan,
              d.notes,
              d.created_at AS deal_created_at,
              d.updated_at AS deal_updated_at,
              t.id AS task_id,
              t.step_name,
              t.step_order,
              t.status AS task_status,
              t.assigned_to,
              assignee.name AS assigned_name,
              t.due_date,
              t.completed_at,
              t.created_at AS task_created_at,
              t.updated_at AS task_updated_at
         FROM crm_deals d
         LEFT JOIN clients c ON c.id::text = d.client_id
         LEFT JOIN salespeople s ON s.id::text = d.seller_id
         LEFT JOIN subscribers sub ON sub.id::text = d.subscriber_id
         LEFT JOIN bans ban ON ban.id = sub.ban_id
         LEFT JOIN crm_deal_tasks t ON t.deal_id = d.id
         LEFT JOIN salespeople assignee ON assignee.id::text = t.assigned_to
         ${whereClause}
        ORDER BY d.created_at DESC, t.step_order ASC, t.id ASC`,
      params
    );

    res.json(buildDealMap(rows));
  } catch (error) {
    serverError(res, error, 'Error obteniendo ventas con workflow');
  }
};

/**
 * Sincronización idempotente: para cada (product_type, sale_type) detectado en
 * suscriptores activos del cliente, asegura que exista UN deal y que tenga TODOS
 * los pasos según category_steps. No duplica, no borra, no toca pasos existentes.
 * Skip silencioso si: el cliente no tiene salesperson_id, o la categoría no
 * tiene pasos configurados (caso MPLS).
 */
async function ensureCategoryDealsAndSteps(clientId) {
  if (!clientId) return;
  const cid = String(clientId).trim();
  if (!cid) return;

  const clientRows = await query(
    `SELECT id::text AS id, salesperson_id::text AS salesperson_id
       FROM clients WHERE id::text = $1 LIMIT 1`,
    [cid]
  );
  if (clientRows.length === 0) return;
  const sellerId = clientRows[0].salesperson_id;
  if (!sellerId) return;

  const subs = await loadActiveSubscribersForClient(query, cid);
  if (subs.length === 0) return;

  // Set único de categorías activas
  const categories = new Map();
  for (const sub of subs) {
    const dt = sub.dealType;
    if (!dt) continue;
    const key = `${dt.product_type}|${dt.sale_type}`;
    if (!categories.has(key)) categories.set(key, dt);
  }
  if (categories.size === 0) return;

  for (const dt of categories.values()) {
    const steps = await loadCategorySteps(
      (sql, params) => query(sql, params),
      dt.product_type,
      dt.sale_type
    );
    // Sin pasos configurados (ej. MPLS) -> skip silencioso, no crear deal vacío.
    if (!steps || steps.length === 0) continue;

    // Buscar deal existente por (client, product_type, sale_type) — uno por categoría.
    // Solo reusar deals "genéricos" (sin subscriber individual): los deals con
    // subscriber_id pertenecen a syncClientDealsFromSubscribers y no deben
    // mezclarse con el sync de categoría.
    const existing = await query(
      `SELECT id FROM crm_deals
        WHERE client_id = $1 AND product_type = $2 AND sale_type = $3
          AND (subscriber_id IS NULL OR source_type = 'category-sync')
        ORDER BY created_at ASC, id ASC LIMIT 1`,
      [cid, dt.product_type, dt.sale_type]
    );

    let dealId = existing[0]?.id;
    if (!dealId) {
      const created = await query(
        `INSERT INTO crm_deals
            (client_id, seller_id, product_type, sale_type,
             source_type, source_label, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'category-sync', $5, NOW(), NOW())
         RETURNING id`,
        [cid, sellerId, dt.product_type, dt.sale_type, `${dt.product_type} ${dt.sale_type}`]
      );
      dealId = created[0].id;
    }

    // Insertar solo los step_order faltantes; mantener intactos los existentes.
    const existingTaskRows = await query(
      `SELECT step_order FROM crm_deal_tasks WHERE deal_id = $1`,
      [dealId]
    );
    const existingOrders = new Set(existingTaskRows.map((r) => Number(r.step_order)));

    for (const step of steps) {
      const stepOrder = Number(step.step_order);
      if (existingOrders.has(stepOrder)) continue;
      await query(
        `INSERT INTO crm_deal_tasks
            (deal_id, step_name, step_order, status, assigned_to, created_at, updated_at)
         VALUES ($1, $2, $3, 'pending', $4, NOW(), NOW())`,
        [dealId, step.step_name, stepOrder, sellerId]
      );
    }
  }
}

export const getClientDeals = async (req, res) => {
  const clientId = String(req.params.id || '').trim();
  req.query.client_id = clientId;
  // Sync silencioso: idempotente, crea faltantes sin duplicar.
  if (clientId) {
    try {
      await ensureCategoryDealsAndSteps(clientId);
    } catch (e) {
      logDealSync('auto-sync:error', { clientId, error: String(e?.message || e) });
    }

    // Filtro de deals zombie: solo categorías activas según subs/BANs actuales,
    // y subscribers que sigan clasificando en la misma categoría que su deal.
    // No borra nada: solo oculta del response.
    try {
      const subs = await loadActiveSubscribersForClient(query, clientId);
      const activeCats = new Set();
      const subCatById = new Map();
      for (const s of subs) {
        if (!s.dealType) continue;
        const key = `${s.dealType.product_type}|${s.dealType.sale_type}`;
        activeCats.add(key);
        subCatById.set(String(s.id), key);
      }

      const originalJson = res.json.bind(res);
      res.json = (deals) => {
        if (!Array.isArray(deals)) return originalJson(deals);
        const skippedZombie = [];
        const skippedOrphan = [];
        const filtered = deals.filter((d) => {
          const dealCat = `${d.product_type}|${d.sale_type}`;
          if (!activeCats.has(dealCat)) {
            skippedZombie.push({
              deal_id: d.id,
              product_type: d.product_type,
              sale_type: d.sale_type,
              reason: 'category_not_active'
            });
            return false;
          }
          if (d.subscriber_id) {
            const subCat = subCatById.get(String(d.subscriber_id));
            if (!subCat) {
              skippedOrphan.push({
                deal_id: d.id,
                subscriber_id: d.subscriber_id,
                reason: 'subscriber_inactive_or_missing'
              });
              return false;
            }
            if (subCat !== dealCat) {
              skippedZombie.push({
                deal_id: d.id,
                subscriber_id: d.subscriber_id,
                from: dealCat,
                to: subCat,
                reason: 'subscriber_recategorized'
              });
              return false;
            }
          }
          return true;
        });
        if (skippedZombie.length || skippedOrphan.length) {
          logDealSync('client-deals:filtered', { clientId, skippedZombie, skippedOrphan });
        }
        return originalJson(filtered);
      };
    } catch (e) {
      logDealSync('client-deals:filter-error', { clientId, error: String(e?.message || e) });
    }
  }
  return getDeals(req, res);
};

export const getDealTasks = async (req, res) => {
  const currentRole = String(req.user?.role || '').trim().toLowerCase();
  const requesterSalespersonId = String(req.user?.salespersonId || '').trim() || null;
  const pendingOnly = String(req.query?.pending_only || '').trim() === '1';
  const sellerIdFilter = String(req.query?.seller_id || '').trim();
  const clientIdFilter = String(req.query?.client_id || '').trim();
  const includeOrphans = String(req.query?.include_orphans || '').trim() === '1';

  try {
    await ensureDealWorkflowSchema();
    const conditions = [];
    const params = [];

    if (pendingOnly) {
      conditions.push(`t.status <> 'done'`);
    }

    if (clientIdFilter) {
      params.push(clientIdFilter);
      conditions.push(`d.client_id = $${params.length}`);
    }

    if (sellerIdFilter) {
      params.push(sellerIdFilter);
      conditions.push(`t.assigned_to = $${params.length}`);
    }

    if (currentRole === 'vendedor' && requesterSalespersonId) {
      params.push(requesterSalespersonId);
      conditions.push(`t.assigned_to = $${params.length}`);
    }

    if (!includeOrphans) {
      conditions.push(`
        d.subscriber_id IS NOT NULL
        AND sub.id IS NOT NULL
        AND ban.client_id::text = d.client_id
        AND LOWER(COALESCE(sub.status, '')) NOT IN ('cancelado', 'cancelled', 'inactivo', 'no_renueva_ahora')
      `);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query(
      `SELECT t.id,
              t.deal_id,
              t.step_name,
              t.step_order,
              t.status,
              t.assigned_to,
              assignee.name AS assigned_name,
              d.client_id,
              c.name AS client_name,
              d.seller_id,
              seller.name AS seller_name,
              d.product_type,
              d.sale_type,
              d.source_label,
              d.ban_number,
              d.phone,
              d.created_at AS deal_created_at,
              t.created_at,
              t.updated_at,
              t.due_date,
              (
                SELECT COUNT(*)
                FROM crm_deal_tasks t_all
                WHERE t_all.deal_id = t.deal_id
              ) AS total_steps,
              (
                SELECT COUNT(*)
                FROM crm_deal_tasks t_done
                WHERE t_done.deal_id = t.deal_id
                  AND t_done.status = 'done'
              ) AS completed_steps
         FROM crm_deal_tasks t
         JOIN crm_deals d ON d.id = t.deal_id
         LEFT JOIN clients c ON c.id::text = d.client_id
         LEFT JOIN salespeople seller ON seller.id::text = d.seller_id
         LEFT JOIN salespeople assignee ON assignee.id::text = t.assigned_to
         LEFT JOIN subscribers sub ON sub.id::text = d.subscriber_id
         LEFT JOIN bans ban ON ban.id = sub.ban_id
         ${whereClause}
        ORDER BY
          CASE t.status WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
          t.updated_at DESC,
          t.deal_id DESC,
          t.step_order ASC`,
      params
    );

    res.json(rows.map((row) => ({
      id: Number(row.id),
      deal_id: Number(row.deal_id),
      step_name: row.step_name,
      step_order: Number(row.step_order),
      status: normalizeTaskStatus(row.status),
      assigned_to: row.assigned_to ? String(row.assigned_to) : null,
      assigned_name: row.assigned_name || null,
      client_id: row.client_id ? String(row.client_id) : null,
      client_name: row.client_name || null,
      seller_id: row.seller_id ? String(row.seller_id) : null,
      seller_name: row.seller_name || null,
      product_type: row.product_type,
      sale_type: row.sale_type,
      source_label: row.source_label || null,
      ban_number: row.ban_number || null,
      phone: row.phone || null,
      total_steps: Number(row.total_steps || 0),
      completed_steps: Number(row.completed_steps || 0),
      created_at: row.created_at,
      updated_at: row.updated_at,
      due_date: row.due_date || null,
      deal_created_at: row.deal_created_at
    })));
  } catch (error) {
    serverError(res, error, 'Error obteniendo tareas del workflow');
  }
};

// Mapeo de product_type+sale_type al nombre exacto de categoría en la tabla categories
const PRODUCT_CATEGORY_NAME = {
  'FIJO_REN':    'FIJO REN',
  'FIJO_NEW':    'FIJO NEW',
  'MOVIL_NEW':   'MOVIL NEW',
  'MOVIL_REN':   'MOVIL REN',
  'CLARO_TV_NEW':'TV',
  'CLOUD_NEW':   'Cloud',
  'MPLS_NEW':    null, // sin categoría definida aún
};

async function loadCategorySteps(dbQuery, productType, saleType) {
  // Fuente oficial: category_steps (módulo Categorías).
  const key = `${productType}_${saleType}`;
  const categoryName = PRODUCT_CATEGORY_NAME[key];
  if (categoryName) {
    const rows = await dbQuery(
      `SELECT cs.step_name, cs.step_order
         FROM category_steps cs
         JOIN categories c ON c.id = cs.category_id
        WHERE UPPER(TRIM(c.name)) = UPPER(TRIM($1))
        ORDER BY cs.step_order ASC`,
      [categoryName]
    );
    if (rows.length > 0) return rows;
  }

  // Fallback: crm_workflow_template_steps (sistema antiguo, backwards compat).
  const templateRows = await dbQuery(
    `SELECT s.step_name, s.step_order
       FROM crm_workflow_template_steps s
       JOIN crm_workflow_templates t ON t.id = s.template_id
      WHERE t.product_type = $1
        AND t.sale_type = $2
        AND t.is_active = TRUE
      ORDER BY s.step_order ASC, s.id ASC`,
    [productType, saleType]
  );
  return templateRows;
}

// Mapeo de columnas de follow_up_prospects a tipos de deal
const PROSPECT_COLUMN_TO_DEAL = [
  { col: 'fijo_ren',          product_type: 'FIJO',    sale_type: 'REN' },
  { col: 'fijo_new',          product_type: 'FIJO',    sale_type: 'NEW' },
  { col: 'movil_nueva',       product_type: 'MOVIL',   sale_type: 'NEW' },
  { col: 'movil_renovacion',  product_type: 'MOVIL',   sale_type: 'REN' },
  { col: 'claro_tv',          product_type: 'CLARO_TV', sale_type: 'NEW' },
  { col: 'cloud',             product_type: 'CLOUD',   sale_type: 'NEW' },
  { col: 'mpls',              product_type: 'MPLS',    sale_type: 'NEW' },
];

/**
 * POST /api/deals/clients/:clientId/sync
 * Elimina deals pendientes del cliente y los regenera desde el prospecto activo en seguimiento.
 */
export const syncClientDealsFromProspect = async (req, res) => {
  const clientId = String(req.params.clientId || '').trim();
  const currentRole = String(req.user?.role || '').trim().toLowerCase();
  const currentUserId = String(req.user?.userId || '').trim() || null;
  const requesterSalespersonId = String(req.user?.salespersonId || '').trim() || null;

  // Permitir pasar seller_id explícito (admin/supervisor), si no usar el del requester
  const rawSellerId = String(req.body?.seller_id || requesterSalespersonId || '').trim();

  if (!clientId) return badRequest(res, 'client_id requerido');
  if (!rawSellerId) return badRequest(res, 'seller_id requerido');

  logDealSync('prospect-sync:start', { clientId, currentRole, currentUserId, rawSellerId });

  try {
    await ensureDealWorkflowSchema();

    // 1. Validar vendedor
    const sellerValidation = await resolveSellerForSync(query, [rawSellerId], {
      allowAdminSeller: ['admin', 'supervisor'].includes(currentRole)
    });
    if (!sellerValidation.ok) return badRequest(res, sellerValidation.error);
    const sellerId = sellerValidation.seller.id;
    logDealSync('prospect-sync:seller', { clientId, sellerId, sellerRole: sellerValidation.seller.role });

    // 2. Obtener prospecto activo del cliente
    let prospects;
    try {
      prospects = await query(
        `SELECT * FROM follow_up_prospects
          WHERE client_id::text = $1
            AND completed_date IS NULL
            AND (is_active IS NULL OR is_active = TRUE)
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1`,
        [clientId]
      );
    } catch {
      return res.status(404).json({ error: 'No se pudo acceder al seguimiento del cliente' });
    }

    if (!prospects || prospects.length === 0) {
      logDealSync('prospect-sync:skip', { clientId, reason: 'no_active_follow_up_prospect' });
      return res.status(404).json({ error: 'No hay seguimiento activo para este cliente' });
    }

    const prospect = prospects[0];

    // 3. Detectar qué combinaciones tiene el prospecto
    const activeCombinations = PROSPECT_COLUMN_TO_DEAL.filter(
      ({ col }) => Number(prospect[col] || 0) > 0
    );

    if (activeCombinations.length === 0) {
      logDealSync('prospect-sync:skip', {
        clientId,
        prospectId: String(prospect.id),
        reason: 'no_active_combinations',
        activeFlags: PROSPECT_COLUMN_TO_DEAL.map(({ col }) => ({ col, value: Number(prospect[col] || 0) }))
      });
      return res.json({ deleted: 0, created: [], message: 'No hay tipos de venta activos en el seguimiento' });
    }

    const dbClient = await getClient();
    let deleted = 0;
    const created = [];

    try {
      await dbClient.query('BEGIN');

      // 4. Eliminar deals donde NINGUNA tarea esté completada (no trabajados)
      const deletedResult = await dbClient.query(
        `DELETE FROM crm_deals
          WHERE client_id = $1
            AND id NOT IN (
              SELECT DISTINCT deal_id FROM crm_deal_tasks WHERE status = 'done'
            )
          RETURNING id`,
        [clientId]
      );
      deleted = deletedResult.rowCount;

      // 5. Crear nuevos deals por cada combinación activa
      for (const { product_type, sale_type } of activeCombinations) {
        const steps = await loadCategorySteps(
          (sql, params) => dbClient.query(sql, params).then((r) => r.rows),
          product_type,
          sale_type
        );

        if (!steps || steps.length === 0) continue;

        logDealSync('prospect-sync:category', {
          clientId,
          prospectId: String(prospect.id),
          product_type,
          sale_type,
          steps: steps.length
        });

        const dealResult = await dbClient.query(
          `INSERT INTO crm_deals (
             client_id, seller_id, product_type, sale_type,
             source_type, source_ref, source_label, created_by, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, 'prospect', $5, $6, $7, NOW(), NOW())
           RETURNING id`,
          [
            clientId, sellerId, product_type, sale_type,
            String(prospect.id),
            `Prospecto #${prospect.id}`,
            currentUserId
          ]
        );

        const dealId = dealResult.rows[0].id;
        logDealSync('prospect-sync:deal-created', {
          clientId,
          prospectId: String(prospect.id),
          dealId: String(dealId),
          product_type,
          sale_type
        });

        for (const step of steps) {
          await dbClient.query(
            `INSERT INTO crm_deal_tasks (deal_id, step_name, step_order, status, assigned_to, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [
              dealId,
              step.step_name,
              step.step_order,
              step.step_order === 1 ? 'in_progress' : 'pending',
              sellerId
            ]
          );
        }

        logDealSync('prospect-sync:tasks-created', {
          clientId,
          dealId: String(dealId),
          createdTasks: steps.length,
          product_type,
          sale_type
        });

        created.push({
          deal_id: Number(dealId),
          product_type,
          sale_type,
          label: formatCombinationLabel(product_type, sale_type),
          steps: steps.length
        });
      }

      await dbClient.query('COMMIT');
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    } finally {
      dbClient.release();
    }

    res.json({
      ok: true,
      deleted,
      created,
      message: `${created.length} tipo(s) de venta generados (${deleted} deal(s) anterior(es) eliminado(s))`
    });
  } catch (error) {
    serverError(res, error, 'Error sincronizando tareas del cliente');
  }
};

export const syncClientDealsFromSubscribers = async (req, res) => {
  const clientId = String(req.params.clientId || '').trim();
  const currentRole = String(req.user?.role || '').trim().toLowerCase();
  const currentUserId = String(req.user?.userId || '').trim() || null;
  const requesterSalespersonId = String(req.user?.salespersonId || '').trim() || null;
  const rawSellerId = String(req.body?.seller_id || requesterSalespersonId || '').trim();

  if (!clientId) return badRequest(res, 'client_id requerido');
  if (!rawSellerId) return badRequest(res, 'seller_id requerido');

  logDealSync('subscriber-sync:start', { clientId, currentRole, currentUserId, rawSellerId });

  try {
    await ensureDealWorkflowSchema();

    const sellerValidation = await resolveSellerForSync(query, [rawSellerId], {
      allowAdminSeller: ['admin', 'supervisor'].includes(currentRole)
    });
    if (!sellerValidation.ok) return badRequest(res, sellerValidation.error);
    const sellerId = sellerValidation.seller.id;
    logDealSync('subscriber-sync:seller', { clientId, sellerId, sellerRole: sellerValidation.seller.role });

    const clientRows = await query(
      `SELECT id::text AS id, name
         FROM clients
        WHERE id::text = $1
        LIMIT 1`,
      [clientId]
    );
    if (clientRows.length === 0) return notFound(res, 'Cliente');

    const activeSubscribers = await loadActiveSubscribersForClient(query, clientId);
    if (activeSubscribers.length === 0) {
      logDealSync('subscriber-sync:skip', { clientId, reason: 'no_active_subscribers' });
      return res.json({
        ok: true,
        created: [],
        updated: [],
        skipped: [],
        message: 'No hay suscriptores activos con producto valido para sincronizar'
      });
    }

    const dbClient = await getClient();
    const created = [];
    const updated = [];
    const skipped = [];

    try {
      await dbClient.query('BEGIN');

      for (const subscriber of activeSubscribers) {
        const { product_type, sale_type } = subscriber.dealType;
        logDealSync('subscriber-sync:subscriber-detected', {
          clientId,
          subscriberId: String(subscriber.id),
          phone: subscriber.phone || subscriber.phone_number || null,
          status: String(subscriber.status || ''),
          product_type,
          sale_type
        });
        const steps = await loadCategorySteps(
          (sql, params) => dbClient.query(sql, params).then((r) => r.rows),
          product_type,
          sale_type
        );

        if (!steps || steps.length === 0) {
          logDealSync('subscriber-sync:skip', {
            clientId,
            subscriberId: String(subscriber.id),
            product_type,
            sale_type,
            reason: 'sin_pasos_configurados'
          });
          skipped.push({
            subscriber_id: String(subscriber.id),
            phone: subscriber.phone || subscriber.phone_number || null,
            product_type,
            sale_type,
            reason: 'sin_pasos_configurados'
          });
          continue;
        }

        logDealSync('subscriber-sync:category', {
          clientId,
          subscriberId: String(subscriber.id),
          product_type,
          sale_type,
          steps: steps.length
        });

        const existingDealRows = await dbClient.query(
          `SELECT id
             FROM crm_deals
            WHERE client_id = $1
              AND subscriber_id = $2
              AND product_type = $3
              AND sale_type = $4
            ORDER BY updated_at DESC, id DESC
            LIMIT 1`,
          [clientId, String(subscriber.id), product_type, sale_type]
        );

        let dealId = existingDealRows.rows[0]?.id;
        const subscriberPhone = subscriber.phone || subscriber.phone_number || null;
        const sourceLabel = `${subscriber.ban_number || 'BAN'} ${subscriberPhone || String(subscriber.id)}`.trim();

        if (dealId) {
          await dbClient.query(
            `UPDATE crm_deals
                SET seller_id = $1,
                    source_type = 'subscriber',
                    source_ref = $2,
                    source_label = $3,
                    ban_number = $4,
                    phone = $5,
                    updated_at = NOW()
              WHERE id = $6`,
            [sellerId, String(subscriber.id), sourceLabel, subscriber.ban_number || null, subscriberPhone, dealId]
          );
          updated.push({
            deal_id: Number(dealId),
            subscriber_id: String(subscriber.id),
            product_type,
            sale_type
          });
          logDealSync('subscriber-sync:deal-updated', {
            clientId,
            subscriberId: String(subscriber.id),
            dealId: String(dealId),
            product_type,
            sale_type
          });
        } else {
          const dealResult = await dbClient.query(
            `INSERT INTO crm_deals (
               client_id, seller_id, product_type, sale_type,
               source_type, source_ref, source_label, subscriber_id, ban_number, phone, created_by, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, 'subscriber', $5, $6, $7, $8, $9, $10, NOW(), NOW())
             RETURNING id`,
            [
              clientId,
              sellerId,
              product_type,
              sale_type,
              String(subscriber.id),
              sourceLabel,
              String(subscriber.id),
              subscriber.ban_number || null,
              subscriberPhone,
              currentUserId
            ]
          );
          dealId = dealResult.rows[0].id;
          created.push({
            deal_id: Number(dealId),
            subscriber_id: String(subscriber.id),
            product_type,
            sale_type,
            label: formatCombinationLabel(product_type, sale_type),
            steps: steps.length
          });
          logDealSync('subscriber-sync:deal-created', {
            clientId,
            subscriberId: String(subscriber.id),
            dealId: String(dealId),
            product_type,
            sale_type
          });
        }

        const existingTaskRows = await dbClient.query(
          `SELECT COUNT(*)::int AS total
             FROM crm_deal_tasks
            WHERE deal_id = $1`,
          [dealId]
        );

        if (Number(existingTaskRows.rows[0]?.total || 0) === 0) {
          for (const step of steps) {
            await dbClient.query(
              `INSERT INTO crm_deal_tasks (deal_id, step_name, step_order, status, assigned_to, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
              [
                dealId,
                step.step_name,
                step.step_order,
                step.step_order === 1 ? 'in_progress' : 'pending',
                sellerId
              ]
            );
          }
          logDealSync('subscriber-sync:tasks-created', {
            clientId,
            subscriberId: String(subscriber.id),
            dealId: String(dealId),
            createdTasks: steps.length,
            product_type,
            sale_type
          });
        } else {
          logDealSync('subscriber-sync:tasks-skipped', {
            clientId,
            subscriberId: String(subscriber.id),
            dealId: String(dealId),
            reason: 'existing_tasks',
            totalTasks: Number(existingTaskRows.rows[0]?.total || 0)
          });
        }
      }

      await dbClient.query('COMMIT');
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    } finally {
      dbClient.release();
    }

    res.json({
      ok: true,
      created,
      updated,
      skipped,
      message: `${created.length} deal(s) creados, ${updated.length} deal(s) sincronizados desde suscriptores activos`
    });
  } catch (error) {
    serverError(res, error, 'Error sincronizando tareas del cliente desde suscriptores activos');
  }
};

export const getSalespeople = async (_req, res) => {
  try {
    const rows = await query(
      `SELECT id::text AS id, name, role
         FROM salespeople
        ORDER BY name ASC`
    );
    res.json(rows.map((row) => ({
      id: String(row.id),
      name: row.name || null,
      role: row.role || null
    })));
  } catch (error) {
    serverError(res, error, 'Error obteniendo vendedores');
  }
};

export const updateDealTaskStatus = async (req, res) => {
  const taskId = Number(req.params.id);
  if (Number.isNaN(taskId)) return badRequest(res, 'ID invalido');

  const nextStatus = normalizeTaskStatus(req.body?.status);
  const rawDueDate = req.body?.due_date ?? undefined;
  const currentRole = String(req.user?.role || '').trim().toLowerCase();
  const requesterSalespersonId = String(req.user?.salespersonId || '').trim() || null;

  try {
    await ensureDealWorkflowSchema();
    const taskRows = await query(
      `SELECT t.*
         FROM crm_deal_tasks t
        WHERE t.id = $1
        LIMIT 1`,
      [taskId]
    );
    if (taskRows.length === 0) return notFound(res, 'Tarea');

    const currentTask = taskRows[0];
    if (currentRole === 'vendedor' && requesterSalespersonId && String(currentTask.assigned_to) !== requesterSalespersonId) {
      return res.status(403).json({ error: 'No puedes modificar tareas de otro vendedor' });
    }

    const currentStepOrder = Number(currentTask.step_order);
    let resolvedStatus = nextStatus;
    let previousTaskIsDone = true;

    if (currentStepOrder > 1) {
      const previousRows = await query(
        `SELECT status
           FROM crm_deal_tasks
          WHERE deal_id = $1
            AND step_order = $2
          LIMIT 1`,
        [currentTask.deal_id, currentStepOrder - 1]
      );
      previousTaskIsDone = previousRows.length === 0 || normalizeTaskStatus(previousRows[0].status) === 'done';
    }

    if (nextStatus === 'done' && currentStepOrder > 1 && !previousTaskIsDone) {
      return conflict(res, 'No puedes completar esta tarea hasta terminar la anterior');
    }

    if (nextStatus !== 'done') {
      resolvedStatus = currentStepOrder === 1 || previousTaskIsDone ? 'in_progress' : 'pending';
    }

    const dueDateValue = rawDueDate === null ? null : (rawDueDate || undefined);
    if (dueDateValue !== undefined) {
      await query(
        `UPDATE crm_deal_tasks SET due_date = $1, updated_at = NOW() WHERE id = $2`,
        [dueDateValue, taskId]
      );
    }

    await query(
      `UPDATE crm_deal_tasks
          SET status = $1,
              completed_at = CASE WHEN $1 = 'done' THEN NOW() ELSE NULL END,
              updated_at = NOW()
         WHERE id = $2`,
      [resolvedStatus, taskId]
    );

    if (resolvedStatus === 'done') {
      await query(
        `UPDATE crm_deal_tasks
            SET status = 'in_progress',
                updated_at = NOW()
          WHERE id = (
            SELECT id
            FROM crm_deal_tasks
            WHERE deal_id = $1
              AND step_order = $2
              AND status = 'pending'
             LIMIT 1
           )`,
        [currentTask.deal_id, currentStepOrder + 1]
      );
    } else {
      await query(
        `UPDATE crm_deal_tasks
            SET status = 'pending',
                completed_at = NULL,
                updated_at = NOW()
          WHERE deal_id = $1
            AND step_order > $2`,
        [currentTask.deal_id, currentStepOrder]
      );
    }

    const rows = await query(
      `SELECT t.id,
              t.deal_id,
              t.step_name,
              t.step_order,
              t.status,
              t.assigned_to,
              assignee.name AS assigned_name,
              d.client_id,
              c.name AS client_name,
              d.seller_id,
              seller.name AS seller_name,
              d.product_type,
              d.sale_type,
              d.source_label,
              d.ban_number,
              d.phone,
              t.due_date,
              t.created_at,
              t.updated_at,
              d.created_at AS deal_created_at,
              (
                SELECT COUNT(*)
                FROM crm_deal_tasks t_all
                WHERE t_all.deal_id = t.deal_id
              ) AS total_steps,
              (
                SELECT COUNT(*)
                FROM crm_deal_tasks t_done
                WHERE t_done.deal_id = t.deal_id
                  AND t_done.status = 'done'
              ) AS completed_steps
         FROM crm_deal_tasks t
         JOIN crm_deals d ON d.id = t.deal_id
         LEFT JOIN clients c ON c.id::text = d.client_id
         LEFT JOIN salespeople seller ON seller.id::text = d.seller_id
         LEFT JOIN salespeople assignee ON assignee.id::text = t.assigned_to
        WHERE t.id = $1`,
      [taskId]
    );

    const row = rows[0];

    // ── Fix A v2: sincronizar follow_up_prospects.next_call_date con
    // la fecha del paso ACTIVO del workflow del cliente.
    //   Prioridad 1: status = 'in_progress' (el paso que se trabaja ahora).
    //   Fallback:    status = 'pending' (cuando no hay in_progress, edge case).
    //   Done nunca entra.
    // Mantiene la columna legacy en sync con Mi Día para que /seguimiento
    // muestre la misma fecha. Cast client_id::text por mismatch de tipos.
    if (row?.client_id) {
      // Intentamos primero el MIN sobre in_progress; si no hay, caemos a pending.
      const inProgressRows = await query(
        `SELECT MIN(t.due_date) AS next_date
           FROM crm_deal_tasks t
           JOIN crm_deals d ON d.id = t.deal_id
          WHERE d.client_id = $1
            AND t.status = 'in_progress'
            AND t.due_date IS NOT NULL`,
        [row.client_id]
      );
      let nextDate = inProgressRows[0]?.next_date || null;
      if (!nextDate) {
        const pendingRows = await query(
          `SELECT MIN(t.due_date) AS next_date
             FROM crm_deal_tasks t
             JOIN crm_deals d ON d.id = t.deal_id
            WHERE d.client_id = $1
              AND t.status = 'pending'
              AND t.due_date IS NOT NULL`,
          [row.client_id]
        );
        nextDate = pendingRows[0]?.next_date || null;
      }
      await query(
        `UPDATE follow_up_prospects
            SET next_call_date = $1, updated_at = NOW()
          WHERE client_id::text = $2
            AND completed_date IS NULL`,
        [nextDate, row.client_id]
      );
    }

    res.json({
      id: Number(row.id),
      deal_id: Number(row.deal_id),
      step_name: row.step_name,
      step_order: Number(row.step_order),
      status: normalizeTaskStatus(row.status),
      assigned_to: row.assigned_to ? String(row.assigned_to) : null,
      assigned_name: row.assigned_name || null,
      client_id: row.client_id ? String(row.client_id) : null,
      client_name: row.client_name || null,
      seller_id: row.seller_id ? String(row.seller_id) : null,
      seller_name: row.seller_name || null,
      product_type: row.product_type,
      sale_type: row.sale_type,
      source_label: row.source_label || null,
      ban_number: row.ban_number || null,
      phone: row.phone || null,
      due_date: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : null,
      total_steps: Number(row.total_steps || 0),
      completed_steps: Number(row.completed_steps || 0),
      created_at: row.created_at,
      updated_at: row.updated_at,
      deal_created_at: row.deal_created_at
    });
  } catch (error) {
    serverError(res, error, 'Error actualizando tarea del workflow');
  }
};

export const getPanelTasks = async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        fp.id            AS prospect_id,
        fp.client_id,
        COALESCE(c.business_name, c.name, fp.company_name) AS client_name,
        v.name           AS vendor_name,
        d.id             AS deal_id,
        d.product_type,
        d.sale_type,
        t.id             AS task_id,
        t.step_name,
        t.step_order,
        t.status,
        t.due_date
      FROM follow_up_prospects fp
      LEFT JOIN clients c   ON c.id::text = fp.client_id::text
      LEFT JOIN vendors v   ON v.id = fp.vendor_id
      JOIN crm_deals d      ON d.client_id::text = fp.client_id::text
      JOIN crm_deal_tasks t ON t.deal_id = d.id
      WHERE fp.completed_date IS NULL
        AND (fp.is_active IS NULL OR fp.is_active = TRUE)
        AND t.status IN ('pending', 'in_progress')
      ORDER BY client_name ASC, d.product_type, d.sale_type, t.step_order ASC
    `);

    res.json(rows.map((r) => ({
      prospect_id:  Number(r.prospect_id),
      client_id:    String(r.client_id),
      client_name:  r.client_name || 'Sin nombre',
      vendor_name:  r.vendor_name || null,
      deal_id:      Number(r.deal_id),
      product_type: r.product_type,
      sale_type:    r.sale_type,
      task_id:      Number(r.task_id),
      step_name:    r.step_name,
      step_order:   Number(r.step_order),
      status:       r.status,
      due_date:     r.due_date ? new Date(r.due_date).toISOString().slice(0, 10) : null,
    })));
  } catch (error) {
    serverError(res, error, 'Error obteniendo tareas del panel');
  }
};
