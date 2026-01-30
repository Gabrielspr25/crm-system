import express from 'express';
import cors from 'cors';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const packageJson = require('./package.json');
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones desde esta IP, intente nuevamente en 15 minutos.' }
});
app.use('/api', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ======================================================
// DEBUG: FIX SCHEMA ENDPOINT (EMERGENCY)
// ======================================================
app.get('/api/debug/fix-schema', async (req, res) => {
  if (req.query.token !== 'FIXME123') return res.status(403).json({ error: 'Forbidden' });

  try {
    console.log('[DEBUG] Testing CREATE TABLE permissions...');

    await query(`
      CREATE TABLE IF NOT EXISTS test_permissions_check (
        id SERIAL PRIMARY KEY,
        test_val VARCHAR(255)
      );
    `);

    // Si llegamos aquí, PODEMOS crear tablas.
    // Intentemos crear la tabla satélite de comisiones
    await query(`
      CREATE TABLE IF NOT EXISTS follow_up_commissions (
          prospect_id INTEGER PRIMARY KEY, -- No FK constraint yet to avoid perm issues, just logical link
          vendor_commission DECIMAL(10,2) DEFAULT 0,
          manual_company_earnings DECIMAL(10,2),
          updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    res.json({ success: true, message: 'CRITICAL SUCCESS: Created satellite table follow_up_commissions' });

  } catch (error) {
    console.error('[DEBUG] Error creating table:', error);
    res.status(500).json({ error: error.message });
  }
});

// Servir archivos estáticos del frontend (dist/client)
const distPath = path.join(__dirname, 'dist/client');
// const varWwwPath = '/var/www/crmp'; // DEPRECATED: We now use /opt/crmp/dist/client
app.use(express.static(distPath));

// ======================================================
// Seguridad y Autenticación (MOVED UP FOR SECURITY)
// ======================================================
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'development-refresh-secret';
const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const PUBLIC_ROUTES = new Set([
  'GET /api/health',
  'GET /api/health/full',
  'GET /api/version',
  'POST /api/login',
  'POST /api/token/refresh',
  'GET /api/tarifas/plans',
  'GET /api/tarifas/categories'
]);

const normalizeRoutePath = (routePath) => {
  if (!routePath.startsWith('/')) {
    return `/${routePath}`;
  }
  return routePath.replace(/\/+$/, '') || '/';
};

const isPublicRoute = (req) => {
  if (!req.path.startsWith('/api')) {
    return true;
  }
  const key = `${req.method.toUpperCase()} ${normalizeRoutePath(req.path)}`;
  if (PUBLIC_ROUTES.has(key)) {
    return true;
  }
  return false;
};

// Functions `toDbId` etc are hoisted so we can use them here

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
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: toDbId(payload.userId),
      username: payload.username,
      salespersonId: toDbId(payload.salespersonId),
      salespersonName: payload.salespersonName,
      role: payload.role
    };
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// APLICAR SEGURIDAD ANTES DE MONTAR RUTAS
app.use(authenticateRequest);

// Rutas de Módulos Específicos
app.use('/api/referidos', referidosRoutes);
app.use('/api/tariffs', tarifasRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/bans', banRoutes);
app.use('/api/importador', importRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/products', productRoutes);
app.use('/api/tiers-fixed', tiersFixedRoutes);
app.use('/api/pos', posIntegrationRoutes);

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
  accessToken: jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL }),
  refreshToken: jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL })
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
    LEFT JOIN products p ON pg.product_id = p.id
    LEFT JOIN vendors v ON pg.vendor_id = v.id
`;

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

    const payload = sanitizeUserPayload(user);
    const { accessToken, refreshToken } = issueTokens(payload);

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
app.post('/api/admin/clean-names-ban-dev', async (req, res) => {
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

// Middleware de autenticación aplicado arriba

app.get('/api/me', (req, res) => {
  res.json(req.user);
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

    // NO filtrar por is_active - el frontend maneja el filtro de completados
    let whereClause = '';
    if (include_completed !== 'true') {
      whereClause = 'WHERE p.completed_date IS NULL';
    }

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

    const rows = await query(sql);
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

    if (!client_id) {
      return res.status(400).json({ error: 'client_id es obligatorio' });
    }

    // Verificar que el cliente existe y obtener su nombre
    const clientData = await query('SELECT id, name FROM clients WHERE id = $1', [client_id]);
    if (clientData.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
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
    const {
      client_id, priority_id, vendor_id, completed_date,
      fijo_ren, fijo_new, movil_nueva, movil_renovacion,
      claro_tv, cloud, mpls, notes, vendor_commission,
      manual_company_earnings
    } = req.body;

    console.log(`[UPDATE PROSPECT ${id}] movil_nueva=${movil_nueva}, movil_renovacion=${movil_renovacion}`);

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
// Reportes por Suscriptor (mensual)
app.get('/api/subscriber-reports', authenticateRequest, async (req, res) => {
  try {
    const reportMonth = normalizeReportMonth(req.query.month);
    const params = [];
    let whereClause = '';

    if (reportMonth) {
      params.push(reportMonth);
      whereClause = 'WHERE fup.completed_date IS NOT NULL AND date_trunc(\'month\', fup.completed_date)::date = $1';
    } else {
      whereClause = 'WHERE fup.completed_date IS NOT NULL';
    }

    const rows = await query(`
      SELECT
        s.id as subscriber_id,
        s.phone,
        s.created_at as activation_date,
        b.ban_number as ban_number,
        c.id as client_id,
        c.name as client_name,
        c.salesperson_id,
        sp.name as salesperson_name,
        s.monthly_value as monthly_value,
        fup.completed_date as completed_date,
        date_trunc('month', fup.completed_date)::date as report_month,
        sr.company_earnings,
        sr.vendor_commission,
        sr.paid_amount,
        sr.paid_date
      FROM subscribers s
      JOIN bans b ON s.ban_id = b.id
      JOIN clients c ON b.client_id = c.id
      LEFT JOIN LATERAL (
        SELECT fup.completed_date
        FROM follow_up_prospects fup
        WHERE fup.client_id = c.id AND fup.completed_date IS NOT NULL
        ORDER BY fup.completed_date DESC
        LIMIT 1
      ) fup ON true
      LEFT JOIN salespeople sp ON c.salesperson_id = sp.id
      LEFT JOIN subscriber_reports sr
        ON sr.subscriber_id = s.id
       AND sr.report_month = date_trunc('month', fup.completed_date)::date
      ${whereClause}
      ORDER BY s.created_at DESC
    `, params);

    const mapped = rows.map((row) => ({
      subscriber_id: row.subscriber_id,
      phone: row.phone,
      activation_date: row.activation_date,
      completed_date: row.completed_date,
      ban_number: row.ban_number,
      client_id: row.client_id,
      client_name: row.client_name,
      client_business_name: null,
      vendor_id: row.salesperson_id,
      vendor_name: row.salesperson_name,
      report_month: row.report_month,
      monthly_value: row.monthly_value === null || row.monthly_value === undefined ? null : Number(row.monthly_value),
      company_earnings: row.company_earnings === null || row.company_earnings === undefined ? null : Number(row.company_earnings),
      vendor_commission: row.vendor_commission === null || row.vendor_commission === undefined ? null : Number(row.vendor_commission),
      paid_amount: row.paid_amount === null || row.paid_amount === undefined ? null : Number(row.paid_amount),
      paid_date: row.paid_date
    }));

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
    const { report_month, company_earnings, vendor_commission, paid_amount, paid_date } = req.body || {};

    const normalizedMonth = normalizeReportMonth(report_month);
    if (!normalizedMonth) {
      return badRequest(res, 'report_month es obligatorio y debe venir como YYYY-MM');
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

    const result = await query(`
      INSERT INTO subscriber_reports (
        subscriber_id,
        report_month,
        company_earnings,
        vendor_commission,
        paid_amount,
        paid_date,
        created_at,
        updated_at
      ) VALUES ($1, $2::date, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (subscriber_id, report_month)
      DO UPDATE SET
        company_earnings = EXCLUDED.company_earnings,
        vendor_commission = EXCLUDED.vendor_commission,
        paid_amount = EXCLUDED.paid_amount,
        paid_date = EXCLUDED.paid_date,
        updated_at = NOW()
      RETURNING *
    `, [
      subscriber_id,
      normalizedMonth,
      Number.isNaN(sanitizedCompanyEarnings) ? null : sanitizedCompanyEarnings,
      Number.isNaN(sanitizedVendorCommission) ? null : sanitizedVendorCommission,
      Number.isNaN(sanitizedPaidAmount) ? null : sanitizedPaidAmount,
      paid_date || null
    ]);

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
// app.post('/api/clients', ...

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
    await query(
      `INSERT INTO audit_log(user_id, username, action, entity_type, entity_id, entity_name, details, ip_address)
VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, username, action, entityType, entityId, entityName, details, ipAddress]
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
