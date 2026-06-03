#!/usr/bin/env node

const http = require('http');
const jwt = require('jsonwebtoken');

try {
  require('dotenv').config();
} catch (_) {
  // dotenv is available in the app runtime; ignore when this script is run elsewhere.
}

const url = new URL(process.env.SEGUIMIENTO_URL || 'http://localhost:3001/api/seguimiento');
const secret = process.env.JWT_SECRET;

if (!secret) {
  console.error('JWT_SECRET requerido para generar token de validacion.');
  process.exit(2);
}

const token = jwt.sign({ role: 'admin' }, secret, { expiresIn: '10m' });

const request = http.get({
  hostname: url.hostname,
  port: url.port || 80,
  path: `${url.pathname}${url.search}`,
  headers: { Authorization: `Bearer ${token}` }
}, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      console.error(JSON.stringify({ ok: false, status: res.statusCode, error: error.message, body }, null, 2));
      process.exit(1);
    }

    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const duplicateClientIds = Object.entries(rows.reduce((acc, row) => {
      if (row.client_id) acc[row.client_id] = (acc[row.client_id] || 0) + 1;
      return acc;
    }, {})).filter(([, count]) => count > 1);
    const nonActiveRows = rows.filter((row) => row.estado !== 'activo').map((row) => row.id);
    const nullVendors = rows.filter((row) => row.vendedor === null || row.vendedor === undefined).map((row) => row.id);

    const result = {
      ok: res.statusCode === 200 && nonActiveRows.length === 0 && duplicateClientIds.length === 0 && nullVendors.length === 0,
      status: res.statusCode,
      total: payload.total,
      rows: rows.length,
      non_active_count: nonActiveRows.length,
      duplicate_client_count: duplicateClientIds.length,
      null_vendor_count: nullVendors.length,
      duplicate_client_ids: duplicateClientIds
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  });
});

request.on('error', (error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
