function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveOrNull(value) {
  const number = numberOrNull(value);
  return number !== null && number > 0 ? number : null;
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

function sumPositiveNumbers(...values) {
  return values.reduce((sum, value) => {
    const number = numberOrNull(value);
    return number !== null && number > 0 ? sum + number : sum;
  }, 0);
}

function normalizeDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function readCompanyCommission(row) {
  const commission = row?.comisiones || row?.comision || {};
  const explicitTotalValue = firstValue(row?.total, commission?.total);
  const explicitTotal = explicitTotalValue === null ? null : numberOrNull(explicitTotalValue);
  if (explicitTotal !== null) return explicitTotal;

  const componentSum = sumPositiveNumbers(
    row?.comisionclaro,
    row?.com_empresa,
    row?.company_earnings,
    row?.features,
    row?.bonoportabilidad,
    row?.bonoretencion,
    row?.bonovolumen,
    row?.comisionextra,
    row?.comisionpapper,
    commission?.comisionclaro,
    commission?.features,
    commission?.bonoportabilidad,
    commission?.bonoretencion,
    commission?.bonovolumen,
    commission?.comisionextra,
    commission?.comisionpapper
  );
  if (componentSum > 0) return Math.round(componentSum * 100) / 100;

  return numberOrNull(firstValue(row?.comisionclaro, row?.com_empresa, row?.company_earnings, commission?.comisionclaro));
}

function readCommission(row) {
  const commission = row?.comisiones || row?.comision || {};
  return {
    company: readCompanyCommission(row),
    vendor: numberOrNull(firstValue(row?.comisionvendedor, row?.com_vendedor, row?.vendor_commission, commission?.comisionvendedor)),
    portability: numberOrNull(firstValue(row?.bonoportabilidad, row?.portability_bonus, commission?.bonoportabilidad)),
  };
}

function firstCommissionValue(...values) {
  for (const value of values) {
    const number = numberOrNull(value);
    if (number !== null && number > 0) return value;
  }
  for (const value of values) {
    const number = numberOrNull(value);
    if (number !== null) return value;
  }
  return 0;
}

function readClientName(row) {
  const cliente = row?.cliente;
  if (typeof cliente === 'string') return cliente.trim();
  const fullName = [cliente?.nombre, cliente?.apellido]
    .filter((value) => value && String(value).trim().toLowerCase() !== 'null')
    .map((value) => String(value).trim())
    .join(' ')
    .trim();
  return firstValue(fullName, row?.cliente_nombre, row?.nombre_cliente, row?.nombre);
}

function readVendorName(row) {
  const vendedor = row?.vendedor;
  if (typeof vendedor === 'string') return vendedor.trim();
  return firstValue(vendedor?.nombre, row?.vendedor_nombre, row?.salesperson, row?.seller);
}

function readVentaTipoId(row) {
  return numberOrNull(firstValue(
    row?.ventatipoid,
    row?.ventatipo_id,
    row?.ventatipo?.id,
    row?.tipo?.id
  ));
}

function readVentaTipoName(row) {
  return firstValue(
    row?.ventatipo_nombre,
    row?.ventatipo?.nombre,
    row?.tipo?.nombre,
    row?.tipo_venta,
    row?.nombre_tipo
  );
}

function readVentaId(row) {
  return numberOrNull(firstValue(row?.ventaid, row?.id, row?.venta_id));
}

function toIsoDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const text = String(value).trim();
    return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
  }
  return date.toISOString().slice(0, 10);
}

export function getTangoCommissionAmount(sale = null, commission = null, legacyFallback = null) {
  return firstCommissionValue(
    readCommission(commission).company,
    readCommission(sale).company,
    readCommission(legacyFallback).company
  );
}

const PYMES_ALLOWED_NAMES = new Set([
  'ba corp new',
  'ba corp ren',
  'cloud negocios',
  'corp update new',
  'corp update ren',
  'office 365 negocios',
  'pymes fijo new',
  'pymes fijo ren',
  'pymes update new',
  'pymes update ren',
  'telemetria new',
  'telemetria ren',
]);

function normalizeVentaTipoName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function isAllowedPymesCommissionVentaTipo(ventatipoId, ventatipoNombre = '') {
  return PYMES_ALLOWED_NAMES.has(normalizeVentaTipoName(ventatipoNombre));
}

export function shouldIncludeTangoV2SaleForCommissions(sale = null, commission = null, config = null) {
  if (config?.include_in_commissions === false) return false;
  const ventaTipoId = readVentaTipoId(sale) ?? readVentaTipoId(commission);
  const ventaTipoName = readVentaTipoName(sale) ?? readVentaTipoName(commission);
  if (!isAllowedPymesCommissionVentaTipo(ventaTipoId, ventaTipoName)) return false;
  if (config?.include_in_commissions === true) return true;
  return getTangoCommissionAmount(sale, commission) > 0;
}

export function isPymesAutocreateVentaTipo(ventatipoId, ventatipoNombre = '') {
  return isAllowedPymesCommissionVentaTipo(ventatipoId, ventatipoNombre);
}

export function classifyPymesAutocreateVentaTipo(ventatipoId, ventatipoNombre = '') {
  if (!isPymesAutocreateVentaTipo(ventatipoId, ventatipoNombre)) return null;
  const id = Number(ventatipoId);
  const name = normalizeVentaTipoName(ventatipoNombre);
  if (/cloud|office 365/.test(name)) return { negocio: 'PYMES', product: 'cloud', movement: 'NEW' };
  if (/fijo/.test(name)) return { negocio: 'PYMES', product: 'fijo', movement: /ren/.test(name) ? 'REN' : 'NEW' };
  if (/ren/.test(name)) return { negocio: 'PYMES', product: 'movil', movement: 'REN' };
  if (/new/.test(name)) return { negocio: 'PYMES', product: 'movil', movement: 'NEW' };
  const map = {
    8: { negocio: 'PYMES', product: 'movil', movement: 'NEW' },
    25: { negocio: 'PYMES', product: 'movil', movement: 'NEW' },
    26: { negocio: 'PYMES', product: 'movil', movement: 'REN' },
    138: { negocio: 'PYMES', product: 'movil', movement: 'REN' },
    139: { negocio: 'PYMES', product: 'movil', movement: 'NEW' },
    140: { negocio: 'PYMES', product: 'fijo', movement: 'REN' },
    141: { negocio: 'PYMES', product: 'fijo', movement: 'NEW' },
  };
  return map[id] || null;
}

export function classifyTangoVentaTipo(ventatipoId, ventatipoNombre = '') {
  const id = Number(ventatipoId);
  const name = String(ventatipoNombre || '').trim().toLowerCase();
  const known = {
    8: { family: 'fijo', lineType: 'NEW' },
    25: { family: 'movil', lineType: 'NEW' },
    26: { family: 'movil', lineType: 'REN' },
    121: { family: 'fijo', lineType: 'NEW' },
    138: { family: 'movil', lineType: 'REN' },
    139: { family: 'movil', lineType: 'NEW' },
    140: { family: 'fijo', lineType: 'REN' },
    141: { family: 'fijo', lineType: 'NEW' },
    142: { family: 'tv', lineType: 'NEW' },
  };
  if (known[id]) return known[id];

  const lineType = /\bren\b|renov/i.test(name) ? 'REN' : 'NEW';
  if (/tv|televisi/.test(name)) return { family: 'tv', lineType };
  if (/cloud/.test(name)) return { family: 'cloud', lineType };
  if (/mpls/.test(name)) return { family: 'mpls', lineType };
  if (/fijo|2 play|3 play|banda|ba corp/.test(name)) return { family: 'fijo', lineType };
  if (/movil|móvil|update|pymes|claro/.test(name)) return { family: 'movil', lineType };
  return { family: 'otro', lineType };
}

export function buildTangoCommissionPendingSale(sale = null, commission = null, motivo = 'ban_no_existe_en_crm') {
  const mapped = mapTangoApiV2SaleToSyncRow(sale, commission);
  return {
    ventaid: mapped.ventaid,
    ban_tango: mapped.ban || null,
    cliente_tango: mapped.cliente || null,
    telefono_tango: mapped.phone || null,
    ventatipo_id: mapped.ventatipoid,
    ventatipo_nombre: readVentaTipoName(sale) || readVentaTipoName(commission) || null,
    fecha_activacion: toIsoDate(mapped.fechaactivacion),
    company_earnings: numberOrNull(mapped.com_empresa) || 0,
    vendor_commission: numberOrNull(mapped.com_vendedor) || 0,
    raw_payload: {
      sale,
      commission,
      mapped,
    },
    motivo,
    status: 'needs_review',
  };
}

export function mapTangoApiV2SaleToSyncRow(sale, commission = null, legacyFallback = null) {
  const saleCommission = readCommission(sale);
  const explicitCommission = readCommission(commission);
  const fallbackCommission = readCommission(legacyFallback);
  const ventaid = readVentaId(sale) ?? readVentaId(commission) ?? readVentaId(legacyFallback);
  const mensualidad = firstValue(
    positiveOrNull(sale?.pagomensual),
    positiveOrNull(sale?.monthly_value),
    positiveOrNull(sale?.monthlyValue),
    positiveOrNull(sale?.plan?.rate),
    positiveOrNull(sale?.tipoplan?.rate),
    positiveOrNull(legacyFallback?.mensualidad)
  );

  return {
    ventaid,
    ban: String(firstValue(sale?.ban, commission?.ban, legacyFallback?.ban) || '').trim(),
    phone: normalizeDigits(firstValue(
      sale?.telefono,
      sale?.phone,
      sale?.numerocelularactivado,
      sale?.status,
      sale?.numero,
      legacyFallback?.phone
    )),
    plan_code: firstValue(
      sale?.codigovoz,
      sale?.plan?.codigovoz,
      sale?.plan?.codigo,
      sale?.plan?.code,
      legacyFallback?.plan_code
    ),
    meses: firstValue(sale?.meses, legacyFallback?.meses),
    ventatipoid: readVentaTipoId(sale) ?? readVentaTipoId(commission) ?? readVentaTipoId(legacyFallback),
    mensualidad,
    com_empresa: firstCommissionValue(explicitCommission.company, saleCommission.company, fallbackCommission.company),
    com_vendedor: firstCommissionValue(explicitCommission.vendor, saleCommission.vendor, fallbackCommission.vendor),
    portability_bonus: firstCommissionValue(explicitCommission.portability, saleCommission.portability, fallbackCommission.portability),
    fechaactivacion: firstValue(sale?.fechaactivacion, commission?.fechaactivacion, legacyFallback?.fechaactivacion),
    tango_vendor_id: firstValue(sale?.vendedorid, sale?.vendedor?.id, commission?.vendedorid, legacyFallback?.tango_vendor_id),
    cliente: readClientName(sale) || readClientName(commission) || readClientName(legacyFallback) || 'SIN NOMBRE',
    vendedor: readVendorName(sale) || readVendorName(commission) || readVendorName(legacyFallback) || '',
    source_priority: 'api_v2',
  };
}

export function mergeTangoApiV2RowsWithLegacyRows({ apiRows = [], legacyRows = [], commissionsById = new Map() }) {
  const legacyByVentaId = new Map();
  for (const row of legacyRows) {
    const ventaid = readVentaId(row);
    if (ventaid !== null && ventaid > 0) legacyByVentaId.set(ventaid, row);
  }

  const merged = [];
  const seen = new Set();
  for (const row of apiRows) {
    const ventaid = readVentaId(row);
    if (ventaid === null || ventaid <= 0 || seen.has(ventaid)) continue;
    const mapped = mapTangoApiV2SaleToSyncRow(row, commissionsById.get(ventaid), legacyByVentaId.get(ventaid));
    merged.push(mapped);
    seen.add(ventaid);
  }

  for (const row of legacyRows) {
    const ventaid = readVentaId(row);
    if (ventaid === null || ventaid <= 0 || seen.has(ventaid)) continue;
    merged.push({ ...row, source_priority: 'legacy_fallback' });
    seen.add(ventaid);
  }

  return merged;
}
