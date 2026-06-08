/**
 * equiposListaController.js
 * Gestión de la Lista de Precios de Equipos PYMES/CORP
 *
 * Tabs del Excel:
 *   Tab 1 — Celulares         (mensualidades 20/24/30/36 meses)
 *   Tab 2 — Módems/Tablets    (mensualidades 12/24/30/36 meses)
 *   Tab 3 — Pospago 2 Años    (precios varían por plan $9.99…$99.99)
 *   Tab 4 — Accesorios        (mensualidades 3/6/12/24 meses)
 */

import { query, getClient } from '../database/db.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

// ─── Constantes ──────────────────────────────────────────────────────────────

const PLANES_POSPAGO = [0, 9.99, 14.99, 19.99, 29.99, 39.99, 49.99, 59.99, 69.99, 79.99, 99.99];

// Detectar marca a partir del nombre del modelo
function detectarMarca(modelo = '') {
  const m = modelo.toUpperCase();
  if (m.includes('SAMSUNG') || m.includes('GXY') || m.includes('GALAXY')) return 'samsung';
  if (m.includes('IPH') || m.includes('IPHONE') || m.includes('AIRPODS') ||
      m.includes('APPLE') || m.includes('HOMEPOD') || m.includes('AIRTAG') ||
      m.includes('MAGSAFE') || m.includes('MAGIC KEYBOARD') || m.includes('SMART KEYBOARD') ||
      m.includes('SMART FOLIO') || m.includes('PENCIL')) return 'apple';
  if (m.includes('MOTO') || m.includes('MOTOROLA')) return 'motorola';
  if (m.includes('JBL')) return 'jbl';
  if (m.includes('BEATS')) return 'beats';
  if (m.includes('SONOS')) return 'sonos';
  if (m.includes('ARGOM')) return 'argom';
  if (m.includes('NUXOR')) return 'nuxor';
  if (m.includes('AIRLINK')) return 'airlink';
  if (m.includes('ZIPKORD')) return 'zipkord';
  if (m.includes('MOPHIE')) return 'mophie';
  if (m.includes('FRANKLIN') || m.includes('PCD')) return 'modem';
  if (m.includes('NETGEAR') || m.includes('ASUS') || m.includes('TP-LINK')) return 'router';
  return 'otro';
}

// Detectar categoría a partir del contexto de la tab
function detectarCategoria(tab, modelo = '') {
  if (tab === 'pospago') return 'pospago';
  const m = modelo.toUpperCase();
  if (tab === 'accesorios') return 'accesorio';
  if (tab === 'modems') {
    if (m.includes('IPAD') || m.includes('TABLET') || m.includes('TAB ')) return 'tablet';
    return 'modem';
  }
  return 'celular';
}

// Extraer precio numérico de string "$1,089.99" → 1089.99
function parsePrecio(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

function isItemCode(value) {
  return Boolean(String(value || '').trim().match(/^\d{5}H$/i));
}

function findSheet(wb, patterns) {
  return wb.SheetNames.find((name) => {
    const normalized = name.toLowerCase();
    return patterns.some((pattern) => normalized.includes(pattern));
  });
}

function mergeItems(items) {
  const byCode = new Map();

  for (const item of items) {
    if (!item?.item_code) continue;
    const code = String(item.item_code).trim().toUpperCase();
    const existing = byCode.get(code);

    if (!existing) {
      byCode.set(code, {
        ...item,
        item_code: code,
        mensualidades: item.mensualidades || [],
        pospago_precios: item.pospago_precios || [],
      });
      continue;
    }

    existing.sap_code = existing.sap_code || item.sap_code;
    existing.modelo = existing.modelo || item.modelo;
    existing.marca = existing.marca === 'otro' ? item.marca : existing.marca || item.marca;
    existing.categoria = existing.categoria === 'pospago' ? item.categoria : existing.categoria || item.categoria;
    existing.precio_regular = existing.precio_regular ?? item.precio_regular;
    existing.fuera_portafolio = Boolean(existing.fuera_portafolio || item.fuera_portafolio);

    if (item.mensualidades?.length) {
      const monthly = new Map(existing.mensualidades.map((m) => [Number(m.meses), m]));
      item.mensualidades.forEach((m) => monthly.set(Number(m.meses), m));
      existing.mensualidades = [...monthly.values()].sort((a, b) => Number(a.meses) - Number(b.meses));
    }

    if (item.pospago_precios?.length) {
      const pospago = new Map(existing.pospago_precios.map((p) => [Number(p.plan_precio), p]));
      item.pospago_precios.forEach((p) => pospago.set(Number(p.plan_precio), p));
      existing.pospago_precios = [...pospago.values()].sort((a, b) => Number(a.plan_precio) - Number(b.plan_precio));
    }
  }

  return [...byCode.values()];
}

// ─── Parser Tab 1: Celulares ─────────────────────────────────────────────────
// Columnas: Item Code | SAP | Modelo | Precio | 20m | 24m | 30m | 36m
function parseTab1(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const items = [];
  let dataStarted = false;

  for (const row of rows) {
    const code = String(row[0] || '').trim();
    if (!isItemCode(code)) {
      if (code.toUpperCase().includes('ITEM CODE') || code.toUpperCase().includes('PRICE CODE')) {
        dataStarted = true;
      }
      continue;
    }
    dataStarted = true;

    const modelo = String(row[2] || '').trim();
    if (!modelo) continue;

    const precioReg = parsePrecio(row[3]);
    const mens = [
      { meses: 20, monto: parsePrecio(row[4]) },
      { meses: 24, monto: parsePrecio(row[5]) },
      { meses: 30, monto: parsePrecio(row[6]) },
      { meses: 36, monto: parsePrecio(row[7]) },
    ].filter(m => m.monto !== null);

    items.push({
      item_code:        code.toUpperCase(),
      sap_code:         String(row[1] || '').trim(),
      modelo:           modelo,
      marca:            detectarMarca(modelo),
      categoria:        'celular',
      precio_regular:   precioReg,
      fuera_portafolio: modelo.includes('*'),
      mensualidades:    mens,
    });
  }
  return items;
}

// ─── Parser Tab 2: Módems, Tablets ───────────────────────────────────────────
// Columnas: Item Code | SAP | Modelo | Precio | 12m | 24m | 30m | 36m
function parseTab2(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const items = [];

  for (const row of rows) {
    const code = String(row[0] || '').trim();
    if (!isItemCode(code)) continue;

    const modelo = String(row[2] || '').trim();
    if (!modelo) continue;

    const priceOffset = parsePrecio(row[4]) !== null ? 1 : 0;
    const precioReg = parsePrecio(row[3 + priceOffset]);
    const mens = [
      { meses: 12, monto: parsePrecio(row[4 + priceOffset]) },
      { meses: 24, monto: parsePrecio(row[5 + priceOffset]) },
      { meses: 30, monto: parsePrecio(row[6 + priceOffset]) },
      { meses: 36, monto: parsePrecio(row[7 + priceOffset]) },
    ].filter(m => m.monto !== null);

    const modeloUp = modelo.toUpperCase();
    let categoria = 'modem';
    if (modeloUp.includes('IPAD') || modeloUp.includes('TABLET') || modeloUp.includes('TAB ')) {
      categoria = 'tablet';
    }

    items.push({
      item_code:        code.toUpperCase(),
      sap_code:         String(row[1] || '').trim(),
      modelo:           modelo,
      marca:            detectarMarca(modelo),
      categoria:        categoria,
      precio_regular:   precioReg,
      fuera_portafolio: modelo.includes('*'),
      mensualidades:    mens,
    });
  }
  return items;
}

// ─── Parser Tab 3: Pospago 2 Años ────────────────────────────────────────────
// Columnas: Item Code | SAP | Modelo | SinContrato | $9.99 | $14.99 | … | $99.99
function parseTab3(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const items = [];

  for (const row of rows) {
    const codeIndex = [0, 1, 2].find((index) => isItemCode(row[index]));
    if (codeIndex === undefined) continue;
    const code = String(row[codeIndex] || '').trim();

    const modelo = String(row[codeIndex + 2] || row[codeIndex + 1] || '').trim();
    if (!modelo) continue;

    const pospago = PLANES_POSPAGO.map((plan, i) => ({
      plan_precio: plan,
      monto:       parsePrecio(row[codeIndex + 3 + i]) ?? 0,
    }));

    items.push({
      item_code:        code.toUpperCase(),
      sap_code:         String(row[codeIndex + 1] || '').trim(),
      modelo:           modelo,
      marca:            detectarMarca(modelo),
      categoria:        'pospago',
      precio_regular:   parsePrecio(row[codeIndex + 3]),  // Sin Contrato = precio base
      fuera_portafolio: false,
      pospago_precios:  pospago,
    });
  }
  return items;
}

// ─── Parser Tab 4: Accesorios ────────────────────────────────────────────────
// Columnas: Item Code | SAP | Modelo | Precio | 3m | 6m | 12m | 24m
function parseTab4(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const items = [];

  for (const row of rows) {
    const code = String(row[0] || '').trim();
    if (!isItemCode(code)) continue;

    const modelo = String(row[2] || '').trim();
    if (!modelo) continue;

    const precioReg = parsePrecio(row[3]);
    const mens = [
      { meses: 3,  monto: parsePrecio(row[4]) },
      { meses: 6,  monto: parsePrecio(row[5]) },
      { meses: 12, monto: parsePrecio(row[6]) },
      { meses: 24, monto: parsePrecio(row[7]) },
    ].filter(m => m.monto !== null);

    items.push({
      item_code:        code.toUpperCase(),
      sap_code:         String(row[1] || '').trim(),
      modelo:           modelo,
      marca:            detectarMarca(modelo),
      categoria:        'accesorio',
      precio_regular:   precioReg,
      fuera_portafolio: false,
      mensualidades:    mens,
    });
  }
  return items;
}

// ─── Parsear el Excel completo ────────────────────────────────────────────────
export function parsearExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const celulares = findSheet(wb, ['finan equipos']);
  const modems = findSheet(wb, ['finan modems']);
  const accesorios = findSheet(wb, ['accesorios']);
  const pospagoSheets = wb.SheetNames.filter((name) => {
    const normalized = name.toLowerCase();
    return normalized.includes('ofertas tablets') ||
      normalized.includes('precios modems') ||
      normalized.includes('planes familiares') ||
      normalized.includes('planes fam otros');
  });

  const items = mergeItems([
    ...(celulares ? parseTab1(wb.Sheets[celulares]) : []),
    ...(modems ? parseTab2(wb.Sheets[modems]) : []),
    ...(accesorios ? parseTab4(wb.Sheets[accesorios]) : []),
    ...pospagoSheets.flatMap((sheetName) => parseTab3(wb.Sheets[sheetName])),
  ]);

  return { items, sheetNames: wb.SheetNames };
}

// ─── ENDPOINTS ───────────────────────────────────────────────────────────────

/**
 * GET /api/equipos-lista
 * Devuelve todos los equipos activos con sus mensualidades y precios pospago.
 */
export const getEquipos = async (req, res) => {
  try {
    const { categoria, marca, search } = req.query;

    let sql = `SELECT * FROM v_equipos_vigentes WHERE 1=1`;
    const params = [];

    if (categoria) {
      params.push(categoria);
      sql += ` AND categoria = $${params.length}`;
    }
    if (marca) {
      params.push(marca);
      sql += ` AND marca = $${params.length}`;
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      sql += ` AND (LOWER(modelo) LIKE $${params.length} OR item_code ILIKE $${params.length})`;
    }

    const rows = await query(sql, params);
    res.json({ ok: true, total: rows.length, data: rows });
  } catch (err) {
    console.error('[equipos-lista] getEquipos error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

/**
 * POST /api/equipos-lista/preview
 * Parsea el Excel y devuelve un preview sin guardar en DB.
 * Útil para la pantalla admin de confirmación.
 */
export const previewUpload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió archivo.' });

    const { items, sheetNames } = parsearExcel(req.file.buffer);

    const resumen = {
      total: items.length,
      por_categoria: {},
    };
    for (const item of items) {
      resumen.por_categoria[item.categoria] = (resumen.por_categoria[item.categoria] || 0) + 1;
    }

    res.json({ ok: true, sheetNames, resumen, items });
  } catch (err) {
    console.error('[equipos-lista] previewUpload error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

/**
 * POST /api/equipos-lista/upload
 * Parsea el Excel y hace upsert completo en la DB.
 * Requiere autenticación (admin).
 */
export const uploadLista = async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió archivo.' });

  const { vigencia_inicio, vigencia_fin, notas } = req.body;
  const username = req.user?.username || 'admin';

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Registrar el upload
    const uploadResult = await client.query(
      `INSERT INTO equipos_uploads (nombre_archivo, subido_por, vigencia_inicio, vigencia_fin, notas)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.file.originalname, username, vigencia_inicio || null, vigencia_fin || null, notas || null]
    );
    const uploadId = uploadResult.rows[0].id;

    // 2. Parsear Excel
    const { items } = parsearExcel(req.file.buffer);

    // 3. Desactivar todos los equipos existentes antes del upsert
    await client.query(`UPDATE equipos_lista SET activo = FALSE`);

    let insertados = 0;
    let actualizados = 0;

    for (const item of items) {
      // 4. Upsert del equipo
      const existing = await client.query(
        `SELECT id FROM equipos_lista WHERE item_code = $1 LIMIT 1`,
        [item.item_code]
      );

      let equipoId;
      if (existing.rows.length > 0) {
        equipoId = existing.rows[0].id;
        await client.query(
          `UPDATE equipos_lista SET
            upload_id = $1, sap_code = $2, modelo = $3, marca = $4,
            categoria = $5, precio_regular = $6, fuera_portafolio = $7,
            activo = TRUE, actualizado_en = NOW()
           WHERE id = $8`,
          [uploadId, item.sap_code, item.modelo, item.marca,
           item.categoria, item.precio_regular, item.fuera_portafolio, equipoId]
        );
        actualizados++;
      } else {
        const ins = await client.query(
          `INSERT INTO equipos_lista
            (upload_id, item_code, sap_code, modelo, marca, categoria, precio_regular, fuera_portafolio, activo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
           RETURNING id`,
          [uploadId, item.item_code, item.sap_code, item.modelo, item.marca,
           item.categoria, item.precio_regular, item.fuera_portafolio]
        );
        equipoId = ins.rows[0].id;
        insertados++;
      }

      // 5. Reemplazar mensualidades
      await client.query(`DELETE FROM equipos_mensualidades WHERE equipo_id = $1`, [equipoId]);
      if (item.mensualidades?.length) {
        for (const m of item.mensualidades) {
          await client.query(
            `INSERT INTO equipos_mensualidades (equipo_id, meses, monto) VALUES ($1, $2, $3)`,
            [equipoId, m.meses, m.monto]
          );
        }
      }

      // 6. Reemplazar precios pospago
      await client.query(`DELETE FROM equipos_pospago WHERE equipo_id = $1`, [equipoId]);
      if (item.pospago_precios?.length) {
        for (const p of item.pospago_precios) {
          await client.query(
            `INSERT INTO equipos_pospago (equipo_id, plan_precio, monto) VALUES ($1, $2, $3)`,
            [equipoId, p.plan_precio, p.monto]
          );
        }
      }
    }

    // 7. Actualizar total en el upload
    await client.query(
      `UPDATE equipos_uploads SET total_items = $1 WHERE id = $2`,
      [items.length, uploadId]
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      upload_id:   uploadId,
      total:       items.length,
      insertados,
      actualizados,
      message:     `Lista actualizada: ${insertados} nuevos, ${actualizados} actualizados.`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[equipos-lista] uploadLista error:', err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
};

/**
 * GET /api/equipos-lista/uploads
 * Historial de uploads.
 */
export const getUploads = async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM equipos_uploads ORDER BY fecha_subida DESC LIMIT 20`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
