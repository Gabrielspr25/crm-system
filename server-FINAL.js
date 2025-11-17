import express from 'express';
import cors from 'cors';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// ======================================================
// Configuración base
// ======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'development-refresh-secret';
const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const PUBLIC_ROUTES = new Set([
  'GET /api/health',
  'POST /api/login',
  'POST /api/token/refresh'
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
  return PUBLIC_ROUTES.has(key);
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
  password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!',
  max: 10,
  idleTimeoutMillis: 30_000
});

async function query(text, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
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
    await client.query('ROLLBACK').catch(() => {});
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
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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
// Clientes
// ======================================================
app.get('/api/clients', async (req, res) => {
  try {
    const params = [];
    let whereClause = 'WHERE COALESCE(c.is_active,1) = 1';

    if (req.user?.role === 'vendedor' && req.user.salespersonId != null) {
      const salespersonIdParam = Number(req.user.salespersonId);
      if (Number.isInteger(salespersonIdParam)) {
      params.push(salespersonIdParam);
      whereClause += ` AND (c.vendor_id = $${params.length} OR c.vendor_id IS NULL)`;
      }
    }

    const rows = await query(
      `SELECT 
          c.*,
          v.name AS vendor_name,
          COALESCE(b.ban_count, 0) AS ban_count,
          b.ban_numbers,
          CASE WHEN COALESCE(b.ban_count, 0) > 0 THEN 1 ELSE 0 END AS has_bans
        FROM clients c
        LEFT JOIN vendors v ON c.vendor_id = v.id
        LEFT JOIN (
          SELECT client_id,
                 COUNT(*) AS ban_count,
                 STRING_AGG(ban_number, ', ') AS ban_numbers
          FROM bans
          WHERE COALESCE(is_active,1) = 1
          GROUP BY client_id
        ) b ON b.client_id = c.id
        ${whereClause}
        ORDER BY c.name ASC`,
      params
    );

    const mapped = rows.map((row) =>
      enrich(
        row,
        ['includes_ban', 'vendor_id', 'ban_count', 'is_active'],
        ['has_bans'],
        ['created_at', 'updated_at']
      )
    );
    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo clientes');
  }
});

app.get('/api/clients/:id', async (req, res) => {
  const clientId = Number(req.params.id);
  if (Number.isNaN(clientId)) {
    return badRequest(res, 'ID de cliente inválido');
  }

  try {
    const rows = await query(
      `SELECT 
          c.*,
          v.name AS vendor_name
        FROM clients c
        LEFT JOIN vendors v ON c.vendor_id = v.id
        WHERE c.id = $1`,
      [clientId]
    );

    if (rows.length === 0) {
      return notFound(res, 'Cliente');
    }

    const client = enrich(
      rows[0],
      ['includes_ban', 'vendor_id', 'is_active'],
      [],
      ['created_at', 'updated_at']
    );

    if (req.user?.role === 'vendedor') {
      const clientVendorId = client.vendor_id ?? null;
      if (clientVendorId && !sameId(clientVendorId, req.user.salespersonId)) {
        return res.status(403).json({ error: 'No autorizado para ver este cliente' });
      }
    }

    res.json(client);
    } catch (error) {
    serverError(res, error, 'Error obteniendo cliente');
  }
});

app.post('/api/clients', async (req, res) => {
  const {
    name,
    business_name = null,
    contact_person = null,
    email = null,
    phone = null,
    secondary_phone = null,
    mobile_phone = null,
    address = null,
    city = null,
    zip_code = null,
    includes_ban = 0,
    vendor_id = null
  } = req.body || {};

  if (!name || typeof name !== 'string') {
    return badRequest(res, 'El nombre es obligatorio');
  }

  try {
    const assignedVendorId = (req.user?.role === 'vendedor')
      ? toDbId(req.user.salespersonId)
      : toDbId(vendor_id);

    const rows = await query(
      `INSERT INTO clients
        (name, business_name, contact_person, email, phone, secondary_phone, mobile_phone, address, city, zip_code, includes_ban, vendor_id, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1,NOW(),NOW())
       RETURNING *`,
      [
        name.trim(),
        business_name,
        contact_person,
        email,
        phone,
        secondary_phone,
        mobile_phone,
        address,
        city,
        zip_code,
        includes_ban ? 1 : 0,
        assignedVendorId
      ]
    );

    const client = enrich(
      rows[0],
      ['includes_ban', 'vendor_id', 'is_active'],
      [],
      ['created_at', 'updated_at']
    );

    res.status(201).json(client);
  } catch (error) {
    serverError(res, error, 'Error creando cliente');
  }
});

app.put('/api/clients/:id', async (req, res) => {
  const clientId = Number(req.params.id);
  if (Number.isNaN(clientId)) {
    return badRequest(res, 'ID de cliente inválido');
  }

  const {
    name,
    business_name = null,
    contact_person = null,
    email = null,
    phone = null,
    secondary_phone = null,
    mobile_phone = null,
    address = null,
    city = null,
    zip_code = null,
    includes_ban = 0,
    vendor_id = null,
    is_active = 1
  } = req.body || {};

  if (!name || typeof name !== 'string') {
    return badRequest(res, 'El nombre es obligatorio');
  }

  try {
    const existing = await query(`SELECT vendor_id FROM clients WHERE id = $1`, [clientId]);
    if (existing.length === 0) {
      return notFound(res, 'Cliente');
    }

    let finalVendorId = toDbId(vendor_id);
    if (req.user?.role === 'vendedor') {
      const currentVendorId = existing[0].vendor_id;
      if (currentVendorId && !sameId(currentVendorId, req.user.salespersonId)) {
        return res.status(403).json({ error: 'No autorizado para modificar este cliente' });
      }
      finalVendorId = toDbId(req.user.salespersonId);
    }

    const rows = await query(
      `UPDATE clients
          SET name = $1,
              business_name = $2,
              contact_person = $3,
              email = $4,
              phone = $5,
              secondary_phone = $6,
              mobile_phone = $7,
              address = $8,
              city = $9,
              zip_code = $10,
              includes_ban = $11,
              vendor_id = $12,
              is_active = $13,
              updated_at = NOW()
        WHERE id = $14
        RETURNING *`,
      [
        name.trim(),
        business_name,
        contact_person,
        email,
        phone,
        secondary_phone,
        mobile_phone,
        address,
        city,
        zip_code,
        includes_ban ? 1 : 0,
        finalVendorId,
        is_active ? 1 : 0,
        clientId
      ]
    );

    if (rows.length === 0) {
      return notFound(res, 'Cliente');
    }

    const client = enrich(
      rows[0],
      ['includes_ban', 'vendor_id', 'is_active'],
      [],
      ['created_at', 'updated_at']
    );

    res.json(client);
  } catch (error) {
    serverError(res, error, 'Error actualizando cliente');
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  const clientId = Number(req.params.id);
  if (Number.isNaN(clientId)) {
    return badRequest(res, 'ID de cliente inválido');
  }

  try {
    const existing = await query(`SELECT vendor_id FROM clients WHERE id = $1`, [clientId]);
    if (existing.length === 0) {
      return notFound(res, 'Cliente');
    }

    if (req.user?.role === 'vendedor') {
      const currentVendorId = existing[0].vendor_id;
      if (currentVendorId && !sameId(currentVendorId, req.user.salespersonId)) {
        return res.status(403).json({ error: 'No autorizado para eliminar este cliente' });
      }
    }

    await pool.query('BEGIN');
    await query(
      `DELETE FROM subscribers WHERE ban_id IN (SELECT id FROM bans WHERE client_id = $1)`
      , [clientId]
    );
    await query(`DELETE FROM bans WHERE client_id = $1`, [clientId]);
    const rows = await query(`DELETE FROM clients WHERE id = $1 RETURNING *`, [clientId]);
    await pool.query('COMMIT');

    if (rows.length === 0) {
      return notFound(res, 'Cliente');
    }

    res.json({ success: true });
  } catch (error) {
    await pool.query('ROLLBACK');
    serverError(res, error, 'Error eliminando cliente');
  }
});

// ======================================================
// BANs
// ======================================================
app.get('/api/bans', async (req, res) => {
  const { client_id: clientIdParam } = req.query;
  const params = [];
  let filter = '';

  if (clientIdParam) {
    const clientId = Number(clientIdParam);
    if (Number.isNaN(clientId)) {
      return badRequest(res, 'client_id inválido');
    }
    params.push(clientId);
    filter = 'WHERE b.client_id = $1';
  }

  try {
    const rows = await query(
      `SELECT b.*, c.name AS client_name, c.vendor_id
         FROM bans b
         LEFT JOIN clients c ON b.client_id = c.id
         ${filter}
         ORDER BY b.created_at DESC`,
      params
    );

    const authorizedRows = req.user?.role === 'vendedor'
      ? rows.filter((row) => !row.vendor_id || sameId(row.vendor_id, req.user.salespersonId))
      : rows;

    const mapped = authorizedRows.map((row) =>
      enrich(row, ['client_id', 'is_active'], [], ['created_at', 'updated_at'])
    );
    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo BANs');
  }
});

app.post('/api/bans', async (req, res) => {
  const { ban_number, client_id, description = null, status = 'active', is_active = 1 } = req.body || {};

  if (!ban_number || typeof ban_number !== 'string') {
    return badRequest(res, 'El BAN es obligatorio');
  }

  if (!client_id) {
    return badRequest(res, 'client_id es obligatorio');
  }

  try {
    const clientRows = await query(`SELECT vendor_id FROM clients WHERE id = $1`, [client_id]);
    if (clientRows.length === 0) {
      return notFound(res, 'Cliente');
    }

    if (req.user?.role === 'vendedor') {
      const clientVendorId = clientRows[0].vendor_id;
      if (clientVendorId && !sameId(clientVendorId, req.user.salespersonId)) {
        return res.status(403).json({ error: 'No autorizado para crear BAN en este cliente' });
      }
    }

    const existing = await query(
      `SELECT id FROM bans WHERE ban_number = $1`,
      [ban_number.trim()]
    );

    if (existing.length > 0) {
      return conflict(res, 'El BAN ya existe');
    }

    const rows = await query(
      `INSERT INTO bans
        (ban_number, client_id, description, status, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
       RETURNING *`,
      [ban_number.trim(), client_id, description, status === 'cancelled' ? 'cancelled' : 'active', is_active ? 1 : 0]
    );

    const ban = enrich(rows[0], ['client_id', 'is_active'], [], ['created_at', 'updated_at']);
    res.status(201).json(ban);
    } catch (error) {
    serverError(res, error, 'Error creando BAN');
  }
});

app.put('/api/bans/:id', async (req, res) => {
  const banId = Number(req.params.id);
  if (Number.isNaN(banId)) {
    return badRequest(res, 'ID de BAN inválido');
  }

  const {
    ban_number,
    client_id,
    description = null,
    status = 'active',
    is_active = 1
  } = req.body || {};

  if (!ban_number || typeof ban_number !== 'string') {
    return badRequest(res, 'El BAN es obligatorio');
  }

  try {
    const ownerRows = await query(
      `SELECT b.client_id, c.vendor_id
         FROM bans b
         LEFT JOIN clients c ON b.client_id = c.id
        WHERE b.id = $1`,
      [banId]
    );

    if (ownerRows.length === 0) {
      return notFound(res, 'BAN');
    }

    if (req.user?.role === 'vendedor') {
      const currentVendorId = ownerRows[0].vendor_id;
      if (currentVendorId && !sameId(currentVendorId, req.user.salespersonId)) {
        return res.status(403).json({ error: 'No autorizado para modificar este BAN' });
      }
    }

    if (client_id && client_id !== ownerRows[0].client_id) {
      const targetClient = await query(`SELECT vendor_id FROM clients WHERE id = $1`, [client_id]);
      if (targetClient.length === 0) {
        return notFound(res, 'Cliente');
      }
      if (req.user?.role === 'vendedor') {
        const clientVendorId = targetClient[0].vendor_id;
        if (clientVendorId && !sameId(clientVendorId, req.user.salespersonId)) {
          return res.status(403).json({ error: 'No autorizado para mover el BAN a ese cliente' });
        }
      }
    }

    const existing = await query(
      `SELECT id FROM bans WHERE ban_number = $1 AND id <> $2`,
      [ban_number.trim(), banId]
    );

    if (existing.length > 0) {
      return conflict(res, 'El BAN ya existe');
    }

    const rows = await query(
      `UPDATE bans
          SET ban_number = $1,
              client_id = $2,
              description = $3,
              status = $4,
              is_active = $5,
              updated_at = NOW()
        WHERE id = $6
        RETURNING *`,
      [ban_number.trim(), client_id, description, status === 'cancelled' ? 'cancelled' : 'active', is_active ? 1 : 0, banId]
    );

    if (rows.length === 0) {
      return notFound(res, 'BAN');
    }

    const ban = enrich(rows[0], ['client_id', 'is_active'], [], ['created_at', 'updated_at']);
    res.json(ban);
  } catch (error) {
    serverError(res, error, 'Error actualizando BAN');
  }
});

app.delete('/api/bans/:id', async (req, res) => {
  const banId = Number(req.params.id);
  if (Number.isNaN(banId)) {
    return badRequest(res, 'ID de BAN inválido');
  }

  try {
    const ownerRows = await query(
      `SELECT b.client_id, c.vendor_id
         FROM bans b
         LEFT JOIN clients c ON b.client_id = c.id
        WHERE b.id = $1`,
      [banId]
    );

    if (ownerRows.length === 0) {
      return notFound(res, 'BAN');
    }

    if (req.user?.role === 'vendedor') {
      const currentVendorId = ownerRows[0].vendor_id;
      if (currentVendorId && !sameId(currentVendorId, req.user.salespersonId)) {
        return res.status(403).json({ error: 'No autorizado para eliminar este BAN' });
      }
    }

    await pool.query('BEGIN');
    await query(`DELETE FROM subscribers WHERE ban_id = $1`, [banId]);
    const rows = await query(`DELETE FROM bans WHERE id = $1 RETURNING *`, [banId]);
    await pool.query('COMMIT');

    if (rows.length === 0) {
      return notFound(res, 'BAN');
    }

    res.json({ success: true });
  } catch (error) {
    await pool.query('ROLLBACK');
    serverError(res, error, 'Error eliminando BAN');
  }
});

// ======================================================
// Suscriptores
// ======================================================
app.get('/api/subscribers', async (req, res) => {
  const { ban_id: banIdParam } = req.query;
  const params = [];
  let filter = '';

  if (banIdParam) {
    const banId = Number(banIdParam);
    if (Number.isNaN(banId)) {
      return badRequest(res, 'ban_id inválido');
    }
    params.push(banId);
    filter = 'WHERE s.ban_id = $1';
  }

  try {
    const rows = await query(
      `SELECT s.*, b.ban_number, b.client_id, c.vendor_id
         FROM subscribers s
         LEFT JOIN bans b ON s.ban_id = b.id
         LEFT JOIN clients c ON b.client_id = c.id
         ${filter}
         ORDER BY s.created_at DESC`,
      params
    );

    const authorizedRows = req.user?.role === 'vendedor'
      ? rows.filter((row) => !row.vendor_id || sameId(row.vendor_id, req.user.salespersonId))
      : rows;

    const mapped = authorizedRows.map((row) =>
      enrich(
        row,
        ['ban_id', 'client_id', 'vendor_id', 'monthly_value', 'months', 'remaining_payments'],
        ['is_active'],
        ['contract_start_date', 'contract_end_date', 'created_at', 'updated_at']
      )
    );
    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo suscriptores');
  }
});

app.post('/api/subscribers', async (req, res) => {
  const {
    phone,
    ban_id,
    contract_start_date = null,
    contract_end_date = null,
    service_type = null,
    monthly_value = null,
    months = null,
    remaining_payments = null,
    is_active = 1
  } = req.body || {};

  if (!phone || typeof phone !== 'string') {
    return badRequest(res, 'El teléfono es obligatorio');
  }

  if (!ban_id) {
    return badRequest(res, 'ban_id es obligatorio');
  }

  try {
    const banRows = await query(
      `SELECT b.client_id, c.vendor_id
         FROM bans b
         LEFT JOIN clients c ON b.client_id = c.id
        WHERE b.id = $1`,
      [ban_id]
    );

    if (banRows.length === 0) {
      return notFound(res, 'BAN');
    }

    if (req.user?.role === 'vendedor') {
      const banVendorId = banRows[0].vendor_id;
      if (banVendorId && !sameId(banVendorId, req.user.salespersonId)) {
        return res.status(403).json({ error: 'No autorizado para agregar suscriptores a este BAN' });
      }
    }

    const rows = await query(
      `INSERT INTO subscribers
        (phone, ban_id, contract_start_date, contract_end_date, service_type, monthly_value, months, remaining_payments, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
       RETURNING *`,
      [
        phone.trim(),
        ban_id,
        contract_start_date,
        contract_end_date,
        service_type,
        monthly_value,
        months,
        remaining_payments,
        is_active ? 1 : 0
      ]
    );

    const subscriber = enrich(
      rows[0],
      ['ban_id', 'monthly_value', 'months', 'remaining_payments'],
      ['is_active'],
      ['contract_start_date', 'contract_end_date', 'created_at', 'updated_at']
    );

    res.status(201).json(subscriber);
  } catch (error) {
    serverError(res, error, 'Error creando suscriptor');
  }
});

app.put('/api/subscribers/:id', async (req, res) => {
  const subscriberId = Number(req.params.id);
  if (Number.isNaN(subscriberId)) {
    return badRequest(res, 'ID de suscriptor inválido');
  }

  const {
    phone,
    ban_id,
    contract_start_date = null,
    contract_end_date = null,
    service_type = null,
    monthly_value = null,
    months = null,
    remaining_payments = null,
    is_active = 1
  } = req.body || {};

  if (!phone || typeof phone !== 'string') {
    return badRequest(res, 'El teléfono es obligatorio');
  }

  try {
    const ownerRows = await query(
      `SELECT s.ban_id, b.client_id, c.vendor_id
         FROM subscribers s
         LEFT JOIN bans b ON s.ban_id = b.id
         LEFT JOIN clients c ON b.client_id = c.id
        WHERE s.id = $1`,
      [subscriberId]
    );

    if (ownerRows.length === 0) {
      return notFound(res, 'Suscriptor');
    }

    if (req.user?.role === 'vendedor') {
      const currentVendorId = ownerRows[0].vendor_id;
      if (currentVendorId && !sameId(currentVendorId, req.user.salespersonId)) {
        return res.status(403).json({ error: 'No autorizado para modificar este suscriptor' });
      }
    }

    if (ban_id && ban_id !== ownerRows[0].ban_id) {
      const targetBan = await query(
        `SELECT b.client_id, c.vendor_id
           FROM bans b
           LEFT JOIN clients c ON b.client_id = c.id
          WHERE b.id = $1`,
        [ban_id]
      );
      if (targetBan.length === 0) {
        return notFound(res, 'BAN');
      }
      if (req.user?.role === 'vendedor') {
        const banVendorId = targetBan[0].vendor_id;
        if (banVendorId && !sameId(banVendorId, req.user.salespersonId)) {
          return res.status(403).json({ error: 'No autorizado para mover el suscriptor a ese BAN' });
        }
      }
    }

    const rows = await query(
      `UPDATE subscribers
          SET phone = $1,
              ban_id = $2,
              contract_start_date = $3,
              contract_end_date = $4,
              service_type = $5,
              monthly_value = $6,
              months = $7,
              remaining_payments = $8,
              is_active = $9,
              updated_at = NOW()
        WHERE id = $10
        RETURNING *`,
      [
        phone.trim(),
        ban_id,
        contract_start_date,
        contract_end_date,
        service_type,
        monthly_value,
        months,
        remaining_payments,
        is_active ? 1 : 0,
        subscriberId
      ]
    );

    if (rows.length === 0) {
      return notFound(res, 'Suscriptor');
    }

    const subscriber = enrich(
      rows[0],
      ['ban_id', 'monthly_value', 'months', 'remaining_payments'],
      ['is_active'],
      ['contract_start_date', 'contract_end_date', 'created_at', 'updated_at']
    );

    res.json(subscriber);
  } catch (error) {
    serverError(res, error, 'Error actualizando suscriptor');
  }
});

app.delete('/api/subscribers/:id', async (req, res) => {
  const subscriberId = Number(req.params.id);
  if (Number.isNaN(subscriberId)) {
    return badRequest(res, 'ID de suscriptor inválido');
  }

  try {
    const ownerRows = await query(
      `SELECT s.ban_id, b.client_id, c.vendor_id
         FROM subscribers s
         LEFT JOIN bans b ON s.ban_id = b.id
         LEFT JOIN clients c ON b.client_id = c.id
        WHERE s.id = $1`,
      [subscriberId]
    );

    if (ownerRows.length === 0) {
      return notFound(res, 'Suscriptor');
    }

    if (req.user?.role === 'vendedor') {
      const currentVendorId = ownerRows[0].vendor_id;
      if (currentVendorId && !sameId(currentVendorId, req.user.salespersonId)) {
        return res.status(403).json({ error: 'No autorizado para eliminar este suscriptor' });
      }
    }

    const rows = await query(`DELETE FROM subscribers WHERE id = $1 RETURNING *`, [subscriberId]);
    if (rows.length === 0) {
      return notFound(res, 'Suscriptor');
    }
    res.json({ success: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando suscriptor');
  }
});

// ======================================================
// Follow-up prospects y call logs
// ======================================================
function mapProspectRow(row) {
  return enrich(
    row,
    [
      'client_id',
      'priority_id',
      'vendor_id',
      'step_id',
      'fijo_ren',
      'fijo_new',
      'movil_nueva',
      'movil_renovacion',
      'claro_tv',
      'cloud',
      'mpls',
      'call_count',
      'total_amount'
    ],
    ['is_active', 'is_completed'],
    ['last_call_date', 'next_call_date', 'completed_date', 'created_at', 'updated_at']
  );
}

app.get('/api/follow-up-prospects', async (req, res) => {
  try {
    const rows = await query(
      `SELECT fp.*, v.name AS vendor_name, c.name AS client_name
         FROM follow_up_prospects fp
         LEFT JOIN vendors v ON fp.vendor_id = v.id
         LEFT JOIN clients c ON fp.client_id = c.id
         ORDER BY fp.created_at DESC`
    );
    const authorizedRows = req.user?.role === 'vendedor'
      ? rows.filter((row) => sameId(row.vendor_id, req.user.salespersonId))
      : rows;
    res.json(authorizedRows.map(mapProspectRow));
  } catch (error) {
    serverError(res, error, 'Error obteniendo prospectos');
  }
});

app.post('/api/follow-up-prospects', async (req, res) => {
  const {
    company_name,
    client_id = null,
    priority_id = null,
    vendor_id = null,
    step_id = null,
    fijo_ren = 0,
    fijo_new = 0,
    movil_nueva = 0,
    movil_renovacion = 0,
    claro_tv = 0,
    cloud = 0,
    mpls = 0,
    last_call_date = null,
    next_call_date = null,
    call_count = 0,
    is_completed = false,
    completed_date = null,
    total_amount = 0,
    notes = null,
    contact_phone = null,
    contact_email = null,
    is_active = true
  } = req.body || {};

  if (!company_name || typeof company_name !== 'string') {
    return badRequest(res, 'El nombre de la empresa es obligatorio');
  }

  try {
    let finalVendorId = toDbId(vendor_id);
    if (req.user?.role === 'vendedor') {
      finalVendorId = toDbId(req.user.salespersonId);
    }

    if (client_id) {
      const clientRows = await query(`SELECT vendor_id FROM clients WHERE id = $1`, [client_id]);
      if (clientRows.length === 0) {
        return notFound(res, 'Cliente');
      }
      if (req.user?.role === 'vendedor') {
        const clientVendorId = clientRows[0].vendor_id;
        if (clientVendorId && !sameId(clientVendorId, req.user.salespersonId)) {
          return res.status(403).json({ error: 'No autorizado para crear seguimiento para ese cliente' });
        }
      }
    }

    const rows = await query(
      `INSERT INTO follow_up_prospects
        (company_name, client_id, priority_id, vendor_id, step_id, fijo_ren, fijo_new, movil_nueva, movil_renovacion, claro_tv, cloud, mpls, last_call_date, next_call_date, call_count, is_completed, completed_date, total_amount, notes, contact_phone, contact_email, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),NOW())
       RETURNING *`,
      [
        company_name.trim(),
        client_id,
        priority_id,
        finalVendorId,
        step_id,
        fijo_ren,
        fijo_new,
        movil_nueva,
        movil_renovacion,
        claro_tv,
        cloud,
        mpls,
        last_call_date,
        next_call_date,
        call_count,
        is_completed ? 1 : 0,
        completed_date,
        total_amount,
        notes,
        contact_phone,
        contact_email,
        is_active ? 1 : 0
      ]
    );

    res.status(201).json(mapProspectRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error creando prospecto');
  }
});

app.put('/api/follow-up-prospects/:id', async (req, res) => {
  const prospectId = Number(req.params.id);
  if (Number.isNaN(prospectId)) {
    return badRequest(res, 'ID de prospecto inválido');
  }

  const {
    company_name,
    client_id = null,
    priority_id = null,
    vendor_id = null,
    step_id = null,
    fijo_ren = 0,
    fijo_new = 0,
    movil_nueva = 0,
    movil_renovacion = 0,
    claro_tv = 0,
    cloud = 0,
    mpls = 0,
    last_call_date = null,
    next_call_date = null,
    call_count = 0,
    is_completed = false,
    completed_date = null,
    total_amount = 0,
    notes = null,
    contact_phone = null,
    contact_email = null,
    is_active = true
  } = req.body || {};

  if (!company_name || typeof company_name !== 'string') {
    return badRequest(res, 'El nombre de la empresa es obligatorio');
  }

  try {
    const existing = await query(`SELECT vendor_id, client_id FROM follow_up_prospects WHERE id = $1`, [prospectId]);
    if (existing.length === 0) {
      return notFound(res, 'Prospecto');
    }

    let finalVendorId = toDbId(vendor_id ?? existing[0].vendor_id);
    if (req.user?.role === 'vendedor') {
      const currentVendorId = existing[0].vendor_id;
      if (currentVendorId && !sameId(currentVendorId, req.user.salespersonId)) {
        return res.status(403).json({ error: 'No autorizado para modificar este prospecto' });
      }
      finalVendorId = toDbId(req.user.salespersonId);
    }

    if (client_id) {
      const clientRows = await query(`SELECT vendor_id FROM clients WHERE id = $1`, [client_id]);
      if (clientRows.length === 0) {
        return notFound(res, 'Cliente');
      }
      if (req.user?.role === 'vendedor') {
        const clientVendorId = clientRows[0].vendor_id;
        if (clientVendorId && !sameId(clientVendorId, req.user.salespersonId)) {
          return res.status(403).json({ error: 'No autorizado para vincular el prospecto con ese cliente' });
        }
      }
    }

    const rows = await query(
      `UPDATE follow_up_prospects
          SET company_name = $1,
              client_id = $2,
              priority_id = $3,
              vendor_id = $4,
              step_id = $5,
              fijo_ren = $6,
              fijo_new = $7,
              movil_nueva = $8,
              movil_renovacion = $9,
              claro_tv = $10,
              cloud = $11,
              mpls = $12,
              last_call_date = $13,
              next_call_date = $14,
              call_count = $15,
              is_completed = $16,
              completed_date = $17,
              total_amount = $18,
              notes = $19,
              contact_phone = $20,
              contact_email = $21,
              is_active = $22,
              updated_at = NOW()
        WHERE id = $23
        RETURNING *`,
      [
        company_name.trim(),
        client_id,
        priority_id,
        finalVendorId,
        step_id,
        fijo_ren,
        fijo_new,
        movil_nueva,
        movil_renovacion,
        claro_tv,
        cloud,
        mpls,
        last_call_date,
        next_call_date,
        call_count,
        is_completed,
        completed_date,
        total_amount,
        notes,
        contact_phone,
        contact_email,
        is_active,
        prospectId
      ]
    );

    if (rows.length === 0) {
      return notFound(res, 'Prospecto');
    }

    res.json(mapProspectRow(rows[0]));
  } catch (error) {
    serverError(res, error, 'Error actualizando prospecto');
  }
});

app.delete('/api/follow-up-prospects/:id', async (req, res) => {
  const prospectId = Number(req.params.id);
  if (Number.isNaN(prospectId)) {
    return badRequest(res, 'ID de prospecto inválido');
  }

  try {
    const existing = await query(`SELECT vendor_id FROM follow_up_prospects WHERE id = $1`, [prospectId]);
    if (existing.length === 0) {
      return notFound(res, 'Prospecto');
    }

    if (req.user?.role === 'vendedor') {
      const currentVendorId = existing[0].vendor_id;
      if (currentVendorId && !sameId(currentVendorId, req.user.salespersonId)) {
        return res.status(403).json({ error: 'No autorizado para eliminar este prospecto' });
      }
    }

    const rows = await query(`DELETE FROM follow_up_prospects WHERE id = $1 RETURNING *`, [prospectId]);
    if (rows.length === 0) {
      return notFound(res, 'Prospecto');
    }
    res.json({ success: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando prospecto');
  }
});

app.get('/api/call-logs/:followUpId', async (req, res) => {
  const followUpId = Number(req.params.followUpId);
  if (Number.isNaN(followUpId)) {
    return badRequest(res, 'ID de seguimiento inválido');
  }

  try {
    const prospectRows = await query(`SELECT vendor_id FROM follow_up_prospects WHERE id = $1`, [followUpId]);
    if (prospectRows.length === 0) {
      return notFound(res, 'Prospecto');
    }

    if (req.user?.role === 'vendedor') {
      const prospectVendorId = prospectRows[0].vendor_id;
      if (prospectVendorId && !sameId(prospectVendorId, req.user.salespersonId)) {
        return res.status(403).json({ error: 'No autorizado para ver las llamadas de este prospecto' });
      }
    }

    const rows = await query(
      `SELECT * FROM call_logs WHERE follow_up_id = $1 ORDER BY call_date DESC`,
      [followUpId]
    );

    const mapped = rows.map((row) =>
      enrich(row, ['follow_up_id', 'vendor_id'], [], ['call_date', 'next_call_date', 'created_at', 'updated_at'])
    );

    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo registros de llamadas');
  }
});

app.post('/api/call-logs', async (req, res) => {
    const { 
    follow_up_id,
    vendor_id = null,
    call_date,
    notes = null,
    outcome = null,
    next_call_date = null
  } = req.body || {};

  if (!follow_up_id) {
    return badRequest(res, 'follow_up_id es obligatorio');
  }

  try {
    const prospectRows = await query(`SELECT vendor_id FROM follow_up_prospects WHERE id = $1`, [follow_up_id]);
    if (prospectRows.length === 0) {
      return notFound(res, 'Prospecto');
    }

    let finalVendorId = toDbId(vendor_id ?? prospectRows[0].vendor_id);
    if (req.user?.role === 'vendedor') {
      const prospectVendorId = prospectRows[0].vendor_id;
      if (prospectVendorId && !sameId(prospectVendorId, req.user.salespersonId)) {
        return res.status(403).json({ error: 'No autorizado para registrar llamadas en este prospecto' });
      }
      finalVendorId = toDbId(req.user.salespersonId);
    }

    const rows = await query(
      `INSERT INTO call_logs
        (follow_up_id, vendor_id, call_date, notes, outcome, next_call_date, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
       RETURNING *`,
      [follow_up_id, finalVendorId, call_date || new Date(), notes, outcome, next_call_date]
    );

    const log = enrich(rows[0], ['follow_up_id', 'vendor_id'], [], ['call_date', 'next_call_date', 'created_at', 'updated_at']);
    res.status(201).json(log);
  } catch (error) {
    serverError(res, error, 'Error registrando llamada');
  }
});

// ======================================================
// Prioridades y pasos de seguimiento
// ======================================================
app.get('/api/priorities', async (_req, res) => {
  try {
    const rows = await query(`SELECT * FROM priorities ORDER BY order_index ASC, name ASC`);
    const mapped = rows.map((row) =>
      enrich(row, ['order_index'], ['is_active'], ['created_at', 'updated_at'])
    );
    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo prioridades');
  }
});

app.post('/api/priorities', async (req, res) => {
  const { name, color_hex = '#3B82F6', order_index = 0, is_active = true } = req.body || {};

  if (!name || typeof name !== 'string') {
    return badRequest(res, 'El nombre es obligatorio');
  }

  try {
    const rows = await query(
      `INSERT INTO priorities (name, color_hex, order_index, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW())
       RETURNING *`,
      [name.trim(), color_hex, order_index, is_active ? 1 : 0]
    );

    res.status(201).json(enrich(rows[0], ['order_index'], ['is_active'], ['created_at', 'updated_at']));
  } catch (error) {
    serverError(res, error, 'Error creando prioridad');
  }
});

app.put('/api/priorities/:id', async (req, res) => {
  const priorityId = Number(req.params.id);
  if (Number.isNaN(priorityId)) {
    return badRequest(res, 'ID de prioridad inválido');
  }

  const { name, color_hex = '#3B82F6', order_index = 0, is_active = true } = req.body || {};

  if (!name || typeof name !== 'string') {
    return badRequest(res, 'El nombre es obligatorio');
  }

  try {
    const rows = await query(
      `UPDATE priorities
          SET name = $1,
              color_hex = $2,
              order_index = $3,
              is_active = $4,
              updated_at = NOW()
        WHERE id = $5
        RETURNING *`,
      [name.trim(), color_hex, order_index, is_active ? 1 : 0, priorityId]
    );

    if (rows.length === 0) {
      return notFound(res, 'Prioridad');
    }

    res.json(enrich(rows[0], ['order_index'], ['is_active'], ['created_at', 'updated_at']));
  } catch (error) {
    serverError(res, error, 'Error actualizando prioridad');
  }
});

app.delete('/api/priorities/:id', async (req, res) => {
  const priorityId = Number(req.params.id);
  if (Number.isNaN(priorityId)) {
    return badRequest(res, 'ID de prioridad inválido');
  }

  try {
    const rows = await query(`DELETE FROM priorities WHERE id = $1 RETURNING *`, [priorityId]);
    if (rows.length === 0) {
      return notFound(res, 'Prioridad');
    }
    res.json({ success: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando prioridad');
  }
});

app.get('/api/follow-up-steps', async (_req, res) => {
  try {
    const rows = await query(`SELECT * FROM follow_up_steps ORDER BY order_index ASC, name ASC`);
    const mapped = rows.map((row) =>
      enrich(row, ['order_index'], ['is_active'], ['created_at', 'updated_at'])
    );
    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo pasos');
  }
});

app.post('/api/follow-up-steps', async (req, res) => {
  const { name, description = null, order_index = 0, is_active = true } = req.body || {};

  if (!name || typeof name !== 'string') {
    return badRequest(res, 'El nombre es obligatorio');
  }

  try {
    const rows = await query(
      `INSERT INTO follow_up_steps (name, description, order_index, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW())
       RETURNING *`,
      [name.trim(), description, order_index, is_active]
    );

    res.status(201).json(enrich(rows[0], ['order_index'], ['is_active'], ['created_at', 'updated_at']));
  } catch (error) {
    serverError(res, error, 'Error creando paso');
  }
});

app.put('/api/follow-up-steps/:id', async (req, res) => {
  const stepId = Number(req.params.id);
  if (Number.isNaN(stepId)) {
    return badRequest(res, 'ID de paso inválido');
  }

  const { name, description = null, order_index = 0, is_active = true } = req.body || {};

  if (!name || typeof name !== 'string') {
    return badRequest(res, 'El nombre es obligatorio');
  }

  try {
    const rows = await query(
      `UPDATE follow_up_steps
          SET name = $1,
              description = $2,
              order_index = $3,
              is_active = $4,
              updated_at = NOW()
        WHERE id = $5
        RETURNING *`,
      [name.trim(), description, order_index, is_active ? 1 : 0, stepId]
    );

    if (rows.length === 0) {
      return notFound(res, 'Paso');
    }

    res.json(enrich(rows[0], ['order_index'], ['is_active'], ['created_at', 'updated_at']));
  } catch (error) {
    serverError(res, error, 'Error actualizando paso');
  }
});

app.delete('/api/follow-up-steps/:id', async (req, res) => {
  const stepId = Number(req.params.id);
  if (Number.isNaN(stepId)) {
    return badRequest(res, 'ID de paso inválido');
  }

  try {
    const rows = await query(`DELETE FROM follow_up_steps WHERE id = $1 RETURNING *`, [stepId]);
    if (rows.length === 0) {
      return notFound(res, 'Paso');
    }
    res.json({ success: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando paso');
  }
});

// ======================================================
// Rutas no encontradas
// ======================================================
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ======================================================
// Arranque del servidor
// ======================================================
app.listen(PORT, () => {
  console.log(`✅ CRM Pro API escuchando en el puerto ${PORT}`);
});