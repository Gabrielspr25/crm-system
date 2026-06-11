/**
 * planesPreviewController.js
 * Constructor de Ofertas — preview con diff y aplicación aprobada.
 *
 * Flujo:
 *   POST /api/planes-modulos/preview            → sube doc, detecta tipo, parsea, devuelve diff (NO aplica)
 *   POST /api/planes-modulos/apply/:previewId   → aplica los cambios de un preview aprobado
 *
 * Reglas (memory/constructor-ofertas.md):
 *   - Nunca se modifica contenido sin aprobación explícita (anti-clobber).
 *   - Snapshot previo a disco antes de aplicar (rollback manual posible).
 *   - Historial en tabla planes_documentos queda para migración futura.
 */

import pool from '../database/db.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(__dirname, '../../../scripts');
const SNAPSHOT_DIR = '/opt/crmp/uploads/pdf-planes/snapshots';

// Previews pendientes en memoria (proceso único PM2). TTL 30 min.
const previews = new Map();
const PREVIEW_TTL_MS = 30 * 60 * 1000;

function gcPreviews() {
  const now = Date.now();
  for (const [id, p] of previews) {
    if (now - p.created > PREVIEW_TTL_MS) previews.delete(id);
  }
}

function runParser(script, filePath) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    const proc = spawn('python3', [path.join(SCRIPTS_DIR, script), filePath]);
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`Parser ${script} falló (exit ${code}): ${stderr.slice(0, 500)}`));
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error(`Parser ${script}: salida no es JSON válido`)); }
    });
  });
}

const normTitulo = s => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]/g, '');

const filaKey = f => `${String(f.codigo).trim()}|${String(f.alfa_code || '-').trim()}`;

/** Diff entre filas publicadas y filas del documento nuevo. */
function diffFilas(actuales, nuevas) {
  const mapAct = new Map(actuales.map(f => [filaKey(f), f]));
  const mapNue = new Map(nuevas.map(f => [filaKey(f), f]));

  const nuevos = [], ausentes = [], modificados = [];
  let sinCambio = 0;

  for (const [k, fn] of mapNue) {
    const fa = mapAct.get(k);
    if (!fa) { nuevos.push(fn); continue; }
    const campos = [];
    for (const c of ['precio', 'descripcion', 'tecnologia']) {
      const va = fa[c] ?? '', vn = fn[c] ?? '';
      if (String(va) !== String(vn)) campos.push({ campo: c, antes: va, ahora: vn });
    }
    if (campos.length) modificados.push({ codigo: fn.codigo, alfa_code: fn.alfa_code, cambios: campos });
    else sinCambio++;
  }
  for (const [k, fa] of mapAct) {
    if (!mapNue.has(k)) ausentes.push(fa);
  }
  return { nuevos, ausentes, modificados, sin_cambio: sinCambio };
}

// ─── POST /api/planes-modulos/preview ────────────────────────────────────────
export async function previewDocumento(req, res) {
  gcPreviews();
  if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió ningún archivo' });

  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();
  const cleanup = () => { try { fs.unlinkSync(filePath); } catch (_) {} };

  try {
    let parsed = null, tipo = null, pagina = null;

    if (ext === '.pdf') {
      // 1) ¿Listado de planes fijos?
      try {
        const r = await runParser('parse_planes_fijos_pdf.py', filePath);
        if (!r.error && (r.total_filas || 0) > 0) { parsed = r; tipo = 'planes_fijos'; pagina = 'fijos'; }
      } catch (_) { /* probar siguiente parser */ }

      // 2) ¿Boletín equipos / Internet On The Go?
      if (!parsed) {
        try {
          const r = await runParser('parse_equipos_pdf.py', filePath);
          if (!r.error && Array.isArray(r.secciones) && r.secciones.length > 0) {
            parsed = r; tipo = 'equipos_inalambrico'; pagina = 'inalambrico';
          }
        } catch (_) { /* sin match */ }
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      cleanup();
      return res.status(422).json({
        ok: false,
        error: 'Excel detectado (lista de precios móviles): parser aún no implementado. Ver memory/constructor-ofertas.md paso 5.',
      });
    }

    cleanup();
    if (!parsed) {
      return res.status(422).json({
        ok: false,
        error: 'Documento no reconocido por ningún parser. No se modificó nada.',
      });
    }

    // ── Diff contra lo publicado ──
    const { rows: modulosDb } = await pool.query(
      `SELECT id, seccion_key, titulo, contenido FROM planes_modulos
       WHERE pagina = $1 AND activo = true ORDER BY orden, id`,
      [pagina]
    );

    const resumen = [];
    const planAplicacion = [];

    if (tipo === 'planes_fijos') {
      for (const [key, mod] of Object.entries(parsed.modulos || {})) {
        const db = modulosDb.find(m =>
          m.seccion_key === key || normTitulo(m.titulo) === normTitulo(mod.titulo)
        );
        if (!db) {
          resumen.push({ seccion: mod.titulo, estado: 'SIN_MODULO_EN_PORTAL', filas_doc: mod.filas.length });
          continue;
        }
        const actuales = db.contenido?.filas || [];
        const d = diffFilas(actuales, mod.filas);
        resumen.push({
          seccion: mod.titulo, modulo_id: db.id,
          filas_doc: mod.filas.length, filas_publicadas: actuales.length,
          nuevos: d.nuevos.length, ausentes: d.ausentes.length,
          modificados: d.modificados.length, sin_cambio: d.sin_cambio,
          detalle: d,
        });
        planAplicacion.push({ modulo_id: db.id, seccion_key: db.seccion_key, filas: mod.filas });
      }
    } else {
      // equipos_inalambrico: el parser existente reemplaza contenido completo de un módulo.
      resumen.push({
        seccion: 'inalambrico', estado: 'REEMPLAZO_COMPLETO',
        secciones_doc: parsed.secciones.length,
        nota: 'Usa el flujo existente upload-pdf por módulo, o aplica con este preview al módulo indicado.',
      });
    }

    const previewId = crypto.randomUUID();
    previews.set(previewId, {
      created: Date.now(),
      tipo, pagina, parsed, planAplicacion,
      archivo: req.file.originalname,
      usuario: req.user?.username || req.user?.email || 'admin',
    });

    return res.json({
      ok: true,
      preview_id: previewId,
      expira_en_min: 30,
      tipo_detectado: tipo,
      pagina,
      rev: parsed.rev || null,
      version_doc: parsed.version_doc || null,
      archivo: req.file.originalname,
      resumen,
      no_publicados: Array.isArray(parsed.no_publicados) ? parsed.no_publicados.length : 0,
    });
  } catch (err) {
    cleanup();
    console.error('[planesPreview] previewDocumento error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── POST /api/planes-modulos/apply/:previewId ───────────────────────────────
export async function applyPreview(req, res) {
  gcPreviews();
  const { previewId } = req.params;
  const p = previews.get(previewId);
  if (!p) return res.status(404).json({ ok: false, error: 'Preview no encontrado o expirado (30 min). Vuelve a subir el documento.' });

  if (!p.planAplicacion.length) {
    return res.status(422).json({ ok: false, error: 'Este preview no tiene cambios aplicables.' });
  }

  const usuario = req.user?.username || req.user?.email || 'admin';
  const client = await pool.connect();
  try {
    // Snapshot previo a disco
    const ids = p.planAplicacion.map(x => x.modulo_id);
    const { rows: antes } = await client.query(
      `SELECT id, pagina, seccion_key, titulo, contenido FROM planes_modulos WHERE id = ANY($1)`,
      [ids]
    );
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const snapFile = path.join(SNAPSHOT_DIR, `snapshot-${p.pagina}-${Date.now()}.json`);
    fs.writeFileSync(snapFile, JSON.stringify({
      fecha: new Date().toISOString(), usuario, archivo: p.archivo,
      tipo: p.tipo, rev: p.parsed.rev, version_doc: p.parsed.version_doc,
      modulos_antes: antes,
    }, null, 2));

    // Aplicar en transacción
    await client.query('BEGIN');
    for (const item of p.planAplicacion) {
      const mod = antes.find(m => m.id === item.modulo_id);
      const columnas = mod?.contenido?.columnas
        || ['Código', 'Descripción', 'Alfa Code', 'Tecnología', 'Precio'];
      await client.query(
        `UPDATE planes_modulos
         SET contenido = $1, boletin_ref = $2, updated_by = $3
         WHERE id = $4`,
        [
          { columnas, filas: item.filas },
          p.archivo,
          usuario,
          item.modulo_id,
        ]
      );
    }
    await client.query('COMMIT');
    previews.delete(previewId);

    return res.json({
      ok: true,
      aplicado: p.planAplicacion.map(x => ({ modulo_id: x.modulo_id, seccion_key: x.seccion_key, filas: x.filas.length })),
      snapshot: snapFile,
      archivo: p.archivo,
      rev: p.parsed.rev,
      version_doc: p.parsed.version_doc,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[planesPreview] applyPreview error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
}
