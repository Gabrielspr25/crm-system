import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

// ======================================================
// Configuración base
// ======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

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

// ======================================================
// Healthcheck
// ======================================================
app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'OK', time: new Date().toISOString() });
  } catch (error) {
    serverError(res, error);
  }
});

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

// ======================================================
// Clientes
// ======================================================
app.get('/api/clients', async (_req, res) => {
  try {
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
        WHERE COALESCE(c.is_active,1) = 1
        ORDER BY c.name ASC`
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
    address = null,
    includes_ban = 0,
    vendor_id = null
  } = req.body || {};

  if (!name || typeof name !== 'string') {
    return badRequest(res, 'El nombre es obligatorio');
  }

  try {
    const rows = await query(
      `INSERT INTO clients
        (name, business_name, contact_person, email, phone, address, includes_ban, vendor_id, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,NOW(),NOW())
       RETURNING *`,
      [name.trim(), business_name, contact_person, email, phone, address, includes_ban ? 1 : 0, vendor_id || null]
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
    address = null,
    includes_ban = 0,
    vendor_id = null,
    is_active = 1
  } = req.body || {};

  if (!name || typeof name !== 'string') {
    return badRequest(res, 'El nombre es obligatorio');
  }

  try {
    const rows = await query(
      `UPDATE clients
         SET name = $1,
             business_name = $2,
             contact_person = $3,
             email = $4,
             phone = $5,
             address = $6,
             includes_ban = $7,
             vendor_id = $8,
             is_active = $9,
             updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        name.trim(),
        business_name,
        contact_person,
        email,
        phone,
        address,
        includes_ban ? 1 : 0,
        vendor_id || null,
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
    await pool.query('BEGIN');
    await query(
      `DELETE FROM subscribers WHERE ban_id IN (SELECT id FROM bans WHERE client_id = $1)`,
      [clientId]
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
      `SELECT b.*, c.name AS client_name
         FROM bans b
         LEFT JOIN clients c ON b.client_id = c.id
         ${filter}
         ORDER BY b.created_at DESC`,
      params
    );

    const mapped = rows.map((row) =>
      enrich(row, ['client_id', 'is_active'], [], ['created_at', 'updated_at'])
    );
    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo BANs');
  }
});

app.post('/api/bans', async (req, res) => {
  const { ban_number, client_id, description = null, is_active = 1 } = req.body || {};

  if (!ban_number || typeof ban_number !== 'string') {
    return badRequest(res, 'El BAN es obligatorio');
  }

  if (!client_id) {
    return badRequest(res, 'client_id es obligatorio');
  }

  try {
    const existing = await query(
      `SELECT id FROM bans WHERE ban_number = $1`,
      [ban_number.trim()]
    );

    if (existing.length > 0) {
      return conflict(res, 'El BAN ya existe');
    }

    const rows = await query(
      `INSERT INTO bans
        (ban_number, client_id, description, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW())
       RETURNING *`,
      [ban_number.trim(), client_id, description, is_active ? 1 : 0]
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
    is_active = 1
  } = req.body || {};

  if (!ban_number || typeof ban_number !== 'string') {
    return badRequest(res, 'El BAN es obligatorio');
  }

  try {
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
              is_active = $4,
              updated_at = NOW()
        WHERE id = $5
        RETURNING *`,
      [ban_number.trim(), client_id, description, is_active ? 1 : 0, banId]
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
      `SELECT s.*, b.ban_number
         FROM subscribers s
         LEFT JOIN bans b ON s.ban_id = b.id
         ${filter}
         ORDER BY s.created_at DESC`,
      params
    );

    const mapped = rows.map((row) =>
      enrich(
        row,
        ['ban_id', 'monthly_value', 'months', 'remaining_payments'],
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

app.get('/api/follow-up-prospects', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT fp.*, v.name AS vendor_name, c.name AS client_name
         FROM follow_up_prospects fp
         LEFT JOIN vendors v ON fp.vendor_id = v.id
         LEFT JOIN clients c ON fp.client_id = c.id
         ORDER BY fp.created_at DESC`
    );
    res.json(rows.map(mapProspectRow));
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
    const rows = await query(
      `INSERT INTO follow_up_prospects
        (company_name, client_id, priority_id, vendor_id, step_id, fijo_ren, fijo_new, movil_nueva, movil_renovacion, claro_tv, cloud, mpls, last_call_date, next_call_date, call_count, is_completed, completed_date, total_amount, notes, contact_phone, contact_email, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),NOW())
       RETURNING *`,
      [
        company_name.trim(),
        client_id,
        priority_id,
        vendor_id,
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
        is_active
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
        vendor_id,
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
    const rows = await query(
      `INSERT INTO call_logs
        (follow_up_id, vendor_id, call_date, notes, outcome, next_call_date, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
       RETURNING *`,
      [follow_up_id, vendor_id, call_date || new Date(), notes, outcome, next_call_date]
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
      [name.trim(), description, order_index, is_active, stepId]
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
// Metas generales y de productos
// ======================================================
app.get('/api/goals', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT g.*, v.name AS vendor_name
         FROM goals g
         LEFT JOIN vendors v ON g.vendor_id = v.id
         ORDER BY g.period_year DESC, g.period_month DESC NULLS LAST, g.created_at DESC`
    );

    const mapped = rows.map((row) =>
      enrich(
        row,
        ['vendor_id', 'period_year', 'period_month', 'period_quarter', 'target_amount', 'current_amount'],
        ['is_active'],
        ['created_at', 'updated_at']
      )
    );

    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo metas');
  }
});

app.post('/api/goals', async (req, res) => {
  const {
    vendor_id = null,
    period_type,
    period_year,
    period_month = null,
    period_quarter = null,
    target_amount,
    current_amount = 0,
    description = null,
    is_active = 1
  } = req.body || {};

  if (!period_type || typeof period_type !== 'string') {
    return badRequest(res, 'El tipo de periodo es obligatorio');
  }

  if (period_year == null) {
    return badRequest(res, 'El año del periodo es obligatorio');
  }

  if (target_amount == null) {
    return badRequest(res, 'El monto objetivo es obligatorio');
  }

  try {
    const rows = await query(
      `INSERT INTO goals
        (vendor_id, period_type, period_year, period_month, period_quarter, target_amount, current_amount, description, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
       RETURNING *`,
      [vendor_id, period_type, period_year, period_month, period_quarter, target_amount, current_amount, description, is_active ? 1 : 0]
    );

    res.status(201).json(enrich(rows[0], ['vendor_id', 'period_year', 'period_month', 'period_quarter', 'target_amount', 'current_amount'], ['is_active'], ['created_at', 'updated_at']));
  } catch (error) {
    serverError(res, error, 'Error creando meta');
  }
});

app.put('/api/goals/:id', async (req, res) => {
  const goalId = Number(req.params.id);
  if (Number.isNaN(goalId)) {
    return badRequest(res, 'ID de meta inválido');
  }

  const {
    vendor_id = null,
    period_type,
    period_year,
    period_month = null,
    period_quarter = null,
    target_amount,
    current_amount = 0,
    description = null,
    is_active = 1
  } = req.body || {};

  if (!period_type || typeof period_type !== 'string') {
    return badRequest(res, 'El tipo de periodo es obligatorio');
  }

  try {
    const rows = await query(
      `UPDATE goals
          SET vendor_id = $1,
              period_type = $2,
              period_year = $3,
              period_month = $4,
              period_quarter = $5,
              target_amount = $6,
              current_amount = $7,
              description = $8,
              is_active = $9,
              updated_at = NOW()
        WHERE id = $10
        RETURNING *`,
      [vendor_id, period_type, period_year, period_month, period_quarter, target_amount, current_amount, description, is_active ? 1 : 0, goalId]
    );

    if (rows.length === 0) {
      return notFound(res, 'Meta');
    }

    res.json(enrich(rows[0], ['vendor_id', 'period_year', 'period_month', 'period_quarter', 'target_amount', 'current_amount'], ['is_active'], ['created_at', 'updated_at']));
  } catch (error) {
    serverError(res, error, 'Error actualizando meta');
  }
});

app.delete('/api/goals/:id', async (req, res) => {
  const goalId = Number(req.params.id);
  if (Number.isNaN(goalId)) {
    return badRequest(res, 'ID de meta inválido');
  }

  try {
    const rows = await query(`DELETE FROM goals WHERE id = $1 RETURNING *`, [goalId]);
    if (rows.length === 0) {
      return notFound(res, 'Meta');
    }
    res.json({ success: true });
  } catch (error) {
    serverError(res, error, 'Error eliminando meta');
  }
});

app.get('/api/product-goals', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT pg.*, p.name AS product_name, p.description AS product_description
         FROM product_goals pg
         LEFT JOIN products p ON pg.product_id = p.id
         ORDER BY pg.period_year DESC, pg.period_month DESC NULLS LAST, pg.created_at DESC`
    );

    const mapped = rows.map((row) =>
      enrich(
        row,
        ['product_id', 'vendor_id', 'period_year', 'period_month', 'period_quarter', 'target_quantity', 'current_quantity', 'target_revenue', 'current_revenue'],
        ['is_active'],
        ['created_at', 'updated_at']
      )
    );

    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo metas de producto');
  }
});

app.post('/api/product-goals', async (req, res) => {
  const {
    product_id,
    vendor_id = null,
    period_type = 'monthly',
    period_year,
    period_month = null,
    period_quarter = null,
    target_quantity = 0,
    current_quantity = 0,
    target_revenue = 0,
    current_revenue = 0,
    description = null,
    is_active = 1
  } = req.body || {};

  if (!product_id) {
    return badRequest(res, 'product_id es obligatorio');
  }

  if (period_year == null) {
    return badRequest(res, 'El año es obligatorio');
  }

  try {
    const rows = await query(
      `INSERT INTO product_goals
        (product_id, vendor_id, period_type, period_year, period_month, period_quarter, target_quantity, current_quantity, target_revenue, current_revenue, description, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
       RETURNING *`,
      [
        product_id,
        vendor_id,
        period_type,
        period_year,
        period_month,
        period_quarter,
        target_quantity,
        current_quantity,
        target_revenue,
        current_revenue,
        description,
        is_active ? 1 : 0
      ]
    );

    res.status(201).json(enrich(rows[0], ['product_id', 'vendor_id', 'period_year', 'period_month', 'period_quarter', 'target_quantity', 'current_quantity', 'target_revenue', 'current_revenue'], ['is_active'], ['created_at', 'updated_at']));
  } catch (error) {
    serverError(res, error, 'Error creando meta de producto');
  }
});

app.put('/api/product-goals/:id', async (req, res) => {
  const goalId = Number(req.params.id);
  if (Number.isNaN(goalId)) {
    return badRequest(res, 'ID de meta de producto inválido');
  }

  const {
    product_id,
    vendor_id = null,
    period_type = 'monthly',
    period_year,
    period_month = null,
    period_quarter = null,
    target_quantity = 0,
    current_quantity = 0,
    target_revenue = 0,
    current_revenue = 0,
    description = null,
    is_active = 1
  } = req.body || {};

  if (!product_id) {
    return badRequest(res, 'product_id es obligatorio');
  }

  try {
    const rows = await query(
      `UPDATE product_goals
          SET product_id = $1,
              vendor_id = $2,
              period_type = $3,
              period_year = $4,
              period_month = $5,
              period_quarter = $6,
              target_quantity = $7,
              current_quantity = $8,
              target_revenue = $9,
              current_revenue = $10,
              description = $11,
              is_active = $12,
              updated_at = NOW()
        WHERE id = $13
        RETURNING *`,
      [
        product_id,
        vendor_id,
        period_type,
        period_year,
        period_month,
        period_quarter,
        target_quantity,
        current_quantity,
        target_revenue,
        current_revenue,
        description,
        is_active ? 1 : 0,
        goalId
      ]
    );

    if (rows.length === 0) {
      return notFound(res, 'Meta de producto');
    }

    res.json(enrich(rows[0], ['product_id', 'vendor_id', 'period_year', 'period_month', 'period_quarter', 'target_quantity', 'current_quantity', 'target_revenue', 'current_revenue'], ['is_active'], ['created_at', 'updated_at']));
  } catch (error) {
    serverError(res, error, 'Error actualizando meta de producto');
  }
});

app.delete('/api/product-goals/:id', async (req, res) => {
  const goalId = Number(req.params.id);
  if (Number.isNaN(goalId)) {
    return badRequest(res, 'ID de meta de producto inválido');
  }

  try {
    await pool.query('BEGIN');
    await query(`DELETE FROM vendor_product_goals WHERE goal_id = $1`, [goalId]);
    const rows = await query(`DELETE FROM product_goals WHERE id = $1 RETURNING *`, [goalId]);
    await pool.query('COMMIT');

    if (rows.length === 0) {
      return notFound(res, 'Meta de producto');
    }

    res.json({ success: true });
  } catch (error) {
    await pool.query('ROLLBACK');
    serverError(res, error, 'Error eliminando meta de producto');
  }
});

app.post('/api/product-goals/:id/assign-vendors', async (req, res) => {
  const goalId = Number(req.params.id);
  if (Number.isNaN(goalId)) {
    return badRequest(res, 'ID de meta de producto inválido');
  }

  const { assignments = [] } = req.body || {};

  try {
    await pool.query('BEGIN');
    await query(`DELETE FROM vendor_product_goals WHERE goal_id = $1`, [goalId]);

    for (const assignment of assignments) {
      const vendorId = assignment.vendor_id;
      const allocated = assignment.assigned_amount ?? assignment.allocated_percentage ?? 0;
      if (!vendorId) continue;

      await query(
        `INSERT INTO vendor_product_goals (vendor_id, product_id, goal_id, allocated_percentage, created_at, updated_at)
         VALUES ($1, (SELECT product_id FROM product_goals WHERE id = $2), $2, $3, NOW(), NOW())`,
        [vendorId, goalId, allocated]
      );
    }

    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await pool.query('ROLLBACK');
    serverError(res, error, 'Error asignando vendedores a la meta');
  }
});

// ======================================================
// Historial de ventas (derivado de follow_up_prospects completados)
// ======================================================
app.get('/api/sales-history', async (req, res) => {
  const { client_id: clientIdParam } = req.query;
  const params = [];
  let filter = 'WHERE fp.is_completed = TRUE';

  if (clientIdParam) {
    const clientId = Number(clientIdParam);
    if (Number.isNaN(clientId)) {
      return badRequest(res, 'client_id inválido');
    }
    params.push(clientId);
    filter += ` AND fp.client_id = $${params.length}`;
  }

  try {
    const rows = await query(
      `SELECT fp.*, v.name AS vendor_name
         FROM follow_up_prospects fp
         LEFT JOIN vendors v ON fp.vendor_id = v.id
         ${filter}
         ORDER BY COALESCE(fp.completed_date, fp.updated_at, fp.created_at) DESC`,
      params
    );

    const mapped = rows.map((row) => {
      const saleDate = row.completed_date || row.updated_at || row.created_at;
      return enrich(
        {
          id: row.id,
          client_id: row.client_id,
          prospect_id: row.id,
          company_name: row.company_name,
          vendor_id: row.vendor_id,
          vendor_name: row.vendor_name,
          total_amount: toNumber(row.total_amount) || 0,
          fijo_ren: toNumber(row.fijo_ren) || 0,
          fijo_new: toNumber(row.fijo_new) || 0,
          movil_nueva: toNumber(row.movil_nueva) || 0,
          movil_renovacion: toNumber(row.movil_renovacion) || 0,
          claro_tv: toNumber(row.claro_tv) || 0,
          cloud: toNumber(row.cloud) || 0,
          mpls: toNumber(row.mpls) || 0,
          sale_date: saleDate ? new Date(saleDate).toISOString() : null,
          notes: row.notes,
          created_at: row.created_at
        },
        ['total_amount', 'fijo_ren', 'fijo_new', 'movil_nueva', 'movil_renovacion', 'claro_tv', 'cloud', 'mpls'],
        [],
        ['sale_date', 'created_at']
      );
    });

    res.json(mapped);
  } catch (error) {
    serverError(res, error, 'Error obteniendo historial de ventas');
  }
});

// ======================================================
// Static frontend
// ======================================================
const candidateDirs = [
  '/var/www/crmp/dist',
  path.join(__dirname, 'dist')
];

const staticDir = candidateDirs.find((dir) => {
  try {
    return fs.existsSync(dir);
  } catch (_err) {
    return false;
  }
}) || candidateDirs[1];

app.use(express.static(staticDir));

app.get('*', (_req, res) => {
  const indexPath = path.join(staticDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Aplicación no compilada');
  }
});

// ======================================================
// Inicio del servidor
// ======================================================
app.listen(PORT, () => {
  console.log(`✅ CRM Pro API escuchando en el puerto ${PORT}`);
});
