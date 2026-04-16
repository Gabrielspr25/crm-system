import pg from 'pg';

const { Pool } = pg;

const FALLBACK_EXTERNAL_DB = Object.freeze({
  host: '167.99.12.125',
  port: 5432,
  user: 'postgres',
  password: 'fF00JIRFXc',
  database: 'claropr',
});

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
  const host = readEnv(prefixes, 'HOST', FALLBACK_EXTERNAL_DB.host);
  const port = parsePort(readEnv(prefixes, 'PORT', FALLBACK_EXTERNAL_DB.port), FALLBACK_EXTERNAL_DB.port);
  const user = readEnv(prefixes, 'USER', FALLBACK_EXTERNAL_DB.user);
  const password = readEnv(prefixes, 'PASSWORD', FALLBACK_EXTERNAL_DB.password);
  const database = readEnv(prefixes, 'NAME', FALLBACK_EXTERNAL_DB.database);
  const max = parsePort(readEnv(prefixes, 'MAX_CONNECTIONS', '5'), 5);
  const connectionTimeoutMillis = parsePort(readEnv(prefixes, 'CONNECTION_TIMEOUT_MS', '15000'), 15000);
  const queryTimeout = parsePort(readEnv(prefixes, 'QUERY_TIMEOUT_MS', '30000'), 30000);
  const statementTimeout = parsePort(readEnv(prefixes, 'STATEMENT_TIMEOUT_MS', '30000'), 30000);
  const idleTimeoutMillis = parsePort(readEnv(prefixes, 'IDLE_TIMEOUT_MS', '30000'), 30000);

  const sslEnabled = parseBoolean(readEnv(prefixes, 'SSL', ''), false);
  const rejectUnauthorized = parseBoolean(readEnv(prefixes, 'SSL_REJECT_UNAUTHORIZED', ''), false);
  const ssl = sslEnabled ? { rejectUnauthorized } : false;

  const isUsingFallbackPassword = password === FALLBACK_EXTERNAL_DB.password;
  if (isUsingFallbackPassword) {
    warnOnce(
      `${poolLabel}-fallback-password`,
      `[${poolLabel}] WARNING: using fallback external DB password. Configure ${prefixes[0]}_PASSWORD (or ${prefixes[1]}_PASSWORD) in environment.`,
    );
  }

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
