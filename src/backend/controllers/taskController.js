/**
 * taskController.js
 * Shared utilities, schema management and re-exports for task routes.
 */
import { query as dbQuery } from '../database/db.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

// ─── Re-exports ───────────────────────────────────────────────────────────────
export { authenticateToken, requireRole };
export { dbQuery as query };

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
export const badRequest = (res, msg) => res.status(400).json({ error: msg });
export const notFound   = (res, entity = 'Recurso') => res.status(404).json({ error: `${entity} no encontrado` });
export const serverError = (res, err, ctx = 'Error') => {
  console.error(ctx, err);
  res.status(500).json({ error: ctx });
};

// ─── Constants ────────────────────────────────────────────────────────────────
export const TASK_STATUSES = new Set(['pending', 'in_progress', 'done']);

// ─── ID helpers ───────────────────────────────────────────────────────────────
export const toDbId = (id) => (id == null ? null : String(id).trim());
export const sameId = (a, b) => {
  if (a == null || b == null) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
};

// ─── Normalizers ──────────────────────────────────────────────────────────────
export const normalizeTaskDate = (val) => {
  if (!val || val === 'null') return null;
  const s = String(val).trim();
  if (!s) return null;
  // Accept YYYY-MM-DD or ISO timestamp
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return s.slice(0, 10); // keep YYYY-MM-DD
};

export const normalizeTaskTime = (val) => {
  if (!val || val === 'null') return null;
  const s = String(val).trim();
  if (!s) return null;
  // Accept HH:MM or HH:MM:SS
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);
  return null;
};

export const normalizeTaskPriority = (val) => {
  const s = String(val || '').trim().toLowerCase();
  if (s === 'high' || s === 'alta') return 'high';
  if (s === 'low' || s === 'baja') return 'low';
  return 'normal';
};

export const normalizeTaskKind = (val, { clientTaskWorkflow, workflowSteps, notes } = {}) => {
  const s = String(val || '').trim().toLowerCase();
  if (s === 'client') return 'client';
  if (s === 'regular') return 'regular';
  // Auto-detect: if there's client workflow data treat as client
  if (clientTaskWorkflow && typeof clientTaskWorkflow === 'object' && Object.keys(clientTaskWorkflow).length) return 'client';
  if (Array.isArray(workflowSteps) && workflowSteps.length) return 'regular';
  return 'regular';
};

export const normalizeClientTaskWorkflow = (val) => {
  if (!val || typeof val !== 'object') return null;
  return val;
};

export const normalizeTaskWorkflowSteps = (val) => {
  if (!Array.isArray(val)) return [];
  return val.filter(Boolean).map((s) => ({
    id: s.id || null,
    label: String(s.label || s.step_name || '').trim(),
    is_done: Boolean(s.is_done),
  }));
};

export const normalizeTaskCustomFields = (val) => {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return {};
  return val;
};

export const normalizeTaskColumnType = (val) => {
  const s = String(val || '').trim().toLowerCase();
  const valid = ['text', 'number', 'date', 'boolean', 'select'];
  return valid.includes(s) ? s : 'text';
};

export const normalizeTaskColumnOptions = (val) => {
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  return [];
};

export const cleanTaskColumnKey = (label) => {
  return String(label || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
};

export const resolveTaskStatusForWorkflow = (kind, steps, requestedStatus) => {
  const status = String(requestedStatus || '').trim().toLowerCase();
  if (!TASK_STATUSES.has(status)) return 'pending';
  if (kind !== 'regular' || !Array.isArray(steps) || !steps.length) return status;
  const allDone = steps.every((s) => Boolean(s.is_done));
  const anyDone = steps.some((s) => Boolean(s.is_done));
  if (allDone) return 'done';
  if (anyDone) return 'in_progress';
  return status === 'done' ? 'in_progress' : status;
};

// ─── SQL helpers ──────────────────────────────────────────────────────────────
export const SELECT_TASK = `
  SELECT
    t.id,
    t.owner_user_id,
    t.assigned_user_id,
    ou.username  AS owner_username,
    au.username  AS assigned_username,
    COALESCE(oas.name, ou.username) AS owner_name,
    COALESCE(aas.name, au.username) AS assigned_name,
    t.title,
    t.due_date,
    t.follow_up_date,
    t.follow_up_time,
    t.client_id,
    t.client_name,
    t.notes,
    t.status,
    t.priority,
    t.task_kind,
    t.client_task_workflow,
    t.workflow_steps,
    t.custom_fields,
    t.completed_at,
    t.created_at,
    t.updated_at
  FROM crm_tasks t
  LEFT JOIN users_auth ou  ON ou.id::text  = t.owner_user_id::text
  LEFT JOIN users_auth au  ON au.id::text  = t.assigned_user_id::text
  LEFT JOIN salespeople oas ON oas.id::text = ou.salesperson_id::text
  LEFT JOIN salespeople aas ON aas.id::text = au.salesperson_id::text
`.trim();

export const mapRow = (r) => ({
  id: Number(r.id),
  owner_user_id:    String(r.owner_user_id    || ''),
  assigned_user_id: r.assigned_user_id ? String(r.assigned_user_id) : null,
  owner_username:   r.owner_username   || null,
  owner_name:       r.owner_name       || null,
  assigned_username: r.assigned_username || null,
  assigned_name:     r.assigned_name    || null,
  title:          String(r.title || ''),
  due_date:       r.due_date       ? String(r.due_date).slice(0, 10) : null,
  follow_up_date: r.follow_up_date ? String(r.follow_up_date).slice(0, 10) : null,
  follow_up_time: r.follow_up_time || null,
  client_id:      r.client_id   ? String(r.client_id) : null,
  client_name:    r.client_name || null,
  notes:          r.notes       || null,
  status:         r.status      || 'pending',
  priority:       r.priority    || 'normal',
  task_kind:      r.task_kind   || 'regular',
  client_task_workflow: r.client_task_workflow || null,
  workflow_steps:  r.workflow_steps  || [],
  custom_fields:   r.custom_fields   || {},
  completed_at:   r.completed_at ? new Date(r.completed_at).toISOString() : null,
  created_at:     r.created_at   ? new Date(r.created_at).toISOString()   : null,
  updated_at:     r.updated_at   ? new Date(r.updated_at).toISOString()   : null,
});

export const mapColRow = (r) => ({
  id:          Number(r.id),
  column_key:  r.column_key,
  label:       r.label,
  data_type:   r.data_type || 'text',
  options:     Array.isArray(r.options) ? r.options : [],
  sort_order:  Number(r.sort_order || 0),
  is_active:   Boolean(r.is_active),
  created_at:  r.created_at ? new Date(r.created_at).toISOString() : null,
  updated_at:  r.updated_at ? new Date(r.updated_at).toISOString() : null,
});

// ─── Schema bootstrap ─────────────────────────────────────────────────────────
let schemaReady = false;

export const ensureSchema = async () => {
  if (schemaReady) return;
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS crm_tasks (
      id               BIGSERIAL PRIMARY KEY,
      owner_user_id    TEXT NOT NULL,
      assigned_user_id TEXT,
      title            TEXT NOT NULL,
      due_date         DATE,
      follow_up_date   DATE,
      follow_up_time   TEXT,
      client_id        TEXT,
      client_name      TEXT,
      notes            TEXT,
      status           TEXT NOT NULL DEFAULT 'pending',
      priority         TEXT NOT NULL DEFAULT 'normal',
      task_kind        TEXT NOT NULL DEFAULT 'regular',
      client_task_workflow JSONB,
      workflow_steps   JSONB NOT NULL DEFAULT '[]',
      custom_fields    JSONB NOT NULL DEFAULT '{}',
      completed_at     TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS crm_task_columns (
      id             SERIAL PRIMARY KEY,
      owner_user_id  TEXT NOT NULL,
      column_key     TEXT NOT NULL,
      label          TEXT NOT NULL,
      data_type      TEXT NOT NULL DEFAULT 'text',
      options        JSONB NOT NULL DEFAULT '[]',
      sort_order     INT  NOT NULL DEFAULT 0,
      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (owner_user_id, column_key)
    )
  `);
  schemaReady = true;
};
