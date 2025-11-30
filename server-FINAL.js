import express from 'express';
import cors from 'cors';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// ======================================================
// Configuración base
// ======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3001);

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

// ======================================================
// Endpoint para limpiar nombres BAN (sin autenticación - solo desarrollo)
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
    console.log('📋 GET /api/clients - Usuario:', req.user?.username, 'Role:', req.user?.role);
    const params = [];
    let whereClause = 'WHERE COALESCE(c.is_active,1) = 1';

    // Todos los usuarios (admin, supervisor, vendedor) ven todos los clientes
    // Sin filtro por vendor_id

    // Consulta optimizada para mejor rendimiento con información de suscriptores
    const sql = `SELECT DISTINCT ON (c.id)
          c.*,
          v.name AS vendor_name,
          COALESCE(b.ban_count, 0) AS ban_count,
          CASE 
            WHEN b.ban_numbers IS NOT NULL AND LENGTH(b.ban_numbers) > 200 
            THEN LEFT(b.ban_numbers, 200) || '...'
            ELSE b.ban_numbers
          END AS ban_numbers,
          b.ban_descriptions,
          CASE WHEN COALESCE(b.ban_count, 0) > 0 THEN 1 ELSE 0 END AS has_bans,
          COALESCE(s.subscriber_count, 0) AS subscriber_count,
          s.primary_subscriber_phone,
          s.primary_contract_end_date,
          s.primary_subscriber_created_at,
          s.primary_service_type,
          s.all_service_types,
          COALESCE(la.last_activity, c.updated_at) AS last_activity,
          CASE WHEN b.cancelled_status IS NOT NULL THEN 1 ELSE 0 END AS has_cancelled_bans
        FROM clients c
        LEFT JOIN vendors v ON c.vendor_id = v.id
        LEFT JOIN (
          SELECT 
            client_id,
            COUNT(*) AS ban_count,
            STRING_AGG(ban_number, ', ' ORDER BY ban_number) AS ban_numbers,
            STRING_AGG(DISTINCT CASE WHEN status = 'cancelled' OR status = 'cancelado' THEN 'cancelled' END, ', ') AS cancelled_status,
            STRING_AGG(DISTINCT CASE WHEN description IS NOT NULL AND description <> '' THEN description END, ', ') AS ban_descriptions
          FROM bans
          WHERE COALESCE(is_active,1) = 1
          GROUP BY client_id
        ) b ON b.client_id = c.id
        LEFT JOIN (
          SELECT 
            b.client_id,
            COUNT(DISTINCT s.id) AS subscriber_count,
            COUNT(DISTINCT CASE WHEN COALESCE(s.remaining_payments, 0) = 0 THEN s.id END) AS subscribers_in_opportunity,
            MAX(CASE WHEN s.phone IS NOT NULL THEN s.phone END) AS primary_subscriber_phone,
            MAX(CASE WHEN s.contract_end_date IS NOT NULL THEN s.contract_end_date END) AS primary_contract_end_date,
            MAX(CASE WHEN s.created_at IS NOT NULL THEN s.created_at END) AS primary_subscriber_created_at,
            MAX(CASE WHEN s.service_type IS NOT NULL THEN s.service_type END) AS primary_service_type,
            STRING_AGG(DISTINCT s.service_type, ', ') AS all_service_types
          FROM bans b
          INNER JOIN subscribers s ON s.ban_id = b.id
          WHERE COALESCE(b.is_active,1) = 1 AND COALESCE(s.is_active,1) = 1
          GROUP BY b.client_id
        ) s ON s.client_id = c.id
        LEFT JOIN (
          SELECT 
            b.client_id,
            MAX(GREATEST(
              COALESCE(b.updated_at, '1970-01-01'::timestamp),
              COALESCE(s.updated_at, '1970-01-01'::timestamp),
              COALESCE(c.updated_at, '1970-01-01'::timestamp)
            )) AS last_activity
          FROM bans b
          LEFT JOIN subscribers s ON s.ban_id = b.id
          LEFT JOIN clients c ON c.id = b.client_id
          WHERE COALESCE(b.is_active,1) = 1
          GROUP BY b.client_id
        ) la ON la.client_id = c.id
        ${whereClause}
        ORDER BY c.id, c.name ASC`;

    console.log('📋 Ejecutando consulta SQL para clientes...');
    const startTime = Date.now();
    const rows = await query(sql, params);
    const duration = Date.now() - startTime;
    console.log(`✅ Clientes encontrados: ${rows.length} (en ${duration}ms)`);

    const mapped = rows.map((row) =>
      enrich(
        row,
        ['includes_ban', 'vendor_id', 'ban_count', 'is_active', 'subscriber_count', 'subscribers_in_opportunity', 'has_cancelled_bans', 'base'],
        ['has_bans'],
        ['created_at', 'updated_at', 'primary_contract_end_date', 'primary_subscriber_created_at', 'last_activity']
      )
    );
    console.log(`✅ Clientes mapeados: ${mapped.length}`);
    res.json(mapped);
  } catch (error) {
    console.error('❌ Error en GET /api/clients:', error);
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

    // Todos los usuarios pueden ver todos los clientes (sin restricción de vendor_id)
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
    vendor_id = null,
    base = 0
  } = req.body || {};

  // Solo business_name es obligatorio
  if (!business_name || typeof business_name !== 'string' || !business_name.trim()) {
    return badRequest(res, 'La empresa (business_name) es obligatoria');
  }

  try {
    let assignedVendorId = toDbId(vendor_id);

    // Si es vendedor, buscar su vendor_id numérico desde salespeople y auto-asignarlo
    if (req.user?.role === 'vendedor' && req.user.salespersonId) {
      // Buscar el salesperson para obtener su nombre
      const salespersonResult = await query(
        `SELECT name FROM salespeople WHERE id = $1`,
        [req.user.salespersonId]
      );
      if (salespersonResult.length > 0) {
        const salespersonName = salespersonResult[0].name;
        // Normalizar nombres para búsqueda (mayúsculas, sin espacios extra)
        const normalizedName = salespersonName.trim().toUpperCase();
        const firstName = normalizedName.split(' ')[0]; // Primer nombre

        // Buscar vendor por nombre (coincidencia exacta, parcial, o por primer nombre)
        const vendorResult = await query(
          `SELECT id FROM vendors 
           WHERE UPPER(TRIM(name)) = $1 
              OR UPPER(TRIM(name)) LIKE $2 
              OR UPPER(TRIM(name)) = $3
           LIMIT 1`,
          [normalizedName, `%${normalizedName}%`, firstName]
        );
        if (vendorResult.length > 0) {
          assignedVendorId = Number(vendorResult[0].id);
          console.log(`✅ Vendor auto-asignado para ${salespersonName}: ${assignedVendorId}`);
        } else {
          // Si no hay vendor asociado, usar el primer vendor activo o null
          const defaultVendor = await query(`SELECT id FROM vendors WHERE is_active = 1 LIMIT 1`);
          assignedVendorId = defaultVendor.length > 0 ? Number(defaultVendor[0].id) : null;
          console.log(`⚠️ No se encontró vendor para ${salespersonName}, usando default: ${assignedVendorId}`);
        }
      }
    }

    console.log('📝 Creando cliente - Usuario:', req.user?.username, 'Role:', req.user?.role, 'vendor_id asignado:', assignedVendorId);

    const rows = await query(
      `INSERT INTO clients
        (name, business_name, contact_person, email, phone, secondary_phone, mobile_phone, address, city, zip_code, includes_ban, vendor_id, base, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1,NOW(),NOW())
       RETURNING *`,
      [
        name?.trim() || null,
        business_name.trim(),
        contact_person,
        email,
        phone,
        secondary_phone,
        mobile_phone,
        address,
        city,
        zip_code,
        includes_ban ? 1 : 0,
        assignedVendorId,
        base || 0
      ]
    );

    const client = enrich(
      rows[0],
      ['includes_ban', 'vendor_id', 'is_active', 'base'],
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
    is_active = 1,
    base = 0
  } = req.body || {};

  // Solo business_name es obligatorio
  if (!business_name || typeof business_name !== 'string' || !business_name.trim()) {
    return badRequest(res, 'La empresa (business_name) es obligatoria');
  }

  try {
    const existing = await query(`SELECT vendor_id FROM clients WHERE id = $1`, [clientId]);
    if (existing.length === 0) {
      return notFound(res, 'Cliente');
    }

    // Preservar vendor_id existente si no se proporciona uno nuevo
    let finalVendorId = toDbId(vendor_id);
    const currentVendorId = existing[0].vendor_id;

    // Si no se envió vendor_id, preservar el existente
    if (finalVendorId === null && currentVendorId !== null) {
      finalVendorId = currentVendorId;
    }

    if (req.user?.role === 'vendedor') {
      // Los vendedores pueden editar cualquier cliente
      // Si el cliente no tiene vendor_id, asignarlo al vendedor que lo edita
      if (currentVendorId === null && finalVendorId === null) {
        // Buscar el vendor_id del vendedor
        const salespersonResult = await query(
          `SELECT name FROM salespeople WHERE id = $1`,
          [req.user.salespersonId]
        );
        if (salespersonResult.length > 0) {
          const salespersonName = salespersonResult[0].name;
          const normalizedName = salespersonName.trim().toUpperCase();
          const firstName = normalizedName.split(' ')[0];
          const vendorResult = await query(
            `SELECT id FROM vendors 
             WHERE UPPER(TRIM(name)) = $1 
                OR UPPER(TRIM(name)) LIKE $2 
                OR UPPER(TRIM(name)) = $3
             LIMIT 1`,
            [normalizedName, `%${normalizedName}%`, firstName]
          );
          if (vendorResult.length > 0) {
            finalVendorId = Number(vendorResult[0].id);
          }
        }
      }
      // Si se está cambiando el vendor_id, permitirlo (los vendedores pueden cambiar asignaciones)
      // Si no se cambia, preservar el existente
      if (finalVendorId === null && currentVendorId !== null) {
        finalVendorId = currentVendorId;
      }
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
              base = $13,
              is_active = $14,
              updated_at = NOW()
        WHERE id = $15
        RETURNING *`,
      [
        name?.trim() || null,
        business_name.trim(),
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
        base || 0,
        is_active ? 1 : 0,
        clientId
      ]
    );

    if (rows.length === 0) {
      return notFound(res, 'Cliente');
    }

    const client = enrich(
      rows[0],
      ['includes_ban', 'vendor_id', 'is_active', 'base'],
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

    // Todos los usuarios pueden ver todos los BANs (sin restricción de vendor_id)
    const mapped = rows.map((row) =>
      enrich(row, ['client_id', 'is_active'], [], ['created_at', 'updated_at'])
    );
    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo BANs');
  }
});

app.post('/api/bans', async (req, res) => {
  const { ban_number, client_id, description = null, status = 'active', is_active = 1, cancel_reason } = req.body || {};

  if (!ban_number || typeof ban_number !== 'string') {
    return badRequest(res, 'El BAN es obligatorio');
  }

  if (!client_id) {
    return badRequest(res, 'client_id es obligatorio');
  }

  if (status === 'cancelled' && !cancel_reason) {
    return badRequest(res, 'Razón de cancelación es obligatoria para BANs cancelados');
  }

  try {
    const clientRows = await query(`SELECT vendor_id FROM clients WHERE id = $1`, [client_id]);
    if (clientRows.length === 0) {
      return notFound(res, 'Cliente');
    }

    // Los vendedores pueden crear BANs para cualquier cliente
    // Sin restricciones de vendor_id

    // Verificar duplicados de BAN
    const existing = await query(
      `SELECT b.id, b.client_id, c.business_name, c.name 
       FROM bans b
       LEFT JOIN clients c ON b.client_id = c.id
       WHERE b.ban_number = $1`,
      [ban_number.trim()]
    );

    console.log(`🔍 Verificando BAN ${ban_number.trim()} - Resultados encontrados:`, existing.length, existing);

    if (existing.length > 0) {
      const banInfo = existing[0];
      const existingClientId = banInfo.client_id;
      const clientName = banInfo.business_name || banInfo.name || 'Cliente desconocido';

      console.log(`⚠️ BAN duplicado encontrado:`, {
        ban_number: ban_number.trim(),
        existing_ban_id: banInfo.id,
        existing_client_id: existingClientId,
        current_client_id: client_id,
        client_name: clientName
      });

      // Verificar si el cliente_id del BAN existente coincide con el cliente_id actual
      // Comparar como números para evitar problemas de tipo
      const existingClientIdNum = Number(existingClientId);
      const currentClientIdNum = Number(client_id);

      if (existingClientIdNum === currentClientIdNum) {
        return conflict(res, `El BAN ${ban_number.trim()} ya existe y está asignado a este cliente: ${clientName} (ID: ${existingClientId}). Un cliente puede tener múltiples BANs, pero cada número de BAN debe ser único.`);
      } else {
        // El BAN existe pero está asignado a otro cliente - no permitir crear uno nuevo con el mismo número
        return conflict(res, `El BAN ${ban_number.trim()} ya existe y está asignado al cliente: ${clientName} (ID: ${existingClientId}). Cada número de BAN debe ser único en el sistema.`);
      }
    }

    const rows = await query(
      `INSERT INTO bans
        (ban_number, client_id, description, status, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
       RETURNING *`,
      [ban_number.trim(), client_id, description, status === 'cancelled' ? 'cancelled' : 'active', is_active ? 1 : 0]
    );

    const ban = enrich(rows[0], ['client_id', 'is_active'], [], ['created_at', 'updated_at']);

    // Si está cancelado, guardar la razón
    if (status === 'cancelled' && cancel_reason) {
      await query(
        `INSERT INTO ban_cancel_reason (ban_id, reason, created_at) VALUES ($1, $2, NOW())`,
        [ban.id, cancel_reason]
      );
    }

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
    is_active = 1,
    cancel_reason
  } = req.body || {};

  console.log('📝 PUT /api/bans/:id - Datos recibidos:', { banId, ban_number, client_id, description, status, is_active, cancel_reason });

  if (!ban_number || typeof ban_number !== 'string') {
    return badRequest(res, 'El BAN es obligatorio');
  }

  if (status === 'cancelled' && !cancel_reason) {
    return badRequest(res, 'Razón de cancelación es obligatoria para BANs cancelados');
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

    // Si no se proporciona client_id, usar el existente del BAN
    const finalClientId = client_id || ownerRows[0].client_id;

    // Los vendedores pueden editar BANs de cualquier cliente
    // Sin restricciones de vendor_id

    if (client_id && client_id !== ownerRows[0].client_id) {
      const targetClient = await query(`SELECT vendor_id FROM clients WHERE id = $1`, [client_id]);
      if (targetClient.length === 0) {
        return notFound(res, 'Cliente');
      }
      // Los vendedores pueden mover BANs a cualquier cliente
    }

    const existing = await query(
      `SELECT id FROM bans WHERE ban_number = $1 AND id <> $2`,
      [ban_number.trim(), banId]
    );

    if (existing.length > 0) {
      return conflict(res, 'El BAN ya existe');
    }

    // Normalizar el status: aceptar 'cancelled', 'cancelado', o cualquier otro valor como 'active'
    const normalizedStatus = (status === 'cancelled' || status === 'cancelado') ? 'cancelled' : 'active';
    console.log('🔄 Normalizando status:', status, '->', normalizedStatus);

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
      [ban_number.trim(), finalClientId, description, normalizedStatus, is_active ? 1 : 0, banId]
    );

    console.log('✅ BAN actualizado en BD:', rows[0]);

    if (rows.length === 0) {
      return notFound(res, 'BAN');
    }

    // Si cambió a cancelado, guardar la razón
    if (normalizedStatus === 'cancelled' && cancel_reason) {
      // Eliminar razones anteriores si existen
      await query(`DELETE FROM ban_cancel_reason WHERE ban_id = $1`, [banId]);
      // Insertar nueva razón
      await query(
        `INSERT INTO ban_cancel_reason (ban_id, reason, created_at) VALUES ($1, $2, NOW())`,
        [banId, cancel_reason]
      );
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

    // Los vendedores pueden eliminar BANs de cualquier cliente
    // Sin restricciones de vendor_id

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
// Importador Visual
// ======================================================
app.post('/api/importador/save', async (req, res) => {
  const { mapping, data } = req.body || {};

  console.log('📥 Importador save - Datos recibidos:', {
    hasMapping: !!mapping,
    hasData: !!data,
    dataLength: Array.isArray(data) ? data.length : 0,
    firstRow: Array.isArray(data) && data.length > 0 ? data[0] : null,
    user: req.user ? { userId: req.user.userId, salespersonId: req.user.salespersonId, role: req.user.role } : null
  });

  if (!mapping || !data || !Array.isArray(data)) {
    return badRequest(res, 'Datos de mapeo y datos son requeridos');
  }

  if (data.length === 0) {
    return badRequest(res, 'No hay datos para procesar');
  }

  // Obtener vendor_id del usuario o buscar el primero disponible
  let vendorId = req.user?.salespersonId;

  // Convertir a número si es string numérico
  if (vendorId && typeof vendorId === 'string') {
    const numId = Number(vendorId);
    vendorId = !isNaN(numId) ? numId : null;
  }

  // Si vendorId no es un número válido, dejar como NULL (sin vendedor asignado)
  // Los clientes importados pueden no tener vendedor asignado
  if (!vendorId || typeof vendorId !== 'number') {
    vendorId = null;
    console.log('ℹ️ No hay vendor_id válido - Los clientes se crearán sin vendedor asignado');
  }

  console.log('✅ Usando vendor_id:', vendorId || 'NULL (sin asignar)', typeof vendorId);

  const client = await pool.connect();
  let created = 0;
  let updated = 0;
  let errors = [];

  // Procesar en lotes para evitar agotar locks de PostgreSQL
  const BATCH_SIZE = 100; // Procesar 100 filas por lote
  const TOTAL_BATCHES = Math.ceil(data.length / BATCH_SIZE);

  try {
    for (let batchIndex = 0; batchIndex < TOTAL_BATCHES; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, data.length);
      const batch = data.slice(batchStart, batchEnd);

      console.log(`📦 Procesando lote ${batchIndex + 1}/${TOTAL_BATCHES} (filas ${batchStart + 1}-${batchEnd})`);

      await client.query('BEGIN');

      for (let i = 0; i < batch.length; i++) {
        const rowIndex = batchStart + i;
        const row = batch[i];

        try {

          const clientData = row.Clientes || {};
          const banData = row.BANs || {};
          const subscriberData = row.Suscriptores || {};

          // REGLA 1: BAN siempre requerido
          // Si no hay BAN, buscar por empresa; si no hay empresa, omitir fila
          let normalizedBan = null;
          if (banData.ban_number) {
            normalizedBan = String(banData.ban_number).trim().replace(/[^0-9]/g, '').slice(0, 9);
            if (!normalizedBan || normalizedBan.length === 0) {
              normalizedBan = null; // BAN inválido, tratar como si no hubiera BAN
            }
          }

          // Si NO hay BAN válido, se requiere empresa (business_name) O nombre (name)
          if (!normalizedBan) {
            if (!clientData.business_name && !clientData.name) {
              errors.push(`Fila ${rowIndex + 1} omitida: falta BAN, se requiere al menos Nombre o Empresa`);
              continue;
            }
            // Si no hay BAN pero hay datos de cliente, continuar
          }

          // REGLA MODIFICADA (24/11/2025):
          // Si hay BAN, PERMITIR crear cliente aunque no tenga nombre ni empresa.
          // Se usará el BAN como identificador temporal y se marcará como INCOMPLETO (si existe lógica para ello)
          // o simplemente se creará con un nombre genérico basado en el BAN para que aparezca en el sistema.
          
          // Validar teléfono del suscriptor
          // MODIFICADO: Ya no es obligatorio tener teléfono si hay BAN.
          // Si falta el teléfono, se crea el Cliente y el BAN, pero sin suscriptor (quedará como INCOMPLETO).
          let subscriberPhone = null;
          if (subscriberData.phone) {
            subscriberPhone = String(subscriberData.phone).trim().replace(/[^0-9]/g, '');
            if (!subscriberPhone || subscriberPhone.length === 0) {
              subscriberPhone = null;
            }
          }

          // Buscar o crear cliente
          let clientId = null;

          if (normalizedBan) {
            // Si hay BAN: buscar por 1) Email, 2) BAN asociado, 3) Teléfono Suscriptor, 4) business_name
            // 1. Buscar por email si existe
            if (clientData.email) {
              const emailResult = await client.query(
                `SELECT id FROM clients WHERE email = $1`,
                [clientData.email]
              );
              if (emailResult.rows.length > 0) {
                clientId = emailResult.rows[0].id;
              }
            }

            // 2. Si no se encontró por email, buscar cliente asociado al BAN
            if (!clientId) {
              const banClientResult = await client.query(
                `SELECT client_id FROM bans WHERE ban_number = $1 LIMIT 1`,
                [normalizedBan]
              );
              if (banClientResult.rows.length > 0) {
                clientId = banClientResult.rows[0].client_id;
              }
            }

            // 3. NUEVO: Buscar por teléfono de suscriptor existente
            // Si el suscriptor ya existe, pertenece a un BAN, que pertenece a un Cliente.
            if (!clientId && subscriberPhone) {
               const subResult = await client.query(
                 `SELECT b.client_id 
                  FROM subscribers s
                  JOIN bans b ON s.ban_id = b.id
                  WHERE s.phone = $1 AND s.is_active = 1
                  LIMIT 1`,
                 [subscriberPhone]
               );
               if (subResult.rows.length > 0) {
                 clientId = subResult.rows[0].client_id;
                 // console.log(`ℹ️ Cliente encontrado por teléfono ${subscriberPhone}: ID ${clientId}`);
               }
            }

            // 4. Si no se encontró por email ni BAN ni teléfono, buscar por business_name y FUSIONAR duplicados
            if (!clientId && clientData.business_name) {
              const businessResult = await client.query(
                `SELECT id FROM clients WHERE business_name = $1 ORDER BY id ASC`,
                [clientData.business_name]
              );
              if (businessResult.rows.length > 0) {
                clientId = businessResult.rows[0].id; // Usar el cliente más antiguo

                // FUSIONAR duplicados si existen
                if (businessResult.rows.length > 1) {
                  const duplicateIds = businessResult.rows.slice(1).map(r => r.id);

                  for (const dupId of duplicateIds) {
                    // Mover BANs y eliminar duplicado
                    await client.query(
                      `UPDATE bans SET client_id = $1, updated_at = NOW() WHERE client_id = $2`,
                      [clientId, dupId]
                    );
                    await client.query(`DELETE FROM clients WHERE id = $1`, [dupId]);
                  }

                  errors.push(`✅ FUSIÓN CLIENTE - Fila ${rowIndex + 1}: Se fusionaron ${duplicateIds.length} cliente(s) duplicado(s) con "${clientData.business_name}" en el cliente ID ${clientId}.`);
                }
              }
            }
          } else {
            // Si NO hay BAN: buscar por business_name O name
            // Prioridad: business_name, luego name
            let searchField = null;
            let searchValue = null;

            if (clientData.business_name) {
              searchField = 'business_name';
              searchValue = clientData.business_name;
            } else if (clientData.name) {
              searchField = 'name';
              searchValue = clientData.name;
            }

            if (searchField) {
              const clientResult = await client.query(
                `SELECT id FROM clients WHERE ${searchField} = $1 ORDER BY id ASC`,
                [searchValue]
              );
              
              if (clientResult.rows.length > 0) {
                clientId = clientResult.rows[0].id; // Usar el cliente más antiguo (ID menor)

                // Si hay DUPLICADOS (más de 1 cliente con el mismo nombre), FUSIONARLOS
                if (clientResult.rows.length > 1) {
                  const duplicateIds = clientResult.rows.slice(1).map(r => r.id); // IDs de los duplicados

                  for (const dupId of duplicateIds) {
                    // 1. Mover todos los BANs del duplicado al cliente principal
                    await client.query(
                      `UPDATE bans SET client_id = $1, updated_at = NOW() WHERE client_id = $2`,
                      [clientId, dupId]
                    );

                    // 2. Eliminar el cliente duplicado
                    await client.query(
                      `DELETE FROM clients WHERE id = $1`,
                      [dupId]
                    );
                  }

                  errors.push(`✅ FUSIÓN CLIENTE - Fila ${rowIndex + 1}: Se fusionaron ${duplicateIds.length} cliente(s) duplicado(s) con "${searchValue}" en el cliente ID ${clientId}. Todos los BANs ahora están bajo un solo cliente.`);
                }
              }
            }
          }

          if (clientId) {
            // Verificar si hay duplicados de cliente por business_name o email
            const duplicateCheck = await client.query(
              `SELECT id, name, business_name, email FROM clients 
               WHERE (business_name = $1 OR email = $2) 
               AND id != $3 
               LIMIT 1`,
              [
                clientData.business_name || null,
                clientData.email || null,
                clientId
              ]
            );

            if (duplicateCheck.rows.length > 0) {
              const dup = duplicateCheck.rows[0];
              const dupName = dup.business_name || dup.name || 'Cliente desconocido';
              errors.push(`⚠️ POSIBLE DUPLICADO CLIENTE - Fila ${rowIndex + 1}: Cliente con empresa "${clientData.business_name || 'N/A'}" o email "${clientData.email || 'N/A'}" ya existe como "${dupName}" (ID: ${dup.id}). Se actualizó el cliente existente (ID: ${clientId}).`);
            }

            // Actualizar cliente existente
            // Solo actualizar vendor_id si el cliente no tiene uno asignado (NULL)
            await client.query(
              `UPDATE clients 
               SET name = COALESCE($1, name), 
                   business_name = COALESCE($2, business_name), 
                   contact_person = COALESCE($3, contact_person),
                   email = COALESCE($4, email),
                   phone = COALESCE($5, phone), 
                   secondary_phone = COALESCE($6, secondary_phone),
                   mobile_phone = COALESCE($7, mobile_phone), 
                   address = COALESCE($8, address),
                   city = COALESCE($9, city), 
                   zip_code = COALESCE($10, zip_code),
                   vendor_id = COALESCE(vendor_id, $11),
                   base = COALESCE($12, base),
                   is_active = 1,
                   updated_at = NOW()
               WHERE id = $13`,
              [
                clientData.name || null,
                clientData.business_name || null,
                clientData.contact_person || null,
                clientData.email || null,
                clientData.phone || null,
                clientData.secondary_phone || null,
                clientData.mobile_phone || null,
                banData.address || clientData.address || null,
                banData.city || clientData.city || null,
                banData.zip_code || clientData.zip_code || null,
                vendorId,
                clientData.base || null,
                clientId
              ]
            );
            updated++;
          } else {
            // Crear nuevo cliente
            // Si hay BAN: puede ser sin datos (valores por defecto)
            // Si NO hay BAN: debe tener business_name (ya validado arriba)
            
            // Determinar nombre final asegurando que no sea vacío ni solo espacios
            let finalName = clientData.name;
            if (!finalName || !String(finalName).trim()) {
                finalName = clientData.business_name;
            }
            if (!finalName || !String(finalName).trim()) {
                finalName = normalizedBan;
            }
            
            // Si aún así no hay nombre (caso raro si pasó la validación inicial), usar un placeholder
            if (!finalName || !String(finalName).trim()) {
                finalName = `Cliente Sin Nombre ${Date.now()}`;
            }

            const newClient = await client.query(
              `INSERT INTO clients (name, business_name, contact_person, email, phone, secondary_phone, mobile_phone, address, city, zip_code, vendor_id, base, is_active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, NOW(), NOW())
               RETURNING id`,
              [
                finalName,
                clientData.business_name || null,
                clientData.contact_person || null,
                clientData.email || null,
                clientData.phone || null,
                clientData.secondary_phone || null,
                clientData.mobile_phone || null,
                banData.address || clientData.address || null,
                banData.city || clientData.city || null,
                banData.zip_code || clientData.zip_code || null,
                vendorId,
                clientData.base || null
              ]
            );
            clientId = newClient.rows[0].id;
            created++;
          }

          // Buscar o crear BAN (solo si hay BAN)
          let banId = null;
          if (normalizedBan) {
            let banResult = await client.query(
              `SELECT b.id, b.client_id, c.name as client_name, c.business_name 
               FROM bans b 
               LEFT JOIN clients c ON b.client_id = c.id 
               WHERE b.ban_number = $1`,
              [normalizedBan]
            );

            if (banResult.rows.length > 0) {
              banId = banResult.rows[0].id;
              const existingBan = banResult.rows[0];
              const existingClientId = existingBan.client_id;
              const existingClientName = existingBan.business_name || existingBan.client_name || 'Cliente desconocido';

              // Detectar si hay un duplicado de BAN en diferente cliente
              if (existingClientId !== clientId && clientId) {
                const currentClientResult = await client.query(
                  `SELECT name, business_name FROM clients WHERE id = $1`,
                  [clientId]
                );
                const currentClientName = currentClientResult.rows.length > 0
                  ? (currentClientResult.rows[0].business_name || currentClientResult.rows[0].name || 'Cliente desconocido')
                  : 'Cliente desconocido';

                errors.push(`⚠️ DUPLICADO BAN ${normalizedBan} - Fila ${rowIndex + 1}: El BAN ya existe y está asignado al cliente "${existingClientName}" (ID: ${existingClientId}), pero se intentó asignar al cliente "${currentClientName}" (ID: ${clientId}). El BAN se mantiene asociado al cliente original.`);
              } else if (existingClientId === clientId) {
                // BAN duplicado en el mismo cliente - solo informar
                errors.push(`ℹ️ BAN ${normalizedBan} ya existe para este cliente (Fila ${rowIndex + 1}). Se actualizaron los datos si fue necesario.`);
              }

              // Actualizar campos nuevos del BAN si hay datos
              if (banData.description || banData.status) {
                await client.query(
                  `UPDATE bans 
                   SET description = COALESCE($1, description),
                       status = COALESCE($2, status),
                       client_id = COALESCE($3, client_id),
                       updated_at = NOW() 
                   WHERE id = $4`,
                  [
                    banData.description || null,
                    banData.status || null,
                    clientId || banResult.rows[0].client_id,
                    banId
                  ]
                );
              }
              // Si el BAN tiene un client_id diferente y tenemos uno nuevo, NO actualizarlo para evitar mover BANs
              // Solo informar en los errores (ya hecho arriba)
            } else {
              // Crear nuevo BAN solo si tenemos clientId
              if (clientId) {
                const newBan = await client.query(
                  `INSERT INTO bans (ban_number, client_id, description, status, is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, 1, NOW(), NOW())
                   RETURNING id`,
                  [
                    normalizedBan,
                    clientId,
                    banData.description || null,
                    banData.status || 'active',
                  ]
                );
                banId = newBan.rows[0].id;
              }
            }
          }

          // Buscar o crear suscriptor (solo si hay BAN y teléfono)
          let subscriberResult = null;
          
          // Lógica para calcular fecha de fin de contrato automática basada en pagos restantes
          // Se usa si no se proporciona una fecha explícita
          let calculatedEndDate = null;
          if (subscriberData.remaining_payments) {
            const remaining = Number(subscriberData.remaining_payments);
            if (!isNaN(remaining) && remaining > 0) {
              const today = new Date();
              const endDate = new Date(today);
              endDate.setMonth(endDate.getMonth() + remaining);
              calculatedEndDate = endDate.toISOString().split('T')[0];
            }
          }

          if (banId && subscriberPhone) {
            // Buscar si el teléfono ya existe en CUALQUIER BAN (activo)
            // Esto es necesario porque ahora tenemos una restricción UNIQUE en phone activo
            subscriberResult = await client.query(
              `SELECT id, ban_id FROM subscribers WHERE phone = $1 AND is_active = 1`,
              [subscriberPhone]
            );
          }

          if (subscriberResult && subscriberResult.rows.length > 0) {
            const existingSub = subscriberResult.rows[0];
            
            // Si existe pero en otro BAN, moverlo al nuevo BAN (según regla: "suscriptor puede ser asignado a otro cliente")
            if (existingSub.ban_id !== banId) {
              console.log(`ℹ️ Moviendo suscriptor ${subscriberPhone} del BAN ${existingSub.ban_id} al BAN ${banId}`);
            }

            // Actualizar suscriptor existente (y moverlo si es necesario)
            await client.query(
              `UPDATE subscribers 
             SET ban_id = $1,
                 service_type = COALESCE($2, service_type),
                 monthly_value = COALESCE($3, monthly_value),
                 months = COALESCE($4, months),
                 remaining_payments = COALESCE($5, remaining_payments),
                 contract_start_date = COALESCE($6, contract_start_date),
                 contract_end_date = COALESCE($7, contract_end_date),
                 status = COALESCE($8, status),
                 equipment = COALESCE($9, equipment),
                 city = COALESCE($10, city),
                 notes = COALESCE($11, notes),
                 updated_at = NOW()
             WHERE id = $12`,
              [
                banId, // Asegurar que esté en el BAN correcto
                subscriberData.service_type || null,
                subscriberData.monthly_value ? (isNaN(Number(subscriberData.monthly_value)) ? null : Number(subscriberData.monthly_value)) : null,
                subscriberData.months ? (isNaN(Number(subscriberData.months)) ? null : Number(subscriberData.months)) : null,
                subscriberData.remaining_payments ? (isNaN(Number(subscriberData.remaining_payments)) ? null : Number(subscriberData.remaining_payments)) : null,
                subscriberData.contract_start_date || null,
                subscriberData.contract_end_date || calculatedEndDate || null,
                subscriberData.status || null,
                subscriberData.equipment || null,
                subscriberData.city || null,
                subscriberData.notes || null,
                existingSub.id,
              ]
            );
          } else if (banId && subscriberPhone) {
            // Crear nuevo suscriptor (solo si hay BAN y teléfono)
            await client.query(
              `INSERT INTO subscribers (phone, ban_id, service_type, monthly_value, months, remaining_payments, contract_start_date, contract_end_date, status, equipment, city, notes, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, NOW(), NOW())`,
              [
                subscriberPhone,
                banId,
                subscriberData.service_type || null,
                subscriberData.monthly_value ? (isNaN(Number(subscriberData.monthly_value)) ? null : Number(subscriberData.monthly_value)) : null,
                subscriberData.months ? (isNaN(Number(subscriberData.months)) ? null : Number(subscriberData.months)) : null,
                subscriberData.remaining_payments ? (isNaN(Number(subscriberData.remaining_payments)) ? null : Number(subscriberData.remaining_payments)) : null,
                subscriberData.contract_start_date || null,
                subscriberData.contract_end_date || calculatedEndDate || null,
                subscriberData.status || 'active',
                subscriberData.equipment || null,
                subscriberData.city || null,
                subscriberData.notes || null,
              ]
            );
          }
        } catch (rowError) {
          console.error(`❌ Error procesando fila ${rowIndex + 1}:`, rowError);
          errors.push(`Fila ${rowIndex + 1}: ${rowError.message || 'Error desconocido'}`);
          continue;
        }
      }

      // Commit del lote
      await client.query('COMMIT');
      console.log(`✅ Lote ${batchIndex + 1}/${TOTAL_BATCHES} completado`);
    }

    console.log('✅ Importador save - Resultado:', {
      total: data.length,
      created,
      updated,
      errors: errors.length,
      errorSamples: errors.slice(0, 5)
    });

    res.json({
      success: true,
      created,
      updated,
      total: data.length,
      errors: errors.slice(0, 20), // Limitar a 20 errores
      message: errors.length > 0
        ? `Procesadas ${data.length} filas. Creados: ${created}, Actualizados: ${updated}. ${errors.length} errores encontrados.`
        : `Procesadas ${data.length} filas. Creados: ${created}, Actualizados: ${updated}.`
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error haciendo rollback:', rollbackError);
    }
    console.error('❌ Error en importador save:', error);
    serverError(res, error, 'Error guardando datos del importador');
  } finally {
    client.release();
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

    // Todos los usuarios pueden ver todos los suscriptores (sin restricción de vendor_id)
    const mapped = rows.map((row) =>
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
    is_active = 1,
    status = 'activo',
    cancel_reason
  } = req.body || {};

  if (!phone || typeof phone !== 'string') {
    return badRequest(res, 'El teléfono es obligatorio');
  }

  if (!ban_id) {
    return badRequest(res, 'ban_id es obligatorio');
  }

  if (status === 'cancelado' && !cancel_reason) {
    return badRequest(res, 'Razón de cancelación es obligatoria para suscriptores cancelados');
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
        (phone, ban_id, contract_start_date, contract_end_date, service_type, monthly_value, months, remaining_payments, is_active, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
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
        status
      ]
    );

    const subscriber = enrich(
      rows[0],
      ['ban_id', 'monthly_value', 'months', 'remaining_payments'],
      ['is_active'],
      ['contract_start_date', 'contract_end_date', 'created_at', 'updated_at']
    );

    // Si está cancelado, guardar la razón
    if (status === 'cancelado' && cancel_reason) {
      await query(
        `INSERT INTO subscriber_cancel_reason (subscriber_id, reason, created_at) VALUES ($1, $2, NOW())`,
        [subscriber.id, cancel_reason]
      );
    }

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
    is_active = 1,
    status = 'activo',
    cancel_reason
  } = req.body || {};

  if (!phone || typeof phone !== 'string') {
    return badRequest(res, 'El teléfono es obligatorio');
  }

  if (status === 'cancelado' && !cancel_reason) {
    return badRequest(res, 'Razón de cancelación es obligatoria para suscriptores cancelados');
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
              status = $10,
              updated_at = NOW()
        WHERE id = $11
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
        status,
        subscriberId
      ]
    );

    if (rows.length === 0) {
      return notFound(res, 'Suscriptor');
    }

    // Si cambió a cancelado, guardar la razón
    if (status === 'cancelado' && cancel_reason) {
      // Eliminar razones anteriores si existen
      await query(`DELETE FROM subscriber_cancel_reason WHERE subscriber_id = $1`, [subscriberId]);
      // Insertar nueva razón
      await query(
        `INSERT INTO subscriber_cancel_reason (subscriber_id, reason, created_at) VALUES ($1, $2, NOW())`,
        [subscriberId, cancel_reason]
      );
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
      'total_amount',
      'base'
    ],
    ['is_active', 'is_completed'],
    ['last_call_date', 'next_call_date', 'completed_date', 'created_at', 'updated_at']
  );
}

app.get('/api/follow-up-prospects', async (req, res) => {
  try {
    // Permitir incluir completados con query param ?include_completed=true
    const includeCompleted = req.query.include_completed === 'true';
    
    let whereConditions = `c.is_active = 1 AND COALESCE(fp.is_active, true) = true`;
    if (!includeCompleted) {
      whereConditions += ` AND COALESCE(fp.is_completed, false) = false`;
    }
    
    const rows = await query(
      `SELECT fp.*, v.name AS vendor_name, c.name AS client_name, c.business_name AS client_business_name
         FROM follow_up_prospects fp
         LEFT JOIN vendors v ON fp.vendor_id = v.id
         INNER JOIN clients c ON fp.client_id = c.id
         WHERE ${whereConditions}
         ORDER BY fp.created_at DESC`
    );
    // TODOS VEN TODO - Sin filtro por vendedor
    res.json(rows.map(mapProspectRow));
  } catch (error) {
    serverError(res, error, 'Error obteniendo prospectos');
  }
});

// Endpoint para obtener prospectos completados (ventas) - para la página de Reportes
app.get('/api/completed-prospects', async (req, res) => {
  try {
    const rows = await query(
      `SELECT fp.*, v.name AS vendor_name, c.name AS client_name, c.business_name AS client_business_name
         FROM follow_up_prospects fp
         LEFT JOIN vendors v ON fp.vendor_id = v.id
         INNER JOIN clients c ON fp.client_id = c.id
         WHERE c.is_active = 1 
           AND fp.is_completed = true
         ORDER BY fp.completed_date DESC`
    );
    // TODOS VEN TODO - Sin filtro por vendedor
    res.json(rows.map(mapProspectRow));
  } catch (error) {
    serverError(res, error, 'Error obteniendo prospectos completados');
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
    is_active = true,
    base = 0
  } = req.body || {};

  if (!company_name || typeof company_name !== 'string') {
    return badRequest(res, 'El nombre de la empresa es obligatorio');
  }

  // Calcular total_amount sumando todos los productos
  const calculatedTotal = 
    Number(fijo_ren || 0) + 
    Number(fijo_new || 0) + 
    Number(movil_nueva || 0) + 
    Number(movil_renovacion || 0) + 
    Number(claro_tv || 0) + 
    Number(cloud || 0) + 
    Number(mpls || 0) + 
    Number(base || 0);
  
  console.log('💰 POST calculatedTotal:', calculatedTotal, 'de productos:', {
    fijo_ren, fijo_new, movil_nueva, movil_renovacion, claro_tv, cloud, mpls, base
  });

  try {
    let finalVendorId = toDbId(vendor_id);

    console.log(`🔍 Creando prospecto - Usuario: ${req.user?.username}, Rol: ${req.user?.role}, vendor_id recibido: ${vendor_id}, finalVendorId inicial: ${finalVendorId}`);

    // Si es vendedor, buscar su vendor_id numérico desde salespeople
    if (req.user?.role === 'vendedor' && req.user.salespersonId) {
      // Buscar el salesperson para obtener su nombre
      const salespersonResult = await query(
        `SELECT name FROM salespeople WHERE id = $1`,
        [req.user.salespersonId]
      );
      if (salespersonResult.length > 0) {
        const salespersonName = salespersonResult[0].name;
        // Normalizar nombres para búsqueda (mayúsculas, sin espacios extra)
        const normalizedName = salespersonName.trim().toUpperCase();
        const firstName = normalizedName.split(' ')[0]; // Primer nombre

        // Buscar vendor por nombre (coincidencia exacta, parcial, o por primer nombre)
        const vendorResult = await query(
          `SELECT id FROM vendors 
           WHERE UPPER(TRIM(name)) = $1 
              OR UPPER(TRIM(name)) LIKE $2 
              OR UPPER(TRIM(name)) = $3
           LIMIT 1`,
          [normalizedName, `%${normalizedName}%`, firstName]
        );
        if (vendorResult.length > 0) {
          finalVendorId = Number(vendorResult[0].id);
          console.log(`✅ Vendor auto-asignado para seguimiento: ${salespersonName} -> ${finalVendorId}`);
        } else {
          // Si no hay vendor asociado, usar el vendor_id del cliente si existe
          if (client_id) {
            const clientRows = await query(`SELECT vendor_id FROM clients WHERE id = $1`, [client_id]);
            if (clientRows.length > 0 && clientRows[0].vendor_id) {
              finalVendorId = Number(clientRows[0].vendor_id);
              console.log(`⚠️ No se encontró vendor para ${salespersonName}, usando vendor_id del cliente: ${finalVendorId}`);
            } else {
              // Último recurso: usar el primer vendor activo
              const defaultVendor = await query(`SELECT id FROM vendors WHERE is_active = 1 LIMIT 1`);
              if (defaultVendor.length > 0) {
                finalVendorId = Number(defaultVendor[0].id);
                console.log(`⚠️ Usando vendor por defecto: ${finalVendorId}`);
              }
            }
          }
        }
      }
    }

    if (client_id) {
      const clientRows = await query(`SELECT vendor_id FROM clients WHERE id = $1`, [client_id]);
      if (clientRows.length === 0) {
        return notFound(res, 'Cliente');
      }
      // Si no se asignó vendor_id (para admin/supervisor) y el cliente tiene uno, usarlo
      // Para vendedores, ya se asignó arriba, pero si no se encontró, usar el del cliente
      if (!finalVendorId && clientRows[0].vendor_id) {
        finalVendorId = Number(clientRows[0].vendor_id);
        console.log(`✅ Usando vendor_id del cliente: ${finalVendorId}`);
      }
    }

    // Validar que finalVendorId sea un número válido
    if (finalVendorId !== null && typeof finalVendorId !== 'number') {
      finalVendorId = Number(finalVendorId);
      if (Number.isNaN(finalVendorId)) {
        finalVendorId = null;
      }
    }

    // Asegurar que siempre haya un vendor_id válido antes de insertar
    if (!finalVendorId) {
      console.log('⚠️ No se pudo determinar vendor_id, buscando vendor por defecto...');
      // Buscar el primer vendor activo como último recurso
      const defaultVendor = await query(`SELECT id FROM vendors WHERE is_active = 1 LIMIT 1`);
      if (defaultVendor.length > 0) {
        finalVendorId = Number(defaultVendor[0].id);
        console.log(`✅ Usando vendor por defecto: ${finalVendorId}`);
      } else {
        return badRequest(res, 'No se pudo asignar un vendedor. Verifica que existan vendedores activos en el sistema.');
      }
    }

    console.log(`📝 Creando prospecto de seguimiento - company_name: ${company_name}, client_id: ${client_id}, vendor_id: ${finalVendorId}, usuario: ${req.user?.username}, rol: ${req.user?.role}`);

    const rows = await query(
      `INSERT INTO follow_up_prospects
        (company_name, client_id, priority_id, vendor_id, step_id, fijo_ren, fijo_new, movil_nueva, movil_renovacion, claro_tv, cloud, mpls, last_call_date, next_call_date, call_count, is_completed, completed_date, total_amount, notes, contact_phone, contact_email, base, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW())
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
        calculatedTotal,  // Usar el total calculado
        notes,
        contact_phone,
        contact_email,
        base || 0,
        is_active ? 1 : 0
      ]
    );

    const prospect = mapProspectRow(rows[0]);
    
    // AUDIT LOG - Registrar creación de prospecto
    await logAudit(
      req.user?.id,
      req.user?.username,
      'MOVER_A_SEGUIMIENTO',
      'prospecto',
      prospect.id,
      company_name,
      `Cliente movido a seguimiento. Vendor: ${finalVendorId}`,
      req.ip
    );

    res.status(201).json(prospect);
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
    is_active = true,
    base = 0
  } = req.body || {};

  if (!company_name || typeof company_name !== 'string') {
    return badRequest(res, 'El nombre de la empresa es obligatorio');
  }

  // Calcular total_amount sumando todos los productos
  const calculatedTotal = 
    Number(fijo_ren || 0) + 
    Number(fijo_new || 0) + 
    Number(movil_nueva || 0) + 
    Number(movil_renovacion || 0) + 
    Number(claro_tv || 0) + 
    Number(cloud || 0) + 
    Number(mpls || 0) + 
    Number(base || 0);
  
  console.log('💰 PUT calculatedTotal:', calculatedTotal, 'de productos:', {
    fijo_ren, fijo_new, movil_nueva, movil_renovacion, claro_tv, cloud, mpls, base
  });

  try {
    const existing = await query(`SELECT vendor_id, client_id, is_completed FROM follow_up_prospects WHERE id = $1`, [prospectId]);
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
              base = $22,
              is_active = $23,
              updated_at = NOW()
        WHERE id = $24
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
        calculatedTotal,  // Usar el total calculado en lugar del valor del frontend
        notes,
        contact_phone,
        contact_email,
        base || 0,
        is_active,
        prospectId
      ]
    );

    if (rows.length === 0) {
      return notFound(res, 'Prospecto');
    }

    const prospect = rows[0];

    // Si se marcó como completado, crear reporte y actualizar metas
    if (is_completed && !existing[0].is_completed) {
      console.log('🎯 Creando reporte de venta completada:', {
        prospect_id: prospectId,
        client_id: prospect.client_id,
        vendor_id: prospect.vendor_id,
        total_amount: prospect.total_amount
      });

      // 1. Crear registro en sales_reports
      await query(
        `INSERT INTO sales_reports (follow_up_prospect_id, client_id, vendor_id, company_name, total_amount, sale_date, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          prospectId,
          prospect.client_id,
          prospect.vendor_id,
          prospect.company_name,
          prospect.total_amount || 0,
          prospect.completed_date || new Date().toISOString()
        ]
      );

      // 2. Actualizar metas del vendedor (goals)
      if (prospect.vendor_id && prospect.total_amount > 0) {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        // Buscar meta activa del vendedor para el período actual
        const vendorGoals = await query(
          `SELECT id, current_amount 
           FROM goals 
           WHERE vendor_id = $1 
             AND period_type = 'monthly'
             AND period_year = $2 
             AND period_month = $3
             AND is_active = 1
           LIMIT 1`,
          [prospect.vendor_id, currentYear, currentMonth]
        );

        if (vendorGoals.length > 0) {
          await query(
            `UPDATE goals 
             SET current_amount = current_amount + $1 
             WHERE id = $2`,
            [prospect.total_amount, vendorGoals[0].id]
          );
          console.log('✅ Meta del vendedor actualizada:', vendorGoals[0].id, 'Nuevo monto:', parseFloat(vendorGoals[0].current_amount) + parseFloat(prospect.total_amount));
        } else {
          console.log('⚠️ No se encontró meta activa del vendedor para el periodo actual');
        }
      }

      // 3. Actualizar metas de productos específicos según lo vendido
      if (prospect.total_amount > 0) {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        // Mapeo de campos de prospect a nombres de productos
        const productMapping = [
          { field: 'fijo_ren', productName: 'Fijo Renovación' },
          { field: 'fijo_new', productName: 'Fijo Nueva' },
          { field: 'movil_nueva', productName: 'Móvil Nueva' },
          { field: 'movil_renovacion', productName: 'Móvil Renovación' },
          { field: 'claro_tv', productName: 'Claro TV Nueva' },
          { field: 'cloud', productName: 'Cloud Nueva' }
        ];

        let updatedCount = 0;
        
        for (const mapping of productMapping) {
          const amount = parseFloat(prospect[mapping.field] || 0);
          
          if (amount > 0) {
            // Actualizar meta de negocio (vendor_id IS NULL)
            const businessGoals = await query(
              `SELECT pg.id, pg.current_revenue 
               FROM product_goals pg
               INNER JOIN products p ON pg.product_id = p.id
               WHERE p.name = $1
                 AND pg.vendor_id IS NULL
                 AND pg.period_type = 'monthly'
                 AND pg.period_year = $2 
                 AND pg.period_month = $3
                 AND pg.is_active = 1
               LIMIT 1`,
              [mapping.productName, currentYear, currentMonth]
            );

            if (businessGoals.length > 0) {
              await query(
                `UPDATE product_goals 
                 SET current_revenue = current_revenue + $1 
                 WHERE id = $2`,
                [amount, businessGoals[0].id]
              );
              console.log(`✅ Meta de negocio actualizada: ${mapping.productName} +$${amount}`);
              updatedCount++;
            }

            // Actualizar meta del vendedor específico (vendor_id = prospect.vendor_id)
            if (prospect.vendor_id) {
              const vendorGoals = await query(
                `SELECT pg.id, pg.current_revenue 
                 FROM product_goals pg
                 INNER JOIN products p ON pg.product_id = p.id
                 WHERE p.name = $1
                   AND pg.vendor_id = $2
                   AND pg.period_type = 'monthly'
                   AND pg.period_year = $3 
                   AND pg.period_month = $4
                   AND pg.is_active = 1
                 LIMIT 1`,
                [mapping.productName, prospect.vendor_id, currentYear, currentMonth]
              );

              if (vendorGoals.length > 0) {
                await query(
                  `UPDATE product_goals 
                   SET current_revenue = current_revenue + $1 
                   WHERE id = $2`,
                  [amount, vendorGoals[0].id]
                );
                console.log(`✅ Meta del vendedor actualizada: ${mapping.productName} +$${amount}`);
                updatedCount++;
              }
            }
          }
        }
        
        if (updatedCount > 0) {
          console.log(`✅ Total de metas actualizadas: ${updatedCount}`);
        } else {
          console.log('⚠️ No se encontraron metas de productos para actualizar');
        }
      }

      console.log('✅ Reporte creado y metas actualizadas exitosamente');
      
      // AUDIT LOG - Registrar venta completada
      await logAudit(
        req.user?.id,
        req.user?.username,
        'COMPLETAR_VENTA',
        'prospecto',
        prospectId,
        company_name,
        `Venta completada. Total: $${calculatedTotal}`,
        req.ip
      );
    }

    res.json(mapProspectRow(prospect));
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
    const existing = await query(`SELECT company_name FROM follow_up_prospects WHERE id = $1`, [prospectId]);
    if (existing.length === 0) {
      return notFound(res, 'Prospecto');
    }

    const companyName = existing[0].company_name;

    // TODOS PUEDEN ELIMINAR - Sin restricción por vendedor

    const rows = await query(`DELETE FROM follow_up_prospects WHERE id = $1 RETURNING *`, [prospectId]);
    if (rows.length === 0) {
      return notFound(res, 'Prospecto');
    }
    
    // AUDIT LOG - Registrar devolución
    await logAudit(
      req.user?.id,
      req.user?.username,
      'DEVOLVER',
      'prospecto',
      prospectId,
      companyName,
      `Cliente devuelto al pool desde seguimiento`,
      req.ip
    );

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

// Este endpoint fue movido arriba antes de authenticateRequest (línea 317) - Endpoint duplicado eliminado

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
// Rutas no encontradas
// ======================================================
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ======================================================
// Arranque del servidor
// ======================================================
const server = app.listen(PORT, () => {
  console.log(`✅ CRM Pro API escuchando en el puerto ${PORT}`);
});

// ============================================================
// AUDIT LOG - Sistema de auditoría
// ============================================================

// Función helper para registrar eventos
async function logAudit(userId, username, action, entityType, entityId, entityName, details, ipAddress = null) {
  try {
    await query(
      `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, entity_name, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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
      whereConditions.push(`action = $${paramCount++}`);
      params.push(action);
    }
    if (entityType) {
      whereConditions.push(`entity_type = $${paramCount++}`);
      params.push(entityType);
    }
    if (userId) {
      whereConditions.push(`user_id = $${paramCount++}`);
      params.push(parseInt(userId));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    params.push(limit, offset);
    const rows = await query(
      `SELECT * FROM audit_log ${whereClause} ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      params
    );

    const countResult = await query(`SELECT COUNT(*) as total FROM audit_log ${whereClause}`, params.slice(0, -2));
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

// Configurar timeouts del servidor para importaciones grandes (1 hora)
server.timeout = 3600000; 
server.keepAliveTimeout = 3600000;
server.headersTimeout = 3600000;