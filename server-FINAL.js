import express from 'express';
import cors from 'cors';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const packageJson = require('./package.json');
const pdfParse = require('pdf-parse');
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { createWorker } from 'tesseract.js';
import { saveImportData } from './src/backend/controllers/importController.js';
import { fullSystemCheck } from './src/backend/controllers/healthController.js';
import { runFullSystemTest } from './src/backend/controllers/systemTestController.js';
import referidosRoutes from './src/backend/routes/referidosRoutes.js';
import tarifasRoutes from './src/backend/routes/tarifasRoutes.js';
import clientRoutes from './src/backend/routes/clientRoutes.js';
import banRoutes from './src/backend/routes/banRoutes.js';
import importRoutes from './src/backend/routes/importRoutes.js';
import vendorRoutes from './src/backend/routes/vendorRoutes.js';
import systemRoutes from './src/backend/routes/systemRoutes.js';
import productRoutes from './src/backend/routes/productRoutes.js';
import tiersFixedRoutes from './src/backend/routes/tiersFixedRoutes.js';
import posIntegrationRoutes from './src/backend/routes/posIntegrationRoutes.js';
import discrepanciasRoutes from './src/backend/routes/discrepanciasRoutes.js';
import salesHistoryRoutes from './src/backend/routes/salesHistoryRoutes.js';
import campaignRoutes from './src/backend/routes/campaignRoutes.js';
import trackingRoutes from './src/backend/routes/trackingRoutes.js';
import goalsRoutes from './src/backend/routes/goalsRoutes.js';
import tangoRoutes from './src/backend/routes/tangoRoutes.js';
import ocrRoutes from './src/backend/routes/ocrRoutes.js';
import dealWorkflowRoutes from './src/backend/routes/dealWorkflowRoutes.js';
import { getTangoPool } from './src/backend/database/externalPools.js';
import { getPermissionCatalogResponse, ensurePermissionSchema, resolvePermissionsForUser, saveUserPermissionOverrides } from './src/backend/utils/permissionService.js';
console.log('🔍 DEBUG: discrepanciasRoutes imported:', typeof discrepanciasRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'tango_secret_key_2024';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'tango_refresh_secret_key_2024';
const ACCESS_TOKEN_TTL = null;
const REFRESH_TOKEN_TTL = null;

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.warn('[SECURITY] JWT secrets are using fallback values. Configure JWT_SECRET and JWT_REFRESH_SECRET in environment.');
}

// ======================================================
// Configuración base
// ======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT || 3001);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors());

// Middleware para evitar caché en index.html
app.use((req, res, next) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones desde esta IP, intente nuevamente en 15 minutos.' }
});
app.use('/api', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// ======================================================
// DEBUG: FIX SCHEMA ENDPOINT (EMERGENCY)
// ======================================================
const isPublicRoute = (req) => {
  if (req.path === '/api/login' || req.path === '/api/token/refresh' || req.path === '/api/health' || req.path === '/api/version') {
    return true;
  }
  return false;
};

// Functions `toDbId` etc are hoisted so we can use them here

const normalizeAuthenticatedRole = (value, fallbackSalespersonId = null) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized) return normalized;
  return fallbackSalespersonId ? 'vendedor' : 'admin';
};

const hydrateAuthenticatedUser = async (tokenUser) => {
  const userId = tokenUser?.userId ?? null;
  const username = String(tokenUser?.username || '').trim();

  if (!userId && !username) {
    return tokenUser;
  }

  const rows = await query(
    `SELECT u.id,
            u.username,
            u.salesperson_id,
            s.name AS salesperson_name,
            s.role AS salesperson_role
       FROM users_auth u
       LEFT JOIN salespeople s ON s.id::text = u.salesperson_id::text
      WHERE ($1::int IS NOT NULL AND u.id = $1)
         OR ($2::text <> '' AND u.username = $2)
      ORDER BY CASE WHEN ($1::int IS NOT NULL AND u.id = $1) THEN 0 ELSE 1 END
      LIMIT 1`,
    [userId ? Number(userId) : null, username]
  );

  if (rows.length === 0) {
    return {
      ...tokenUser,
      userId: toDbId(tokenUser?.userId),
      salespersonId: toDbId(tokenUser?.salespersonId),
      role: normalizeAuthenticatedRole(tokenUser?.role, tokenUser?.salespersonId)
    };
  }

  const row = rows[0];
  return {
    ...tokenUser,
    userId: toDbId(row.id),
    username: row.username,
    salespersonId: toDbId(row.salesperson_id),
    salespersonName: row.salesperson_name || null,
    role: normalizeAuthenticatedRole(row.salesperson_role, row.salesperson_id)
  };
};

const getVendorScope = async (req) => {
  const role = normalizeAuthenticatedRole(req.user?.role, req.user?.salespersonId);
  const salespersonId = String(req.user?.salespersonId || '').trim();

  if (role !== 'vendedor') {
    return { isVendor: false, salespersonId: '', vendorId: null };
  }

  if (!salespersonId) {
    return { isVendor: true, salespersonId: '', vendorId: null };
  }

  const vendorRows = await query(
    `SELECT id
       FROM vendors
      WHERE salesperson_id::text = $1
      LIMIT 1`,
    [salespersonId]
  ).catch(() => []);

  return {
    isVendor: true,
    salespersonId,
    vendorId: vendorRows[0]?.id ? String(vendorRows[0].id) : null
  };
};

const vendorOwnsClient = (clientSalespersonId, scope) => {
  if (!scope?.isVendor) return true;
  if (!scope.salespersonId) return false;
  return String(clientSalespersonId || '').trim() === scope.salespersonId;
};

const vendorOwnsProspect = (row, scope) => {
  if (!scope?.isVendor) return true;
  if (!scope.salespersonId) return false;

  const clientSalespersonId = String(row?.client_salesperson_id || '').trim();
  const prospectVendorId = String(row?.vendor_id || '').trim();

  if (clientSalespersonId && clientSalespersonId === scope.salespersonId) {
    return true;
  }

  return Boolean(scope.vendorId && prospectVendorId && prospectVendorId === scope.vendorId);
};

const authenticateRequest = async (req, res, next) => {
  if (req.method === 'OPTIONS' || isPublicRoute(req)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    try {
      req.user = await hydrateAuthenticatedUser(payload);
    } catch (dbError) {
      console.error('No se pudo hidratar usuario autenticado desde BD:', dbError);
      req.user = {
        userId: toDbId(payload.userId),
        username: payload.username,
        salespersonId: toDbId(payload.salespersonId),
        salespersonName: payload.salespersonName,
        role: normalizeAuthenticatedRole(payload.role, payload.salespersonId)
      };
    }
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const requireRole = (allowedRoles) => (req, res, next) => {
  const role = req.user?.role;
  if (!role || !allowedRoles.includes(role)) {
    return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
  }
  return next();
};

const AUDIT_MODULE_LABELS = {
  auth: 'Autenticacion',
  clients: 'Clientes',
  bans: 'BANs',
  subscribers: 'Suscriptores',
  'follow-up-prospects': 'Seguimiento',
  'call-logs': 'Historial de Gestiones',
  'subscriber-reports': 'Comisiones',
  'sales-history': 'Historial de Ventas',
  tasks: 'Tareas',
  vendors: 'Vendedores',
  salespeople: 'Vendedores',
  tariffs: 'Tarifas',
  tarifas: 'Tarifas',
  tango: 'Tango',
  importador: 'Importador',
  products: 'Productos',
  email: 'Email',
  referidos: 'Referidos',
  goals: 'Metas',
  pos: 'POS',
  tracking: 'Tracking',
  discrepancias: 'Discrepancias',
  system: 'Sistema'
};

function getAuditModule(pathname = '') {
  const parts = String(pathname).split('/').filter(Boolean);
  const moduleKey = parts[0] === 'api' ? (parts[1] || '') : (parts[0] || '');
  return {
    moduleKey: moduleKey || 'general',
    moduleLabel: AUDIT_MODULE_LABELS[moduleKey] || moduleKey || 'General'
  };
}

function getAuditAction(req) {
  const path = String(req.path || '').toLowerCase();
  if (path === '/api/login') return 'LOGIN';
  if (path.includes('/sync')) return 'SINCRONIZAR';
  if (path.includes('/complete')) return 'COMPLETAR';
  if (path.includes('/return')) return 'DEVOLVER';
  if (path.includes('/cancel')) return 'CANCELAR';
  if (path.includes('/reactivate')) return 'REACTIVAR';
  if (path.includes('/send')) return 'ENVIAR';
  if (req.method === 'POST') return 'CREAR';
  if (req.method === 'PUT' || req.method === 'PATCH') return 'EDITAR';
  if (req.method === 'DELETE') return 'ELIMINAR';
  if (req.method === 'GET') return 'VER';
  return req.method || 'ACCION';
}

function getAuditEntityName(req) {
  const body = req.body || {};
  return body.name
    || body.company_name
    || body.client_name
    || body.ban_number
    || body.phone
    || body.username
    || null;
}

function getAuditEntityId(req) {
  const candidate = req.params?.id
    || req.params?.subscriber_id
    || req.params?.prospect_id
    || req.params?.client_id
    || req.params?.ban_id
    || req.body?.id
    || null;
  const numeric = Number(candidate);
  return Number.isFinite(numeric) ? numeric : null;
}

function shouldAuditRequest(req) {
  if (!req.path.startsWith('/api/')) return false;
  if (req.method === 'OPTIONS') return false;
  if (req.path === '/api/health' || req.path === '/api/version' || req.path === '/api/audit-log') return false;
  if (req.path === '/api/token/refresh') return false;
  if (req.path === '/api/login') return false;

  if (req.method === 'GET') {
    return req.path === '/api/subscriber-reports'
      || req.path === '/api/clients'
      || req.path === '/api/follow-up-prospects'
      || req.path === '/api/sales-history'
      || req.path === '/api/tasks'
      || req.path === '/api/completed-prospects';
  }

  return req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE';
}

function safeAuditDetails(details) {
  try {
    return JSON.stringify(details);
  } catch {
    return null;
  }
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

function auditRequestMiddleware(req, res, next) {
  if (!shouldAuditRequest(req)) {
    return next();
  }

  const startedAt = Date.now();
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 400) {
      return;
    }

    const { moduleKey, moduleLabel } = getAuditModule(req.path);
    const username = req.user?.username || String(req.body?.username || '').trim() || 'Sistema';
    const details = safeAuditDetails({
      module: moduleLabel,
      module_key: moduleKey,
      route: req.path,
      method: req.method,
      status_code: res.statusCode,
      duration_ms: Date.now() - startedAt,
      params: req.params || {},
      query: req.query || {},
      target: getAuditEntityName(req)
    });

    logAudit(
      Number.isFinite(Number(req.user?.userId)) ? Number(req.user.userId) : null,
      username,
      getAuditAction(req),
      moduleKey,
      getAuditEntityId(req),
      getAuditEntityName(req),
      details,
      getClientIp(req)
    );
  });

  return next();
}

// APLICAR SEGURIDAD ANTES DE MONTAR RUTAS
app.use(authenticateRequest);
app.use(auditRequestMiddleware);

// Rutas de Módulos Específicos
app.use('/api/referidos', referidosRoutes);
app.use('/api/tariffs', tarifasRoutes);
app.use('/api/tarifas', tarifasRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/bans', banRoutes);
app.use('/api/importador', importRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/products', productRoutes);
app.use('/api/tiers-fixed', tiersFixedRoutes);
app.use('/api/pos', posIntegrationRoutes);
app.use('/api/discrepancias', discrepanciasRoutes);
app.use('/api/sales-history', salesHistoryRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/tango', tangoRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api', dealWorkflowRoutes);
console.log('🔍 DEBUG: /api/discrepancias routes mounted');

// System Routes - PROTECTED EXTRA
// Solo permitir system en dev o con rol admin (validado dentro del router o aqui)
// Por ahora solo autenticado
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/system', systemRoutes);
}

// Helpers que se quedaron abajo (issueTokens, etc) siguen ahí? 
// No, I am replacing the chunk that contained them?
// Wait, the original chunk 83-181 contained helpers?
// Lines 133-155: sanitizeUserPayload, issueTokens, findUserByUsername.
// I must KEEP them.
// I will re-add them after the routes.

const sanitizeUserPayload = (row) => ({
  userId: toDbId(row.id),
  username: row.username,
  salespersonId: toDbId(row.salesperson_id),
  salespersonName: row.salesperson_name,
  role: row.role || 'vendedor'
});

const issueTokens = (payload) => ({
  accessToken: ACCESS_TOKEN_TTL
    ? jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL })
    : jwt.sign(payload, JWT_SECRET),
  refreshToken: REFRESH_TOKEN_TTL
    ? jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL })
    : jwt.sign(payload, JWT_REFRESH_SECRET)
});

async function findUserByUsername(username) {
  const rows = await query(
    `SELECT u.id, u.username, u.password, s.id AS salesperson_id, s.name AS salesperson_name, s.role
       FROM users_auth u
       JOIN salespeople s ON u.salesperson_id = s.id
       WHERE u.username = $1`,
    [username]
  );
  return rows[0];
}

// ======================================================
// Conexión a PostgreSQL
// ======================================================
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'crm_pro',
  user: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD,
  max: 15,
  idleTimeoutMillis: 30_000,
  // connectionTimeoutMillis eliminado para evitar timeouts en servidores lentos
  ssl: false
});

// Eventos del Pool
pool.on('connect', () => {
  // console.log('Base de datos conectada');
});

pool.on('error', (err) => {
  console.error('Error inesperado en el cliente de base de datos', err);
  // No salir del proceso, intentar recuperar
});

// Test de conexión inicial
(async () => {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() as now');
    console.log('✅ Conexión a Base de Datos exitosa:', res.rows[0].now);
    client.release();
  } catch (err) {
    console.error('❌ Error conectando a la Base de Datos:', err.message);
  }
})();

async function query(text, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } catch (error) {
    console.error('Error en query:', text, error.message);
    throw error;
  } finally {
    client.release();
  }
}

const toNumber = (value) =>
  value === null || value === undefined ? value : Number(value);

const toBoolean = (value) =>
  value === true || value === false
    ? value
    : value === 1 || value === '1' || value === 'true';

function mapNumeric(row, fields) {
  fields.forEach((field) => {
    if (field in row && row[field] !== null && row[field] !== undefined) {
      row[field] = toNumber(row[field]);
    }
  });
  return row;
}

function mapBoolean(row, fields) {
  fields.forEach((field) => {
    if (field in row && row[field] !== null && row[field] !== undefined) {
      row[field] = toBoolean(row[field]);
    }
  });
  return row;
}

function mapTimestamps(row, fields) {
  fields.forEach((field) => {
    if (field in row && row[field] instanceof Date) {
      row[field] = row[field].toISOString();
    }
  });
  return row;
}

function enrich(row, numeric = [], boolean = [], timestamps = []) {
  mapNumeric(row, numeric);
  mapBoolean(row, boolean);
  mapTimestamps(row, timestamps);
  return row;
}

function toDbId(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value) : numeric;
}

function sameId(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }
  return String(a) === String(b);
}

function normalizeReportMonth(monthStr) {
  if (!monthStr || typeof monthStr !== 'string') {
    return null;
  }
  const parts = monthStr.split('-');
  if (parts.length < 2) {
    return null;
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  const paddedMonth = String(month).padStart(2, '0');
  return `${year}-${paddedMonth}-01`;
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function notFound(res, entity = 'Recurso') {
  return res.status(404).json({ error: `${entity} no encontrado` });
}

function conflict(res, message) {
  return res.status(409).json({ error: message });
}

function serverError(res, error, message = 'Error interno del servidor') {
  console.error(message, error);
  return res.status(500).json({ error: message });
}

function mapBusinessGoalRow(row) {
  return {
    id: row.id,
    product_id: row.product_id,
    product_name: row.product_name,
    period_type: row.period_type,
    period_year: row.period_year,
    period_month: row.period_month,
    period_quarter: row.period_quarter,
    total_target_amount: Number(row.target_revenue ?? 0),
    current_amount: Number(row.current_revenue ?? 0),
    description: row.description,
    is_active: row.is_active ?? 1,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapVendorGoalRow(row) {
  return {
    id: row.id,
    vendor_id: row.vendor_id,
    vendor_name: row.vendor_name,
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
  };
}

const PRODUCT_GOALS_SELECT = `
  SELECT pg.*, p.name AS product_name, v.name AS vendor_name
    FROM product_goals pg
    LEFT JOIN products p ON pg.product_id::text = p.id::text
    LEFT JOIN vendors v ON pg.vendor_id = v.id
`;

const TASK_STATUSES = new Set(['pending', 'in_progress', 'done']);
const TASK_PRIORITIES = new Set(['low', 'normal', 'high']);
const TASK_COLUMN_TYPES = new Set(['text', 'date', 'number', 'select', 'checkbox']);
const TASK_KINDS = new Set(['regular', 'client']);
const CLIENT_TASK_WORKFLOWS = new Set(['mobile', 'fixed', 'custom']);
const CLIENT_PRODUCT_SOURCE_TYPES = new Set(['manual', 'subscriber_report', 'subscriber', 'sales_history']);
const LEGACY_TASK_CHECKLIST_REGEX = /(^|\n)\[(x| )\]\s+/i;
let ensureTasksSchemaPromise = null;
let ensureClientProductWorkflowSchemaPromise = null;

function normalizeTaskStatus(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return TASK_STATUSES.has(normalized) ? normalized : 'pending';
}

function normalizeTaskPriority(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return TASK_PRIORITIES.has(normalized) ? normalized : 'normal';
}

function normalizeTaskColumnType(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return TASK_COLUMN_TYPES.has(normalized) ? normalized : 'text';
}

function hasLegacyClientTaskMetadata({ clientTaskWorkflow = null, workflowSteps = [], notes = null } = {}) {
  if (typeof clientTaskWorkflow === 'string' && clientTaskWorkflow.trim() !== '') {
    return true;
  }
  if (Array.isArray(workflowSteps) && workflowSteps.length > 0) {
    return true;
  }
  return LEGACY_TASK_CHECKLIST_REGEX.test(String(notes || ''));
}

function normalizeTaskKind(value, fallback = {}) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (TASK_KINDS.has(normalized)) {
    return normalized;
  }
  return hasLegacyClientTaskMetadata(fallback) ? 'client' : 'regular';
}

function normalizeClientTaskWorkflow(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return CLIENT_TASK_WORKFLOWS.has(normalized) ? normalized : 'custom';
}

function cleanTaskColumnKey(value) {
  const base = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base.slice(0, 40);
}

function normalizeTaskCustomFields(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const normalized = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = cleanTaskColumnKey(rawKey);
    if (!key) continue;
    if (rawValue === null || typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      normalized[key] = rawValue;
      continue;
    }
    normalized[key] = String(rawValue);
  }
  return normalized;
}

function normalizeTaskWorkflowSteps(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const label = entry.trim();
        if (!label) return null;
        return {
          id: `step-${index + 1}`,
          label,
          is_done: false
        };
      }

      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const label = String(entry.label ?? entry.text ?? '').trim();
      if (!label) {
        return null;
      }

      return {
        id: String(entry.id || `step-${index + 1}`),
        label,
        is_done: Boolean(entry.is_done ?? entry.done)
      };
    })
    .filter(Boolean)
    .slice(0, 100);
}

function cleanProductTemplateKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

function normalizeProductTaskSteps(value) {
  return normalizeTaskWorkflowSteps(value);
}

function normalizeClientProductSourceType(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return CLIENT_PRODUCT_SOURCE_TYPES.has(normalized) ? normalized : 'manual';
}

function resolveClientProductWorkflowStatus(workflowSteps, fallbackStatus = 'pending') {
  const normalizedFallback = normalizeTaskStatus(fallbackStatus);
  if (!Array.isArray(workflowSteps) || workflowSteps.length === 0) {
    return normalizedFallback;
  }

  const completed = workflowSteps.filter((step) => Boolean(step?.is_done)).length;
  if (completed <= 0) return 'pending';
  if (completed >= workflowSteps.length) return 'done';
  return 'in_progress';
}

function resolveTaskStatusForWorkflow(taskKind, workflowSteps, fallbackStatus = 'pending') {
  const normalizedFallback = normalizeTaskStatus(fallbackStatus);
  if (taskKind !== 'client' || !Array.isArray(workflowSteps) || workflowSteps.length === 0) {
    return normalizedFallback;
  }

  const completed = workflowSteps.filter((step) => Boolean(step?.is_done)).length;
  if (completed <= 0) return 'pending';
  if (completed >= workflowSteps.length) return 'done';
  return 'in_progress';
}

function normalizeTaskDate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }
  return text;
}

function normalizeTaskTime(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const text = String(value).trim();
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(text)) {
    return null;
  }
  return text.slice(0, 5);
}

function normalizeTaskColumnOptions(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, 40);
  }
  if (typeof value === 'string') {
    return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))].slice(0, 40);
  }
  return [];
}

function mapTaskDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function mapTaskTimestamp(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function mapTaskTime(value) {
  if (!value) return null;
  return String(value).slice(0, 5);
}

function mapTaskRow(row) {
  const rawClientId = row.client_id;
  const numericClientId = rawClientId === null || rawClientId === undefined ? null : Number(rawClientId);
  const workflowSteps = normalizeTaskWorkflowSteps(row.workflow_steps);
  const taskKind = normalizeTaskKind(row.task_kind, {
    clientTaskWorkflow: row.client_task_workflow,
    workflowSteps,
    notes: row.notes
  });

  return {
    id: Number(row.id),
    owner_user_id: row.owner_user_id,
    assigned_user_id: row.assigned_user_id === null || row.assigned_user_id === undefined ? null : String(row.assigned_user_id),
    assigned_username: row.assigned_username || null,
    assigned_name: row.assigned_name || null,
    title: row.title,
    due_date: mapTaskDate(row.due_date),
    follow_up_date: mapTaskDate(row.follow_up_date),
    follow_up_time: mapTaskTime(row.follow_up_time),
    client_id: rawClientId === null || rawClientId === undefined
      ? null
      : (Number.isNaN(numericClientId) ? String(rawClientId) : numericClientId),
    client_name: row.client_name,
    notes: row.notes,
    status: resolveTaskStatusForWorkflow(taskKind, workflowSteps, row.status),
    priority: normalizeTaskPriority(row.priority),
    task_kind: taskKind,
    client_task_workflow: taskKind === 'client' ? normalizeClientTaskWorkflow(row.client_task_workflow) : null,
    workflow_steps: workflowSteps,
    custom_fields: normalizeTaskCustomFields(row.custom_fields),
    completed_at: mapTaskTimestamp(row.completed_at),
    created_at: mapTaskTimestamp(row.created_at),
    updated_at: mapTaskTimestamp(row.updated_at)
  };
}

function mapTaskColumnRow(row) {
  return {
    id: Number(row.id),
    column_key: row.column_key,
    label: row.label,
    data_type: normalizeTaskColumnType(row.data_type),
    options: normalizeTaskColumnOptions(row.options),
    sort_order: Number(row.sort_order ?? 0),
    is_active: Boolean(row.is_active),
    created_at: mapTaskTimestamp(row.created_at),
    updated_at: mapTaskTimestamp(row.updated_at)
  };
}

function mapProductTemplateRow(row) {
  return {
    id: Number(row.id),
    product_key: row.product_key,
    product_name: row.product_name,
    steps: normalizeProductTaskSteps(row.steps),
    is_active: row.is_active !== false,
    created_by: row.created_by ? String(row.created_by) : null,
    updated_by: row.updated_by ? String(row.updated_by) : null,
    created_at: mapTaskTimestamp(row.created_at),
    updated_at: mapTaskTimestamp(row.updated_at)
  };
}

function mapClientProductWorkflowRow(row) {
  const numericId = Number(row.id);
  const workflowSteps = normalizeProductTaskSteps(row.workflow_steps);
  return {
    id: Number.isNaN(numericId) ? row.id : numericId,
    client_id: row.client_id === null || row.client_id === undefined ? null : String(row.client_id),
    client_name: row.client_name || null,
    salesperson_id: row.salesperson_id === null || row.salesperson_id === undefined ? null : String(row.salesperson_id),
    salesperson_name: row.salesperson_name || null,
    assigned_user_id: row.assigned_user_id === null || row.assigned_user_id === undefined ? null : String(row.assigned_user_id),
    assigned_username: row.assigned_username || null,
    assigned_name: row.assigned_name || null,
    product_key: row.product_key,
    product_name: row.product_name,
    source_type: normalizeClientProductSourceType(row.source_type),
    source_ref: row.source_ref === null || row.source_ref === undefined ? null : String(row.source_ref),
    source_label: row.source_label || null,
    subscriber_id: row.subscriber_id === null || row.subscriber_id === undefined ? null : String(row.subscriber_id),
    ban_number: row.ban_number || null,
    phone: row.phone || null,
    line_type: row.line_type || null,
    sale_type: row.sale_type || null,
    monthly_value: row.monthly_value === null || row.monthly_value === undefined ? null : Number(row.monthly_value),
    notes: row.notes || null,
    workflow_steps: workflowSteps,
    status: resolveClientProductWorkflowStatus(workflowSteps, row.status),
    completed_at: mapTaskTimestamp(row.completed_at),
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: mapTaskTimestamp(row.created_at),
    updated_at: mapTaskTimestamp(row.updated_at)
  };
}

async function ensureTasksSchema() {
  if (ensureTasksSchemaPromise) {
    return ensureTasksSchemaPromise;
  }

  ensureTasksSchemaPromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS crm_tasks (
        id BIGSERIAL PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        assigned_user_id TEXT NULL,
        title TEXT NOT NULL,
        due_date DATE NULL,
        follow_up_date DATE NULL,
        follow_up_time TIME NULL,
        client_id BIGINT NULL,
        client_name TEXT NULL,
        notes TEXT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'normal',
        custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
        completed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT crm_tasks_status_chk CHECK (status IN ('pending', 'in_progress', 'done')),
        CONSTRAINT crm_tasks_priority_chk CHECK (priority IN ('low', 'normal', 'high'))
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS crm_tasks_owner_idx
      ON crm_tasks(owner_user_id, status, due_date)
    `);

    await query(`
      ALTER TABLE crm_tasks
      ADD COLUMN IF NOT EXISTS assigned_user_id TEXT NULL
    `);

    await query(`
      ALTER TABLE crm_tasks
      ADD COLUMN IF NOT EXISTS follow_up_date DATE NULL
    `);

    await query(`
      ALTER TABLE crm_tasks
      ADD COLUMN IF NOT EXISTS follow_up_time TIME NULL
    `);

    await query(`
      ALTER TABLE crm_tasks
      ADD COLUMN IF NOT EXISTS task_kind TEXT NOT NULL DEFAULT 'regular'
    `);

    await query(`
      ALTER TABLE crm_tasks
      ADD COLUMN IF NOT EXISTS client_task_workflow TEXT NULL
    `);

    await query(`
      ALTER TABLE crm_tasks
      ADD COLUMN IF NOT EXISTS workflow_steps JSONB NOT NULL DEFAULT '[]'::jsonb
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS crm_tasks_assigned_idx
      ON crm_tasks(assigned_user_id, status, due_date)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS crm_tasks_follow_up_idx
      ON crm_tasks(owner_user_id, follow_up_date, follow_up_time)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS crm_tasks_kind_idx
      ON crm_tasks(owner_user_id, task_kind, status, due_date)
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS crm_task_columns (
        id BIGSERIAL PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        column_key TEXT NOT NULL,
        label TEXT NOT NULL,
        data_type TEXT NOT NULL DEFAULT 'text',
        options JSONB NOT NULL DEFAULT '[]'::jsonb,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT crm_task_columns_type_chk CHECK (data_type IN ('text', 'date', 'number', 'select', 'checkbox')),
        CONSTRAINT crm_task_columns_owner_key_uniq UNIQUE(owner_user_id, column_key)
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS crm_task_columns_owner_idx
      ON crm_task_columns(owner_user_id, sort_order)
    `);

    try {
      await query(`ALTER TABLE crm_tasks ALTER COLUMN client_id TYPE TEXT USING client_id::text`);
    } catch (e) {
      console.warn("Notice: could not alter crm_tasks.client_id to text:", e.message);
    }

    await query(`
      UPDATE crm_tasks
         SET task_kind = CASE
           WHEN COALESCE(client_task_workflow, '') <> '' THEN 'client'
           WHEN jsonb_array_length(COALESCE(workflow_steps, '[]'::jsonb)) > 0 THEN 'client'
           WHEN COALESCE(notes, '') ~ '(^|\\n)\\[(x| )\\]\\s+' THEN 'client'
           ELSE 'regular'
         END
       WHERE task_kind IS NULL
          OR task_kind NOT IN ('regular', 'client')
          OR (
            task_kind = 'client'
            AND COALESCE(client_task_workflow, '') = ''
            AND jsonb_array_length(COALESCE(workflow_steps, '[]'::jsonb)) = 0
            AND COALESCE(notes, '') !~ '(^|\\n)\\[(x| )\\]\\s+'
          )
    `);
  })().catch((error) => {
    ensureTasksSchemaPromise = null;
    throw error;
  });

  return ensureTasksSchemaPromise;
}

async function ensureClientProductWorkflowSchema() {
  if (ensureClientProductWorkflowSchemaPromise) {
    return ensureClientProductWorkflowSchemaPromise;
  }

  ensureClientProductWorkflowSchemaPromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS crm_product_task_templates (
        id BIGSERIAL PRIMARY KEY,
        product_key TEXT NOT NULL UNIQUE,
        product_name TEXT NOT NULL,
        steps JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by TEXT NULL,
        updated_by TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS crm_product_task_templates_active_idx
      ON crm_product_task_templates(is_active, product_name)
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS crm_client_product_workflows (
        id BIGSERIAL PRIMARY KEY,
        client_id TEXT NOT NULL,
        client_name TEXT NOT NULL,
        salesperson_id TEXT NULL,
        assigned_user_id TEXT NULL,
        product_key TEXT NOT NULL,
        product_name TEXT NOT NULL,
        source_type TEXT NULL,
        source_ref TEXT NULL,
        source_label TEXT NULL,
        subscriber_id TEXT NULL,
        ban_number TEXT NULL,
        phone TEXT NULL,
        line_type TEXT NULL,
        sale_type TEXT NULL,
        monthly_value NUMERIC NULL,
        notes TEXT NULL,
        workflow_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
        status TEXT NOT NULL DEFAULT 'pending',
        completed_at TIMESTAMPTZ NULL,
        created_by TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT crm_client_product_workflows_status_chk CHECK (status IN ('pending', 'in_progress', 'done'))
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS crm_client_product_workflows_client_idx
      ON crm_client_product_workflows(client_id, status, updated_at DESC)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS crm_client_product_workflows_assigned_idx
      ON crm_client_product_workflows(assigned_user_id, status, updated_at DESC)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS crm_client_product_workflows_salesperson_idx
      ON crm_client_product_workflows(salesperson_id, status, updated_at DESC)
    `);
  })().catch((error) => {
    ensureClientProductWorkflowSchemaPromise = null;
    throw error;
  });

  return ensureClientProductWorkflowSchemaPromise;
}

async function resolveDefaultAssignedUserIdForClient(clientId) {
  const rows = await query(`
    SELECT c.id,
           c.name,
           c.salesperson_id,
           u.id::text AS assigned_user_id
      FROM clients c
      LEFT JOIN users_auth u
        ON u.salesperson_id::text = c.salesperson_id::text
     WHERE c.id::text = $1
     LIMIT 1
  `, [String(clientId)]);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    client_id: String(row.id),
    client_name: row.name,
    salesperson_id: row.salesperson_id ? String(row.salesperson_id) : null,
    assigned_user_id: row.assigned_user_id ? String(row.assigned_user_id) : null
  };
}

// ======================================================
// Rutas de autenticación y salud
// ======================================================
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return badRequest(res, 'Usuario y contraseña son obligatorios');
  }

  try {
    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    await query(
      `UPDATE users_auth SET last_login = NOW() WHERE id = $1`,
      [user.id]
    );

    const payload = sanitizeUserPayload(user);
    const { accessToken, refreshToken } = issueTokens(payload);

    await logAudit(
      Number.isFinite(Number(payload.userId)) ? Number(payload.userId) : null,
      payload.username,
      'LOGIN',
      'auth',
      Number.isFinite(Number(payload.userId)) ? Number(payload.userId) : null,
      payload.salespersonName || payload.username,
      safeAuditDetails({
        module: 'Autenticacion',
        module_key: 'auth',
        route: '/api/login',
        method: 'POST',
        status_code: 200,
        duration_ms: 0,
        target: payload.username
      }),
      getClientIp(req)
    );

    res.json({
      token: accessToken,
      refresh_token: refreshToken,
      user: payload
    });
  } catch (error) {
    serverError(res, error, 'Error iniciando sesión');
  }
});

app.post('/api/token/refresh', async (req, res) => {
  const { refresh_token: refreshToken } = req.body || {};
  if (!refreshToken) {
    return badRequest(res, 'refresh_token es obligatorio');
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const payload = {
      userId: toDbId(decoded.userId),
      username: decoded.username,
      salespersonId: toDbId(decoded.salespersonId),
      salespersonName: decoded.salespersonName,
      role: decoded.role
    };

    const { accessToken, refreshToken: newRefreshToken } = issueTokens(payload);
    res.json({
      token: accessToken,
      refresh_token: newRefreshToken,
      user: payload
    });
  } catch (error) {
    res.status(401).json({ error: 'refresh_token inválido o expirado' });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'OK', time: new Date().toISOString() });
  } catch (error) {
    serverError(res, error);
  }
});

app.get('/api/version', (_req, res) => {
  res.json({ version: packageJson.version });
});

// Rutas de Referidos y Tarifas (DUPLICATE MOUNTS REMOVED)
// Handled at the top of the file securely


// ======================================================
// Endpoint para limpiar nombres BAN
// ======================================================
app.post('/api/admin/clean-names-ban-dev', requireRole(['admin']), async (req, res) => {
  try {
    console.log('\n🔍 Limpiando nombres/empresas BAN...');

    // 1. Contar cuántos hay
    const antes = await query(`
      SELECT 
        COUNT(*) as total_con_nombre_ban,
        COUNT(CASE WHEN name ILIKE 'Cliente BAN%' OR name ILIKE 'BAN%' THEN 1 END) as con_nombre_ban,
        COUNT(CASE WHEN business_name ILIKE 'Empresa BAN%' OR business_name ILIKE 'BAN%' THEN 1 END) as con_empresa_ban
      FROM clients
      WHERE (name ILIKE 'Cliente BAN%' OR name ILIKE 'BAN%' OR 
             business_name ILIKE 'Empresa BAN%' OR business_name ILIKE 'BAN%')
    `);

    const conteos = antes[0];
    console.log('📊 Clientes encontrados:', conteos);

    if (parseInt(conteos.total_con_nombre_ban) === 0) {
      return res.json({
        success: true,
        message: 'No hay clientes con nombre/empresa BAN para limpiar',
        antes: conteos,
        actualizados: 0
      });
    }

    // 2. Actualizar: poner business_name en NULL
    const resultado = await query(`
      UPDATE clients
      SET business_name = NULL,
          updated_at = NOW()
      WHERE business_name ILIKE 'Empresa BAN%'
      RETURNING id
    `);

    const actualizados = resultado.length || 0;
    console.log(`✅ ${actualizados} clientes actualizados`);

    // 3. Verificar
    const despues = await query(`
      SELECT COUNT(*) as total_actualizados
      FROM clients
      WHERE business_name IS NULL 
        AND (name ILIKE 'Cliente BAN%' OR name ILIKE 'BAN%')
    `);

    res.json({
      success: true,
      antes: conteos,
      actualizados: actualizados,
      despues: despues[0],
      message: `${actualizados} clientes actualizados. business_name = NULL. Ahora aparecerán en "Incompletos".`
    });
  } catch (error) {
    console.error('❌ Error limpiando nombres BAN:', error);
    serverError(res, error, 'Error limpiando nombres BAN');
  }
});

app.get('/api/salespeople', authenticateRequest, async (_req, res) => {
  try {
    await ensureSalespeopleCommissionColumn(pool);
    const salespeopleSchema = await detectSalespeopleSchema(pool);
    const rows = await query(`
      SELECT id, name, role,
             ${salespeopleSchema.hasCommissionPercentage ? 'commission_percentage' : 'NULL::numeric AS commission_percentage'}
      FROM salespeople
      ORDER BY name ASC
    `);
    res.json(rows);
  } catch (error) {
    serverError(res, error, 'Error obteniendo vendedores');
  }
});

// Middleware de autenticación aplicado arriba

app.get('/api/me', (req, res) => {
  res.json(req.user);
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/permissions/catalog', async (_req, res) => {
  try {
    res.json(getPermissionCatalogResponse());
  } catch (error) {
    serverError(res, error, 'Error obteniendo catalogo de permisos');
  }
});

app.get('/api/permissions/me', async (req, res) => {
  try {
    const resolved = await resolvePermissionsForUser(query, req.user);
    res.json(resolved);
  } catch (error) {
    serverError(res, error, 'Error obteniendo permisos del usuario actual');
  }
});

app.get('/api/permissions/users/:id', requireRole(['admin', 'supervisor']), async (req, res) => {
  const userId = String(req.params?.id || '').trim();
  if (!userId) {
    return res.status(400).json({ error: 'id es requerido' });
  }

  try {
    await ensurePermissionSchema(query);
    const rows = await query(
      `SELECT u.id::text AS id,
              u.username,
              u.salesperson_id::text AS salesperson_id,
              s.name AS salesperson_name,
              s.role AS salesperson_role
         FROM users_auth u
         LEFT JOIN salespeople s ON s.id::text = u.salesperson_id::text
        WHERE u.id::text = $1
        LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = rows[0];
    const role = String(row.salesperson_role || '').trim().toLowerCase() || (row.salesperson_id ? 'vendedor' : 'admin');
    const resolved = await resolvePermissionsForUser(query, {
      userId: row.id,
      username: row.username,
      salespersonId: row.salesperson_id,
      salespersonName: row.salesperson_name || null,
      role
    });

    res.json({
      user: {
        userId: row.id,
        username: row.username,
        salespersonId: row.salesperson_id,
        salespersonName: row.salesperson_name || null,
        role
      },
      ...resolved
    });
  } catch (error) {
    serverError(res, error, 'Error obteniendo permisos del usuario');
  }
});

app.put('/api/permissions/users/:id', requireRole(['admin', 'supervisor']), async (req, res) => {
  const userId = String(req.params?.id || '').trim();
  const items = Array.isArray(req.body?.permissions) ? req.body.permissions : [];

  if (!userId) {
    return res.status(400).json({ error: 'id es requerido' });
  }

  try {
    await ensurePermissionSchema(query);
    const rows = await query(
      `SELECT u.id::text AS id,
              u.username,
              u.salesperson_id::text AS salesperson_id,
              s.name AS salesperson_name,
              s.role AS salesperson_role
         FROM users_auth u
         LEFT JOIN salespeople s ON s.id::text = u.salesperson_id::text
        WHERE u.id::text = $1
        LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = rows[0];
    const role = String(row.salesperson_role || '').trim().toLowerCase() || (row.salesperson_id ? 'vendedor' : 'admin');
    const overrides = await saveUserPermissionOverrides(query, req.user?.userId, userId, items);
    const resolved = await resolvePermissionsForUser(query, {
      userId: row.id,
      username: row.username,
      salespersonId: row.salesperson_id,
      salespersonName: row.salesperson_name || null,
      role
    });

    res.json({
      user_id: userId,
      overrides,
      permissions: resolved.permissions
    });
  } catch (error) {
    serverError(res, error, 'Error guardando permisos del usuario');
  }
});

app.put('/api/me/password', async (req, res) => {
  const userId = req.user?.userId;
  const { current_password: currentPassword, new_password: newPassword } = req.body || {};

  if (!userId) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return badRequest(res, 'Las contraseñas son obligatorias');
  }

  if (newPassword.length < 8) {
    return badRequest(res, 'La nueva contraseña debe tener al menos 8 caracteres');
  }

  try {
    const rows = await query(`SELECT password FROM users_auth WHERE id = $1`, [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query(
      `UPDATE users_auth SET password = $1, last_login = last_login WHERE id = $2`,
      [hashedPassword, userId]
    );

    res.json({ success: true });
  } catch (error) {
    serverError(res, error, 'Error actualizando contraseña');
  }
});

// ======================================================
// Tareas independientes (lista tipo Asana / To Do)
// ======================================================

app.get('/api/tasks/columns', authenticateRequest, async (req, res) => {
  const ownerUserId = String(req.user?.userId || '').trim();
  if (!ownerUserId) {
    return res.status(401).json({ error: 'Sesion invalida' });
  }

  try {
    await ensureTasksSchema();
    const rows = await query(
      `SELECT id, column_key, label, data_type, options, sort_order, is_active, created_at, updated_at
         FROM crm_task_columns
        WHERE owner_user_id = $1
          AND is_active = TRUE
        ORDER BY sort_order ASC, id ASC`,
      [ownerUserId]
    );
    res.json(rows.map(mapTaskColumnRow));
  } catch (error) {
    serverError(res, error, 'Error obteniendo columnas de tareas');
  }
});

app.post('/api/tasks/columns', authenticateRequest, async (req, res) => {
  const ownerUserId = String(req.user?.userId || '').trim();
  if (!ownerUserId) {
    return res.status(401).json({ error: 'Sesion invalida' });
  }

  const label = String(req.body?.label || '').trim();
  const dataType = normalizeTaskColumnType(req.body?.data_type);
  const options = normalizeTaskColumnOptions(req.body?.options);

  if (!label) {
    return badRequest(res, 'El nombre de la columna es obligatorio');
  }

  try {
    await ensureTasksSchema();
    const baseKey = cleanTaskColumnKey(req.body?.column_key || label);
    if (!baseKey) {
      return badRequest(res, 'Nombre de columna invalido');
    }

    let nextKey = baseKey;
    let suffix = 1;
    // Garantiza key unico por usuario
    while (true) {
      const exists = await query(
        `SELECT 1
           FROM crm_task_columns
          WHERE owner_user_id = $1
            AND column_key = $2
          LIMIT 1`,
        [ownerUserId, nextKey]
      );
      if (exists.length === 0) break;
      suffix += 1;
      nextKey = `${baseKey}_${suffix}`;
    }

    const nextOrderRows = await query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
         FROM crm_task_columns
        WHERE owner_user_id = $1`,
      [ownerUserId]
    );
    const sortOrder = Number(nextOrderRows[0]?.next_order ?? 0);

    const rows = await query(
      `INSERT INTO crm_task_columns (owner_user_id, column_key, label, data_type, options, sort_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, TRUE, NOW(), NOW())
       RETURNING id, column_key, label, data_type, options, sort_order, is_active, created_at, updated_at`,
      [ownerUserId, nextKey, label, dataType, JSON.stringify(options), sortOrder]
    );

    res.status(201).json(mapTaskColumnRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error creando columna de tareas');
  }
});

app.put('/api/tasks/columns/:id', authenticateRequest, async (req, res) => {
  const ownerUserId = String(req.user?.userId || '').trim();
  const columnId = Number(req.params.id);
  if (!ownerUserId) {
    return res.status(401).json({ error: 'Sesion invalida' });
  }
  if (Number.isNaN(columnId)) {
    return badRequest(res, 'ID de columna invalido');
  }

  const updates = [];
  const values = [ownerUserId, columnId];
  let index = values.length + 1;

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'label')) {
    const label = String(req.body.label || '').trim();
    if (!label) return badRequest(res, 'El nombre de la columna no puede estar vacio');
    updates.push(`label = $${index++}`);
    values.push(label);
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'data_type')) {
    updates.push(`data_type = $${index++}`);
    values.push(normalizeTaskColumnType(req.body.data_type));
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'sort_order')) {
    const sortOrder = Number(req.body.sort_order);
    updates.push(`sort_order = $${index++}`);
    values.push(Number.isFinite(sortOrder) ? sortOrder : 0);
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'is_active')) {
    updates.push(`is_active = $${index++}`);
    values.push(Boolean(req.body.is_active));
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'options')) {
    updates.push(`options = $${index++}::jsonb`);
    values.push(JSON.stringify(normalizeTaskColumnOptions(req.body.options)));
  }

  if (updates.length === 0) {
    return badRequest(res, 'No hay campos para actualizar');
  }

  updates.push('updated_at = NOW()');

  try {
    await ensureTasksSchema();
    const rows = await query(
      `UPDATE crm_task_columns
          SET ${updates.join(', ')}
        WHERE owner_user_id = $1
          AND id = $2
      RETURNING id, column_key, label, data_type, options, sort_order, is_active, created_at, updated_at`,
      values
    );

    if (rows.length === 0) {
      return notFound(res, 'Columna');
    }

    res.json(mapTaskColumnRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error actualizando columna de tareas');
  }
});

app.delete('/api/tasks/columns/:id', authenticateRequest, async (req, res) => {
  const ownerUserId = String(req.user?.userId || '').trim();
  const columnId = Number(req.params.id);
  if (!ownerUserId) {
    return res.status(401).json({ error: 'Sesion invalida' });
  }
  if (Number.isNaN(columnId)) {
    return badRequest(res, 'ID de columna invalido');
  }

  try {
    await ensureTasksSchema();
    const rows = await query(
      `DELETE FROM crm_task_columns
        WHERE owner_user_id = $1
          AND id = $2
      RETURNING column_key`,
      [ownerUserId, columnId]
    );

    if (rows.length === 0) {
      return notFound(res, 'Columna');
    }

    const columnKey = rows[0].column_key;
    await query(
      `UPDATE crm_tasks
          SET custom_fields = custom_fields - $2,
              updated_at = NOW()
        WHERE owner_user_id = $1`,
      [ownerUserId, columnKey]
    );

    res.json({ success: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando columna de tareas');
  }
});

app.get('/api/tasks', authenticateRequest, async (req, res) => {
  const currentUserId = String(req.user?.userId || '').trim();
  if (!currentUserId) {
    return res.status(401).json({ error: 'Sesion invalida' });
  }

  try {
    await ensureTasksSchema();
    const role = String(req.user?.role || '').toLowerCase();
    const isPrivileged = role === 'admin' || role === 'supervisor';
    const conditions = [];
    const params = [];

    if (!isPrivileged) {
      params.push(currentUserId);
      conditions.push(`(t.owner_user_id = $${params.length} OR t.assigned_user_id = $${params.length})`);
    }

    const rawStatus = typeof req.query?.status === 'string' ? req.query.status.trim().toLowerCase() : '';
    if (TASK_STATUSES.has(rawStatus)) {
      conditions.push(`t.status = $${params.length + 1}`);
      params.push(rawStatus);
    }

    const assignedTo = String(req.query?.assigned_to || '').trim();
    if (isPrivileged && assignedTo && assignedTo.toLowerCase() !== 'all') {
      conditions.push(`t.assigned_user_id = $${params.length + 1}`);
      params.push(String(toDbId(assignedTo)));
    }

    const q = String(req.query?.q || '').trim();
    if (q) {
      conditions.push(`(
        t.title ILIKE $${params.length + 1}
        OR COALESCE(t.client_name, '') ILIKE $${params.length + 1}
        OR COALESCE(t.notes, '') ILIKE $${params.length + 1}
      )`);
      params.push(`%${q}%`);
    }

    const clientId = req.query?.client_id;
    if (clientId !== undefined && clientId !== null && String(clientId).trim() !== '') {
      conditions.push(`t.client_id::text = $${params.length + 1}`);
      params.push(String(clientId).trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query(
      `SELECT t.id, t.owner_user_id, t.assigned_user_id, u.username AS assigned_username, sp.name AS assigned_name,
              t.title, t.due_date, t.follow_up_date, t.follow_up_time, t.client_id, t.client_name, t.notes, t.status, t.priority,
              t.task_kind, t.client_task_workflow, t.workflow_steps, t.custom_fields,
              t.completed_at, t.created_at, t.updated_at
         FROM crm_tasks t
         LEFT JOIN users_auth u ON u.id::text = t.assigned_user_id::text
         LEFT JOIN salespeople sp ON sp.id::text = u.salesperson_id::text
        ${whereClause}
        ORDER BY
          CASE t.status WHEN 'done' THEN 2 WHEN 'in_progress' THEN 1 ELSE 0 END,
          t.due_date ASC NULLS LAST,
          t.created_at DESC`,
      params
    );

    res.json(rows.map(mapTaskRow));
  } catch (error) {
    serverError(res, error, 'Error obteniendo tareas');
  }
});

app.get('/api/tasks/assignees', authenticateRequest, async (req, res) => {
  const currentUserId = String(req.user?.userId || '').trim();
  if (!currentUserId) {
    return res.status(401).json({ error: 'Sesion invalida' });
  }

  try {
    await ensureTasksSchema();
    const role = String(req.user?.role || '').toLowerCase();
    const isPrivileged = role === 'admin' || role === 'supervisor';
    const rows = await query(
      `SELECT u.id::text AS user_id, u.username, COALESCE(s.name, u.username) AS display_name, COALESCE(s.role, 'vendedor') AS role
         FROM users_auth u
         LEFT JOIN salespeople s ON s.id::text = u.salesperson_id::text
        ${isPrivileged ? '' : 'WHERE u.id::text = $1'}
        ORDER BY COALESCE(s.name, u.username) ASC`,
      isPrivileged ? [] : [currentUserId]
    );
    res.json(rows.map((row) => ({
      user_id: String(row.user_id),
      username: row.username,
      display_name: row.display_name,
      role: String(row.role || 'vendedor').toLowerCase()
    })));
  } catch (error) {
    serverError(res, error, 'Error obteniendo asignables');
  }
});

app.post('/api/tasks', authenticateRequest, async (req, res) => {
  const ownerUserId = String(req.user?.userId || '').trim();
  if (!ownerUserId) {
    return res.status(401).json({ error: 'Sesion invalida' });
  }

  const title = String(req.body?.title || '').trim();
  if (!title) {
    return badRequest(res, 'El titulo de la tarea es obligatorio');
  }

  const dueDate = normalizeTaskDate(req.body?.due_date);
  const followUpDate = normalizeTaskDate(req.body?.follow_up_date);
  const followUpTime = normalizeTaskTime(req.body?.follow_up_time);
  const clientName = String(req.body?.client_name || '').trim() || null;
  const notes = String(req.body?.notes || '').trim() || null;
  const priority = normalizeTaskPriority(req.body?.priority);
  const customFields = normalizeTaskCustomFields(req.body?.custom_fields);
  const role = String(req.user?.role || '').toLowerCase();
  const isPrivileged = role === 'admin' || role === 'supervisor';

  let clientId = null;
  if (req.body?.client_id !== null && req.body?.client_id !== undefined && req.body?.client_id !== '') {
    clientId = req.body.client_id; // Leave it as a string/number (UUID/bigint compatible)
  }

  const taskKind = normalizeTaskKind(req.body?.task_kind, {
    clientTaskWorkflow: req.body?.client_task_workflow,
    workflowSteps: req.body?.workflow_steps,
    notes
  });
  const clientTaskWorkflow = taskKind === 'client'
    ? normalizeClientTaskWorkflow(req.body?.client_task_workflow)
    : null;
  const workflowSteps = taskKind === 'client'
    ? normalizeTaskWorkflowSteps(req.body?.workflow_steps)
    : [];
  const status = resolveTaskStatusForWorkflow(taskKind, workflowSteps, req.body?.status);

  if (taskKind === 'client' && (clientId === null || clientName === null)) {
    return badRequest(res, 'Las tareas de cliente requieren un cliente valido');
  }

  let assignedUserId = ownerUserId;
  if (req.body?.assigned_user_id !== null && req.body?.assigned_user_id !== undefined && req.body?.assigned_user_id !== '') {
    assignedUserId = String(toDbId(req.body.assigned_user_id));
  }
  if (!isPrivileged && !sameId(assignedUserId, ownerUserId)) {
    return res.status(403).json({ error: 'No tienes permisos para asignar tareas a otros usuarios' });
  }

  try {
    await ensureTasksSchema();
    const assigneeCheck = await query(`SELECT id::text AS id FROM users_auth WHERE id::text = $1`, [assignedUserId]);
    if (assigneeCheck.length === 0) {
      return badRequest(res, 'Usuario asignado no existe');
    }

    const rows = await query(
      `INSERT INTO crm_tasks (
         owner_user_id, assigned_user_id, title, due_date, follow_up_date, follow_up_time,
         client_id, client_name, notes, status, priority, task_kind, client_task_workflow, workflow_steps, custom_fields,
         completed_at, created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb,
         CASE WHEN $10 = 'done' THEN NOW() ELSE NULL END, NOW(), NOW()
       )
       RETURNING id, owner_user_id, assigned_user_id, title, due_date, follow_up_date, follow_up_time, client_id, client_name, notes, status, priority,
                 task_kind, client_task_workflow, workflow_steps, custom_fields, completed_at, created_at, updated_at`,
      [
        ownerUserId,
        assignedUserId,
        title,
        dueDate,
        followUpDate,
        followUpTime,
        clientId,
        clientName,
        notes,
        status,
        priority,
        taskKind,
        clientTaskWorkflow,
        JSON.stringify(workflowSteps),
        JSON.stringify(customFields)
      ]
    );

    res.status(201).json(mapTaskRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error creando tarea');
  }
});

app.put('/api/tasks/:id', authenticateRequest, async (req, res) => {
  const currentUserId = String(req.user?.userId || '').trim();
  const taskId = Number(req.params.id);
  if (!currentUserId) {
    return res.status(401).json({ error: 'Sesion invalida' });
  }
  if (Number.isNaN(taskId)) {
    return badRequest(res, 'ID de tarea invalido');
  }
  const role = String(req.user?.role || '').toLowerCase();
  const isPrivileged = role === 'admin' || role === 'supervisor';

  try {
    await ensureTasksSchema();
    const currentRows = await query(
      `SELECT id, owner_user_id, assigned_user_id, client_id, client_name, notes, status, task_kind, client_task_workflow, workflow_steps
         FROM crm_tasks
        WHERE id = $1
          ${isPrivileged ? '' : 'AND (owner_user_id = $2 OR assigned_user_id = $2)'}`,
      isPrivileged ? [taskId] : [taskId, currentUserId]
    );

    if (currentRows.length === 0) {
      return notFound(res, 'Tarea');
    }

    const currentTask = currentRows[0];
    const updates = [];
    const values = [];
    let index = 1;
    let normalizedStatus = null;

    const nextClientId = Object.prototype.hasOwnProperty.call(req.body || {}, 'client_id')
      ? ((req.body.client_id === null || req.body.client_id === '') ? null : req.body.client_id)
      : currentTask.client_id;
    const nextTaskKind = Object.prototype.hasOwnProperty.call(req.body || {}, 'task_kind')
      ? normalizeTaskKind(req.body.task_kind, {
        clientTaskWorkflow: Object.prototype.hasOwnProperty.call(req.body || {}, 'client_task_workflow')
          ? req.body.client_task_workflow
          : currentTask.client_task_workflow,
        workflowSteps: Object.prototype.hasOwnProperty.call(req.body || {}, 'workflow_steps')
          ? req.body.workflow_steps
          : currentTask.workflow_steps,
        notes: Object.prototype.hasOwnProperty.call(req.body || {}, 'notes')
          ? req.body.notes
          : currentTask.notes
      })
      : normalizeTaskKind(currentTask.task_kind, {
        clientTaskWorkflow: currentTask.client_task_workflow,
        workflowSteps: currentTask.workflow_steps,
        notes: currentTask.notes
      });
    const nextClientName = Object.prototype.hasOwnProperty.call(req.body || {}, 'client_name')
      ? (String(req.body.client_name || '').trim() || null)
      : currentTask.client_name;
    const nextWorkflowType = Object.prototype.hasOwnProperty.call(req.body || {}, 'client_task_workflow')
      ? (nextTaskKind === 'client' ? normalizeClientTaskWorkflow(req.body.client_task_workflow) : null)
      : (nextTaskKind === 'client' ? normalizeClientTaskWorkflow(currentTask.client_task_workflow) : null);
    const nextWorkflowSteps = Object.prototype.hasOwnProperty.call(req.body || {}, 'workflow_steps')
      ? (nextTaskKind === 'client' ? normalizeTaskWorkflowSteps(req.body.workflow_steps) : [])
      : (nextTaskKind === 'client' ? normalizeTaskWorkflowSteps(currentTask.workflow_steps) : []);
    const requestedStatus = Object.prototype.hasOwnProperty.call(req.body || {}, 'status')
      ? req.body.status
      : currentTask.status;
    const effectiveStatus = resolveTaskStatusForWorkflow(nextTaskKind, nextWorkflowSteps, requestedStatus);

    if (nextTaskKind === 'client' && (nextClientId === null || nextClientName === null)) {
      return badRequest(res, 'Las tareas de cliente requieren un cliente valido');
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'title')) {
      const title = String(req.body.title || '').trim();
      if (!title) return badRequest(res, 'El titulo no puede estar vacio');
      updates.push(`title = $${index++}`);
      values.push(title);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'due_date')) {
      updates.push(`due_date = $${index++}`);
      values.push(normalizeTaskDate(req.body.due_date));
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'follow_up_date')) {
      updates.push(`follow_up_date = $${index++}`);
      values.push(normalizeTaskDate(req.body.follow_up_date));
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'follow_up_time')) {
      updates.push(`follow_up_time = $${index++}`);
      values.push(normalizeTaskTime(req.body.follow_up_time));
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'client_name')) {
      updates.push(`client_name = $${index++}`);
      values.push(nextClientName);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'client_id')) {
      updates.push(`client_id = $${index++}`);
      values.push(nextClientId);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'assigned_user_id')) {
      let assignedUserId = null;
      if (req.body.assigned_user_id !== null && req.body.assigned_user_id !== undefined && req.body.assigned_user_id !== '') {
        assignedUserId = String(toDbId(req.body.assigned_user_id));
      }

      if (!isPrivileged && assignedUserId && !sameId(assignedUserId, currentUserId)) {
        return res.status(403).json({ error: 'No tienes permisos para asignar tareas a otros usuarios' });
      }

      updates.push(`assigned_user_id = $${index++}`);
      values.push(assignedUserId || currentUserId);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'notes')) {
      const notes = String(req.body.notes || '').trim();
      updates.push(`notes = $${index++}`);
      values.push(notes || null);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'status')) {
      normalizedStatus = effectiveStatus;
      updates.push(`status = $${index++}`);
      values.push(normalizedStatus);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'priority')) {
      updates.push(`priority = $${index++}`);
      values.push(normalizeTaskPriority(req.body.priority));
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'task_kind')) {
      updates.push(`task_kind = $${index++}`);
      values.push(nextTaskKind);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'client_task_workflow')) {
      updates.push(`client_task_workflow = $${index++}`);
      values.push(nextWorkflowType);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'workflow_steps')) {
      updates.push(`workflow_steps = $${index++}::jsonb`);
      values.push(JSON.stringify(nextWorkflowSteps));
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'custom_fields')) {
      updates.push(`custom_fields = $${index++}::jsonb`);
      values.push(JSON.stringify(normalizeTaskCustomFields(req.body.custom_fields)));
    }

    if (
      !Object.prototype.hasOwnProperty.call(req.body || {}, 'status')
      && (
        Object.prototype.hasOwnProperty.call(req.body || {}, 'workflow_steps')
        || Object.prototype.hasOwnProperty.call(req.body || {}, 'task_kind')
      )
    ) {
      normalizedStatus = effectiveStatus;
      updates.push(`status = $${index++}`);
      values.push(normalizedStatus);
    }

    if (updates.length === 0) {
      return badRequest(res, 'No hay campos para actualizar');
    }

    if (normalizedStatus === 'done') {
      updates.push(`completed_at = COALESCE(completed_at, NOW())`);
    } else if (normalizedStatus) {
      updates.push(`completed_at = NULL`);
    }

    updates.push('updated_at = NOW()');

    const whereParts = ['id = $' + index];
    values.push(taskId);
    index += 1;
    if (!isPrivileged) {
      whereParts.push('(owner_user_id = $' + index + ' OR assigned_user_id = $' + index + ')');
      values.push(currentUserId);
      index += 1;
    }

    const rows = await query(
      `UPDATE crm_tasks
          SET ${updates.join(', ')}
        WHERE ${whereParts.join(' AND ')}
      RETURNING id, owner_user_id, assigned_user_id, title, due_date, follow_up_date, follow_up_time, client_id, client_name, notes, status, priority,
                task_kind, client_task_workflow, workflow_steps, custom_fields, completed_at, created_at, updated_at`,
      values
    );

    if (rows.length === 0) {
      return notFound(res, 'Tarea');
    }

    res.json(mapTaskRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error actualizando tarea');
  }
});

app.delete('/api/tasks/:id', authenticateRequest, async (req, res) => {
  const currentUserId = String(req.user?.userId || '').trim();
  const taskId = Number(req.params.id);
  if (!currentUserId) {
    return res.status(401).json({ error: 'Sesion invalida' });
  }
  if (Number.isNaN(taskId)) {
    return badRequest(res, 'ID de tarea invalido');
  }

  try {
    await ensureTasksSchema();
    const role = String(req.user?.role || '').toLowerCase();
    const isPrivileged = role === 'admin' || role === 'supervisor';
    const rows = await query(
      `DELETE FROM crm_tasks
        WHERE id = $1
          ${isPrivileged ? '' : 'AND owner_user_id = $2'}
      RETURNING id`,
      isPrivileged ? [taskId] : [taskId, currentUserId]
    );

    if (rows.length === 0) {
      return notFound(res, 'Tarea');
    }

    res.json({ success: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando tarea');
  }
});

app.get('/api/task-product-templates', authenticateRequest, async (req, res) => {
  try {
    await ensureClientProductWorkflowSchema();
    const role = String(req.user?.role || '').toLowerCase();
    const includeInactive = (role === 'admin' || role === 'supervisor') && String(req.query.include_inactive || '').trim() === '1';
    const rows = await query(
      `SELECT id, product_key, product_name, steps, is_active, created_by, updated_by, created_at, updated_at
         FROM crm_product_task_templates
        ${includeInactive ? '' : 'WHERE is_active = TRUE'}
        ORDER BY LOWER(product_name) ASC`,
      []
    );
    res.json(rows.map(mapProductTemplateRow));
  } catch (error) {
    serverError(res, error, 'Error obteniendo plantillas de producto');
  }
});

app.post('/api/task-product-templates', authenticateRequest, requireRole(['admin', 'supervisor']), async (req, res) => {
  const currentUserId = String(req.user?.userId || '').trim() || null;
  const productName = String(req.body?.product_name || '').trim();
  const productKey = cleanProductTemplateKey(req.body?.product_key || productName);
  const steps = normalizeProductTaskSteps(req.body?.steps);

  if (!productName) {
    return badRequest(res, 'El nombre del producto es obligatorio');
  }
  if (!productKey) {
    return badRequest(res, 'La clave del producto es invalida');
  }
  if (steps.length === 0) {
    return badRequest(res, 'El producto debe tener al menos un paso');
  }

  try {
    await ensureClientProductWorkflowSchema();
    const exists = await query(`SELECT id FROM crm_product_task_templates WHERE product_key = $1`, [productKey]);
    if (exists.length > 0) {
      return badRequest(res, 'Ya existe una plantilla para ese producto');
    }

    const rows = await query(
      `INSERT INTO crm_product_task_templates (
         product_key, product_name, steps, is_active, created_by, updated_by, created_at, updated_at
       )
       VALUES ($1, $2, $3::jsonb, TRUE, $4, $4, NOW(), NOW())
       RETURNING id, product_key, product_name, steps, is_active, created_by, updated_by, created_at, updated_at`,
      [productKey, productName, JSON.stringify(steps), currentUserId]
    );

    res.status(201).json(mapProductTemplateRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error creando plantilla de producto');
  }
});

app.put('/api/task-product-templates/:id', authenticateRequest, requireRole(['admin', 'supervisor']), async (req, res) => {
  const templateId = Number(req.params.id);
  const currentUserId = String(req.user?.userId || '').trim() || null;

  if (Number.isNaN(templateId)) {
    return badRequest(res, 'ID invalido');
  }

  try {
    await ensureClientProductWorkflowSchema();
    const currentRows = await query(`SELECT * FROM crm_product_task_templates WHERE id = $1`, [templateId]);
    if (currentRows.length === 0) {
      return notFound(res, 'Plantilla');
    }

    const currentTemplate = currentRows[0];
    const nextProductName = Object.prototype.hasOwnProperty.call(req.body || {}, 'product_name')
      ? String(req.body.product_name || '').trim()
      : String(currentTemplate.product_name || '').trim();
    const nextProductKey = cleanProductTemplateKey(
      Object.prototype.hasOwnProperty.call(req.body || {}, 'product_key')
        ? req.body.product_key
        : (currentTemplate.product_key || nextProductName)
    );
    const nextSteps = Object.prototype.hasOwnProperty.call(req.body || {}, 'steps')
      ? normalizeProductTaskSteps(req.body.steps)
      : normalizeProductTaskSteps(currentTemplate.steps);
    const nextIsActive = Object.prototype.hasOwnProperty.call(req.body || {}, 'is_active')
      ? Boolean(req.body.is_active)
      : Boolean(currentTemplate.is_active);

    if (!nextProductName) {
      return badRequest(res, 'El nombre del producto es obligatorio');
    }
    if (!nextProductKey) {
      return badRequest(res, 'La clave del producto es invalida');
    }
    if (nextSteps.length === 0) {
      return badRequest(res, 'El producto debe tener al menos un paso');
    }

    const duplicated = await query(
      `SELECT id
         FROM crm_product_task_templates
        WHERE product_key = $1
          AND id <> $2`,
      [nextProductKey, templateId]
    );
    if (duplicated.length > 0) {
      return badRequest(res, 'Ya existe otra plantilla con esa clave de producto');
    }

    const rows = await query(
      `UPDATE crm_product_task_templates
          SET product_key = $1,
              product_name = $2,
              steps = $3::jsonb,
              is_active = $4,
              updated_by = $5,
              updated_at = NOW()
        WHERE id = $6
      RETURNING id, product_key, product_name, steps, is_active, created_by, updated_by, created_at, updated_at`,
      [nextProductKey, nextProductName, JSON.stringify(nextSteps), nextIsActive, currentUserId, templateId]
    );

    res.json(mapProductTemplateRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error actualizando plantilla de producto');
  }
});

app.delete('/api/task-product-templates/:id', authenticateRequest, requireRole(['admin', 'supervisor']), async (req, res) => {
  const templateId = Number(req.params.id);
  if (Number.isNaN(templateId)) {
    return badRequest(res, 'ID invalido');
  }

  try {
    await ensureClientProductWorkflowSchema();
    const rows = await query(
      `DELETE FROM crm_product_task_templates
        WHERE id = $1
      RETURNING id`,
      [templateId]
    );

    if (rows.length === 0) {
      return notFound(res, 'Plantilla');
    }

    res.json({ ok: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando plantilla de producto');
  }
});

app.get('/api/clients/:id/product-workflows', authenticateRequest, async (req, res) => {
  const clientId = String(req.params.id || '').trim();
  if (!clientId) {
    return badRequest(res, 'client_id es obligatorio');
  }

  try {
    await ensureClientProductWorkflowSchema();
    const role = String(req.user?.role || '').toLowerCase();
    const isVendor = role === 'vendedor';
    const salespersonId = String(req.user?.salespersonId || '').trim();
    const clientRows = await query(
      `SELECT c.id, c.name, c.salesperson_id, sp.name AS salesperson_name
         FROM clients c
         LEFT JOIN salespeople sp ON sp.id::text = c.salesperson_id::text
        WHERE c.id::text = $1
          ${isVendor && salespersonId ? 'AND (c.salesperson_id::text = $2 OR c.salesperson_id IS NULL)' : ''}`,
      isVendor && salespersonId ? [clientId, salespersonId] : [clientId]
    );

    if (clientRows.length === 0) {
      return notFound(res, 'Cliente');
    }

    const workflowRows = await query(
      `SELECT w.*,
              ua.username AS assigned_username,
              COALESCE(sa.name, ua.username) AS assigned_name
         FROM crm_client_product_workflows w
         LEFT JOIN users_auth ua ON ua.id::text = w.assigned_user_id::text
         LEFT JOIN salespeople sa ON sa.id::text = ua.salesperson_id::text
        WHERE w.client_id::text = $1
        ORDER BY
          CASE w.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
          w.updated_at DESC,
          w.created_at DESC`,
      [clientId]
    );

    const clientMeta = await resolveDefaultAssignedUserIdForClient(clientId);

    res.json({
      client: {
        id: String(clientRows[0].id),
        name: clientRows[0].name,
        salesperson_id: clientRows[0].salesperson_id ? String(clientRows[0].salesperson_id) : null,
        salesperson_name: clientRows[0].salesperson_name || null,
        default_assigned_user_id: clientMeta?.assigned_user_id || null
      },
      workflows: workflowRows.map((row) => mapClientProductWorkflowRow({
        ...row,
        client_name: row.client_name || clientRows[0].name,
        salesperson_id: row.salesperson_id || clientRows[0].salesperson_id,
        salesperson_name: clientRows[0].salesperson_name || null
      }))
    });
  } catch (error) {
    serverError(res, error, 'Error obteniendo workflows del cliente');
  }
});

app.get('/api/client-product-workflows', authenticateRequest, async (req, res) => {
  try {
    await ensureClientProductWorkflowSchema();
    const role = String(req.user?.role || '').toLowerCase();
    const isVendor = role === 'vendedor';
    const salespersonId = String(req.user?.salespersonId || '').trim();
    const currentUserId = String(req.user?.userId || '').trim();
    const params = [];
    const conditions = [];

    const pendingOnly = String(req.query.pending_only || '').trim() === '1';
    if (pendingOnly) {
      conditions.push(`w.status <> 'done'`);
    }

    const status = String(req.query.status || '').trim().toLowerCase();
    if (TASK_STATUSES.has(status)) {
      conditions.push(`w.status = $${params.length + 1}`);
      params.push(status);
    }

    const clientId = String(req.query.client_id || '').trim();
    if (clientId) {
      conditions.push(`w.client_id::text = $${params.length + 1}`);
      params.push(clientId);
    }

    const assignedUserId = String(req.query.assigned_user_id || '').trim();
    if (assignedUserId) {
      conditions.push(`w.assigned_user_id::text = $${params.length + 1}`);
      params.push(assignedUserId);
    }

    const q = String(req.query.q || '').trim();
    if (q) {
      conditions.push(`(
        w.client_name ILIKE $${params.length + 1}
        OR w.product_name ILIKE $${params.length + 1}
        OR COALESCE(w.source_label, '') ILIKE $${params.length + 1}
        OR COALESCE(w.ban_number, '') ILIKE $${params.length + 1}
        OR COALESCE(w.phone, '') ILIKE $${params.length + 1}
      )`);
      params.push(`%${q}%`);
    }

    if (isVendor && (salespersonId || currentUserId)) {
      const vendorChecks = [];
      if (salespersonId) {
        vendorChecks.push(`c.salesperson_id::text = $${params.length + 1}`);
        params.push(salespersonId);
      }
      if (currentUserId) {
        vendorChecks.push(`w.assigned_user_id::text = $${params.length + 1}`);
        params.push(currentUserId);
      }
      if (vendorChecks.length > 0) {
        conditions.push(`(${vendorChecks.join(' OR ')})`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query(
      `SELECT w.*,
              c.salesperson_id,
              sp.name AS salesperson_name,
              ua.username AS assigned_username,
              COALESCE(sa.name, ua.username) AS assigned_name
         FROM crm_client_product_workflows w
         LEFT JOIN clients c ON c.id::text = w.client_id::text
         LEFT JOIN salespeople sp ON sp.id::text = c.salesperson_id::text
         LEFT JOIN users_auth ua ON ua.id::text = w.assigned_user_id::text
         LEFT JOIN salespeople sa ON sa.id::text = ua.salesperson_id::text
         ${whereClause}
        ORDER BY
          CASE w.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
          w.updated_at DESC,
          w.created_at DESC`,
      params
    );

    res.json(rows.map(mapClientProductWorkflowRow));
  } catch (error) {
    serverError(res, error, 'Error obteniendo workflows');
  }
});

app.post('/api/clients/:id/product-workflows', authenticateRequest, async (req, res) => {
  const clientId = String(req.params.id || '').trim();
  const currentUserId = String(req.user?.userId || '').trim();
  const role = String(req.user?.role || '').toLowerCase();
  const isPrivileged = role === 'admin' || role === 'supervisor';

  if (!clientId) {
    return badRequest(res, 'client_id es obligatorio');
  }
  if (!currentUserId) {
    return res.status(401).json({ error: 'Sesion invalida' });
  }

  try {
    await ensureClientProductWorkflowSchema();
    const clientMeta = await resolveDefaultAssignedUserIdForClient(clientId);
    if (!clientMeta) {
      return notFound(res, 'Cliente');
    }

    let productKey = cleanProductTemplateKey(req.body?.product_key);
    let productName = String(req.body?.product_name || '').trim();
    let workflowSteps = normalizeProductTaskSteps(req.body?.workflow_steps);

    if (productKey) {
      const templateRows = await query(
        `SELECT product_key, product_name, steps
           FROM crm_product_task_templates
          WHERE product_key = $1
          LIMIT 1`,
        [productKey]
      );
      if (templateRows.length > 0) {
        productKey = templateRows[0].product_key;
        productName = productName || templateRows[0].product_name;
        if (workflowSteps.length === 0) {
          workflowSteps = normalizeProductTaskSteps(templateRows[0].steps);
        }
      }
    }

    if (!productName) {
      return badRequest(res, 'El producto es obligatorio');
    }
    if (!productKey) {
      productKey = cleanProductTemplateKey(productName);
    }
    if (workflowSteps.length === 0) {
      return badRequest(res, 'El producto seleccionado no tiene pasos configurados');
    }

    let assignedUserId = null;
    if (req.body?.assigned_user_id !== null && req.body?.assigned_user_id !== undefined && req.body?.assigned_user_id !== '') {
      assignedUserId = String(toDbId(req.body.assigned_user_id));
    } else {
      assignedUserId = clientMeta.assigned_user_id || currentUserId;
    }

    if (!isPrivileged && assignedUserId && !sameId(assignedUserId, currentUserId)) {
      return res.status(403).json({ error: 'No tienes permisos para asignar este workflow a otro usuario' });
    }

    const sourceType = normalizeClientProductSourceType(req.body?.source_type);
    const sourceRef = req.body?.source_ref === null || req.body?.source_ref === undefined || req.body?.source_ref === ''
      ? null
      : String(req.body.source_ref);
    const sourceLabel = String(req.body?.source_label || '').trim() || null;
    const subscriberId = req.body?.subscriber_id === null || req.body?.subscriber_id === undefined || req.body?.subscriber_id === ''
      ? null
      : String(req.body.subscriber_id);
    const banNumber = String(req.body?.ban_number || '').trim() || null;
    const phone = String(req.body?.phone || '').trim() || null;
    const lineType = String(req.body?.line_type || '').trim() || null;
    const saleType = String(req.body?.sale_type || '').trim() || null;
    const notes = String(req.body?.notes || '').trim() || null;
    const monthlyValue = req.body?.monthly_value === null || req.body?.monthly_value === undefined || req.body?.monthly_value === ''
      ? null
      : Number(req.body.monthly_value);
    const status = resolveClientProductWorkflowStatus(workflowSteps, req.body?.status);

    const insertedRows = await query(
      `INSERT INTO crm_client_product_workflows (
         client_id, client_name, salesperson_id, assigned_user_id, product_key, product_name,
         source_type, source_ref, source_label, subscriber_id, ban_number, phone, line_type, sale_type,
         monthly_value, notes, workflow_steps, status, completed_at, created_by, created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12, $13, $14,
         $15, $16, $17::jsonb, $18,
         CASE WHEN $18 = 'done' THEN NOW() ELSE NULL END,
         $19, NOW(), NOW()
       )
       RETURNING id`,
      [
        clientMeta.client_id,
        clientMeta.client_name,
        clientMeta.salesperson_id,
        assignedUserId,
        productKey,
        productName,
        sourceType,
        sourceRef,
        sourceLabel,
        subscriberId,
        banNumber,
        phone,
        lineType,
        saleType,
        Number.isFinite(monthlyValue) ? monthlyValue : null,
        notes,
        JSON.stringify(workflowSteps),
        status,
        currentUserId
      ]
    );

    const rows = await query(
      `SELECT w.*,
              ua.username AS assigned_username,
              COALESCE(sa.name, ua.username) AS assigned_name
         FROM crm_client_product_workflows w
         LEFT JOIN users_auth ua ON ua.id::text = w.assigned_user_id::text
         LEFT JOIN salespeople sa ON sa.id::text = ua.salesperson_id::text
        WHERE w.id = $1`,
      [insertedRows[0].id]
    );

    res.status(201).json(mapClientProductWorkflowRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error creando workflow del cliente');
  }
});

app.put('/api/client-product-workflows/:id', authenticateRequest, async (req, res) => {
  const workflowId = Number(req.params.id);
  const currentUserId = String(req.user?.userId || '').trim();
  const role = String(req.user?.role || '').toLowerCase();
  const isPrivileged = role === 'admin' || role === 'supervisor';
  const salespersonId = String(req.user?.salespersonId || '').trim();

  if (!currentUserId) {
    return res.status(401).json({ error: 'Sesion invalida' });
  }
  if (Number.isNaN(workflowId)) {
    return badRequest(res, 'ID invalido');
  }

  try {
    await ensureClientProductWorkflowSchema();
    const currentRows = await query(
      `SELECT w.*, c.salesperson_id AS client_salesperson_id
         FROM crm_client_product_workflows w
         LEFT JOIN clients c ON c.id::text = w.client_id::text
        WHERE w.id = $1`,
      [workflowId]
    );
    if (currentRows.length === 0) {
      return notFound(res, 'Workflow');
    }

    const currentWorkflow = currentRows[0];
    if (!isPrivileged) {
      const canAccess =
        sameId(currentWorkflow.assigned_user_id, currentUserId) ||
        sameId(currentWorkflow.created_by, currentUserId) ||
        (salespersonId && sameId(currentWorkflow.client_salesperson_id, salespersonId));
      if (!canAccess) {
        return res.status(403).json({ error: 'No tienes permisos para editar este workflow' });
      }
    }

    const updates = [];
    const values = [];
    let index = 1;
    const nextSteps = Object.prototype.hasOwnProperty.call(req.body || {}, 'workflow_steps')
      ? normalizeProductTaskSteps(req.body.workflow_steps)
      : normalizeProductTaskSteps(currentWorkflow.workflow_steps);

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'product_name')) {
      updates.push(`product_name = $${index++}`);
      values.push(String(req.body.product_name || '').trim() || currentWorkflow.product_name);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'product_key')) {
      updates.push(`product_key = $${index++}`);
      values.push(cleanProductTemplateKey(req.body.product_key || currentWorkflow.product_key));
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'source_type')) {
      updates.push(`source_type = $${index++}`);
      values.push(normalizeClientProductSourceType(req.body.source_type));
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'source_ref')) {
      updates.push(`source_ref = $${index++}`);
      values.push(req.body.source_ref === null || req.body.source_ref === '' ? null : String(req.body.source_ref));
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'source_label')) {
      updates.push(`source_label = $${index++}`);
      values.push(String(req.body.source_label || '').trim() || null);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'subscriber_id')) {
      updates.push(`subscriber_id = $${index++}`);
      values.push(req.body.subscriber_id === null || req.body.subscriber_id === '' ? null : String(req.body.subscriber_id));
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'ban_number')) {
      updates.push(`ban_number = $${index++}`);
      values.push(String(req.body.ban_number || '').trim() || null);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'phone')) {
      updates.push(`phone = $${index++}`);
      values.push(String(req.body.phone || '').trim() || null);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'line_type')) {
      updates.push(`line_type = $${index++}`);
      values.push(String(req.body.line_type || '').trim() || null);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'sale_type')) {
      updates.push(`sale_type = $${index++}`);
      values.push(String(req.body.sale_type || '').trim() || null);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'monthly_value')) {
      const numericValue = req.body.monthly_value === null || req.body.monthly_value === '' ? null : Number(req.body.monthly_value);
      updates.push(`monthly_value = $${index++}`);
      values.push(Number.isFinite(numericValue) ? numericValue : null);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'notes')) {
      updates.push(`notes = $${index++}`);
      values.push(String(req.body.notes || '').trim() || null);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'assigned_user_id')) {
      const requestedAssigned = req.body.assigned_user_id === null || req.body.assigned_user_id === ''
        ? null
        : String(toDbId(req.body.assigned_user_id));
      if (!isPrivileged && requestedAssigned && !sameId(requestedAssigned, currentUserId)) {
        return res.status(403).json({ error: 'No tienes permisos para reasignar este workflow' });
      }
      updates.push(`assigned_user_id = $${index++}`);
      values.push(requestedAssigned);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'workflow_steps')) {
      if (nextSteps.length === 0) {
        return badRequest(res, 'El workflow debe conservar al menos un paso');
      }
      updates.push(`workflow_steps = $${index++}::jsonb`);
      values.push(JSON.stringify(nextSteps));
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, 'workflow_steps') ||
      Object.prototype.hasOwnProperty.call(req.body || {}, 'status')
    ) {
      const nextStatus = resolveClientProductWorkflowStatus(
        nextSteps,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'status') ? req.body.status : currentWorkflow.status
      );
      updates.push(`status = $${index++}`);
      values.push(nextStatus);
      updates.push(nextStatus === 'done' ? `completed_at = COALESCE(completed_at, NOW())` : `completed_at = NULL`);
    }

    if (updates.length === 0) {
      return badRequest(res, 'No hay cambios para guardar');
    }

    updates.push(`updated_at = NOW()`);
    values.push(workflowId);

    await query(
      `UPDATE crm_client_product_workflows
          SET ${updates.join(', ')}
        WHERE id = $${index}`,
      values
    );

    const rows = await query(
      `SELECT w.*,
              ua.username AS assigned_username,
              COALESCE(sa.name, ua.username) AS assigned_name
         FROM crm_client_product_workflows w
         LEFT JOIN users_auth ua ON ua.id::text = w.assigned_user_id::text
         LEFT JOIN salespeople sa ON sa.id::text = ua.salesperson_id::text
        WHERE w.id = $1`,
      [workflowId]
    );

    res.json(mapClientProductWorkflowRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error actualizando workflow');
  }
});

app.delete('/api/client-product-workflows/:id', authenticateRequest, async (req, res) => {
  const workflowId = Number(req.params.id);
  const currentUserId = String(req.user?.userId || '').trim();
  const role = String(req.user?.role || '').toLowerCase();
  const isPrivileged = role === 'admin' || role === 'supervisor';

  if (Number.isNaN(workflowId)) {
    return badRequest(res, 'ID invalido');
  }

  try {
    await ensureClientProductWorkflowSchema();
    const currentRows = await query(`SELECT id, assigned_user_id, created_by FROM crm_client_product_workflows WHERE id = $1`, [workflowId]);
    if (currentRows.length === 0) {
      return notFound(res, 'Workflow');
    }

    const currentWorkflow = currentRows[0];
    if (!isPrivileged && !sameId(currentWorkflow.assigned_user_id, currentUserId) && !sameId(currentWorkflow.created_by, currentUserId)) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar este workflow' });
    }

    await query(`DELETE FROM crm_client_product_workflows WHERE id = $1`, [workflowId]);
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando workflow');
  }
});


// ======================================================
// Endpoints IA (documentos + chat)
// ======================================================

// ======================================================
// Vendedores, categorías y productos
// ======================================================
// LEGACY: Endpoint movido a src/backend/routes/vendorRoutes.js (línea 76)
// app.get('/api/vendors', async (_req, res) => {
//   try {
//     const rows = await query(
//       `SELECT * FROM vendors WHERE COALESCE(is_active,1) = 1 ORDER BY name ASC`
//     );
//     const mapped = rows.map((row) =>
//       enrich(row, [], ['is_active'], ['created_at', 'updated_at'])
//     );
//     res.json(mapped);
//   } catch (error) {
//     serverError(res, error, 'Error obteniendo vendedores');
//   }
// });

app.get('/api/categories', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM categories ORDER BY name ASC`
    );
    const mapped = rows.map((row) =>
      enrich(row, [], [], ['created_at', 'updated_at'])
    );
    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo categorías');
  }
});

app.post('/api/categories', async (req, res) => {
  const { name, description } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return badRequest(res, 'El nombre de la categoría es obligatorio');
  }

  try {
    const result = await query(
      `INSERT INTO categories (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [name.trim(), description?.trim() || null]
    );
    res.status(201).json(result[0]);
  } catch (error) {
    serverError(res, error, 'Error creando categoría');
  }
});

app.put('/api/categories/:id', async (req, res) => {
  const categoryId = req.params.id; // UUID

  const { name, description } = req.body || {};
  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return badRequest(res, 'El nombre de la categoría no puede estar vacío');
  }

  try {
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description?.trim() || null);
    }

    if (updates.length === 0) {
      return badRequest(res, 'No hay campos para actualizar');
    }

    values.push(categoryId);

    const result = await query(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json(result[0]);
  } catch (error) {
    serverError(res, error, 'Error actualizando categoría');
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  const categoryId = req.params.id; // UUID

  try {
    // Verificar si hay productos usando esta categoría
    const productsUsingCategory = await query(
      `SELECT COUNT(*) as count FROM products WHERE category_id = $1`,
      [categoryId]
    );

    if (productsUsingCategory[0]?.count > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar la categoría porque tiene productos asociados'
      });
    }

    const result = await query(
      `DELETE FROM categories WHERE id = $1 RETURNING *`,
      [categoryId]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json({ success: true, message: 'Categoría eliminada correctamente' });
  } catch (error) {
    serverError(res, error, 'Error eliminando categoría');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY STEPS (plantillas de pasos por categoría)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/categories/:id/steps  → lista pasos de una categoría
app.get('/api/categories/:id/steps', authenticateRequest, async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM category_steps WHERE category_id = $1 ORDER BY step_order ASC, id ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    serverError(res, error, 'Error obteniendo pasos de categoría');
  }
});

// POST /api/categories/:id/steps  → crear paso
app.post('/api/categories/:id/steps', authenticateRequest, requireRole(['admin', 'supervisor']), async (req, res) => {
  const { step_name, step_order } = req.body || {};
  if (!step_name || typeof step_name !== 'string' || step_name.trim() === '') {
    return badRequest(res, 'El nombre del paso es obligatorio');
  }
  try {
    const maxOrder = await query(
      `SELECT COALESCE(MAX(step_order), 0) AS max_order FROM category_steps WHERE category_id = $1`,
      [req.params.id]
    );
    const order = (step_order != null ? Number(step_order) : maxOrder[0].max_order + 1);
    const result = await query(
      `INSERT INTO category_steps (category_id, step_name, step_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, step_name.trim(), order]
    );
    res.status(201).json(result[0]);
  } catch (error) {
    serverError(res, error, 'Error creando paso');
  }
});

// PUT /api/category-steps/:stepId  → editar paso
app.put('/api/category-steps/:stepId', authenticateRequest, requireRole(['admin', 'supervisor']), async (req, res) => {
  const { step_name, step_order } = req.body || {};
  try {
    const updates = [];
    const values = [];
    let pi = 1;
    if (step_name !== undefined) { updates.push(`step_name = $${pi++}`); values.push(step_name.trim()); }
    if (step_order !== undefined) { updates.push(`step_order = $${pi++}`); values.push(Number(step_order)); }
    if (updates.length === 0) return badRequest(res, 'Nada que actualizar');
    values.push(req.params.stepId);
    const result = await query(
      `UPDATE category_steps SET ${updates.join(', ')} WHERE id = $${pi} RETURNING *`,
      values
    );
    if (result.length === 0) return res.status(404).json({ error: 'Paso no encontrado' });
    res.json(result[0]);
  } catch (error) {
    serverError(res, error, 'Error actualizando paso');
  }
});

// DELETE /api/category-steps/:stepId  → eliminar paso
app.delete('/api/category-steps/:stepId', authenticateRequest, requireRole(['admin', 'supervisor']), async (req, res) => {
  try {
    await query(`DELETE FROM category_steps WHERE id = $1`, [req.params.stepId]);
    res.json({ success: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando paso');
  }
});

// PATCH /api/category-steps/reorder  → reordenar pasos de plantilla
app.patch('/api/category-steps/reorder', authenticateRequest, requireRole(['admin', 'supervisor']), async (req, res) => {
  const { steps } = req.body || {};
  if (!Array.isArray(steps)) {
    return badRequest(res, 'Se esperaba una lista de pasos {step_id, step_order}');
  }
  try {
    await query('BEGIN');
    for (const s of steps) {
      await query(
        `UPDATE category_steps SET step_order = $1 WHERE id = $2`,
        [Number(s.step_order), s.step_id]
      );
    }
    await query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await query('ROLLBACK');
    serverError(res, error, 'Error reordenando pasos');
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// CLIENT STEPS (progreso del cliente en cada paso)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/clients/:clientId/steps  → progreso del cliente en todos sus pasos
app.get('/api/clients/:clientId/steps', authenticateRequest, async (req, res) => {
  try {
    const rows = await query(
      `SELECT
         cs.id            AS step_id,
         cs.category_id,
         cs.step_name,
         cs.step_order,
         cat.name         AS category_name,
         COALESCE(csp.is_done, false) AS is_done,
         csp.done_at,
         csp.notes,
         csp.id           AS client_step_id
       FROM category_steps cs
       JOIN categories cat ON cat.id = cs.category_id
       LEFT JOIN client_steps csp
              ON csp.category_step_id = cs.id
             AND csp.client_id = $1
       ORDER BY cat.name ASC, cs.step_order ASC, cs.id ASC`,
      [req.params.clientId]
    );
    res.json(rows);
  } catch (error) {
    serverError(res, error, 'Error obteniendo progreso del cliente');
  }
});

// PATCH /api/clients/:clientId/steps/:stepId  → marcar/desmarcar paso
app.patch('/api/clients/:clientId/steps/:stepId', authenticateRequest, async (req, res) => {
  const { is_done, notes } = req.body || {};
  const clientId = String(req.params.clientId);  // UUID
  const stepId   = Number(req.params.stepId);
  try {
    const result = await query(
      `INSERT INTO client_steps (client_id, category_step_id, is_done, done_at, notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (client_id, category_step_id)
       DO UPDATE SET
         is_done    = EXCLUDED.is_done,
         done_at    = CASE WHEN EXCLUDED.is_done THEN COALESCE(client_steps.done_at, NOW()) ELSE NULL END,
         notes      = COALESCE(EXCLUDED.notes, client_steps.notes),
         updated_at = NOW()
       RETURNING *`,
      [clientId, stepId, Boolean(is_done), is_done ? new Date() : null, notes ?? null]
    );
    res.json(result[0]);
  } catch (error) {
    serverError(res, error, 'Error actualizando paso del cliente');
  }
});

// LEGACY ENDPOINT - Reemplazado por productRoutes modular (línea ~78)
/*
app.get('/api/products', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ORDER BY p.name ASC`
    );
    const mapped = rows.map((row) =>
      enrich(
        row,
        ['base_price', 'commission_percentage'],
        ['is_active', 'is_recurring'],
        ['created_at', 'updated_at']
      )
    );
    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo productos');
  }
});
*/

const normalizeNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : NaN;
};

const normalizeNullableInteger = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const intValue = Number(value);
  return Number.isInteger(intValue) ? intValue : NaN;
};

const normalizeBillingCycle = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.toLowerCase();
  return ['monthly', 'quarterly', 'yearly'].includes(normalized) ? normalized : null;
};

// LEGACY ENDPOINT - Reemplazado por productRoutes modular
/*
app.post('/api/products', async (req, res) => {
  const {
    name,
    category_id: categoryId,
    description,
    price,
    commission_percentage: commissionPercentage
  } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return badRequest(res, 'El nombre del producto es obligatorio');
  }

  // category_id es UUID nullable
  const normalizedPrice = normalizeNullableNumber(price);
  if (Number.isNaN(normalizedPrice)) {
    return badRequest(res, 'Precio inválido');
  }
  if (
    normalizedPrice !== null &&
    (normalizedPrice < 0 || normalizedPrice > 1_000_000_000)
  ) {
    return badRequest(res, 'El precio debe ser mayor o igual a 0');
  }

  const normalizedCommission = normalizeNullableNumber(commissionPercentage);
  if (Number.isNaN(normalizedCommission)) {
    return badRequest(res, 'Porcentaje de comisión inválido');
  }
  const finalCommission = normalizedCommission !== null ? normalizedCommission : 10.00;

  try {
    const rows = await query(
      `INSERT INTO products
        (name, category_id, description, price, commission_percentage)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name.trim(),
        categoryId || null,
        description?.trim() || null,
        normalizedPrice || 0,
        finalCommission
      ]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    serverError(res, error, 'Error creando producto');
  }
});
*/

// LEGACY ENDPOINT - Reemplazado por productRoutes modular
/*
app.put('/api/products/:id', async (req, res) => {
  const productId = req.params.id; // UUID
  
  const {
    name,
    category_id: categoryId,
    description,
    price,
    commission_percentage: commissionPercentage
  } = req.body || {};

  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      return badRequest(res, 'El nombre del producto no puede estar vacío');
    }
    updates.push(`name = $${paramIndex++}`);
    values.push(name.trim());
  }

  if (categoryId !== undefined) {
    updates.push(`category_id = $${paramIndex++}`);
    values.push(categoryId || null);
  }

  if (description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(description?.trim() || null);
  }

  if (price !== undefined) {
    const normalizedPrice = normalizeNullableNumber(price);
    if (Number.isNaN(normalizedPrice)) {
      return badRequest(res, 'Precio inválido');
    }
    if (
      normalizedPrice !== null &&
      (normalizedPrice < 0 || normalizedPrice > 1_000_000_000)
    ) {
      return badRequest(res, 'El precio debe ser mayor o igual a 0');
    }
    updates.push(`price = $${paramIndex++}`);
    values.push(normalizedPrice);
  }

  if (commissionPercentage !== undefined) {
    const normalizedCommission = normalizeNullableNumber(commissionPercentage);
    if (Number.isNaN(normalizedCommission)) {
      return badRequest(res, 'Porcentaje de comisión inválido');
    }
    updates.push(`commission_percentage = $${paramIndex++}`);
    values.push(normalizedCommission !== null ? normalizedCommission : 10.00);
  }

  if (updates.length === 0) {
    return badRequest(res, 'No hay campos para actualizar');
  }

  values.push(productId);

  try {
    const rows = await query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    serverError(res, error, 'Error actualizando producto');
  }
});
*/

// LEGACY ENDPOINT - Reemplazado por productRoutes modular
/*
app.delete('/api/products/:id', async (req, res) => {
  const productId = req.params.id; // UUID

  try {
    const rows = await query(
      `DELETE FROM products WHERE id = $1 RETURNING *`,
      [productId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando producto');
  }
});
*/

app.get('/api/product-goals', async (req, res) => {
  const { period_year: periodYearParam, period_month: periodMonthParam, include_inactive: includeInactiveParam } = req.query;
  const includeInactive = String(includeInactiveParam ?? '').toLowerCase() === 'true';

  const filters = ['pg.vendor_id IS NULL'];
  const params = [];

  if (!includeInactive) {
    filters.push('COALESCE(pg.is_active,1) = 1');
  }

  if (periodYearParam !== undefined && String(periodYearParam).trim() !== '') {
    const periodYear = Number(periodYearParam);
    if (!Number.isInteger(periodYear)) {
      return badRequest(res, 'period_year inválido');
    }
    params.push(periodYear);
    filters.push(`pg.period_year = $${params.length}`);
  }

  if (periodMonthParam !== undefined && String(periodMonthParam).trim() !== '') {
    const periodMonth = Number(periodMonthParam);
    if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
      return badRequest(res, 'period_month inválido');
    }
    params.push(periodMonth);
    filters.push(`pg.period_month = $${params.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const rows = await query(
      `${PRODUCT_GOALS_SELECT} ${whereClause} ORDER BY pg.period_year DESC, COALESCE(pg.period_month, 0) DESC, p.name ASC`,
      params
    );
    res.json(rows.map(mapBusinessGoalRow));
  } catch (error) {
    serverError(res, error, 'Error obteniendo metas de negocio');
  }
});

app.post('/api/product-goals', async (req, res) => {
  if (req.user?.role === 'vendedor') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const {
    product_id: productId,
    period_type: periodType = 'monthly',
    period_year: periodYear,
    period_month: periodMonth = null,
    period_quarter: periodQuarter = null,
    total_target_amount: totalTargetAmount,
    current_amount: currentAmount = 0,
    description = null
  } = req.body || {};

  const normalizedProductId = Number(productId);
  const normalizedPeriodYear = Number(periodYear);
  const normalizedTargetAmount = Number(totalTargetAmount);
  const normalizedCurrentAmount = Number(currentAmount ?? 0);
  const normalizedPeriodType = ['monthly', 'quarterly', 'yearly'].includes(periodType) ? periodType : 'monthly';

  if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
    return badRequest(res, 'Producto inválido');
  }

  if (!Number.isInteger(normalizedPeriodYear)) {
    return badRequest(res, 'Año inválido');
  }

  if (!Number.isFinite(normalizedTargetAmount)) {
    return badRequest(res, 'Monto de meta inválido');
  }

  let normalizedPeriodMonth = null;
  let normalizedPeriodQuarter = null;

  if (normalizedPeriodType === 'monthly') {
    normalizedPeriodMonth = Number(periodMonth);
    if (!Number.isInteger(normalizedPeriodMonth) || normalizedPeriodMonth < 1 || normalizedPeriodMonth > 12) {
      return badRequest(res, 'Mes inválido');
    }
  } else if (normalizedPeriodType === 'quarterly') {
    normalizedPeriodQuarter = Number(periodQuarter);
    if (!Number.isInteger(normalizedPeriodQuarter) || normalizedPeriodQuarter < 1 || normalizedPeriodQuarter > 4) {
      return badRequest(res, 'Trimestre inválido');
    }
  }

  const normalizedDescription = description != null && String(description).trim() !== '' ? String(description).trim() : null;

  try {
    const rows = await query(
      `INSERT INTO product_goals
        (product_id, vendor_id, period_type, period_year, period_month, period_quarter, target_revenue, current_revenue, description)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        normalizedProductId,
        normalizedPeriodType,
        normalizedPeriodYear,
        normalizedPeriodMonth,
        normalizedPeriodQuarter,
        normalizedTargetAmount,
        Number.isFinite(normalizedCurrentAmount) ? normalizedCurrentAmount : 0,
        normalizedDescription
      ]
    );
    res.status(201).json(mapBusinessGoalRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error creando meta de negocio');
  }
});

app.put('/api/product-goals/:id', async (req, res) => {
  if (req.user?.role === 'vendedor') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const goalId = Number(req.params.id);
  if (Number.isNaN(goalId)) {
    return badRequest(res, 'ID inválido');
  }

  const {
    product_id: productId,
    period_type: periodType = 'monthly',
    period_year: periodYear,
    period_month: periodMonth = null,
    period_quarter: periodQuarter = null,
    total_target_amount: totalTargetAmount,
    current_amount: currentAmount = 0,
    description = null
  } = req.body || {};

  const normalizedProductId = Number(productId);
  const normalizedPeriodYear = Number(periodYear);
  const normalizedTargetAmount = Number(totalTargetAmount);
  const normalizedCurrentAmount = Number(currentAmount ?? 0);
  const normalizedPeriodType = ['monthly', 'quarterly', 'yearly'].includes(periodType) ? periodType : 'monthly';

  if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
    return badRequest(res, 'Producto inválido');
  }

  if (!Number.isInteger(normalizedPeriodYear)) {
    return badRequest(res, 'Año inválido');
  }

  if (!Number.isFinite(normalizedTargetAmount)) {
    return badRequest(res, 'Monto de meta inválido');
  }

  let normalizedPeriodMonth = null;
  let normalizedPeriodQuarter = null;

  if (normalizedPeriodType === 'monthly') {
    normalizedPeriodMonth = Number(periodMonth);
    if (!Number.isInteger(normalizedPeriodMonth) || normalizedPeriodMonth < 1 || normalizedPeriodMonth > 12) {
      return badRequest(res, 'Mes inválido');
    }
  } else if (normalizedPeriodType === 'quarterly') {
    normalizedPeriodQuarter = Number(periodQuarter);
    if (!Number.isInteger(normalizedPeriodQuarter) || normalizedPeriodQuarter < 1 || normalizedPeriodQuarter > 4) {
      return badRequest(res, 'Trimestre inválido');
    }
  }

  const normalizedDescription = description != null && String(description).trim() !== '' ? String(description).trim() : null;

  try {
    const rows = await query(
      `UPDATE product_goals
          SET product_id = $1,
              period_type = $2,
              period_year = $3,
              period_month = $4,
              period_quarter = $5,
              target_revenue = $6,
              current_revenue = $7,
              description = $8,
              updated_at = NOW()
        WHERE id = $9 AND vendor_id IS NULL
        RETURNING *`,
      [
        normalizedProductId,
        normalizedPeriodType,
        normalizedPeriodYear,
        normalizedPeriodMonth,
        normalizedPeriodQuarter,
        normalizedTargetAmount,
        Number.isFinite(normalizedCurrentAmount) ? normalizedCurrentAmount : 0,
        normalizedDescription,
        goalId
      ]
    );

    if (rows.length === 0) {
      return notFound(res, 'Meta de negocio');
    }

    res.json(mapBusinessGoalRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error actualizando meta de negocio');
  }
});

app.delete('/api/product-goals/:id', async (req, res) => {
  if (req.user?.role === 'vendedor') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const goalId = Number(req.params.id);
  if (Number.isNaN(goalId)) {
    return badRequest(res, 'ID inválido');
  }

  try {
    const rows = await query(`DELETE FROM product_goals WHERE id = $1 AND vendor_id IS NULL RETURNING *`, [goalId]);
    if (rows.length === 0) {
      return notFound(res, 'Meta de negocio');
    }
    res.json({ success: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando meta de negocio');
  }
});

app.post('/api/product-goals/bulk', async (req, res) => {
  if (req.user?.role === 'vendedor') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const {
    period_type: periodType = 'monthly',
    period_year: periodYear,
    period_month: periodMonth = null,
    period_quarter: periodQuarter = null,
    goals
  } = req.body || {};

  const normalizedPeriodType = ['monthly', 'quarterly', 'yearly'].includes(periodType) ? periodType : 'monthly';
  const normalizedPeriodYear = Number(periodYear);

  if (!Number.isInteger(normalizedPeriodYear)) {
    return badRequest(res, 'Año inválido');
  }

  let normalizedPeriodMonth = null;
  let normalizedPeriodQuarter = null;

  if (normalizedPeriodType === 'monthly') {
    normalizedPeriodMonth = Number(periodMonth);
    if (!Number.isInteger(normalizedPeriodMonth) || normalizedPeriodMonth < 1 || normalizedPeriodMonth > 12) {
      return badRequest(res, 'Mes inválido');
    }
  } else if (normalizedPeriodType === 'quarterly') {
    normalizedPeriodQuarter = Number(periodQuarter);
    if (!Number.isInteger(normalizedPeriodQuarter) || normalizedPeriodQuarter < 1 || normalizedPeriodQuarter > 4) {
      return badRequest(res, 'Trimestre inválido');
    }
  }

  if (!Array.isArray(goals) || goals.length === 0) {
    return badRequest(res, 'Incluye al menos una meta');
  }

  const sanitizedGoals = goals
    .map((raw) => {
      const productId = Number(raw.product_id ?? raw.productId);
      const targetRaw = raw.total_target_amount ?? raw.target_amount ?? raw.target_revenue;
      const targetAmount = typeof targetRaw === 'string'
        ? Number(targetRaw.replace(/[$,\s]/g, ''))
        : Number(targetRaw);
      const description = raw.description != null && String(raw.description).trim() !== ''
        ? String(raw.description).trim()
        : null;

      if (!Number.isInteger(productId) || productId <= 0 || !Number.isFinite(targetAmount)) {
        return null;
      }

      return {
        productId,
        targetAmount,
        description
      };
    })
    .filter((item) => item !== null);

  if (sanitizedGoals.length === 0) {
    return badRequest(res, 'No hay metas válidas para guardar');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const goal of sanitizedGoals) {
      const existing = await client.query(
        `SELECT id FROM product_goals
          WHERE vendor_id IS NULL
            AND product_id = $1
            AND period_type = $2
            AND period_year = $3
            AND COALESCE(period_month, 0) = COALESCE($4, 0)
            AND COALESCE(period_quarter, 0) = COALESCE($5, 0)`
        , [goal.productId, normalizedPeriodType, normalizedPeriodYear, normalizedPeriodMonth, normalizedPeriodQuarter]
      );

      if (existing.rowCount && existing.rows.length > 0) {
        await client.query(
          `UPDATE product_goals
              SET target_revenue = $1,
                  description = $2,
                  updated_at = NOW()
            WHERE id = $3`,
          [goal.targetAmount, goal.description, existing.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO product_goals
              (product_id, vendor_id, period_type, period_year, period_month, period_quarter, target_revenue, current_revenue, description)
           VALUES ($1, NULL, $2, $3, $4, $5, $6, 0, $7)`,
          [goal.productId, normalizedPeriodType, normalizedPeriodYear, normalizedPeriodMonth, normalizedPeriodQuarter, goal.targetAmount, goal.description]
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    client.release();
    return serverError(res, error, 'Error guardando metas masivas');
  }

  client.release();
  res.status(201).json({ success: true, updated: sanitizedGoals.length });
});

app.get('/api/goals', async (req, res) => {
  const { period_year: periodYearParam, period_month: periodMonthParam } = req.query;

  const filters = ['pg.vendor_id IS NOT NULL', 'COALESCE(pg.is_active,1) = 1'];
  const params = [];

  if (periodYearParam !== undefined && String(periodYearParam).trim() !== '') {
    const periodYear = Number(periodYearParam);
    if (!Number.isInteger(periodYear)) {
      return badRequest(res, 'period_year inválido');
    }
    params.push(periodYear);
    filters.push(`pg.period_year = $${params.length}`);
  }

  if (periodMonthParam !== undefined && String(periodMonthParam).trim() !== '') {
    const periodMonth = Number(periodMonthParam);
    if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
      return badRequest(res, 'period_month inválido');
    }
    params.push(periodMonth);
    filters.push(`pg.period_month = $${params.length}`);
  }

  const whereClause = `WHERE ${filters.join(' AND ')}`;

  try {
    const rows = await query(
      `${PRODUCT_GOALS_SELECT} ${whereClause} ORDER BY pg.period_year DESC, COALESCE(pg.period_month, 0) DESC, v.name ASC`,
      params
    );

    const normalizedUsername = (req.user?.username || '').trim().toLowerCase();
    const normalizedSalespersonName = (req.user?.salespersonName || '').trim().toLowerCase();

    let mapped = rows.map(mapVendorGoalRow);
    if (req.user?.role === 'vendedor') {
      mapped = mapped.filter((goal) => {
        if (req.user?.salespersonId != null && goal.vendor_id != null && sameId(goal.vendor_id, req.user.salespersonId)) {
          return true;
        }
        const vendorName = (goal.vendor_name || '').trim().toLowerCase();
        if (vendorName && normalizedUsername && vendorName === normalizedUsername) {
          return true;
        }
        if (vendorName && normalizedSalespersonName && vendorName === normalizedSalespersonName) {
          return true;
        }
        return false;
      });
    }

    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo metas de vendedores');
  }
});

app.post('/api/goals', async (req, res) => {
  if (req.user?.role === 'vendedor') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const {
    vendor_id: vendorId,
    product_id: productId,
    period_type: periodType = 'monthly',
    period_year: periodYear,
    period_month: periodMonth = null,
    period_quarter: periodQuarter = null,
    target_amount: targetAmount,
    current_amount: currentAmount = 0,
    description = null
  } = req.body || {};

  const normalizedVendorId = Number(vendorId);
  const normalizedProductId = Number(productId);
  const normalizedPeriodYear = Number(periodYear);
  const normalizedTargetAmount = Number(targetAmount);
  const normalizedCurrentAmount = Number(currentAmount ?? 0);
  const normalizedPeriodType = ['monthly', 'quarterly', 'yearly'].includes(periodType) ? periodType : 'monthly';

  if (!Number.isInteger(normalizedVendorId) || normalizedVendorId <= 0) {
    return badRequest(res, 'Vendedor inválido');
  }

  if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
    return badRequest(res, 'Producto inválido');
  }

  if (!Number.isInteger(normalizedPeriodYear)) {
    return badRequest(res, 'Año inválido');
  }

  if (!Number.isFinite(normalizedTargetAmount)) {
    return badRequest(res, 'Monto de meta inválido');
  }

  let normalizedPeriodMonth = null;
  let normalizedPeriodQuarter = null;

  if (normalizedPeriodType === 'monthly') {
    normalizedPeriodMonth = Number(periodMonth);
    if (!Number.isInteger(normalizedPeriodMonth) || normalizedPeriodMonth < 1 || normalizedPeriodMonth > 12) {
      return badRequest(res, 'Mes inválido');
    }
  } else if (normalizedPeriodType === 'quarterly') {
    normalizedPeriodQuarter = Number(periodQuarter);
    if (!Number.isInteger(normalizedPeriodQuarter) || normalizedPeriodQuarter < 1 || normalizedPeriodQuarter > 4) {
      return badRequest(res, 'Trimestre inválido');
    }
  }

  const normalizedDescription = description != null && String(description).trim() !== '' ? String(description).trim() : null;

  try {
    const rows = await query(
      `INSERT INTO product_goals
        (product_id, vendor_id, period_type, period_year, period_month, period_quarter, target_revenue, current_revenue, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        normalizedProductId,
        normalizedVendorId,
        normalizedPeriodType,
        normalizedPeriodYear,
        normalizedPeriodMonth,
        normalizedPeriodQuarter,
        normalizedTargetAmount,
        Number.isFinite(normalizedCurrentAmount) ? normalizedCurrentAmount : 0,
        normalizedDescription
      ]
    );
    res.status(201).json(mapVendorGoalRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error creando meta de vendedor');
  }
});

app.put('/api/goals/:id', async (req, res) => {
  if (req.user?.role === 'vendedor') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const goalId = Number(req.params.id);
  if (Number.isNaN(goalId)) {
    return badRequest(res, 'ID inválido');
  }

  const {
    vendor_id: vendorId,
    product_id: productId,
    period_type: periodType = 'monthly',
    period_year: periodYear,
    period_month: periodMonth = null,
    period_quarter: periodQuarter = null,
    target_amount: targetAmount,
    current_amount: currentAmount = 0,
    description = null
  } = req.body || {};

  const normalizedVendorId = Number(vendorId);
  const normalizedProductId = Number(productId);
  const normalizedPeriodYear = Number(periodYear);
  const normalizedTargetAmount = Number(totalTargetAmount);
  const normalizedCurrentAmount = Number(currentAmount ?? 0);
  const normalizedPeriodType = ['monthly', 'quarterly', 'yearly'].includes(periodType) ? periodType : 'monthly';

  if (!Number.isInteger(normalizedVendorId) || normalizedVendorId <= 0) {
    return badRequest(res, 'Vendedor inválido');
  }

  if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
    return badRequest(res, 'Producto inválido');
  }

  if (!Number.isInteger(normalizedPeriodYear)) {
    return badRequest(res, 'Año inválido');
  }

  if (!Number.isFinite(normalizedTargetAmount)) {
    return badRequest(res, 'Monto de meta inválido');
  }

  let normalizedPeriodMonth = null;
  let normalizedPeriodQuarter = null;

  if (normalizedPeriodType === 'monthly') {
    normalizedPeriodMonth = Number(periodMonth);
    if (!Number.isInteger(normalizedPeriodMonth) || normalizedPeriodMonth < 1 || normalizedPeriodMonth > 12) {
      return badRequest(res, 'Mes inválido');
    }
  } else if (normalizedPeriodType === 'quarterly') {
    normalizedPeriodQuarter = Number(periodQuarter);
    if (!Number.isInteger(normalizedPeriodQuarter) || normalizedPeriodQuarter < 1 || normalizedPeriodQuarter > 4) {
      return badRequest(res, 'Trimestre inválido');
    }
  }

  const normalizedDescription = description != null && String(description).trim() !== '' ? String(description).trim() : null;

  try {
    const rows = await query(
      `UPDATE product_goals
          SET vendor_id = $1,
              product_id = $2,
              period_type = $3,
              period_year = $4,
              period_month = $5,
              period_quarter = $6,
              target_revenue = $7,
              current_revenue = $8,
              description = $9,
              updated_at = NOW()
        WHERE id = $10 AND vendor_id IS NOT NULL
        RETURNING *`,
      [
        normalizedVendorId,
        normalizedProductId,
        normalizedPeriodType,
        normalizedPeriodYear,
        normalizedPeriodMonth,
        normalizedPeriodQuarter,
        normalizedTargetAmount,
        Number.isFinite(normalizedCurrentAmount) ? normalizedCurrentAmount : 0,
        normalizedDescription,
        goalId
      ]
    );

    if (rows.length === 0) {
      return notFound(res, 'Meta de vendedor');
    }

    res.json(mapVendorGoalRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error actualizando meta de vendedor');
  }
});

app.delete('/api/goals/:id', async (req, res) => {
  if (req.user?.role === 'vendedor') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const goalId = Number(req.params.id);
  if (Number.isNaN(goalId)) {
    return badRequest(res, 'ID inválido');
  }

  try {
    const rows = await query(`DELETE FROM product_goals WHERE id = $1 AND vendor_id IS NOT NULL RETURNING *`, [goalId]);
    if (rows.length === 0) {
      return notFound(res, 'Meta de vendedor');
    }
    res.json({ success: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando meta de vendedor');
  }
});

// ======================================================
// Prospectos de seguimiento
app.get('/api/follow-up-prospects', authenticateRequest, async (req, res) => {
  try {
    const { include_completed } = req.query;
    const scope = await getVendorScope(req);

    // Construir WHERE clause con filtros
    const conditions = [];
    const params = [];

    if (include_completed !== 'true') {
      conditions.push('p.completed_date IS NULL');
    }

    // FILTRO VENDEDOR: Solo sus propios seguimientos
    if (scope.isVendor && !scope.salespersonId) {
      return res.json([]);
    }

    if (scope.isVendor && scope.salespersonId) {
      conditions.push('c.salesperson_id = $' + (params.length + 1));
      params.push(scope.salespersonId);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const sql = `
      SELECT 
        p.*,
        c.name as client_name,
        pr.name as priority_name,
        pr.color_hex as priority_color,
        v.name as vendor_name,
        s.name as step_name
      FROM follow_up_prospects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN priorities pr ON p.priority_id = pr.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN follow_up_steps s ON p.step_id = s.id
      ${whereClause}
      ORDER BY p.created_at DESC
    `;

    const rows = await query(sql, params);
    res.json(rows);
  } catch (error) {
    // Si la tabla no existe, devolver array vacío para no romper el frontend
    if (error.code === '42P01') { // undefined_table
      console.warn('Tabla follow_up_prospects no existe, devolviendo array vacío');
      return res.json([]);
    }
    serverError(res, error, 'Error obteniendo prospectos');
  }
});

// POST: Crear prospecto de seguimiento
app.post('/api/follow-up-prospects', authenticateRequest, async (req, res) => {
  try {
    const { client_id } = req.body;
    const scope = await getVendorScope(req);

    if (!client_id) {
      return res.status(400).json({ error: 'client_id es obligatorio' });
    }

    // Verificar que el cliente existe y obtener su nombre
    const clientData = await query('SELECT id, name, salesperson_id FROM clients WHERE id = $1', [client_id]);
    if (clientData.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    if (scope.isVendor && !vendorOwnsClient(clientData[0].salesperson_id, scope)) {
      return res.status(403).json({ error: 'No tienes acceso a este cliente para seguimiento' });
    }

    const companyName = clientData[0].name || 'Sin nombre';

    // Verificar si ya existe un seguimiento activo
    const existingActive = await query(
      'SELECT id FROM follow_up_prospects WHERE client_id = $1 AND is_active = true AND (is_completed IS NULL OR is_completed = false)',
      [client_id]
    );

    if (existingActive.length > 0) {
      return res.status(400).json({ error: 'Este cliente ya tiene un seguimiento activo' });
    }

    const result = await query(
      `INSERT INTO follow_up_prospects 
       (client_id, company_name, is_active, is_completed, created_at, updated_at)
       VALUES ($1::uuid, $2, true, false, NOW(), NOW())
       RETURNING *`,
      [client_id, companyName]
    );

    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creando prospecto:', error);
    res.status(500).json({ error: 'Error creando prospecto de seguimiento' });
  }
});

// PUT: Completar prospecto
app.put('/api/follow-up-prospects/:id/complete', authenticateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await getVendorScope(req);
    const accessRows = await query(
      `SELECT fp.id, fp.vendor_id, c.salesperson_id AS client_salesperson_id
         FROM follow_up_prospects fp
         LEFT JOIN clients c ON c.id = fp.client_id
        WHERE fp.id = $1`,
      [id]
    );

    if (accessRows.length === 0) {
      return res.status(404).json({ error: 'Prospecto no encontrado' });
    }

    if (!vendorOwnsProspect(accessRows[0], scope)) {
      return res.status(403).json({ error: 'No tienes acceso a este seguimiento' });
    }

    const result = await query(
      `UPDATE follow_up_prospects 
       SET is_completed = true, completed_date = NOW(), is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Prospecto no encontrado' });
    }

    res.json({ success: true, prospect: result[0] });
  } catch (error) {
    console.error('Error completando prospecto:', error);
    res.status(500).json({ error: 'Error completando prospecto' });
  }
});

// DELETE: Devolver prospecto a base disponible (elimina de follow_up_prospects)
app.delete('/api/follow-up-prospects/:id', authenticateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await getVendorScope(req);
    const accessRows = await query(
      `SELECT fp.id, fp.vendor_id, c.salesperson_id AS client_salesperson_id
         FROM follow_up_prospects fp
         LEFT JOIN clients c ON c.id = fp.client_id
        WHERE fp.id = $1`,
      [id]
    );

    if (accessRows.length === 0) {
      return res.status(404).json({ error: 'Prospecto no encontrado' });
    }

    if (!vendorOwnsProspect(accessRows[0], scope)) {
      return res.status(403).json({ error: 'No tienes acceso a este seguimiento' });
    }

    const result = await query(
      'DELETE FROM follow_up_prospects WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Prospecto no encontrado' });
    }

    res.json({ success: true, message: 'Prospecto devuelto a base disponible' });
  } catch (error) {
    console.error('Error eliminando prospecto:', error);
    res.status(500).json({ error: 'Error devolviendo prospecto a disponibles' });
  }
});

// GET /api/priorities - Obtener prioridades
app.get('/api/priorities', authenticateRequest, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM priorities ORDER BY order_index ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting priorities:', error);
    res.status(500).json({ error: 'Error obteniendo prioridades' });
  }
});

// GET /api/follow-up-steps - Obtener pasos de seguimiento
app.get('/api/follow-up-steps', authenticateRequest, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM follow_up_steps ORDER BY order_index ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting follow-up steps:', error);
    res.status(500).json({ error: 'Error obteniendo pasos de seguimiento' });
  }
});

// PUT: Actualizar prospecto (general)
app.put('/api/follow-up-prospects/:id', authenticateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await getVendorScope(req);
    const {
      client_id, priority_id, vendor_id, completed_date,
      fijo_ren, fijo_new, movil_nueva, movil_renovacion,
      claro_tv, cloud, mpls, notes, vendor_commission,
      manual_company_earnings
    } = req.body;

    console.log(`[UPDATE PROSPECT ${id}] movil_nueva=${movil_nueva}, movil_renovacion=${movil_renovacion}`);
    const accessRows = await query(
      `SELECT fp.id, fp.vendor_id, fp.client_id, c.salesperson_id AS client_salesperson_id
         FROM follow_up_prospects fp
         LEFT JOIN clients c ON c.id = fp.client_id
        WHERE fp.id = $1`,
      [id]
    );

    if (accessRows.length === 0) {
      return res.status(404).json({ error: 'Prospecto no encontrado' });
    }

    if (!vendorOwnsProspect(accessRows[0], scope)) {
      return res.status(403).json({ error: 'No tienes acceso a este seguimiento' });
    }

    if (scope.isVendor && client_id !== undefined && client_id !== null && String(client_id).trim() !== '') {
      const targetClientRows = await query('SELECT id, salesperson_id FROM clients WHERE id = $1', [client_id]);
      if (targetClientRows.length === 0) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
      if (!vendorOwnsClient(targetClientRows[0].salesperson_id, scope)) {
        return res.status(403).json({ error: 'No puedes mover el seguimiento a un cliente ajeno' });
      }
    }

    // Saneamiento de entradas numéricas y IDs
    const sanitizedVendorCommission = vendor_commission === '' || vendor_commission === null || vendor_commission === undefined ? 0 : parseFloat(vendor_commission);
    const sanitizedCompanyEarnings = manual_company_earnings === '' || manual_company_earnings === null || manual_company_earnings === undefined ? null : parseFloat(manual_company_earnings);

    // IDs opcionales deben ser null si son undefined
    const p_priority_id = priority_id === undefined ? null : priority_id;
    const p_vendor_id = vendor_id === undefined ? null : vendor_id;
    const p_client_id = client_id === undefined ? null : client_id;
    const p_completed_date = completed_date === undefined ? null : completed_date;
    const p_notes = notes === undefined ? null : notes;

    // Productos default 0 si undefined
    const p_fijo_ren = fijo_ren || 0;
    const p_fijo_new = fijo_new || 0;
    const p_movil_nueva = movil_nueva || 0;
    const p_movil_renovacion = movil_renovacion || 0;
    const p_claro_tv = claro_tv || 0;
    const p_cloud = cloud || 0;
    const p_mpls = mpls || 0;

    // 1. Actualizar tabla principal (sin columnas conflictivas)
    const result = await query(
      `UPDATE follow_up_prospects 
       SET client_id = COALESCE($1, client_id), 
           priority_id = COALESCE($2, priority_id), 
           vendor_id = COALESCE($3, vendor_id), 
           completed_date = $4, 
           fijo_ren = $5, fijo_new = $6,
           movil_nueva = $7, movil_renovacion = $8, claro_tv = $9,
           cloud = $10, mpls = $11, notes = COALESCE($12, notes), 
           updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [p_client_id, p_priority_id, p_vendor_id, p_completed_date,
        p_fijo_ren, p_fijo_new, p_movil_nueva, p_movil_renovacion,
        p_claro_tv, p_cloud, p_mpls, p_notes,
        id]
    );

    // 2. Actualizar/Insertar en tabla satélite de comisiones
    // (Solo si los valores vinieron definidos en el request o asumimos que siempre queremos sincronizar)
    // Dado que Reports.tsx manda el objeto completo, sincronizamos siempre.
    await query(`
      INSERT INTO follow_up_commissions (prospect_id, vendor_commission, manual_company_earnings, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (prospect_id) 
      DO UPDATE SET 
        vendor_commission = EXCLUDED.vendor_commission,
        manual_company_earnings = EXCLUDED.manual_company_earnings,
        updated_at = NOW()
    `, [id,
      isNaN(sanitizedVendorCommission) ? 0 : sanitizedVendorCommission,
      isNaN(sanitizedCompanyEarnings) ? null : sanitizedCompanyEarnings
    ]);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Prospecto no encontrado' });
    }

    const updatedProspect = result[0];
    updatedProspect.vendor_commission = isNaN(sanitizedVendorCommission) ? 0 : sanitizedVendorCommission;
    updatedProspect.manual_company_earnings = isNaN(sanitizedCompanyEarnings) ? null : sanitizedCompanyEarnings;

    res.json({ success: true, prospect: updatedProspect });
  } catch (error) {
    console.error('Error actualizando prospecto:', error);
    res.status(500).json({ error: 'Error actualizando prospecto' });
  }
});

// PUT: Devolver prospecto (marcar como inactivo)
app.put('/api/follow-up-prospects/:id/return', authenticateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await getVendorScope(req);
    const accessRows = await query(
      `SELECT fp.id, fp.vendor_id, c.salesperson_id AS client_salesperson_id
         FROM follow_up_prospects fp
         LEFT JOIN clients c ON c.id = fp.client_id
        WHERE fp.id = $1`,
      [id]
    );

    if (accessRows.length === 0) {
      return res.status(404).json({ error: 'Prospecto no encontrado' });
    }

    if (!vendorOwnsProspect(accessRows[0], scope)) {
      return res.status(403).json({ error: 'No tienes acceso a este seguimiento' });
    }

    const result = await query(
      `UPDATE follow_up_prospects 
       SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Prospecto no encontrado' });
    }

    res.json({ success: true, prospect: result[0] });
  } catch (error) {
    console.error('Error devolviendo prospecto:', error);
    res.status(500).json({ error: 'Error devolviendo prospecto' });
  }
});

// ======================================================
// CALL LOGS (Llamadas de seguimiento)
// ======================================================

// GET: Obtener logs de un prospecto
app.get('/api/call-logs/:prospect_id', authenticateRequest, async (req, res) => {
  try {
    const { prospect_id } = req.params;

    const logs = await query(
      `SELECT cl.*, s.name as step_name
       FROM call_logs cl
       LEFT JOIN follow_up_steps s ON cl.step_id = s.id
       WHERE cl.follow_up_id = $1
       ORDER BY cl.call_date DESC`,
      [prospect_id]
    );

    res.json(logs || []);
  } catch (error) {
    console.error('Error obteniendo call logs:', error);
    res.status(500).json({ error: 'Error obteniendo historial de llamadas' });
  }
});

// POST: Crear nuevo call log
app.post('/api/call-logs', authenticateRequest, async (req, res) => {
  try {
    const { follow_up_id, call_date, notes, outcome, next_call_date, step_completed, step_id } = req.body;

    // Guardar call log
    const result = await query(
      `INSERT INTO call_logs (follow_up_id, call_date, notes, outcome, next_call_date, step_completed, step_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [follow_up_id, call_date, notes, outcome, next_call_date, step_completed || false, step_id]
    );

    // Si se completó el paso, avanzar al siguiente
    let next_step_id = step_id; // mantener actual si no avanza

    if (step_completed && step_id) {
      // Obtener siguiente paso
      const nextSteps = await query(
        `SELECT id FROM follow_up_steps 
         WHERE order_index > (SELECT order_index FROM follow_up_steps WHERE id = $1)
         ORDER BY order_index ASC LIMIT 1`,
        [step_id]
      );
      if (nextSteps.length > 0) next_step_id = nextSteps[0].id;
    }

    // Actualizar prospecto: Última llamada, Próxima llamada, Nuevo Paso (si aplica)
    await query(
      `UPDATE follow_up_prospects 
       SET 
         last_call_date = $1,
         next_call_date = $2,
         step_id = COALESCE($3, step_id),
         updated_at = NOW()
       WHERE id = $4`,
      [call_date, next_call_date, step_completed ? next_step_id : null, follow_up_id]
    );

    res.json({ success: true, log: result[0] });
  } catch (error) {
    console.error('Error creando call log:', error);
    res.status(500).json({ error: 'Error guardando llamada' });
  }
});

// ======================================================
// Prospectos COMPLETADOS (Reportes)
app.get('/api/completed-prospects', authenticateRequest, async (req, res) => {
  try {
    const rows = await query(`
      SELECT 
        fup.*,
        c.name as client_name,
        c.city,
        c.address,
        COALESCE(v.name, sp.name) as vendor_name,
        COALESCE(v.id::text, sp.id::text) as vendor_id,
        v.commission_percentage,
        sp.commission_fijo_new,
        sp.commission_fijo_ren,
        COALESCE(fc.vendor_commission, 0) as vendor_commission,
        fc.manual_company_earnings
      FROM follow_up_prospects fup
      LEFT JOIN follow_up_commissions fc ON fup.id = fc.prospect_id
      LEFT JOIN clients c ON fup.client_id = c.id
      LEFT JOIN vendors v ON fup.vendor_id = v.id
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      WHERE fup.completed_date IS NOT NULL
      ORDER BY fup.completed_date DESC
    `);

    // Para cada prospect, obtener los suscriptores del cliente
    for (const prospect of rows) {
      if (prospect.client_id) {
        const subscribers = await query(`
          SELECT 
            s.id,
            s.phone,
            s.monthly_value,
            s.line_type,
            b.ban_number,
            b.account_type
          FROM subscribers s
          INNER JOIN bans b ON s.ban_id = b.id
          WHERE b.client_id = $1
        `, [prospect.client_id]);
        prospect.subscribers = subscribers;
      } else {
        prospect.subscribers = [];
      }
    }

    res.json(rows);
  } catch (error) {
    console.error('Error fetching completed prospects:', error);
    res.status(500).json({ error: 'Error fetching completed prospects', details: error.message });
  }
});

// ======================================================
// Sincronizar PYMES desde Tango Legacy (auto-crea clientes/BANs/subscribers faltantes)
// ======================================================
app.post('/api/subscriber-reports/sync-pymes', authenticateRequest, requireRole(['admin', 'supervisor']), async (req, res) => {
  const legacyPool = getTangoPool();
  const crmClient = await pool.connect();
  try {
    // 1. Traer TODAS las ventas PYMES de Tango (fuente de verdad)
    const legacyResult = await legacyPool.query(`
      SELECT v.ventaid, v.ban, v.status as linea,
             COALESCE(v.comisionclaro, 0) as com_empresa,
             COALESCE(v.comisionvendedor, 0) as com_vendedor,
             v.fechaactivacion, v.ventatipoid,
             COALESCE(cc.nombre, 'SIN NOMBRE') as cliente,
             vt.nombre as tipo, vd.nombre as vendedor
      FROM venta v
      JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
      LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
      LEFT JOIN vendedor vd ON vd.vendedorid = v.vendedorid
      WHERE v.ventatipoid IN (138, 139, 140, 141)
        AND v.activo = true
      ORDER BY cc.nombre, v.ban, v.ventaid
    `);
    const ventas = legacyResult.rows;
    console.log(`[SYNC-PYMES] Tango: ${ventas.length} ventas PYMES`);

    await crmClient.query('BEGIN');

    // 3. Collect all unique BANs from Tango
    const allBANs = [...new Set(ventas.map(v => (v.ban || '').trim()).filter(Boolean))];

    // 4. Get existing subscribers in CRM for those BANs
    const existingSubs = await crmClient.query(`
      SELECT s.id as sub_id, s.phone, b.ban_number, b.id as ban_id,
             c.name as client_name, c.id as client_id, c.salesperson_id
      FROM subscribers s
      JOIN bans b ON b.id = s.ban_id
      JOIN clients c ON c.id = b.client_id
      WHERE b.ban_number = ANY($1)
      ORDER BY b.ban_number, s.phone
    `, [allBANs]);

    const subsByBan = {};
    for (const s of existingSubs.rows) {
      if (!subsByBan[s.ban_number]) subsByBan[s.ban_number] = [];
      subsByBan[s.ban_number].push(s);
    }

    // 5. Delete ONLY PYMES reports that have NO manual data (preserve user-entered commissions)
    const delResult = await crmClient.query(`
      DELETE FROM subscriber_reports WHERE subscriber_id IN (
        SELECT s.id FROM subscribers s JOIN bans b ON b.id = s.ban_id
        WHERE b.ban_number = ANY($1)
      )
      AND (company_earnings IS NULL OR company_earnings = 0)
      AND (vendor_commission IS NULL OR vendor_commission = 0)
      AND (paid_amount IS NULL OR paid_amount = 0)
    `, [allBANs]);
    console.log(`[SYNC-PYMES] Borrados: ${delResult.rowCount} reports vacíos (preservando datos manuales)`);

    // 6. Group ventas by BAN
    const ventasByBan = {};
    for (const v of ventas) {
      const ban = (v.ban || '').trim();
      if (!ban) continue;
      if (!ventasByBan[ban]) ventasByBan[ban] = [];
      ventasByBan[ban].push(v);
    }

    let inserted = 0, created_clients = 0, created_bans = 0, created_subs = 0, errors = 0;
    const details = [];

    // Helper: determine line_type and account_type from ventatipoid
    function ventaTypeInfo(ventatipoid) {
      const id = Number(ventatipoid);
      // 138=Update REN, 139=Update NEW, 140=Fijo REN, 141=Fijo NEW
      const lineType = (id === 138 || id === 140) ? 'REN' : 'NEW';
      const accountType = (id === 138 || id === 139) ? 'UPDATE' : 'FIJO';
      return { lineType, accountType };
    }

    // 7. Process each BAN group — 1 venta = 1 subscriber = 1 report
    for (const ban of Object.keys(ventasByBan)) {
      const banVentas = ventasByBan[ban];
      let banSubs = subsByBan[ban] || [];
      let banId = banSubs.length > 0 ? banSubs[0].ban_id : null;
      let clientId = banSubs.length > 0 ? banSubs[0].client_id : null;

      // Determine account_type from first venta
      const firstTypeInfo = ventaTypeInfo(banVentas[0].ventatipoid);

      // AUTO-CREATE: if BAN doesn't exist in CRM, create client + BAN
      if (banSubs.length === 0) {
        try {
          const firstVenta = banVentas[0];
          const clienteName = (firstVenta.cliente || 'SIN NOMBRE').trim();
          const vendedorName = (firstVenta.vendedor || '').trim().toUpperCase();

          // Find salesperson in CRM
          let spId = null;
          if (vendedorName) {
            const spResult = await crmClient.query(
              "SELECT id FROM salespeople WHERE UPPER(name) LIKE $1 LIMIT 1",
              [`%${vendedorName}%`]
            );
            if (spResult.rows.length > 0) spId = spResult.rows[0].id;
          }

          // Check if client already exists by name
          const existClient = await crmClient.query(
            "SELECT id FROM clients WHERE UPPER(name) = $1 LIMIT 1",
            [clienteName.toUpperCase()]
          );
          if (existClient.rows.length > 0) {
            clientId = existClient.rows[0].id;
          } else {
            const newClient = await crmClient.query(
              "INSERT INTO clients (name, salesperson_id) VALUES ($1, $2) RETURNING id",
              [clienteName, spId]
            );
            clientId = newClient.rows[0].id;
            created_clients++;
            console.log(`[SYNC-PYMES] + Cliente creado: ${clienteName}`);
          }

          // Create BAN with correct account_type
          const newBan = await crmClient.query(
            "INSERT INTO bans (client_id, ban_number, account_type) VALUES ($1, $2, $3) RETURNING id",
            [clientId, ban, firstTypeInfo.accountType]
          );
          banId = newBan.rows[0].id;
          created_bans++;

          // Create follow_up as completed
          await crmClient.query(`
            INSERT INTO follow_up_prospects (client_id, company_name, is_active, completed_date, is_completed, notes)
            VALUES ($1, $2, false, NOW(), true, 'PYMES - Auto-creado por Sync Tango')
            ON CONFLICT DO NOTHING
          `, [clientId, clienteName]);

          details.push({ ban, cliente: clienteName, status: 'auto_created' });
        } catch (createErr) {
          console.error(`[SYNC-PYMES] Error creando BAN ${ban}:`, createErr.message);
          errors++;
          details.push({ ban, status: 'create_error', error: createErr.message });
          continue;
        }
      } else {
        // Update account_type on existing BAN if missing
        await crmClient.query(
          "UPDATE bans SET account_type = $1 WHERE id = $2 AND (account_type IS NULL OR account_type = '')",
          [firstTypeInfo.accountType, banId]
        );
      }

      // 8. For each venta, find or create a subscriber, then create report
      // Track which subscribers are already used (for this sync run)
      const usedSubIds = new Set();

      for (const v of banVentas) {
        const { lineType, accountType } = ventaTypeInfo(v.ventatipoid);
        const linea = (v.linea || '').replace(/[^0-9]/g, '');
        const month = v.fechaactivacion ? new Date(v.fechaactivacion) : new Date();
        const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;

        let targetSub = null;

        // Try match by phone number (if we have one)
        if (linea.length >= 7) {
          targetSub = banSubs.find(s => {
            if (usedSubIds.has(`${s.sub_id}|${monthStr}`)) return false;
            const sp = (s.phone || '').replace(/[^0-9]/g, '');
            return sp.endsWith(linea.slice(-7));
          });
        }

        // Try find any unused subscriber for this month
        if (!targetSub) {
          targetSub = banSubs.find(s => !usedSubIds.has(`${s.sub_id}|${monthStr}`));
        }

        // No available subscriber — create a new one
        if (!targetSub) {
          try {
            const phone = linea.length >= 7 ? linea : `LINEA-${ban}-${banSubs.length + 1}`;
            const newSub = await crmClient.query(
              "INSERT INTO subscribers (ban_id, phone, line_type) VALUES ($1, $2, $3) RETURNING id",
              [banId, phone, lineType]
            );
            created_subs++;
            const newSubObj = { sub_id: newSub.rows[0].id, phone, ban_number: ban, ban_id: banId, client_id: clientId };
            banSubs.push(newSubObj);
            targetSub = newSubObj;
          } catch (subErr) {
            console.error(`[SYNC-PYMES] Error creando subscriber BAN ${ban}:`, subErr.message);
            errors++;
            continue;
          }
        }

        // Mark this subscriber+month as used
        usedSubIds.add(`${targetSub.sub_id}|${monthStr}`);

        // Update subscriber line_type if needed
        await crmClient.query(
          "UPDATE subscribers SET line_type = $1 WHERE id = $2 AND line_type != $1",
          [lineType, targetSub.sub_id]
        );

        // 9. Insert report (comisiones en 0 para entrada manual)
        try {
          await crmClient.query(`
            INSERT INTO subscriber_reports (subscriber_id, report_month, company_earnings, vendor_commission)
            VALUES ($1, $2, 0, 0)
            ON CONFLICT (subscriber_id, report_month) DO NOTHING
          `, [targetSub.sub_id, monthStr]);
          inserted++;
        } catch (insErr) {
          console.error(`[SYNC-PYMES] Insert error sub=${targetSub.sub_id}:`, insErr.message);
          errors++;
        }
      }
    }

    // 10. MIRROR LOGIC — Remove CRM reports/subs that no longer exist in Tango
    // Collect all Tango BANs from active ventas (already in allBANs)
    // Also find BANs that exist in CRM (PYMES type) but NOT in Tango anymore
    let cancelled_reports = 0, cancelled_subs = 0;
    try {
      // Find ALL CRM subscriber_reports for PYMES BANs (those in allBANs)
      const allCrmReports = await crmClient.query(`
        SELECT sr.subscriber_id, sr.report_month,
               sr.company_earnings, sr.vendor_commission, sr.paid_amount,
               s.phone, b.ban_number
        FROM subscriber_reports sr
        JOIN subscribers s ON s.id = sr.subscriber_id
        JOIN bans b ON b.id = s.ban_id
        WHERE b.ban_number = ANY($1)
      `, [allBANs]);

      // Build a set of valid (ban|month|count) from Tango
      const tangoReportKeys = new Map(); // ban|month -> count
      for (const v of ventas) {
        const ban = (v.ban || '').trim();
        const month = v.fechaactivacion ? new Date(v.fechaactivacion) : new Date();
        const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
        const key = `${ban}|${monthStr}`;
        tangoReportKeys.set(key, (tangoReportKeys.get(key) || 0) + 1);
      }

      // Group CRM reports by ban|month
      const crmByKey = {};
      for (const r of allCrmReports.rows) {
        const m = new Date(r.report_month);
        const monthStr = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`;
        const k = `${r.ban_number}|${monthStr}`;
        if (!crmByKey[k]) crmByKey[k] = [];
        crmByKey[k].push(r);
      }

      // Delete excess CRM reports that don't exist in Tango
      for (const [key, crmReports] of Object.entries(crmByKey)) {
        const tangoCount = tangoReportKeys.get(key) || 0;
        const excess = crmReports.length - tangoCount;
        if (excess > 0) {
          // Sort: prioritize deleting reports with NO manual data
          crmReports.sort((a, b) => {
            const aManual = (parseFloat(a.company_earnings) || 0) + (parseFloat(a.vendor_commission) || 0) + (parseFloat(a.paid_amount) || 0);
            const bManual = (parseFloat(b.company_earnings) || 0) + (parseFloat(b.vendor_commission) || 0) + (parseFloat(b.paid_amount) || 0);
            return aManual - bManual; // delete zero-data first
          });
          const toDelete = crmReports.slice(0, excess);
          for (const del of toDelete) {
            const manual = (parseFloat(del.company_earnings) || 0) + (parseFloat(del.vendor_commission) || 0) + (parseFloat(del.paid_amount) || 0);
            if (manual === 0) {
              // Safe to delete — no manual data (PK is subscriber_id + report_month)
              await crmClient.query("DELETE FROM subscriber_reports WHERE subscriber_id = $1 AND report_month = $2", [del.subscriber_id, del.report_month]);
              cancelled_reports++;
              console.log(`[SYNC-MIRROR] Deleted empty report: BAN=${del.ban_number}, month=${key.split('|')[1]}, sub=${del.subscriber_id}`);
            } else {
              console.log(`[SYNC-MIRROR] ⚠ Kept report with manual data ($${manual}): BAN=${del.ban_number}, sub=${del.subscriber_id}`);
              details.push({ ban: del.ban_number, status: 'kept_manual_data', amount: manual });
            }
          }
        }
      }

      // Also: find PYMES BANs in CRM that are NOT in Tango active ventas at all
      // These may have been fully deactivated
      const orphanResult = await crmClient.query(`
        SELECT sr.subscriber_id, sr.report_month,
               sr.company_earnings, sr.vendor_commission, sr.paid_amount,
               b.ban_number
        FROM subscriber_reports sr
        JOIN subscribers s ON s.id = sr.subscriber_id
        JOIN bans b ON b.id = s.ban_id
        WHERE b.account_type IN ('UPDATE', 'FIJO')
          AND b.ban_number != ALL($1)
          AND (sr.company_earnings IS NULL OR sr.company_earnings = 0)
          AND (sr.vendor_commission IS NULL OR sr.vendor_commission = 0)
          AND (sr.paid_amount IS NULL OR sr.paid_amount = 0)
      `, [allBANs]);

      if (orphanResult.rows.length > 0) {
        for (const orph of orphanResult.rows) {
          await crmClient.query("DELETE FROM subscriber_reports WHERE subscriber_id = $1 AND report_month = $2", [orph.subscriber_id, orph.report_month]);
        }
        cancelled_reports += orphanResult.rows.length;
        const orphanBANs = [...new Set(orphanResult.rows.map(r => r.ban_number))];
        console.log(`[SYNC-MIRROR] Deleted ${orphanResult.rows.length} orphan reports from BANs not in Tango: ${orphanBANs.join(', ')}`);
        details.push({ status: 'orphans_removed', count: orphanResult.rows.length, bans: orphanBANs });
      }

    } catch (mirrorErr) {
      console.error('[SYNC-MIRROR] Error en lógica mirror:', mirrorErr.message);
      details.push({ status: 'mirror_error', error: mirrorErr.message });
    }

    // 11. Final verification — compare COUNTS (ventas must match exactly)
    const crmTotal = await crmClient.query(`
      SELECT COUNT(*) as reports
      FROM subscriber_reports WHERE subscriber_id IN (
        SELECT s.id FROM subscribers s JOIN bans b ON b.id = s.ban_id WHERE b.ban_number = ANY($1)
      )
    `, [allBANs]);

    const tangoTotal = await legacyPool.query(
      "SELECT COUNT(*) as ventas FROM venta WHERE ventatipoid IN (138,139,140,141) AND activo = true"
    );

    const crmCount = Number(crmTotal.rows[0].reports);
    const tangoCount = Number(tangoTotal.rows[0].ventas);
    const match = crmCount === tangoCount;

    console.log(`[SYNC-PYMES] Tango: ${tangoCount} ventas | CRM: ${crmCount} reports | ${match ? '✓ MATCH PERFECTO' : `⚠ DIFF (${tangoCount - crmCount})`}`);

    await crmClient.query('COMMIT');
    console.log(`[SYNC-PYMES] COMMIT OK — ${inserted} reports, ${created_clients} clientes, ${created_bans} BANs, ${created_subs} subs creados, ${cancelled_reports} cancelados`);

    // Build comprehensive report
    const report = {
      resumen: match
        ? `✅ SYNC PERFECTO — Tango ${tangoCount} = CRM ${crmCount}`
        : `⚠️ DIFERENCIA — Tango ${tangoCount} vs CRM ${crmCount} (diff: ${tangoCount - crmCount})`,
      acciones: [],
    };
    if (created_clients > 0) report.acciones.push(`${created_clients} cliente(s) creados`);
    if (created_bans > 0) report.acciones.push(`${created_bans} BAN(s) creados`);
    if (created_subs > 0) report.acciones.push(`${created_subs} suscriptor(es) creados`);
    if (inserted > 0) report.acciones.push(`${inserted} reporte(s) insertados`);
    if (cancelled_reports > 0) report.acciones.push(`${cancelled_reports} reporte(s) eliminados (mirror)`);
    if (errors > 0) report.acciones.push(`${errors} error(es)`);
    if (report.acciones.length === 0) report.acciones.push('Sin cambios necesarios');

    res.json({
      success: true,
      report,
      stats: {
        total_legacy: ventas.length,
        reports_created: inserted,
        reports_cancelled: cancelled_reports,
        clients_created: created_clients,
        bans_created: created_bans,
        subscribers_created: created_subs,
        errors,
        tango_ventas: tangoCount,
        crm_reports: crmCount,
        totals_match: match
      },
      details
    });

  } catch (error) {
    try { await crmClient.query('ROLLBACK'); } catch (e) { /* ignore */ }
    console.error('[SYNC-PYMES] Error:', error);
    res.status(500).json({ error: 'Error al sincronizar PYMES', details: error.message });
  } finally {
    crmClient.release();
  }
});

// ======================================================
// Comparación Tango PYMES vs CRM por mes
app.get('/api/subscriber-reports/comparison', authenticateRequest, requireRole(['admin', 'supervisor']), async (req, res) => {
  try {
    // 1. Datos de Tango
    const legacyPool = getTangoPool();
    const tangoResult = await legacyPool.query(`
      SELECT
        TO_CHAR(fechaactivacion, 'YYYY-MM') as month,
        COUNT(*) as ventas,
        COALESCE(SUM(comisionclaro), 0) as empresa,
        COALESCE(SUM(comisionvendedor), 0) as vendedor
      FROM venta
      WHERE ventatipoid IN (138, 139, 140, 141) AND activo = true
      GROUP BY TO_CHAR(fechaactivacion, 'YYYY-MM')
      ORDER BY month
    `);

    // 2. Datos del CRM
    const crmResult = await pool.query(`
      SELECT
        TO_CHAR(report_month, 'YYYY-MM') as month,
        COUNT(*) as ventas,
        COALESCE(SUM(company_earnings), 0) as empresa,
        COALESCE(SUM(vendor_commission), 0) as comision,
        COALESCE(SUM(paid_amount), 0) as pagado
      FROM subscriber_reports
      GROUP BY TO_CHAR(report_month, 'YYYY-MM')
      ORDER BY month
    `);

    // 3. Merge
    const tangoMap = {};
    for (const r of tangoResult.rows) {
      tangoMap[r.month] = { ventas: parseInt(r.ventas), empresa: parseFloat(r.empresa), vendedor: parseFloat(r.vendedor) };
    }
    const crmMap = {};
    for (const r of crmResult.rows) {
      crmMap[r.month] = { ventas: parseInt(r.ventas), empresa: parseFloat(r.empresa), comision: parseFloat(r.comision), pagado: parseFloat(r.pagado) };
    }

    const allMonths = [...new Set([...Object.keys(tangoMap), ...Object.keys(crmMap)])].sort();
    const comparison = allMonths.map(month => ({
      month,
      tango: tangoMap[month] || { ventas: 0, empresa: 0, vendedor: 0 },
      crm: crmMap[month] || { ventas: 0, empresa: 0, comision: 0, pagado: 0 },
      match: (tangoMap[month]?.ventas || 0) === (crmMap[month]?.ventas || 0),
    }));

    // 4. Detail: all Tango ventas with BAN, client, date, type
    const tangoDetailResult = await legacyPool.query(`
      SELECT v.ventaid, v.ban,
             COALESCE(cc.nombre, 'SIN NOMBRE') as cliente,
             v.fechaactivacion as fecha,
             v.status as linea,
             vt.nombre as tipo,
             v.ventatipoid,
             COALESCE(v.comisionclaro, 0) as comision_empresa,
             COALESCE(v.comisionvendedor, 0) as comision_vendedor,
             vd.nombre as vendedor
      FROM venta v
      JOIN ventatipo vt ON vt.ventatipoid = v.ventatipoid
      LEFT JOIN clientecredito cc ON cc.clientecreditoid = v.clientecreditoid
      LEFT JOIN vendedor vd ON vd.vendedorid = v.vendedorid
      WHERE v.ventatipoid IN (138, 139, 140, 141) AND v.activo = true
      ORDER BY v.fechaactivacion DESC, cc.nombre, v.ban
    `);

    res.json({ comparison, detail: tangoDetailResult.rows });
  } catch (error) {
    console.error('[COMPARISON] Error:', error);
    res.status(500).json({ error: 'Error al comparar datos', details: error.message });
  }
});

// ======================================================
// Reportes por Suscriptor (mensual)
function roundMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

function computeSuggestedVendorCommission(companyEarnings, commissionPercentage) {
  const earnings = Number(companyEarnings);
  const percentage = Number(commissionPercentage);
  if (!Number.isFinite(earnings) || earnings <= 0) return null;
  if (!Number.isFinite(percentage) || percentage <= 0) return null;
  return roundMoney((earnings * percentage) / 100);
}

function normalizeVendorNameKey(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function buildSubscriberReportDedupKey(row) {
  const ban = String(row?.ban_number || '').trim();
  const month = row?.report_month ? String(row.report_month).slice(0, 10) : '';
  const lineType = String(row?.line_type || '').trim().toUpperCase();
  const monthlyValue = roundMoney(row?.monthly_value);
  const companyEarnings = roundMoney(row?.company_earnings);
  return [ban, month, lineType, monthlyValue ?? '', companyEarnings ?? ''].join('|');
}

app.get('/api/subscriber-reports', authenticateRequest, async (req, res) => {
  try {
    await ensureSalespeopleCommissionColumn(pool);
    await ensureSubscriberReportsWorkflowColumns(pool);
    const reportMonth = normalizeReportMonth(req.query.month);
    const clientId = req.query.client_id ? String(req.query.client_id).trim() : '';
    const scope = await getVendorScope(req);
    const schema = await detectSubscriberSyncSchema(pool);
    const salespeopleSchema = await detectSalespeopleSchema(pool);
    const workflowSchema = await detectSubscriberReportsWorkflowSchema(pool);
    const params = [];
    const conditions = [];

    if (reportMonth) {
      params.push(reportMonth);
      conditions.push(`sr.report_month = $${params.length}`);
    }

    if (clientId) {
      params.push(clientId);
      conditions.push(`c.id = $${params.length}`);
    }

    // Filtrar por vendedor si no es admin
    if (scope.isVendor && !scope.salespersonId) {
      return res.json([]);
    }

    if (scope.isVendor && scope.salespersonId) {
      params.push(scope.salespersonId);
      conditions.push(`c.salesperson_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const rows = await query(`
      SELECT
        s.id as subscriber_id,
        s.${quoteIdent(schema.phoneColumn)} as phone,
        ${schema.hasLineType ? 's.line_type,' : 'NULL AS line_type,'}
        ${schema.hasTangoVentaId ? 's.tango_ventaid,' : 'NULL AS tango_ventaid,'}
        ${schema.hasStatus ? 's.status as subscriber_status,' : "'activo' AS subscriber_status,"}
        s.created_at as activation_date,
        b.${quoteIdent(schema.banNumberColumn)} as ban_number,
        b.account_type,
        c.id as client_id,
        c.name as client_name,
        c.salesperson_id,
        sp.name as salesperson_name,
        ${salespeopleSchema.hasCommissionPercentage ? 'sp.commission_percentage as salesperson_commission_percentage,' : 'NULL::numeric AS salesperson_commission_percentage,'}
        s.monthly_value as monthly_value,
        sr.report_month,
        sr.company_earnings,
        sr.vendor_commission,
        sr.paid_amount,
        sr.paid_date,
        ${workflowSchema.hasIsAudited ? 'sr.is_audited,' : 'FALSE AS is_audited,'}
        ${workflowSchema.hasAuditedAt ? 'sr.audited_at,' : 'NULL AS audited_at,'}
        ${workflowSchema.hasWithholdingApplies ? 'sr.withholding_applies' : 'TRUE AS withholding_applies'}
      FROM subscriber_reports sr
      JOIN subscribers s ON sr.subscriber_id = s.id
      JOIN bans b ON s.ban_id = b.id
      JOIN clients c ON b.client_id = c.id
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      ${whereClause}
      ORDER BY c.name, b.${quoteIdent(schema.banNumberColumn)}, s.${quoteIdent(schema.phoneColumn)}
    `, params);

    const vendorProfileSchema = await detectVendorProfileSchema(pool);
    const vendorCommissionByName = new Map();
    if (vendorProfileSchema.hasTable) {
      const vendorNames = [...new Set(
        rows
          .map((row) => normalizeVendorNameKey(row.salesperson_name))
          .filter(Boolean)
      )];

      if (vendorNames.length > 0) {
        const vendorRows = await query(`
          SELECT name, commission_percentage
          FROM vendors
          WHERE UPPER(TRIM(name)) = ANY($1)
        `, [vendorNames]);

        for (const vendorRow of vendorRows) {
          vendorCommissionByName.set(
            normalizeVendorNameKey(vendorRow.name),
            vendorRow.commission_percentage === null || vendorRow.commission_percentage === undefined
              ? null
              : Number(vendorRow.commission_percentage)
          );
        }
      }
    }

    const canonicalTangoKeys = new Set(
      rows
        .filter((row) => Number.isFinite(Number(row.tango_ventaid)) && Number(row.tango_ventaid) > 0)
        .map((row) => buildSubscriberReportDedupKey(row))
        .filter(Boolean)
    );

    const visibleRows = rows.filter((row) => {
      if (Number.isFinite(Number(row.tango_ventaid)) && Number(row.tango_ventaid) > 0) {
        return true;
      }

      const normalizedStatus = String(row.subscriber_status || 'activo').trim().toLowerCase();
      if (!normalizedStatus || normalizedStatus === 'activo' || normalizedStatus === 'active') {
        return true;
      }

      const dedupKey = buildSubscriberReportDedupKey(row);
      return !dedupKey || !canonicalTangoKeys.has(dedupKey);
    });

    const tangoVentaIds = [...new Set(
      visibleRows
        .map((row) => Number(row.tango_ventaid))
        .filter((value) => Number.isFinite(value) && value > 0)
    )];

    const saleTypeByVentaId = new Map();
    if (tangoVentaIds.length > 0) {
      try {
        const tangoPool = getTangoPool();
        const tangoResult = await tangoPool.query(`
          SELECT ventaid, ventatipoid
          FROM venta
          WHERE ventaid = ANY($1::int[])
        `, [tangoVentaIds]);

        for (const row of tangoResult.rows) {
          const ventaId = Number(row.ventaid);
          const ventaTipo = Number(row.ventatipoid);
          let saleType = null;
          if (ventaTipo === 138) saleType = 'MOVIL_RENOVACION';
          else if (ventaTipo === 139) saleType = 'MOVIL_NUEVA';
          else if (ventaTipo === 140) saleType = 'FIJO_REN';
          else if (ventaTipo === 141) saleType = 'FIJO_NEW';
          if (saleType) {
            saleTypeByVentaId.set(ventaId, saleType);
          }
        }
      } catch (tangoError) {
        console.warn('[subscriber-reports] No se pudo resolver sale_type desde Tango:', tangoError.message);
      }
    }

    const mapped = visibleRows.map((row) => {
      const profileCommissionPercentage = vendorCommissionByName.get(normalizeVendorNameKey(row.salesperson_name));
      const commissionPercentage =
        profileCommissionPercentage !== undefined
          ? profileCommissionPercentage
          : (
              row.salesperson_commission_percentage === null || row.salesperson_commission_percentage === undefined
                ? null
                : Number(row.salesperson_commission_percentage)
            );
      const storedVendorCommission =
        row.vendor_commission === null || row.vendor_commission === undefined
          ? null
          : Number(row.vendor_commission);
      const suggestedVendorCommission = computeSuggestedVendorCommission(row.company_earnings, commissionPercentage);
      const effectiveVendorCommission =
        storedVendorCommission !== null && storedVendorCommission > 0
          ? storedVendorCommission
          : suggestedVendorCommission;

      return {
      subscriber_id: row.subscriber_id,
      phone: row.phone,
      line_type: row.line_type || null,
      sale_type: saleTypeByVentaId.get(Number(row.tango_ventaid)) || null,
      activation_date: row.activation_date,
      ban_number: row.ban_number,
      account_type: row.account_type || null,
      client_id: row.client_id,
      client_name: row.client_name,
      client_business_name: null,
      vendor_id: row.salesperson_id,
      vendor_name: row.salesperson_name,
      salesperson_commission_percentage: commissionPercentage,
      report_month: row.report_month,
      monthly_value: row.monthly_value === null || row.monthly_value === undefined ? null : Number(row.monthly_value),
      company_earnings: row.company_earnings === null || row.company_earnings === undefined ? null : Number(row.company_earnings),
      vendor_commission: storedVendorCommission,
      suggested_vendor_commission: suggestedVendorCommission,
      effective_vendor_commission: effectiveVendorCommission,
      paid_amount: row.paid_amount === null || row.paid_amount === undefined ? null : Number(row.paid_amount),
      paid_date: row.paid_date,
      is_paid: Boolean(row.paid_date) || Number(row.paid_amount || 0) > 0,
      is_audited: Boolean(row.is_audited),
      audited_at: row.audited_at || null,
      withholding_applies: row.withholding_applies !== false
    };
    });

    res.json(mapped);
  } catch (error) {
    console.error('Error fetching subscriber reports:', error);
    res.status(500).json({ error: 'Error fetching subscriber reports', details: error.message });
  }
});

// PUT: Guardar reporte por suscriptor
app.put('/api/subscriber-reports/:subscriber_id', authenticateRequest, async (req, res) => {
  try {
    const { subscriber_id } = req.params;
    const { report_month, company_earnings, vendor_commission, paid_amount, paid_date, is_audited, withholding_applies, is_paid } = req.body || {};
    await ensureSalespeopleCommissionColumn(pool);
    await ensureSubscriberReportsWorkflowColumns(pool);
    const salespeopleSchema = await detectSalespeopleSchema(pool);
    const workflowSchema = await detectSubscriberReportsWorkflowSchema(pool);
    const vendorProfileSchema = await detectVendorProfileSchema(pool);

    const normalizedMonth = normalizeReportMonth(report_month);
    if (!normalizedMonth) {
      return badRequest(res, 'report_month es obligatorio y debe venir como YYYY-MM');
    }

    // VALIDACIÓN OBLIGATORIA: Cliente debe tener vendedor real (no admin)
    const clientCheck = await query(`
      SELECT c.id, c.name, s.name as salesperson_name, s.role as salesperson_role,
             ${salespeopleSchema.hasCommissionPercentage ? 's.commission_percentage' : 'NULL::numeric'} as salesperson_commission_percentage
      FROM subscribers sub
      JOIN bans b ON sub.ban_id = b.id
      JOIN clients c ON b.client_id = c.id
      LEFT JOIN salespeople s ON c.salesperson_id = s.id
      WHERE sub.id = $1
    `, [subscriber_id]);

    if (clientCheck.length === 0) {
      return res.status(404).json({ error: 'Suscriptor no encontrado' });
    }

    const { name: clientName, salesperson_name, salesperson_role, salesperson_commission_percentage } = clientCheck[0];
    let effectiveCommissionPercentage =
      salesperson_commission_percentage === null || salesperson_commission_percentage === undefined
        ? null
        : Number(salesperson_commission_percentage);
    if (vendorProfileSchema.hasTable && salesperson_name) {
      const vendorProfileRows = await query(`
        SELECT commission_percentage
        FROM vendors
        WHERE UPPER(TRIM(name)) = UPPER(TRIM($1))
        LIMIT 1
      `, [salesperson_name]);
      if (vendorProfileRows.length > 0 && vendorProfileRows[0].commission_percentage !== null && vendorProfileRows[0].commission_percentage !== undefined) {
        effectiveCommissionPercentage = Number(vendorProfileRows[0].commission_percentage);
      }
    }
    const normalizedSalesRole = String(salesperson_role || '').trim().toLowerCase();
    const allowedSalesRoles = new Set(['vendedor', 'supervisor', 'admin']);

    if (!salesperson_name || !allowedSalesRoles.has(normalizedSalesRole)) {
      return badRequest(
        res,
        `No se puede guardar. El cliente "${clientName}" debe tener un usuario comercial asignado ` +
        `(vendedor/supervisor/admin). Actualmente asignado a: ${salesperson_name || 'ninguno'} ` +
        `(${salesperson_role || 'sin role'}).`
      );
    }

    const sanitizedCompanyEarnings =
      company_earnings === '' || company_earnings === null || company_earnings === undefined
        ? null
        : parseFloat(company_earnings);
    const sanitizedVendorCommission =
      vendor_commission === '' || vendor_commission === null || vendor_commission === undefined
        ? null
        : parseFloat(vendor_commission);
    const sanitizedPaidAmount =
      paid_amount === '' || paid_amount === null || paid_amount === undefined
        ? null
        : parseFloat(paid_amount);
    const normalizedCompanyEarnings = Number.isNaN(sanitizedCompanyEarnings) ? null : sanitizedCompanyEarnings;
    const suggestedVendorCommission = computeSuggestedVendorCommission(normalizedCompanyEarnings, effectiveCommissionPercentage);
    const existingRows = await query(`
      SELECT *
      FROM subscriber_reports
      WHERE subscriber_id = $1 AND report_month = $2::date
      LIMIT 1
    `, [subscriber_id, normalizedMonth]);
    const existingReport = existingRows[0] || null;
    const existingIsPaid = Boolean(existingReport?.paid_date) || Number(existingReport?.paid_amount || 0) > 0;

    let normalizedVendorCommission = Number.isNaN(sanitizedVendorCommission) ? null : sanitizedVendorCommission;
    if ((normalizedVendorCommission === null || normalizedVendorCommission === 0) && suggestedVendorCommission !== null) {
      normalizedVendorCommission = suggestedVendorCommission;
    }

    let finalVendorCommission = normalizedVendorCommission;
    let finalPaidAmount = Number.isNaN(sanitizedPaidAmount) ? null : sanitizedPaidAmount;
    let finalPaidDate = paid_date || null;
    const shouldMarkPaid = is_paid === true || Boolean(finalPaidDate) || (finalPaidAmount !== null && finalPaidAmount > 0);

    if (existingIsPaid) {
      finalVendorCommission =
        existingReport.vendor_commission === null || existingReport.vendor_commission === undefined
          ? finalVendorCommission
          : Number(existingReport.vendor_commission);
      finalPaidAmount =
        existingReport.paid_amount === null || existingReport.paid_amount === undefined
          ? finalPaidAmount
          : Number(existingReport.paid_amount);
      finalPaidDate = existingReport.paid_date || finalPaidDate;
    } else if (shouldMarkPaid) {
      if ((finalVendorCommission === null || finalVendorCommission === undefined) && suggestedVendorCommission !== null) {
        finalVendorCommission = suggestedVendorCommission;
      }
      if ((finalPaidAmount === null || finalPaidAmount === undefined) && finalVendorCommission !== null && finalVendorCommission !== undefined) {
        finalPaidAmount = finalVendorCommission;
      }
      if (!finalPaidDate) {
        finalPaidDate = new Date().toISOString();
      }
    }

    const finalIsAudited =
      typeof is_audited === 'boolean'
        ? is_audited
        : Boolean(existingReport?.is_audited);
    const finalAuditedAt = finalIsAudited
      ? (existingReport?.audited_at || new Date().toISOString())
      : null;
    const finalWithholdingApplies =
      typeof withholding_applies === 'boolean'
        ? withholding_applies
        : (existingReport?.withholding_applies !== false);

    const columns = [
      'subscriber_id',
      'report_month',
      'company_earnings',
      'vendor_commission',
      'paid_amount',
      'paid_date'
    ];
    const values = [
      subscriber_id,
      normalizedMonth,
      normalizedCompanyEarnings,
      finalVendorCommission,
      finalPaidAmount,
      finalPaidDate
    ];
    const updates = [
      'company_earnings = EXCLUDED.company_earnings',
      'vendor_commission = EXCLUDED.vendor_commission',
      'paid_amount = EXCLUDED.paid_amount',
      'paid_date = EXCLUDED.paid_date'
    ];

    if (workflowSchema.hasIsAudited) {
      columns.push('is_audited');
      values.push(finalIsAudited);
      updates.push('is_audited = EXCLUDED.is_audited');
    }
    if (workflowSchema.hasAuditedAt) {
      columns.push('audited_at');
      values.push(finalAuditedAt);
      updates.push('audited_at = EXCLUDED.audited_at');
    }
    if (workflowSchema.hasWithholdingApplies) {
      columns.push('withholding_applies');
      values.push(finalWithholdingApplies);
      updates.push('withholding_applies = EXCLUDED.withholding_applies');
    }

    columns.push('created_at', 'updated_at');
    const placeholders = values.map((_, index) => index === 1 ? `$${index + 1}::date` : `$${index + 1}`);

    const result = await query(`
      INSERT INTO subscriber_reports (
        ${columns.join(', ')}
      ) VALUES (${placeholders.join(', ')}, NOW(), NOW())
      ON CONFLICT (subscriber_id, report_month)
      DO UPDATE SET
        ${updates.join(', ')},
        updated_at = NOW()
      RETURNING *
    `, values);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Suscriptor no encontrado' });
    }

    res.json({ success: true, report: result[0] });
  } catch (error) {
    console.error('Error saving subscriber report:', error);
    res.status(500).json({ error: 'Error saving subscriber report' });
  }
});

// ======================================================
/* LEGACY SEARCH COMMENTED OUT (Handled in clientRoutes.js)
app.get('/api/clients/search', ... 
*/



// ======================================================
// Fusionar Clientes
// LEGACY: Endpoint movido a src/backend/routes/clientRoutes.js (POST /merge)
// app.post('/api/clients/merge', authenticateRequest, async (req, res) => {
//   const { sourceId, targetId } = req.body;
//
//   if (!sourceId || !targetId) {
//     return res.status(400).json({ error: 'Se requieren sourceId y targetId' });
//   }
//
//   if (sourceId === targetId) {
//     return res.status(400).json({ error: 'No se puede fusionar el mismo cliente' });
//   }
//
//   try {
//     // 1. Verificar que ambos existan
//     const source = await query('SELECT * FROM clients WHERE id = $1', [sourceId]);
//     const target = await query('SELECT * FROM clients WHERE id = $1', [targetId]);
//
//     if (source.length === 0 || target.length === 0) {
//       return res.status(404).json({ error: 'Uno o ambos clientes no existen' });
//     }
//
//     // 2. Mover BANs
//     await query('UPDATE bans SET client_id = $1 WHERE client_id = $2', [targetId, sourceId]);
//
//     // 3. Mover Seguimientos (FollowUps)
//     try {
//       await query('UPDATE follow_up_prospects SET client_id = $1 WHERE client_id = $2', [targetId, sourceId]);
//     } catch (e) {
//       console.warn("No se pudo actualizar follow_up_prospects", e.message);
//     }
//
//     // 4. Eliminar Cliente Origen
//     await query('DELETE FROM clients WHERE id = $1', [sourceId]);
//
//     res.json({ success: true, message: `Cliente ${sourceId} fusionado en ${targetId} correctamente.` });
//
//   } catch (error) {
//     console.error('Error merging clients:', error);
//     res.status(500).json({ error: 'Error fusionando clientes' });
//   }
// });

// Clientes
// ======================================================
/* LEGACY ENDPOINT COMMENTED OUT - NOW USING clientRoutes.js (MODULAR)
app.get('/api/clients', async (req, res) => {
  // This endpoint is deprecated and replaced by clientRoutes.js
  // which includes proper stats calculation
  res.status(410).json({ error: 'Use modular clientRoutes' });
});
*/

app.get('/api/clients/:id', async (req, res) => {
  // ... (COMMENTED OUT)
  res.status(410).json({ error: 'Endpoint deprecated. Use modular routes.' });
});

// POST /api/clients - Crear nuevo cliente

// PUT /api/clients/:id - Actualizar cliente
// app.put('/api/clients/:id', ...

// ======================================================
// Endpoints de BANs
// ======================================================

// GET /api/bans
// app.get('/api/bans', ...

// POST /api/bans
// app.post('/api/bans', ...

// PUT /api/bans/:id
// app.put('/api/bans/:id', ...

// ======================================================
// Endpoints de Suscriptores
// ======================================================

const VALID_PR_PHONE = /^(787|939|989)\d{7}$/;
const VALID_PREFIXES = ['787', '939', '989'];
const OCR_CHAR_MAP = {
  O: '0',
  o: '0',
  I: '1',
  l: '1',
  S: '5',
  s: '5',
  B: '8',
  b: '8',
  Z: '2',
  z: '2',
  G: '6',
  g: '6'
};

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function normalizePlanCodeKey(value) {
  let cleaned = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  cleaned = cleaned.replace(/^(ACTIVE|ACTVE|ACIVE|CANCELLED|CANCELED|CANCELADO|INACTIVE|INACTIVO)/i, '');
  return cleaned;
}

function normalizeStatus(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('cancel')) return 'cancelado';
  if (raw.includes('actv') || raw.includes('acive') || raw.includes('actve')) return 'activo';
  if (raw.includes('active') || raw.includes('activo')) return 'activo';
  return 'activo';
}

const STATUS_TOKEN_REGEX = /\b(active|actve|acive|activo|canceled|cancelled|cancelado|inactivo)\b/i;

function hasStatusToken(value) {
  return STATUS_TOKEN_REGEX.test(String(value || ''));
}

function extractStatusOnlyLine(value) {
  const cleaned = String(value || '').trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^[-|:\s]*(active|actve|acive|activo|canceled|cancelled|cancelado|inactivo)[-|:\s]*$/i);
  return match ? normalizeStatus(match[1]) : null;
}

function normalizeOcrChars(value) {
  return String(value || '')
    .split('')
    .map((ch) => OCR_CHAR_MAP[ch] || ch)
    .join('');
}

function autocorrectPrefixIfNeeded(digits) {
  if (!digits || digits.length !== 10) return { phone: null, corrected: false };
  const prefix = digits.slice(0, 3);
  if (VALID_PREFIXES.includes(prefix)) {
    return { phone: digits, corrected: false };
  }

  let best = null;
  for (const candidate of VALID_PREFIXES) {
    let diff = 0;
    for (let i = 0; i < 3; i += 1) {
      if (candidate[i] !== prefix[i]) diff += 1;
    }
    if (best === null || diff < best.diff) {
      best = { prefix: candidate, diff };
    }
  }

  if (best && best.diff === 1) {
    return { phone: `${best.prefix}${digits.slice(3)}`, corrected: true };
  }

  return { phone: null, corrected: false };
}

function extractStatusFromLine(line) {
  const match = line.match(STATUS_TOKEN_REGEX);
  return normalizeStatus(match ? match[1] : 'activo');
}

function normalizePhoneCandidate(raw) {
  const cleaned = normalizeOcrChars(String(raw || '').trim());
  if (!cleaned) return { phone: null, ignored100: false };

  if (/^100[-\s]?\d+/i.test(cleaned)) {
    return { phone: null, ignored100: true, prefixCorrected: false };
  }

  let digits = cleaned.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }

  if (VALID_PR_PHONE.test(digits)) {
    return { phone: digits, ignored100: false, prefixCorrected: false };
  }

  const corrected = autocorrectPrefixIfNeeded(digits);
  if (corrected.phone && VALID_PR_PHONE.test(corrected.phone)) {
    return { phone: corrected.phone, ignored100: false, prefixCorrected: corrected.corrected };
  }

  return { phone: null, ignored100: false, prefixCorrected: false };
}

function extractPhoneFromLine(line) {
  const direct = normalizePhoneCandidate(line);
  if (direct.phone || direct.ignored100) return direct;

  const chunks = line.match(/\d[\d().\-\s]{6,}\d/g) || [];
  for (const chunk of chunks) {
    const candidate = normalizePhoneCandidate(chunk);
    if (candidate.phone || candidate.ignored100) return candidate;
  }

  const tokens = line.split(/\s+/);
  for (const token of tokens) {
    const candidate = normalizePhoneCandidate(token);
    if (candidate.phone || candidate.ignored100) return candidate;
  }

  return { phone: null, ignored100: false };
}

function extractPlanFromLine(line) {
  const statusMatch = line.match(STATUS_TOKEN_REGEX);
  const tail = statusMatch
    ? line.slice((statusMatch.index || 0) + statusMatch[0].length).trim()
    : line.trim();

  if (!tail) return null;
  let tailForPlan = tail.replace(new RegExp(STATUS_TOKEN_REGEX, 'gi'), '').trim();
  const token = (tailForPlan.match(/[A-Za-z0-9_-]{3,}/g) || [])[0] || null;
  return token ? token.toUpperCase() : null;
}

function extractPlanFromStandaloneLine(line) {
  const cleaned = String(line || '').trim();
  if (!cleaned) return null;
  if (extractStatusOnlyLine(cleaned)) return null;
  const phoneCheck = extractPhoneFromLine(cleaned);
  if (phoneCheck.phone || phoneCheck.ignored100) return null;
  let cleanedForPlan = cleaned.replace(new RegExp(STATUS_TOKEN_REGEX, 'gi'), '').trim();
  const token = (cleanedForPlan.match(/[A-Za-z0-9_-]{3,}/g) || [])[0] || null;
  return token ? token.toUpperCase() : null;
}

function rowsToClipboardText(rows) {
  const header = 'Subscriber Type Status Price Plan';
  const lines = rows
    .filter((row) => row.subscriber)
    .map((row) => [row.subscriber, row.type || 'G', row.status || 'Active', row.pricePlan || ''].filter(Boolean).join(' '));
  return [header, ...lines].join('\n').trim();
}

function normalizePhoneDigits(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return null;
}

function extractPhoneFromOcrLine(line) {
  const candidates = line.match(/(?:\+?1\s*)?(?:\(?\d{3}\)?[\s\-\.]*)\d{3}[\s\-\.]*\d{4}/g);
  if (candidates && candidates.length) {
    for (const candidate of candidates) {
      const phone = normalizePhoneDigits(candidate);
      if (phone) return phone;
    }
  }

  const longRuns = line.match(/\d[\d\s\-\.]{8,}\d/g);
  if (longRuns && longRuns.length) {
    for (const run of longRuns) {
      const phone = normalizePhoneDigits(run);
      if (phone) return phone;
    }
  }
  return null;
}

function parseOcrStatus(tokens) {
  const joined = tokens.join(' ').toLowerCase();
  const map = [
    [/\bactive\b/, 'Active'],
    [/\bactve\b/, 'Active'],
    [/\bacive\b/, 'Active'],
    [/\binactive\b/, 'Inactive'],
    [/\bcancel(?:led|ed|ado)?\b/, 'Cancelled'],
    [/\bsuspend(?:ed|ido|ida)?\b/, 'Suspended']
  ];

  for (const [regex, label] of map) {
    if (regex.test(joined)) {
      const restTokens = tokens.filter((token) => !regex.test(token.toLowerCase()));
      return { status: label, restTokens };
    }
  }
  return { status: '', restTokens: tokens };
}

function parseLocalOcrText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, ' ').trim())
    .filter(Boolean);

  const rows = [];
  const warnings = [];
  const seen = new Set();

  for (const line of lines) {
    const phone = extractPhoneFromOcrLine(line);
    if (!phone) continue;
    if (seen.has(phone)) continue;
    seen.add(phone);

    const lineNoPhone = line
      .replace(/(?:\+?1\s*)?(?:\(?\d{3}\)?[\s\-\.]*)\d{3}[\s\-\.]*\d{4}/, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const tokens = lineNoPhone.split(' ').filter(Boolean);

    let type = '';
    if (tokens.length && tokens[0].length <= 3) {
      type = tokens.shift() || '';
    }

    const parsedStatus = parseOcrStatus(tokens);
    const status = parsedStatus.status;
    const pricePlan = parsedStatus.restTokens.join(' ').trim();

    rows.push({
      subscriber: phone,
      type,
      status,
      pricePlan,
      rawLine: line
    });
  }

  if (!rows.length) {
    warnings.push('No se detectaron telefonos de 10 digitos. Sube imagen mas nitida o recortada a la tabla.');
  }

  return { rows, warnings, lineCount: lines.length };
}

async function ocrImageBuffer(buffer) {
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(buffer);
    return String(result?.data?.text || '');
  } finally {
    await worker.terminate();
  }
}

app.post('/api/subscribers/extract-image', authenticateRequest, uploadMemory.single('file'), async (req, res) => {
  try {
    let fileBuffer = null;
    let mime = '';

    if (req.file?.buffer) {
      fileBuffer = req.file.buffer;
      mime = String(req.file.mimetype || '').toLowerCase();
    } else if (req.body?.image_base64) {
      const rawBase64 = String(req.body.image_base64).trim().replace(/^data:.*;base64,/, '');
      if (!rawBase64) {
        return badRequest(res, 'image_base64 invalido');
      }
      fileBuffer = Buffer.from(rawBase64, 'base64');
      mime = String(req.body?.mime_type || 'image/png').toLowerCase();
    } else {
      return badRequest(res, 'Archivo requerido (file) o image_base64');
    }

    let text = '';
    if (mime.includes('pdf')) {
      const parsedPdf = await pdfParse(fileBuffer);
      text = String(parsedPdf?.text || '').trim();
      if (text.length < 30) {
        return res.status(422).json({
          error: 'PDF escaneado sin texto. Exporta/recorta una imagen de la tabla y vuelve a subir.'
        });
      }
    } else {
      text = await ocrImageBuffer(fileBuffer);
    }

    const parsed = parseLocalOcrText(text);
    const rows = parsed.rows.map((row) => ({
      subscriber: row.subscriber,
      type: row.type,
      status: row.status,
      pricePlan: row.pricePlan
    }));
    return res.json({
      ok: true,
      rows,
      text: rowsToClipboardText(rows),
      warnings: parsed.warnings,
      debug: {
        detectedRows: rows.length,
        parsedLines: parsed.lineCount
      },
      provider: 'local-ocr'
    });
  } catch (error) {
    return serverError(res, error, 'Error extrayendo texto con OCR local');
  }
});

function parseSubscriberRows(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd());

  const warnings = [];
  const parsedRows = [];
  const byPhone = new Map();
  let ignored100 = 0;
  let invalid = 0;
  let duplicateCount = 0;

  const consumed = new Set();

  for (let idx = 0; idx < lines.length; idx += 1) {
    if (consumed.has(idx)) continue;

    const original = lines[idx];
    const line = original.trim();
    if (!line) continue;
    if (/subscriber/i.test(line) && /status/i.test(line) && /plan/i.test(line)) continue;
    if (/subscriber\s*list\s*for\s*ban/i.test(line)) continue;
    if (/please\s+enter/i.test(line)) continue;

    const phoneResult = extractPhoneFromLine(line);
    if (phoneResult.ignored100) {
      ignored100 += 1;
      consumed.add(idx);
      continue;
    }

    if (!phoneResult.phone) {
      // Formato multilinea: estas lineas suelen ser estado/plan de la linea anterior.
      if (extractStatusOnlyLine(line) || extractPlanFromStandaloneLine(line)) {
        continue;
      }

      invalid += 1;
      warnings.push(`Linea ${idx + 1}: sin telefono valido 787/939/989`);
      parsedRows.push({
        line_no: idx + 1,
        raw_line: line,
        phone: null,
        status_norm: null,
        plan_code: null,
        action: 'invalid',
        warning: 'telefono_invalido'
      });
      continue;
    }

    consumed.add(idx);

    const inlineStatus = hasStatusToken(line);
    let statusNorm = inlineStatus ? extractStatusFromLine(line) : null;
    let planCode = inlineStatus ? extractPlanFromLine(line) : null;

    if (!statusNorm && idx + 1 < lines.length && !consumed.has(idx + 1)) {
      const nextLine = lines[idx + 1].trim();
      const nextStatus = extractStatusOnlyLine(nextLine);
      if (nextStatus) {
        statusNorm = nextStatus;
        consumed.add(idx + 1);
      }
    }

    if (!planCode && idx + 1 < lines.length && !consumed.has(idx + 1)) {
      const nextLine = lines[idx + 1].trim();
      const nextPlan = extractPlanFromStandaloneLine(nextLine);
      if (nextPlan) {
        planCode = nextPlan;
        consumed.add(idx + 1);
      }
    }

    if (!planCode && idx + 2 < lines.length && !consumed.has(idx + 2)) {
      const nextNextLine = lines[idx + 2].trim();
      const nextNextPlan = extractPlanFromStandaloneLine(nextNextLine);
      if (nextNextPlan) {
        planCode = nextNextPlan;
        consumed.add(idx + 2);
      }
    }

    const row = {
      line_no: idx + 1,
      raw_line: line,
      phone: phoneResult.phone,
      status_norm: statusNorm || 'activo',
      plan_code: planCode || null,
      action: 'pending',
      warning: phoneResult.prefixCorrected ? 'prefix_autocorrected' : null
    };

    if (phoneResult.prefixCorrected) {
      warnings.push(`Linea ${idx + 1}: prefijo corregido por OCR (${row.phone})`);
    }

    if (byPhone.has(row.phone)) {
      duplicateCount += 1;
      const existingRow = byPhone.get(row.phone);
      const isExistingActive = /activo|active/i.test(existingRow.status_norm);
      const isNewActive = /activo|active/i.test(row.status_norm);

      if (isExistingActive && !isNewActive) {
        warnings.push(`Linea ${idx + 1}: repetido ignorado (${row.phone}), se conserva plan Activo anterior`);
      } else {
        warnings.push(`Linea ${idx + 1}: duplicado en pegado para ${row.phone}, se reemplaza linea anterior`);
        byPhone.set(row.phone, row);
      }
    } else {
      byPhone.set(row.phone, row);
    }
  }

  const uniqueRows = [...byPhone.values()];
  return {
    uniqueRows,
    allRows: parsedRows.concat(uniqueRows),
    warnings,
    stats: {
      total_lines: lines.length,
      valid_rows: uniqueRows.length,
      ignored_100_prefix: ignored100,
      invalid_lines: invalid,
      duplicated_in_paste: duplicateCount
    }
  };
}

function resolvePriceFromCatalog(planCode, planCatalog) {
  if (!planCode) return null;
  const key = normalizePlanCodeKey(planCode);
  if (!key) return null;

  if (planCatalog.exact.has(key)) return planCatalog.exact.get(key);

  const candidates = planCatalog.similar.filter((item) => item.key.includes(key) || key.includes(item.key));
  if (candidates.length === 1) {
    return candidates[0].price;
  }
  return null;
}

async function detectSubscriberSyncSchema(client) {
  const [subColsResult, banColsResult] = await Promise.all([
    client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'subscribers'
    `),
    client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'bans'
    `)
  ]);

  const subCols = new Set(subColsResult.rows.map((r) => r.column_name));
  const banCols = new Set(banColsResult.rows.map((r) => r.column_name));

  const phoneColumn = subCols.has('phone_number')
    ? 'phone_number'
    : (subCols.has('phone') ? 'phone' : null);
  const banNumberColumn = banCols.has('number')
    ? 'number'
    : (banCols.has('ban_number') ? 'ban_number' : null);

  if (!phoneColumn || !banNumberColumn) {
    throw new Error('Schema subscribers/bans incompatible para sync');
  }

  return {
    phoneColumn,
    banNumberColumn,
    hasLineType: subCols.has('line_type'),
    hasTangoVentaId: subCols.has('tango_ventaid'),
    hasPlan: subCols.has('plan'),
    hasMonthlyValue: subCols.has('monthly_value'),
    hasStatus: subCols.has('status'),
    hasCreatedAt: subCols.has('created_at'),
    hasUpdatedAt: subCols.has('updated_at'),
    hasCancelReason: subCols.has('cancel_reason')
  };
}

async function detectSalespeopleSchema(client) {
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'salespeople'
  `);

  const cols = new Set(result.rows.map((r) => r.column_name));
  return {
    hasCommissionPercentage: cols.has('commission_percentage')
  };
}

async function detectVendorProfileSchema(client) {
  const tableResult = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'vendors'
    ) AS exists
  `);

  return {
    hasTable: Boolean(tableResult.rows[0]?.exists)
  };
}

async function ensureSalespeopleCommissionColumn(client) {
  try {
    await client.query(`
      ALTER TABLE salespeople
      ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2) DEFAULT 50.00
    `);
  } catch (error) {
    if (error?.code !== '42501') throw error;
    console.warn('[schema] Sin permisos para agregar salespeople.commission_percentage; se usará fallback legacy.');
  }
}

async function ensureSubscriberReportsWorkflowColumns(client) {
  try {
    await client.query(`
      ALTER TABLE subscriber_reports
      ADD COLUMN IF NOT EXISTS is_audited BOOLEAN DEFAULT FALSE
    `);
    await client.query(`
      ALTER TABLE subscriber_reports
      ADD COLUMN IF NOT EXISTS audited_at TIMESTAMP NULL
    `);
    await client.query(`
      ALTER TABLE subscriber_reports
      ADD COLUMN IF NOT EXISTS withholding_applies BOOLEAN DEFAULT TRUE
    `);
  } catch (error) {
    if (error?.code !== '42501') throw error;
    console.warn('[schema] Sin permisos para agregar columnas workflow en subscriber_reports; se usará fallback.');
  }
}

async function detectSubscriberReportsWorkflowSchema(client) {
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriber_reports'
  `);

  const cols = new Set(result.rows.map((r) => r.column_name));
  return {
    hasIsAudited: cols.has('is_audited'),
    hasAuditedAt: cols.has('audited_at'),
    hasWithholdingApplies: cols.has('withholding_applies')
  };
}

async function loadPlanCatalog(client) {
  const catalog = { exact: new Map(), similar: [] };
  try {
    const result = await client.query(`
      SELECT code, alpha_code, price
      FROM plans
      WHERE COALESCE(is_active, true) = true
    `);

    for (const row of result.rows) {
      const price = row.price !== null ? Number(row.price) : null;
      if (price === null || Number.isNaN(price)) continue;

      const codeKey = normalizePlanCodeKey(row.code);
      const alphaKey = normalizePlanCodeKey(row.alpha_code);

      if (codeKey) {
        catalog.exact.set(codeKey, price);
        catalog.similar.push({ key: codeKey, price });
      }
      if (alphaKey) {
        catalog.exact.set(alphaKey, price);
        catalog.similar.push({ key: alphaKey, price });
      }
    }
  } catch (_err) {
    // plans table is optional for this sync, keep monthly_value unresolved when unavailable
  }

  // Fallback Tango: tipoplan.codigovoz -> rate/precio/price
  try {
    const legacyDB = getTangoPool(); // Usar la BD externa que sí tiene tipoplan
    const tipoplanColsResult = await legacyDB.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tipoplan'
    `);
    const tipoplanCols = new Set(tipoplanColsResult.rows.map((r) => String(r.column_name || '').toLowerCase()));

    if (tipoplanCols.has('codigovoz')) {
      const candidatePriceCols = ['rate', 'precio', 'price', 'renta', 'monthly_value'];
      const priceCol = candidatePriceCols.find((col) => tipoplanCols.has(col));

      if (priceCol) {
        const result = await legacyDB.query(`
          SELECT codigovoz, ${quoteIdent(priceCol)} AS price
          FROM tipoplan
          WHERE codigovoz IS NOT NULL
        `);

        for (const row of result.rows) {
          const key = normalizePlanCodeKey(row.codigovoz);
          if (!key) continue;

          const rawPrice = row.price;
          if (rawPrice === null || rawPrice === undefined || rawPrice === '') continue;
          const parsedPrice = Number(String(rawPrice).replace(/[^0-9.-]/g, ''));
          if (Number.isNaN(parsedPrice)) continue;

          // Preferir catalogo local plans. tipoplan solo fallback.
          if (!catalog.exact.has(key)) {
            catalog.exact.set(key, parsedPrice);
          }
          catalog.similar.push({ key, price: parsedPrice });
        }
      }
    }
  } catch (_err) {
    // tipoplan is optional
    console.warn("[WARNING] Fail to load tipoplan from tango pool:", _err.message);
  }

  return catalog;
}

app.post('/api/subscribers/paste-sync', authenticateRequest, async (req, res) => {
  const {
    ban_id = null,
    ban_number = null,
    clipboard_text = '',
    dry_run = false,
    rows = null
  } = req.body || {};

  const rawFromRows = Array.isArray(rows)
    ? rows
      .map((row) => {
        const subscriber = row?.subscriber || row?.phone || row?.phone_number || '';
        const status = row?.status || '';
        const plan = row?.pricePlan || row?.plan || '';
        return `${subscriber} ${status} ${plan}`.trim();
      })
      .join('\n')
    : '';

  const rawText = String(clipboard_text || rawFromRows || '').trim();
  if (!rawText) {
    return badRequest(res, 'clipboard_text es obligatorio');
  }
  if (!ban_id && !ban_number) {
    return badRequest(res, 'Debes enviar ban_id o ban_number');
  }

  const parsed = parseSubscriberRows(rawText);
  const stats = {
    total_lines: parsed.stats.total_lines,
    valid_rows: parsed.stats.valid_rows,
    ignored_100_prefix: parsed.stats.ignored_100_prefix,
    invalid_lines: parsed.stats.invalid_lines,
    duplicated_in_paste: parsed.stats.duplicated_in_paste,
    conflicts_other_ban: 0,
    inserted: 0,
    updated: 0,
    canceled: 0,
    deleted: 0,
    unchanged: 0,
    set_active: 0,
    set_cancelled: 0
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const schema = await detectSubscriberSyncSchema(client);
    const phoneExpr = `NULLIF(regexp_replace(COALESCE(s.${quoteIdent(schema.phoneColumn)}::text, ''), '[^0-9]', '', 'g'), '')`;

    const banNumberSql = quoteIdent(schema.banNumberColumn);
    const banQuery = ban_id
      ? `SELECT id, ${banNumberSql} AS ban_number FROM bans WHERE id = $1 LIMIT 1`
      : `SELECT id, ${banNumberSql} AS ban_number FROM bans WHERE TRIM(${banNumberSql}::text) = TRIM($1::text) LIMIT 1`;
    const banParam = ban_id || ban_number;
    const banResult = await client.query(banQuery, [banParam]);
    if (banResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return notFound(res, 'BAN');
    }
    const ban = banResult.rows[0];

    const planCatalog = await loadPlanCatalog(client);
    const incomingPhones = parsed.uniqueRows.map((row) => row.phone).filter(Boolean);

    const existingBanResult = await client.query(`
      SELECT
        s.id,
        s.ban_id,
        s.${quoteIdent(schema.phoneColumn)} AS phone_value,
        ${schema.hasPlan ? 's.plan,' : 'NULL AS plan,'}
        ${schema.hasStatus ? 's.status,' : "NULL AS status,"}
        ${schema.hasMonthlyValue ? 's.monthly_value,' : 'NULL AS monthly_value,'}
        ${phoneExpr} AS phone_norm
      FROM subscribers s
      WHERE s.ban_id = $1
    `, [ban.id]);

    const existingByPhone = new Map();
    for (const row of existingBanResult.rows) {
      if (row.phone_norm) {
        existingByPhone.set(String(row.phone_norm), row);
      }
    }

    const globalByPhone = new Map();
    if (incomingPhones.length > 0) {
      const globalResult = await client.query(`
        SELECT
          s.id,
          s.ban_id,
          ${phoneExpr} AS phone_norm
        FROM subscribers s
        WHERE ${phoneExpr} = ANY($1::text[])
      `, [incomingPhones]);

      for (const row of globalResult.rows) {
        const key = String(row.phone_norm || '');
        if (!key) continue;
        if (!globalByPhone.has(key)) globalByPhone.set(key, []);
        globalByPhone.get(key).push(row);
      }
    }

    const missingPlans = new Set();
    for (const row of parsed.uniqueRows) {
      const desiredStatus = normalizeStatus(row.status_norm);
      const desiredPlan = row.plan_code || null;
      if (desiredStatus !== 'cancelado' && desiredPlan && resolvePriceFromCatalog(desiredPlan, planCatalog) === null) {
        missingPlans.add(desiredPlan);
      }
    }

    if (missingPlans.size > 0) {
      const missingList = Array.from(missingPlans).join(', ');
      parsed.warnings.push(`🛑 ALERTA: Los planes "${missingList}" no existen en el sistema. Se procesarán sin precio. Créalos después en la pestaña "Constructor Tarifas".`);
    }

    const previewRows = [];
    for (const row of parsed.uniqueRows) {
      const current = existingByPhone.get(row.phone);
      const desiredStatus = normalizeStatus(row.status_norm);
      const desiredPlan = row.plan_code || null;
      const resolvedPrice = desiredStatus === 'cancelado' ? null : resolvePriceFromCatalog(desiredPlan, planCatalog);

      if (current) {
        existingByPhone.delete(row.phone);
        const currentStatus = normalizeStatus(current.status);
        const currentPlan = current.plan ? String(current.plan) : null;
        const currentPhone = current.phone_value ? String(current.phone_value).replace(/\D/g, '') : '';
        const currentMonthly = current.monthly_value !== null ? Number(current.monthly_value) : null;
        const needsStatus = currentStatus !== desiredStatus;
        const needsPlan = schema.hasPlan && desiredPlan !== null && currentPlan !== desiredPlan;
        const needsPhone = currentPhone !== row.phone;
        const needsMonthly = schema.hasMonthlyValue && resolvedPrice !== null && currentMonthly !== resolvedPrice;
        const hasChanges = needsStatus || needsPlan || needsPhone || needsMonthly;

        let action = 'unchanged';
        if (hasChanges) action = desiredStatus === 'cancelado' ? 'cancel_existing' : 'update_existing';

        previewRows.push({
          ...row,
          action,
          warning: null
        });

        if (!hasChanges) {
          stats.unchanged += 1;
          continue;
        }

        if (action === 'cancel_existing') {
          stats.canceled += 1;
          stats.set_cancelled += 1;
        } else {
          stats.updated += 1;
          stats.set_active += 1;
        }

        if (!dry_run) {
          const setParts = [];
          const values = [];
          let idx = 1;

          setParts.push(`${quoteIdent(schema.phoneColumn)} = $${idx}`);
          values.push(row.phone);
          idx += 1;

          if (schema.hasStatus) {
            setParts.push(`status = $${idx}`);
            values.push(desiredStatus);
            idx += 1;
          }
          if (schema.hasPlan) {
            setParts.push(`plan = $${idx}`);
            values.push(desiredPlan);
            idx += 1;
          }
          if (schema.hasMonthlyValue && resolvedPrice !== null) {
            setParts.push(`monthly_value = $${idx}`);
            values.push(resolvedPrice);
            idx += 1;
          }
          if (schema.hasCancelReason) {
            setParts.push(`cancel_reason = $${idx}`);
            values.push(desiredStatus === 'cancelado' ? 'Cancelado via pegado masivo' : null);
            idx += 1;
          }
          if (schema.hasUpdatedAt) {
            setParts.push('updated_at = NOW()');
          }

          values.push(current.id);
          await client.query(
            `UPDATE subscribers SET ${setParts.join(', ')} WHERE id = $${idx}`,
            values
          );
        }
        continue;
      }

      const globalMatches = globalByPhone.get(row.phone) || [];
      const conflictRow = globalMatches.find((item) => String(item.ban_id) !== String(ban.id));
      if (conflictRow) {
        stats.conflicts_other_ban += 1;
        previewRows.push({
          ...row,
          action: 'conflict_other_ban',
          warning: `telefono ya existe en otro BAN (${conflictRow.ban_id})`
        });
        continue;
      }

      const insertStatus = desiredStatus;
      previewRows.push({
        ...row,
        action: insertStatus === 'cancelado' ? 'insert_cancelado' : 'insert_new',
        warning: null
      });

      if (insertStatus === 'cancelado') {
        stats.canceled += 1;
        stats.set_cancelled += 1;
      } else {
        stats.inserted += 1;
        stats.set_active += 1;
      }

      if (!dry_run) {
        const cols = ['ban_id', schema.phoneColumn];
        const valuesSql = ['$1', '$2'];
        const values = [ban.id, row.phone];
        let idx = 3;

        if (schema.hasStatus) {
          cols.push('status');
          valuesSql.push(`$${idx}`);
          values.push(insertStatus);
          idx += 1;
        }
        if (schema.hasPlan) {
          cols.push('plan');
          valuesSql.push(`$${idx}`);
          values.push(desiredPlan);
          idx += 1;
        }
        if (schema.hasMonthlyValue && resolvedPrice !== null) {
          cols.push('monthly_value');
          valuesSql.push(`$${idx}`);
          values.push(resolvedPrice);
          idx += 1;
        }
        if (schema.hasCancelReason) {
          cols.push('cancel_reason');
          valuesSql.push(`$${idx}`);
          values.push(insertStatus === 'cancelado' ? 'Cancelado via pegado masivo' : null);
          idx += 1;
        }
        if (schema.hasCreatedAt) {
          cols.push('created_at');
          valuesSql.push('NOW()');
        }
        if (schema.hasUpdatedAt) {
          cols.push('updated_at');
          valuesSql.push('NOW()');
        }

        await client.query(
          `INSERT INTO subscribers (${cols.map((col) => quoteIdent(col)).join(', ')})
           VALUES (${valuesSql.join(', ')})`,
          values
        );
      }
    }

    const rowsToDelete = Array.from(existingByPhone.values());
    for (const rowToDelete of rowsToDelete) {
      previewRows.push({
        phone: rowToDelete.phone_value || '',
        status_norm: rowToDelete.status || '',
        plan_code: rowToDelete.plan || '',
        action: 'delete_existing',
        warning: 'no existe en la imagen procesada'
      });
      stats.deleted = (stats.deleted || 0) + 1;

      if (!dry_run) {
        await client.query('DELETE FROM subscribers WHERE id = $1', [rowToDelete.id]);
      }
    }

    if (dry_run) {
      await client.query('ROLLBACK');
    } else {
      // Sync the BAN status so that the BAN goes to cancelled tab if all its subscribers are cancelled.
      await client.query(`
        UPDATE bans 
        SET status = CASE 
          WHEN (
            SELECT COUNT(*) 
            FROM subscribers 
            WHERE ban_id = bans.id
          ) > 0 AND (
            SELECT COUNT(*) 
            FROM subscribers 
            WHERE ban_id = bans.id 
              AND LOWER(status) NOT IN ('cancelado', 'cancelled', 'inactivo')
          ) = 0 THEN 'C'
          ELSE 'A'
        END,
        updated_at = NOW()
        WHERE id = $1
      `, [ban.id]);

      await client.query('COMMIT');
    }

    return res.json({
      ok: true,
      dry_run: Boolean(dry_run),
      stats,
      rows: previewRows,
      warnings: parsed.warnings
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_e) { /* ignore */ }
    return serverError(res, error, 'Error procesando pegado masivo de suscriptores');
  } finally {
    client.release();
  }
});

// GET /api/subscribers - Obtener suscriptores
app.get('/api/subscribers', authenticateRequest, async (req, res) => {
  const { ban_id, client_id } = req.query;
  try {
    let sql = 'SELECT s.* FROM subscribers s';
    const params = [];

    if (ban_id) {
      sql += ' WHERE s.ban_id = $1';
      params.push(ban_id);
    } else if (client_id) {
      sql += ' JOIN bans b ON s.ban_id = b.id WHERE b.client_id = $1';
      params.push(client_id);
    }

    sql += ' ORDER BY s.created_at DESC';

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting subscribers:', error);
    res.status(500).json({ error: 'Error obteniendo suscriptores' });
  }
});

// POST /api/subscribers - Crear suscriptor
app.post('/api/subscribers', authenticateRequest, async (req, res) => {
  const {
    ban_id,
    phone,
    plan,
    monthly_value,
    remaining_payments = null,
    contract_term = null,
    contract_end_date = null
  } = req.body;

  if (!ban_id || !phone) {
    return res.status(400).json({ error: 'BAN y número de teléfono son obligatorios' });
  }

  try {
    // Verificar si ya existe
    const existing = await pool.query('SELECT id FROM subscribers WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El número de teléfono ya existe' });
    }

    const result = await pool.query(
      `INSERT INTO subscribers
  (ban_id, phone, plan, monthly_value, remaining_payments, contract_term, contract_end_date, created_at, updated_at)
VALUES($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
RETURNING * `,
      [ban_id, phone, plan, monthly_value, remaining_payments, contract_term, contract_end_date]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating subscriber:', error);
    res.status(500).json({ error: 'Error creando suscriptor' });
  }
});

// PUT /api/subscribers/:id/cancel - Cancelar línea de suscriptor
app.put('/api/subscribers/:id/cancel', authenticateRequest, async (req, res) => {
  const { id } = req.params;
  const { cancel_reason = null } = req.body || {};
  try {
    const existing = await query('SELECT id FROM subscribers WHERE id = $1', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Suscriptor no encontrado' });
    const result = await query(
      `UPDATE subscribers SET status = 'cancelado', cancel_reason = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [cancel_reason, id]
    );
    res.json(result[0]);
  } catch (error) {
    console.error('Error cancelando suscriptor:', error);
    res.status(500).json({ error: 'Error cancelando suscriptor' });
  }
});

// PUT /api/subscribers/:id/reactivate - Reactivar línea cancelada
app.put('/api/subscribers/:id/reactivate', authenticateRequest, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await query('SELECT id FROM subscribers WHERE id = $1', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Suscriptor no encontrado' });
    const result = await query(
      `UPDATE subscribers SET status = 'activo', cancel_reason = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    res.json(result[0]);
  } catch (error) {
    console.error('Error reactivando suscriptor:', error);
    res.status(500).json({ error: 'Error reactivando suscriptor' });
  }
});

// PUT /api/subscribers/:id - Actualizar suscriptor
app.put('/api/subscribers/:id', authenticateRequest, async (req, res) => {
  const { id } = req.params;
  const {
    phone,
    plan,
    monthly_value,
    remaining_payments,
    contract_term,
    contract_end_date
  } = req.body;

  try {
    const existing = await pool.query('SELECT id FROM subscribers WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Suscriptor no encontrado' });
    }

    const result = await pool.query(
      `UPDATE subscribers
      SET phone = COALESCE($1, phone),
  plan = COALESCE($2, plan),
  monthly_value = COALESCE($3, monthly_value),
  remaining_payments = COALESCE($4, remaining_payments),
  contract_term = COALESCE($5, contract_term),
  contract_end_date = COALESCE($6, contract_end_date),
  updated_at = NOW()
      WHERE id = $7
RETURNING * `,
      [
        phone, plan, monthly_value, remaining_payments, contract_term, contract_end_date, id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating subscriber:', error);
    res.status(500).json({ error: 'Error actualizando suscriptor' });
  }
});

// ======================================================
// Endpoint para limpiar BD (solo desarrollo)
// ======================================================
app.delete('/api/admin/clean-database', authenticateRequest, async (req, res) => {
  try {
    // Verificar que sea admin o desarrollo
    if (req.user.role !== 'admin' && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Solo administradores pueden limpiar la BD en producción' });
    }

    console.log('\n⚠️ LIMPIEZA DE BD solicitada por:', req.user.username);

    // Contar antes
    const antes = await Promise.all([
      query('SELECT COUNT(*) as total FROM subscribers'),
      query('SELECT COUNT(*) as total FROM bans'),
      query('SELECT COUNT(*) as total FROM clients')
    ]);

    const conteosAntes = {
      subscribers: parseInt(antes[0][0].total),
      bans: parseInt(antes[1][0].total),
      clients: parseInt(antes[2][0].total)
    };

    console.log('📊 Antes:', conteosAntes);

    // Borrar en orden
    await query('DELETE FROM subscribers');
    await query('DELETE FROM bans');
    await query('DELETE FROM clients');

    // Contar después
    const despues = await Promise.all([
      query('SELECT COUNT(*) as total FROM subscribers'),
      query('SELECT COUNT(*) as total FROM bans'),
      query('SELECT COUNT(*) as total FROM clients')
    ]);

    const conteosDespues = {
      subscribers: parseInt(despues[0][0].total),
      bans: parseInt(despues[1][0].total),
      clients: parseInt(despues[2][0].total)
    };

    console.log('✅ Después:', conteosDespues);
    console.log('✅ BD limpiada completamente');

    res.json({
      success: true,
      antes: conteosAntes,
      despues: conteosDespues
    });
  } catch (error) {
    console.error('❌ Error limpiando BD:', error);
    serverError(res, error, 'Error limpiando base de datos');
  }
});

// ======================================================
// Endpoint de Diagnóstico (Health Check) - ANTES del Fallback
// ======================================================
app.get('/api/health/full', fullSystemCheck);
app.get('/api/system-test/full', runFullSystemTest);

// GET /api/audit-log - Obtener historial de auditoría (SOLO ADMIN)
app.get('/api/audit-log', async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const action = req.query.action;
    const entityType = req.query.entity_type;
    const userId = req.query.user_id;
    const username = req.query.username;

    let whereConditions = [];
    let params = [];
    let paramCount = 1;

    if (action) {
      whereConditions.push(`action = $${paramCount++} `);
      params.push(action);
    }
    if (entityType) {
      whereConditions.push(`entity_type = $${paramCount++} `);
      params.push(entityType);
    }
    if (userId) {
      whereConditions.push(`user_id = $${paramCount++} `);
      params.push(parseInt(userId));
    }
    if (username) {
      whereConditions.push(`LOWER(COALESCE(username, '')) LIKE $${paramCount++} `);
      params.push(`%${String(username).toLowerCase()}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')} ` : '';

    params.push(limit, offset);
    const rows = await query(
      `SELECT * FROM audit_log ${whereClause} ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++} `,
      params
    );

    const countResult = await query(`SELECT COUNT(*) as total FROM audit_log ${whereClause} `, params.slice(0, -2));
    const total = parseInt(countResult[0].total);

    res.json({
      logs: rows,
      total,
      limit,
      offset
    });
  } catch (error) {
    serverError(res, error, 'Error obteniendo historial de auditoría');
  }
});

// GET /api/audit-log/users - Lista de usuarios para filtros de auditoría
app.get('/api/audit-log/users', async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const rows = await query(`
      SELECT username
      FROM (
        SELECT DISTINCT username FROM users_auth
        UNION
        SELECT DISTINCT username FROM audit_log WHERE username IS NOT NULL
      ) u
      WHERE username IS NOT NULL AND TRIM(username) <> ''
      ORDER BY username
    `);

    res.json(rows.map((row) => row.username));
  } catch (error) {
    serverError(res, error, 'Error obteniendo usuarios de auditoría');
  }
});

// ======================================================
// SPA Fallback
// ======================================================
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }

  // Siempre usar distPath (varWwwPath deprecated)
  const indexPath = path.join(distPath, 'index.html');

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend no encontrado. Ejecute npm run build.');
  }
});

// ======================================================
// Arranque del servidor
// ======================================================
const server = app.listen(PORT, () => {
  console.log(`✅ CRM Pro API escuchando en el puerto ${PORT} `);
});

// ============================================================
// AUDIT LOG - Sistema de auditoría
// ============================================================

// Función helper para registrar eventos
async function logAudit(userId, username, action, entityType, entityId, entityName, details, ipAddress = null) {
  try {
    const safeUserId = Number.isFinite(Number(userId)) ? Number(userId) : null;
    const safeEntityId = Number.isFinite(Number(entityId)) ? Number(entityId) : null;
    await query(
      `INSERT INTO audit_log(user_id, username, action, entity_type, entity_id, entity_name, details, ip_address)
VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
      [safeUserId, username, action, entityType, safeEntityId, entityName, details, ipAddress]
    );
  } catch (error) {
    console.error('❌ Error registrando auditoría:', error);
  }
}

// GET /api/audit-log - Obtener historial de auditoría (SOLO ADMIN)
app.get('/api/audit-log', async (req, res) => {
  try {
    // SOLO ADMIN puede ver el historial
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const action = req.query.action;
    const entityType = req.query.entity_type;
    const userId = req.query.user_id;
    const username = req.query.username;

    let whereConditions = [];
    let params = [];
    let paramCount = 1;

    if (action) {
      whereConditions.push(`action = $${paramCount++} `);
      params.push(action);
    }
    if (entityType) {
      whereConditions.push(`entity_type = $${paramCount++} `);
      params.push(entityType);
    }
    if (userId) {
      whereConditions.push(`user_id = $${paramCount++} `);
      params.push(parseInt(userId));
    }
    if (username) {
      whereConditions.push(`LOWER(COALESCE(username, '')) LIKE $${paramCount++} `);
      params.push(`%${String(username).toLowerCase()}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')} ` : '';

    params.push(limit, offset);
    const rows = await query(
      `SELECT * FROM audit_log ${whereClause} ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++} `,
      params
    );

    const countResult = await query(`SELECT COUNT(*) as total FROM audit_log ${whereClause} `, params.slice(0, -2));
    const total = parseInt(countResult[0].total);

    res.json({
      logs: rows,
      total,
      limit,
      offset
    });
  } catch (error) {
    serverError(res, error, 'Error obteniendo historial de auditoría');
  }
});

// ======================================================
// Endpoint de Email (Office 365)
// ======================================================
app.post('/api/email/send', authenticateRequest, async (req, res) => {
  const { to, subject, html, text } = req.body;

  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({ error: 'Faltan campos requeridos (to, subject, html/text)' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        ciphers: 'SSLv3'
      }
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER, // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });

    console.log('Message sent: %s', info.messageId);
    res.json({ message: 'Correo enviado correctamente', messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Error al enviar el correo. Verifica las credenciales SMTP.' });
  }
});

// Endpoint de Reportes (Para pasar agent-functional.js)
/* LEGACY COMPLETED-PROSPECTS COMMENTED OUT (Already handled at line 1599)
app.get('/api/completed-prospects', authenticateRequest, (req, res) => {
  res.json([]);
});
*/

// ======================================================
// Endpoint de Importación (Refactorizado)
// ======================================================
// LEGACY: Endpoint movido a src/backend/routes/importRoutes.js (POST /save)
// app.post('/api/importador/save', authenticateRequest, saveImportData);

// Configurar timeouts del servidor para importaciones grandes (1 hora)
server.timeout = 3600000;
server.keepAliveTimeout = 3600000;
server.headersTimeout = 3600000;

