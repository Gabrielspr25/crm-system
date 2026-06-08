/**
 * planesModulosController.js
 * CRUD para módulos de planes dinámicos (Fijos, Móviles, Inalámbrico)
 */

import pool from '../database/db.js';

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
