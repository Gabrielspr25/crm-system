#!/usr/bin/env node

const http = require('http');
const jwt = require('jsonwebtoken');

try {
  require('dotenv').config({ quiet: true });
} catch (_) {
  // noop
}

const baseUrl = new URL(process.env.SEGUIMIENTO_URL || 'http://localhost:3001');
const secret = process.env.JWT_SECRET;

if (!secret) {
  console.error('JWT_SECRET requerido.');
  process.exit(2);
}

const token = jwt.sign({ role: 'admin' }, secret, { expiresIn: '10m' });
const stamp = String(Date.now());
const testPriority = `QA-${stamp}`;
const testNote = `Nota QA ${stamp}`;

const requestJson = (method, path, body) => new Promise((resolve, reject) => {
  const payload = body ? JSON.stringify(body) : undefined;
  const req = http.request({
    hostname: baseUrl.hostname,
    port: baseUrl.port || 80,
    path,
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
    },
  }, (res) => {
    let raw = '';
    res.on('data', (chunk) => { raw += chunk; });
    res.on('end', () => {
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch (error) { data = { parseError: error.message, raw }; }
      resolve({ status: res.statusCode, data });
    });
  });
  req.on('error', reject);
  if (payload) req.write(payload);
  req.end();
});

(async () => {
  const initial = await requestJson('GET', '/api/seguimiento?estado=activo&limit=1');
  const first = Array.isArray(initial.data?.rows) ? initial.data.rows[0] : null;
  if (initial.status !== 200 || !first?.id) {
    throw new Error(`GET inicial invalido: ${JSON.stringify(initial)}`);
  }

  const patch = await requestJson('PATCH', `/api/seguimiento/${first.id}`, {
    priority: testPriority,
    next_action: 'Llamar cliente QA',
    due_date: '2026-06-01',
    blocked: true,
    tags: ['qa', 'seguimiento'],
    notes: testNote,
  });
  if (patch.status !== 200) {
    throw new Error(`PATCH fallo: ${JSON.stringify(patch)}`);
  }

  const after = await requestJson('GET', '/api/seguimiento?estado=activo&limit=500');
  const updated = Array.isArray(after.data?.rows)
    ? after.data.rows.find((row) => String(row.id) === String(first.id))
    : null;
  const ok = after.status === 200 &&
    updated?.prioridad === testPriority &&
    updated?.proxima_accion === 'Llamar cliente QA' &&
    String(updated?.fecha_compromiso || '').startsWith('2026-06-01') &&
    updated?.bloqueado === true &&
    updated?.notes === testNote;

  console.log(JSON.stringify({
    ok,
    row_id: first.id,
    priority: updated?.prioridad,
    next_action: updated?.proxima_accion,
    due_date: updated?.fecha_compromiso,
    blocked: updated?.bloqueado,
    notes: updated?.notes,
  }, null, 2));

  process.exit(ok ? 0 : 1);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
