import pg from 'pg';

const { Pool } = pg;

// Campos requeridos del pool externo. NO se permiten fallbacks hardcoded.
// Cada pool (TANGO / POS / DISCREPANCIAS) debe resolver sus valores via env vars.
const REQUIRED_FIELDS = ['HOST', 'USER', 'PASSWORD', 'NAME'];

const warnedKeys = new Set();
let tangoPool = null;
let posPool = null;
let discrepanciasPool = null;

function warnOnce(key, message) {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(message);
}

function parsePort(value, fallbackPort) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallbackPort;
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function readEnv(prefixes, suffix, fallbackValue) {
  for (const prefix of prefixes) {
    const envKey = `${prefix}_${suffix}`;
    const envValue = process.env[envKey];
    if (envValue !== undefined && envValue !== '') {
      return envValue;
    }
  }
  return fallbackValue;
}

function buildRemoteDbConfig(poolLabel, prefixes) {
  // Validar que TODOS los campos requeridos esten seteados en alguno de los prefijos.
  const missing = [];
  const resolved = {};
  for (const suffix of REQUIRED_FIELDS) {
    const value = readEnv(prefixes, suffix, undefined);
    if (value === undefined) {
      missing.push(`${prefixes[0]}_${suffix}`);
    } else {
      resolved[suffix] = value;
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `[${poolLabel}] Faltan variables de entorno requeridas para el pool externo: ${missing.join(', ')}. ` +
        `Configurar en .env (ver .env.example).`,
    );
  }

  const host = resolved.HOST;
  const port = parsePort(readEnv(prefixes, 'PORT', '5432'), 5432);
  const user = resolved.USER;
  const password = resolved.PASSWORD;
  const database = resolved.NAME;
  const max = parsePort(readEnv(prefixes, 'MAX_CONNECTIONS', '5'), 5);
  const connectionTimeoutMillis = parsePort(readEnv(prefixes, 'CONNECTION_TIMEOUT_MS', '15000'), 15000);
  const queryTimeout = parsePort(readEnv(prefixes, 'QUERY_TIMEOUT_MS', '30000'), 30000);
  const statementTimeout = parsePort(readEnv(prefixes, 'STATEMENT_TIMEOUT_MS', '30000'), 30000);
  const idleTimeoutMillis = parsePort(readEnv(prefixes, 'IDLE_TIMEOUT_MS', '30000'), 30000);

  const sslEnabled = parseBoolean(readEnv(prefixes, 'SSL', ''), false);
  const rejectUnauthorized = parseBoolean(readEnv(prefixes, 'SSL_REJECT_UNAUTHORIZED', ''), false);
  const ssl = sslEnabled ? { rejectUnauthorized } : false;

  warnOnce(
    `${poolLabel}-target`,
    `[${poolLabel}] External DB target: ${user}@${host}:${port}/${database}`,
  );

  return {
    host,
    port,
    user,
    password,
    database,
    max,
    connectionTimeoutMillis,
    query_timeout: queryTimeout,
    statement_timeout: statementTimeout,
    idleTimeoutMillis,
    ssl,
  };
}

function createPool(label, config) {
  const pool = new Pool(config);
  pool.on('error', (err) => {
    console.error(`[${label}] unexpected pool error:`, err);
  });
  return pool;
}

export function getTangoPool() {
  if (!tangoPool) {
    tangoPool = createPool('TANGO-POOL', buildRemoteDbConfig('TANGO-POOL', ['TANGO_DB', 'POS_DB']));
  }
  return tangoPool;
}

export function getPosPool() {
  if (!posPool) {
    posPool = createPool('POS-POOL', buildRemoteDbConfig('POS-POOL', ['POS_DB', 'TANGO_DB']));
  }
  return posPool;
}

export function getDiscrepanciasPool() {
  if (!discrepanciasPool) {
    discrepanciasPool = createPool(
      'DISCREPANCIAS-POOL',
      buildRemoteDbConfig('DISCREPANCIAS-POOL', ['DISCREPANCIAS_DB', 'POS_DB', 'TANGO_DB'])
    );
  }
  return discrepanciasPool;
}

export async function closeExternalPools() {
  const closers = [];
  if (tangoPool) {
    closers.push(tangoPool.end().catch(() => {}));
    tangoPool = null;
  }
  if (posPool) {
    closers.push(posPool.end().catch(() => {}));
    posPool = null;
  }
  if (discrepanciasPool) {
    closers.push(discrepanciasPool.end().catch(() => {}));
    discrepanciasPool = null;
  }
  await Promise.all(closers);
}
