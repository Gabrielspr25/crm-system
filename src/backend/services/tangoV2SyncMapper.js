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

function normalizeDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function readCommission(row) {
  const commission = row?.comisiones || row?.comision || {};
  return {
    company: numberOrNull(firstValue(row?.comisionclaro, row?.com_empresa, row?.company_earnings, commission?.comisionclaro)),
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
  return firstValue(cliente?.nombre, row?.cliente_nombre, row?.nombre_cliente, row?.nombre);
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

function readVentaId(row) {
  return numberOrNull(firstValue(row?.ventaid, row?.id, row?.venta_id));
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
