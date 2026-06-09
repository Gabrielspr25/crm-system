/**
 * planesModulosController.js
 * CRUD para módulos de planes dinámicos (Fijos, Móviles, Inalámbrico)
 */

import pool from '../database/db.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PAGINAS_VALIDAS = ['fijos', 'moviles', 'inalambrico'];

// ─── GET /api/planes-modulos/:pagina ─────────────────────────────────────────
// Público — devuelve todos los módulos activos de una página
export async function getModulosByPagina(req, res) {
  const { pagina } = req.params;
  if (!PAGINAS_VALIDAS.includes(pagina)) {
    return res.status(400).json({ ok: false, error: 'Página inválida. Usa: fijos | moviles | inalambrico' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, pagina, seccion_key, titulo, subtitulo, descripcion,
              orden, activo, tipo, contenido,
              vigencia_desde, vigencia_hasta, boletin_ref,
              updated_at
       FROM planes_modulos
       WHERE pagina = $1 AND activo = true
       ORDER BY orden, id`,
      [pagina]
    );
    return res.json({ ok: true, pagina, modulos: rows });
  } catch (err) {
    console.error('[planesModulos] getModulosByPagina error:', err.message);
    return res.status(500).json({ ok: false, error: 'Error al obtener módulos' });
  }
}

// ─── GET /api/planes-modulos/admin/all ───────────────────────────────────────
// Admin — devuelve TODOS los módulos (activos e inactivos) de todas las páginas
export async function getAllModulosAdmin(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, pagina, seccion_key, titulo, subtitulo, descripcion,
              orden, activo, tipo, contenido,
              vigencia_desde, vigencia_hasta, boletin_ref,
              updated_at, updated_by
       FROM planes_modulos
       ORDER BY pagina, orden, id`
    );
    return res.json({ ok: true, modulos: rows });
  } catch (err) {
    console.error('[planesModulos] getAllModulosAdmin error:', err.message);
    return res.status(500).json({ ok: false, error: 'Error al obtener módulos' });
  }
}

// ─── POST /api/planes-modulos ─────────────────────────────────────────────────
// Admin — crear nuevo módulo
export async function createModulo(req, res) {
  const {
    pagina, seccion_key, titulo, subtitulo, descripcion,
    orden, activo, tipo, contenido,
    vigencia_desde, vigencia_hasta, boletin_ref
  } = req.body;

  if (!pagina || !seccion_key || !titulo || !tipo || !contenido) {
    return res.status(400).json({ ok: false, error: 'Campos requeridos: pagina, seccion_key, titulo, tipo, contenido' });
  }
  if (!PAGINAS_VALIDAS.includes(pagina)) {
    return res.status(400).json({ ok: false, error: 'Página inválida. Usa: fijos | moviles | inalambrico' });
  }

  let contenidoJson;
  try {
    contenidoJson = typeof contenido === 'string' ? JSON.parse(contenido) : contenido;
  } catch {
    return res.status(400).json({ ok: false, error: 'contenido debe ser JSON válido' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO planes_modulos
         (pagina, seccion_key, titulo, subtitulo, descripcion, orden, activo, tipo,
          contenido, vigencia_desde, vigencia_hasta, boletin_ref, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        pagina, seccion_key, titulo,
        subtitulo || null,
        descripcion || null,
        orden ?? 0,
        activo !== false,
        tipo,
        contenidoJson,
        vigencia_desde || null,
        vigencia_hasta || null,
        boletin_ref || null,
        req.user?.username || req.user?.email || 'admin'
      ]
    );
    return res.status(201).json({ ok: true, modulo: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: `Ya existe un módulo con seccion_key="${seccion_key}" en página "${pagina}"` });
    }
    console.error('[planesModulos] createModulo error:', err.message);
    return res.status(500).json({ ok: false, error: 'Error al crear módulo' });
  }
}

// ─── PUT /api/planes-modulos/:id ─────────────────────────────────────────────
// Admin — actualizar módulo por ID
export async function updateModulo(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const {
    titulo, subtitulo, descripcion,
    orden, activo, tipo, contenido,
    vigencia_desde, vigencia_hasta, boletin_ref
  } = req.body;

  let contenidoJson;
  if (contenido !== undefined) {
    try {
      contenidoJson = typeof contenido === 'string' ? JSON.parse(contenido) : contenido;
    } catch {
      return res.status(400).json({ ok: false, error: 'contenido debe ser JSON válido' });
    }
  }

  try {
    const { rows } = await pool.query(
      `UPDATE planes_modulos SET
         titulo         = COALESCE($1, titulo),
         subtitulo      = COALESCE($2, subtitulo),
         descripcion    = COALESCE($3, descripcion),
         orden          = COALESCE($4, orden),
         activo         = COALESCE($5, activo),
         tipo           = COALESCE($6, tipo),
         contenido      = COALESCE($7, contenido),
         vigencia_desde = COALESCE($8, vigencia_desde),
         vigencia_hasta = COALESCE($9, vigencia_hasta),
         boletin_ref    = COALESCE($10, boletin_ref),
         updated_by     = $11
       WHERE id = $12
       RETURNING *`,
      [
        titulo ?? null,
        subtitulo ?? null,
        descripcion ?? null,
        orden ?? null,
        activo !== undefined ? activo : null,
        tipo ?? null,
        contenidoJson ?? null,
        vigencia_desde ?? null,
        vigencia_hasta ?? null,
        boletin_ref ?? null,
        req.user?.username || req.user?.email || 'admin',
        id
      ]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Módulo no encontrado' });
    return res.json({ ok: true, modulo: rows[0] });
  } catch (err) {
    console.error('[planesModulos] updateModulo error:', err.message);
    return res.status(500).json({ ok: false, error: 'Error al actualizar módulo' });
  }
}

// ─── POST /api/planes-modulos/:id/upload-pdf ─────────────────────────────────
// Admin — recibe PDF, parsea con pdfplumber Python y actualiza contenido del módulo
export async function uploadPdfModulo(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió ningún archivo PDF' });

  const pdfPath = req.file.path;
  const scriptPath = path.resolve(__dirname, '../../../scripts/parse_equipos_pdf.py');

  if (!fs.existsSync(scriptPath)) {
    fs.unlinkSync(pdfPath);
    return res.status(500).json({ ok: false, error: 'Parser no encontrado en servidor' });
  }

  try {
    const contenidoJson = await new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      const proc = spawn('python3', [scriptPath, pdfPath]);
      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => {
        try { fs.unlinkSync(pdfPath); } catch (_) {}
        if (code !== 0) return reject(new Error(`Parser falló (exit ${code}): ${stderr}`));
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.error) return reject(new Error(parsed.error));
          resolve(parsed);
        } catch {
          reject(new Error('Respuesta del parser no es JSON válido'));
        }
      });
    });

    // Anti-clobber: no sobreescribir si el parser no extrajo tablas de precios
    const seccionesCount = Array.isArray(contenidoJson.secciones) ? contenidoJson.secciones.length : 0;
    if (seccionesCount === 0) {
      return res.status(422).json({
        ok: false,
        warning: true,
        error: 'El parser no encontró tablas de precios en este PDF. El contenido del módulo no fue modificado.',
        parse_result: {
          secciones: 0,
          ofertas_especiales: Array.isArray(contenidoJson.ofertas_especiales) ? contenidoJson.ofertas_especiales.length : 0,
          financiamiento_of: Array.isArray(contenidoJson.financiamiento_of) ? contenidoJson.financiamiento_of.length : 0,
          financiamiento_gu: Array.isArray(contenidoJson.financiamiento_gu) ? contenidoJson.financiamiento_gu.length : 0,
        },
      });
    }

    const { rows } = await pool.query(
      `UPDATE planes_modulos
       SET contenido = $1, updated_by = $2
       WHERE id = $3
       RETURNING id, seccion_key, pagina`,
      [contenidoJson, req.user?.username || 'admin', id]
    );

    if (!rows.length) return res.status(404).json({ ok: false, error: 'Módulo no encontrado' });
    return res.json({
      ok: true,
      modulo: rows[0],
      secciones: seccionesCount,
      ofertas_especiales: Array.isArray(contenidoJson.ofertas_especiales) ? contenidoJson.ofertas_especiales.length : 0,
    });

  } catch (err) {
    try { fs.unlinkSync(pdfPath); } catch (_) {}
    console.error('[planesModulos] uploadPdfModulo error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── DELETE /api/planes-modulos/:id ──────────────────────────────────────────
// Admin — soft delete (activo = false)
export async function deleteModulo(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  try {
    const { rows } = await pool.query(
      `UPDATE planes_modulos SET activo = false, updated_by = $1
       WHERE id = $2 RETURNING id, seccion_key, pagina`,
      [req.user?.username || req.user?.email || 'admin', id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Módulo no encontrado' });
    return res.json({ ok: true, desactivado: rows[0] });
  } catch (err) {
    console.error('[planesModulos] deleteModulo error:', err.message);
    return res.status(500).json({ ok: false, error: 'Error al desactivar módulo' });
  }
}
