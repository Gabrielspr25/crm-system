import { getClient, query } from '../database/db.js';
import { badRequest, conflict, notFound, serverError } from '../middlewares/errorHandler.js';

const PRODUCT_TYPES = new Set(['FIJO', 'MOVIL', 'CLARO_TV', 'CLOUD', 'MPLS']);
const SALE_TYPES = new Set(['NEW', 'REN']);
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
              d.notes,
              d.created_at AS deal_created_at,
              d.updated_at AS deal_updated_at,
              t.id AS task_id,
              t.step_name,
              t.step_order,
              t.status AS task_status,
              t.assigned_to,
              assignee.name AS assigned_name,
              t.completed_at,
              t.created_at AS task_created_at,
              t.updated_at AS task_updated_at
         FROM crm_deals d
         LEFT JOIN clients c ON c.id::text = d.client_id
         LEFT JOIN salespeople s ON s.id::text = d.seller_id
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

export const getClientDeals = async (req, res) => {
  req.query.client_id = String(req.params.id || '').trim();
  return getDeals(req, res);
};

export const getDealTasks = async (req, res) => {
  const currentRole = String(req.user?.role || '').trim().toLowerCase();
  const requesterSalespersonId = String(req.user?.salespersonId || '').trim() || null;
  const pendingOnly = String(req.query?.pending_only || '').trim() === '1';
  const sellerIdFilter = String(req.query?.seller_id || '').trim();
  const clientIdFilter = String(req.query?.client_id || '').trim();

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
      deal_created_at: row.deal_created_at
    })));
  } catch (error) {
    serverError(res, error, 'Error obteniendo tareas del workflow');
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
