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

// Servir archivos estáticos del frontend (dist/client)
const distPath = path.join(__dirname, 'dist/client');
// const varWwwPath = '/var/www/crmp'; // DEPRECATED: We now use /opt/crmp/dist/client
app.use(express.static(distPath));

// Rutas de Módulos Específicos
app.use('/api/referidos', referidosRoutes);
app.use('/api/tariffs', tarifasRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/bans', banRoutes);
app.use('/api/importador', importRoutes);


const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'development-refresh-secret';
const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const PUBLIC_ROUTES = new Set([
  'GET /api/health',
  'GET /api/health/full',
  'GET /api/system-test/full',
  'GET /api/version',
  'POST /api/login',
  'POST /api/token/refresh',
  'POST /api/tarifas/parse-document',
  'GET /api/tarifas/plans',
  'GET /api/tarifas/categories',
  'POST /api/tarifas/categories',
  'PUT /api/tarifas/categories',
  'DELETE /api/tarifas/categories'
]);

app.get('/api/version', (req, res) => {
  res.json({
    version: packageJson.version,
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

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
  // Permitir rutas de categorías con ID (ej: PUT /api/tarifas/categories/123)
  if (req.path.match(/^\/api\/tarifas\/categories\/\d+$/)) {
    return true;
  }
  return false;
};

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

app.use(authenticateRequest);

// Rutas de Referidos
app.use('/api/referidos', referidosRoutes);

// Rutas de Tarifas y Planes
app.use('/api/tarifas', tarifasRoutes);

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
app.get('/api/vendors', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM vendors WHERE COALESCE(is_active,1) = 1 ORDER BY name ASC`
    );
    const mapped = rows.map((row) =>
      enrich(row, [], ['is_active'], ['created_at', 'updated_at'])
    );
    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo vendedores');
  }
});

app.get('/api/categories', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM categories WHERE COALESCE(is_active,1) = 1 ORDER BY name ASC`
    );
    const mapped = rows.map((row) =>
      enrich(row, [], ['is_active'], ['created_at', 'updated_at'])
    );
    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo categorías');
  }
});

app.post('/api/categories', async (req, res) => {
  const { name, description, color_hex } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return badRequest(res, 'El nombre de la categoría es obligatorio');
  }

  try {
    const result = await query(
      `INSERT INTO categories (name, description, color_hex, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 1, NOW(), NOW())
       RETURNING *`,
      [name.trim(), description?.trim() || null, color_hex || null]
    );
    const mapped = enrich(result[0], [], ['is_active'], ['created_at', 'updated_at']);
    res.status(201).json(mapped);
  } catch (error) {
    serverError(res, error, 'Error creando categoría');
  }
});

app.put('/api/categories/:id', async (req, res) => {
  const categoryId = parseInt(req.params.id, 10);
  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return badRequest(res, 'ID de categoría inválido');
  }

  const { name, description, color_hex, is_active } = req.body || {};
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
    if (color_hex !== undefined) {
      updates.push(`color_hex = $${paramIndex++}`);
      values.push(color_hex || null);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return badRequest(res, 'No hay campos para actualizar');
    }

    updates.push(`updated_at = NOW()`);
    values.push(categoryId);

    const result = await query(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const mapped = enrich(result[0], [], ['is_active'], ['created_at', 'updated_at']);
    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error actualizando categoría');
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  const categoryId = parseInt(req.params.id, 10);
  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return badRequest(res, 'ID de categoría inválido');
  }

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

app.get('/api/products', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE COALESCE(p.is_active,1) = 1
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

app.post('/api/products', async (req, res) => {
  const {
    name,
    category_id: categoryId,
    description,
    base_price: basePrice,
    commission_percentage: commissionPercentage,
    is_recurring: isRecurring,
    billing_cycle: billingCycle
  } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return badRequest(res, 'El nombre del producto es obligatorio');
  }

  const normalizedCategoryId = normalizeNullableInteger(categoryId);
  if (Number.isNaN(normalizedCategoryId)) {
    return badRequest(res, 'Categoría inválida');
  }

  const normalizedBasePrice = normalizeNullableNumber(basePrice);
  if (Number.isNaN(normalizedBasePrice)) {
    return badRequest(res, 'Precio base inválido');
  }
  if (
    normalizedBasePrice !== null &&
    (normalizedBasePrice < 0 || normalizedBasePrice > 1_000_000_000)
  ) {
    return badRequest(res, 'El precio base debe ser mayor o igual a 0');
  }

  const normalizedCommission = normalizeNullableNumber(commissionPercentage);
  if (Number.isNaN(normalizedCommission)) {
    return badRequest(res, 'Porcentaje de comisión inválido');
  }
  if (
    normalizedCommission !== null &&
    (normalizedCommission < 0 || normalizedCommission > 100)
  ) {
    return badRequest(res, 'El porcentaje de comisión debe estar entre 0 y 100');
  }

  const normalizedIsRecurring = isRecurring ? 1 : 0;
  const normalizedBillingCycle = normalizedIsRecurring
    ? normalizeBillingCycle(billingCycle) || 'monthly'
    : null;

  try {
    const rows = await query(
      `INSERT INTO products
        (name, category_id, description, base_price, commission_percentage, is_recurring, billing_cycle, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW(), NOW())
       RETURNING *`,
      [
        name.trim(),
        normalizedCategoryId,
        description?.trim() || null,
        normalizedBasePrice,
        normalizedCommission,
        normalizedIsRecurring,
        normalizedBillingCycle
      ]
    );
    const mapped = enrich(
      rows[0],
      ['base_price', 'commission_percentage'],
      ['is_active', 'is_recurring'],
      ['created_at', 'updated_at']
    );
    res.status(201).json(mapped);
  } catch (error) {
    serverError(res, error, 'Error creando producto');
  }
});

app.put('/api/products/:id', async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return badRequest(res, 'ID de producto inválido');
  }

  const {
    name,
    category_id: categoryId,
    description,
    base_price: basePrice,
    commission_percentage: commissionPercentage,
    is_recurring: isRecurring,
    billing_cycle: billingCycle,
    is_active: isActive
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
    const normalizedCategoryId = normalizeNullableInteger(categoryId);
    if (Number.isNaN(normalizedCategoryId)) {
      return badRequest(res, 'Categoría inválida');
    }
    updates.push(`category_id = $${paramIndex++}`);
    values.push(normalizedCategoryId);
  }

  if (description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(description?.trim() || null);
  }

  if (basePrice !== undefined) {
    const normalizedBasePrice = normalizeNullableNumber(basePrice);
    if (Number.isNaN(normalizedBasePrice)) {
      return badRequest(res, 'Precio base inválido');
    }
    if (
      normalizedBasePrice !== null &&
      (normalizedBasePrice < 0 || normalizedBasePrice > 1_000_000_000)
    ) {
      return badRequest(res, 'El precio base debe ser mayor o igual a 0');
    }
    updates.push(`base_price = $${paramIndex++}`);
    values.push(normalizedBasePrice);
  }

  if (commissionPercentage !== undefined) {
    const normalizedCommission = normalizeNullableNumber(commissionPercentage);
    if (Number.isNaN(normalizedCommission)) {
      return badRequest(res, 'Porcentaje de comisión inválido');
    }
    if (
      normalizedCommission !== null &&
      (normalizedCommission < 0 || normalizedCommission > 100)
    ) {
      return badRequest(res, 'El porcentaje de comisión debe estar entre 0 y 100');
    }
    updates.push(`commission_percentage = $${paramIndex++}`);
    values.push(normalizedCommission);
  }

  if (isRecurring !== undefined) {
    const normalizedIsRecurring = isRecurring ? 1 : 0;
    updates.push(`is_recurring = $${paramIndex++}`);
    values.push(normalizedIsRecurring);

    if (!normalizedIsRecurring) {
      updates.push(`billing_cycle = NULL`);
    } else if (billingCycle !== undefined) {
      const normalizedBillingCycle = normalizeBillingCycle(billingCycle) || 'monthly';
      updates.push(`billing_cycle = $${paramIndex++}`);
      values.push(normalizedBillingCycle);
    }
  } else if (billingCycle !== undefined) {
    const normalizedBillingCycle = normalizeBillingCycle(billingCycle) || 'monthly';
    updates.push(`billing_cycle = $${paramIndex++}`);
    values.push(normalizedBillingCycle);
  }

  if (isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(isActive ? 1 : 0);
  }

  if (updates.length === 0) {
    return badRequest(res, 'No hay campos para actualizar');
  }

  updates.push(`updated_at = NOW()`);
  values.push(productId);

  try {
    const rows = await query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const mapped = enrich(
      rows[0],
      ['base_price', 'commission_percentage'],
      ['is_active', 'is_recurring'],
      ['created_at', 'updated_at']
    );
    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error actualizando producto');
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return badRequest(res, 'ID de producto inválido');
  }

  try {
    const rows = await query(
      `UPDATE products SET is_active = 0, updated_at = NOW() WHERE id = $1 RETURNING *`,
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

    let whereClause = 'WHERE COALESCE(p.is_active, true) = true';
    if (include_completed !== 'true') {
      whereClause += ' AND COALESCE(p.is_completed, false) = false';
    }

    const sql = `
      SELECT 
        p.*,
        c.name as client_name,
        c.business_name,
        v.name as vendor_name
      FROM follow_up_prospects p
      JOIN clients c ON p.client_id = c.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
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

// ======================================================
// Prospectos COMPLETADOS (Reportes)
app.get('/api/completed-prospects', authenticateRequest, async (req, res) => {
  // Tabla no existe en schema actual, retornamos vacío para evitar fallos
  res.json([]);
});

// ======================================================
/* LEGACY SEARCH COMMENTED OUT (Handled in clientRoutes.js)
app.get('/api/clients/search', ... 
*/



// ======================================================
// Fusionar Clientes
app.post('/api/clients/merge', authenticateRequest, async (req, res) => {
  const { sourceId, targetId } = req.body;

  if (!sourceId || !targetId) {
    return res.status(400).json({ error: 'Se requieren sourceId y targetId' });
  }

  if (sourceId === targetId) {
    return res.status(400).json({ error: 'No se puede fusionar el mismo cliente' });
  }

  try {
    // 1. Verificar que ambos existan
    const source = await query('SELECT * FROM clients WHERE id = $1', [sourceId]);
    const target = await query('SELECT * FROM clients WHERE id = $1', [targetId]);

    if (source.length === 0 || target.length === 0) {
      return res.status(404).json({ error: 'Uno o ambos clientes no existen' });
    }

    // 2. Mover BANs
    await query('UPDATE bans SET client_id = $1 WHERE client_id = $2', [targetId, sourceId]);

    // 3. Mover Seguimientos (FollowUps)
    try {
      await query('UPDATE follow_up_prospects SET client_id = $1 WHERE client_id = $2', [targetId, sourceId]);
    } catch (e) {
      console.warn("No se pudo actualizar follow_up_prospects", e.message);
    }

    // 4. Eliminar Cliente Origen
    await query('DELETE FROM clients WHERE id = $1', [sourceId]);

    res.json({ success: true, message: `Cliente ${sourceId} fusionado en ${targetId} correctamente.` });

  } catch (error) {
    console.error('Error merging clients:', error);
    res.status(500).json({ error: 'Error fusionando clientes' });
  }
});

// Clientes
// ======================================================
app.get('/api/clients', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10000; // Límite aumentado para asegurar que carguen todos
    const offset = page > 0 ? (page - 1) * limit : 0;

    console.log(`📋 GET / api / clients - User: ${req.user?.username} - Page: ${page}, Limit: ${limit} `);

    let whereClause = '';
    const params = [];

    // Lógica para Contar Total (solo si se pide paginación)
    let totalCount = 0;
    if (page > 0) {
      const countSql = `SELECT COUNT(*) as total FROM clients c ${whereClause} `;
      const countResult = await query(countSql, params); // Params debe coincidir si hubiera filtros
      totalCount = parseInt(countResult[0]?.total || 0);
    }

    // Consulta optimizada
    const sql = `SELECT DISTINCT ON(c.id)
c.*,
  v.name AS vendor_name,
    COALESCE(b.ban_count, 0) AS ban_count,
      COALESCE(b.active_ban_count, 0) AS active_ban_count,
        COALESCE(b.cancelled_ban_count, 0) AS cancelled_ban_count,
          b.ban_numbers,
          b.ban_descriptions,
          CASE WHEN COALESCE(b.ban_count, 0) > 0 THEN 1 ELSE 0 END AS has_bans,
            COALESCE(s.subscriber_count, 0) AS subscriber_count,
              COALESCE(s.active_subscriber_count, 0) AS active_subscriber_count,
                COALESCE(s.cancelled_subscriber_count, 0) AS cancelled_subscriber_count,
                  s.primary_subscriber_phone,
                  s.primary_contract_end_date,
                  s.primary_subscriber_created_at,
                  s.primary_service_type,
                  s.all_service_types,
                  COALESCE(la.last_activity, c.updated_at) AS last_activity,
                    CASE WHEN b.cancelled_ban_count > 0 AND b.active_ban_count = 0 THEN 1 ELSE 0 END AS has_cancelled_bans
        FROM clients c
        LEFT JOIN vendors v ON c.vendor_id = v.id
        LEFT JOIN(
                      SELECT 
            client_id,
                      COUNT(*) AS ban_count,
                      COUNT(CASE WHEN UPPER(status) NOT IN('CANCELADO', 'CANCELLED', 'C', 'BAJA', 'SUSPENDIDO', 'INACTIVE') THEN 1 END) AS active_ban_count,
                      COUNT(CASE WHEN UPPER(status) IN('CANCELADO', 'CANCELLED', 'C', 'BAJA', 'SUSPENDIDO', 'INACTIVE') THEN 1 END) AS cancelled_ban_count,
                      STRING_AGG(ban_number, ', ' ORDER BY ban_number) AS ban_numbers,
                      STRING_AGG(DISTINCT CASE WHEN UPPER(status) IN('CANCELADO', 'CANCELLED', 'C', 'BAJA', 'SUSPENDIDO', 'INACTIVE') THEN 'cancelled' END, ', ') AS cancelled_status,
                      STRING_AGG(DISTINCT CASE WHEN description IS NOT NULL AND description <> '' THEN description END, ', ') AS ban_descriptions
          FROM bans
          WHERE COALESCE(is_active, 1) = 1
          GROUP BY client_id
                    ) b ON b.client_id = c.id
        LEFT JOIN(
                      SELECT 
            b.client_id,
                      COUNT(DISTINCT s.id) AS subscriber_count,
                      COUNT(DISTINCT CASE WHEN UPPER(COALESCE(s.status, '')) NOT IN('CANCELADO', 'CANCELLED', 'C', 'BAJA', 'SUSPENDIDO', 'INACTIVE') THEN s.id END) AS active_subscriber_count,
                      COUNT(DISTINCT CASE WHEN UPPER(COALESCE(s.status, '')) IN('CANCELADO', 'CANCELLED', 'C', 'BAJA', 'SUSPENDIDO', 'INACTIVE') THEN s.id END) AS cancelled_subscriber_count,
                      COUNT(DISTINCT CASE WHEN COALESCE(s.remaining_payments, 0) = 0 THEN s.id END) AS subscribers_in_opportunity,
                      MAX(CASE WHEN s.phone IS NOT NULL THEN s.phone END) AS primary_subscriber_phone,
                      MAX(CASE WHEN s.contract_end_date IS NOT NULL THEN s.contract_end_date END) AS primary_contract_end_date,
                      MAX(CASE WHEN s.created_at IS NOT NULL THEN s.created_at END) AS primary_subscriber_created_at,
                      MAX(CASE WHEN s.service_type IS NOT NULL THEN s.service_type END) AS primary_service_type,
                      STRING_AGG(DISTINCT s.service_type, ', ') AS all_service_types
          FROM bans b
          INNER JOIN subscribers s ON s.ban_id = b.id
          WHERE COALESCE(b.is_active, 1) = 1 AND COALESCE(s.is_active, 1) = 1
          GROUP BY b.client_id
                    ) s ON s.client_id = c.id
        LEFT JOIN(
                      SELECT 
            b.client_id,
                      MAX(GREATEST(
                        COALESCE(b.updated_at, '1970-01-01':: timestamp),
                        COALESCE(s.updated_at, '1970-01-01':: timestamp),
                        COALESCE(c.updated_at, '1970-01-01':: timestamp)
                      )) AS last_activity
          FROM bans b
          LEFT JOIN subscribers s ON s.ban_id = b.id
          LEFT JOIN clients c ON c.id = b.client_id
          WHERE COALESCE(b.is_active, 1) = 1
          GROUP BY b.client_id
                    ) la ON la.client_id = c.id
        ${whereClause}
        ORDER BY c.id, c.name ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2} `;

    // Añadir parámetros de paginación/límite
    // IMPORTANTE: Si es legacy (page=0), offset es 0 y limit es 2000
    params.push(limit, offset);

    console.log('📋 Ejecutando consulta SQL...');
    const startTime = Date.now();
    const rows = await query(sql, params);
    const duration = Date.now() - startTime;
    console.log(`✅ Clientes encontrados: ${rows.length} (en ${duration}ms)`);

    const mapped = rows.map((row) =>
      enrich(
        row,
        ['includes_ban', 'vendor_id', 'ban_count', 'active_ban_count', 'cancelled_ban_count', 'is_active', 'subscriber_count', 'active_subscriber_count', 'cancelled_subscriber_count', 'subscribers_in_opportunity', 'has_cancelled_bans', 'base'],
        ['has_bans'],
        ['created_at', 'updated_at', 'primary_contract_end_date', 'primary_subscriber_created_at', 'last_activity']
      )
    );

    if (page > 0) {
      // Respuesta con paginación
      res.json({
        data: mapped,
        pagination: {
          total: totalCount,
          page: page,
          limit: limit,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } else {
      // Respuesta Legacy (Array directo)
      if (rows.length === limit) {
        console.warn(`⚠️ ALERTA: La consulta alcanzó el límite de seguridad de ${limit} registros.Es posible que falten datos.Se recomienda usar paginación.`);
      }
      res.json(mapped);
    }
  } catch (error) {
    console.error('❌ Error en GET /api/clients:', error);
    serverError(res, error, 'Error obteniendo clientes');
  }
});

/* LEGACY ROUTES COMMENTED OUT TO USE MODULAR ROUTES
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
*/

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

  const indexPath = process.platform === 'linux' && fs.existsSync(varWwwPath)
    ? path.join(varWwwPath, 'index.html')
    : path.join(distPath, 'index.html');

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
app.get('/api/completed-prospects', authenticateRequest, (req, res) => {
  res.json([]);
});

// ======================================================
// Endpoint de Importación (Refactorizado)
// ======================================================
app.post('/api/importador/save', authenticateRequest, saveImportData);

// Configurar timeouts del servidor para importaciones grandes (1 hora)
server.timeout = 3600000;
server.keepAliveTimeout = 3600000;
server.headersTimeout = 3600000;