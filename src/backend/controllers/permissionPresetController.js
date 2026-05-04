import { query } from '../database/db.js';
import { serverError, badRequest, notFound } from '../middlewares/errorHandler.js';
import { PERMISSION_KEYS, normalizePermissionKey } from '../../shared/permissionCatalog.js';
import { saveUserPermissionOverrides } from '../utils/permissionService.js';

const VALID_EFFECTS = new Set(['allow', 'deny', 'inherit']);

const ensurePresetSchema = async () => {
    await query(`
        CREATE TABLE IF NOT EXISTS permission_presets (
            id          BIGSERIAL PRIMARY KEY,
            name        TEXT NOT NULL,
            effects     JSONB NOT NULL DEFAULT '{}',
            created_by  TEXT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS permission_presets_name_idx
        ON permission_presets (LOWER(TRIM(name)))
    `);
};

// GET /api/permissions/presets
export const listPresets = async (_req, res) => {
    try {
        await ensurePresetSchema();
        const rows = await query(
            `SELECT id, name, effects, created_by, created_at, updated_at
               FROM permission_presets
              ORDER BY name ASC`
        );
        res.json(rows.map(r => ({
            id: Number(r.id),
            name: r.name,
            effects: r.effects || {},
            created_by: r.created_by || null,
            created_at: r.created_at,
            updated_at: r.updated_at,
        })));
    } catch (error) {
        serverError(res, error, 'Error listando presets');
    }
};

// POST /api/permissions/presets
export const createPreset = async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const rawEffects = req.body?.effects || {};
    const createdBy = String(req.user?.userId || '').trim() || null;

    if (!name) return badRequest(res, 'name es requerido');
    if (name.length > 100) return badRequest(res, 'name no puede superar 100 caracteres');

    // Limpiar effects: solo guardar keys válidas y effects válidos, omitir "inherit"
    const cleanEffects = {};
    for (const [key, effect] of Object.entries(rawEffects)) {
        const normalizedKey = normalizePermissionKey(key);
        const normalizedEffect = String(effect || '').trim().toLowerCase();
        if (PERMISSION_KEYS.has(normalizedKey) && VALID_EFFECTS.has(normalizedEffect)) {
            cleanEffects[normalizedKey] = normalizedEffect;
        }
    }

    try {
        await ensurePresetSchema();

        const existing = await query(
            `SELECT id FROM permission_presets WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1`,
            [name]
        );
        if (existing.length > 0) {
            // Actualizar si ya existe con ese nombre
            const updated = await query(
                `UPDATE permission_presets
                    SET effects = $1, updated_at = NOW(), created_by = $2
                  WHERE id = $3
                  RETURNING *`,
                [JSON.stringify(cleanEffects), createdBy, existing[0].id]
            );
            return res.json({
                id: Number(updated[0].id),
                name: updated[0].name,
                effects: updated[0].effects || {},
                created_by: updated[0].created_by || null,
                created_at: updated[0].created_at,
                updated_at: updated[0].updated_at,
            });
        }

        const inserted = await query(
            `INSERT INTO permission_presets (name, effects, created_by, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             RETURNING *`,
            [name, JSON.stringify(cleanEffects), createdBy]
        );

        res.status(201).json({
            id: Number(inserted[0].id),
            name: inserted[0].name,
            effects: inserted[0].effects || {},
            created_by: inserted[0].created_by || null,
            created_at: inserted[0].created_at,
            updated_at: inserted[0].updated_at,
        });
    } catch (error) {
        serverError(res, error, 'Error creando preset');
    }
};

// DELETE /api/permissions/presets/:id
export const deletePreset = async (req, res) => {
    const id = Number(req.params?.id);
    if (Number.isNaN(id)) return badRequest(res, 'ID inválido');

    try {
        await ensurePresetSchema();
        const rows = await query(
            `DELETE FROM permission_presets WHERE id = $1 RETURNING id`,
            [id]
        );
        if (rows.length === 0) return notFound(res, 'Preset');
        res.json({ ok: true });
    } catch (error) {
        serverError(res, error, 'Error eliminando preset');
    }
};

// POST /api/permissions/presets/:id/apply-salesperson/:salespersonId
// Aplica un preset al users_auth vinculado a ese salesperson
export const applyPresetToSalesperson = async (req, res) => {
    const presetId = Number(req.params?.id);
    const salespersonId = String(req.params?.salespersonId || '').trim();
    const actorUserId = String(req.user?.userId || '').trim() || null;

    if (Number.isNaN(presetId)) return badRequest(res, 'Preset ID inválido');
    if (!salespersonId) return badRequest(res, 'salespersonId es requerido');

    try {
        await ensurePresetSchema();

        // 1. Obtener el preset
        const presetRows = await query(
            `SELECT id, name, effects FROM permission_presets WHERE id = $1 LIMIT 1`,
            [presetId]
        );
        if (presetRows.length === 0) return notFound(res, 'Preset');
        const preset = presetRows[0];

        // 2. Buscar el users_auth vinculado a este salesperson
        const userRows = await query(
            `SELECT id::text AS id, username
               FROM users_auth
              WHERE salesperson_id::text = $1
              LIMIT 1`,
            [salespersonId]
        );
        if (userRows.length === 0) {
            return res.status(404).json({ error: 'Este vendedor no tiene cuenta de acceso vinculada' });
        }
        const userId = userRows[0].id;

        // 3. Convertir effects del preset a formato de overrides
        const effects = preset.effects || {};
        const items = Object.entries(effects).map(([permission_key, effect]) => ({
            permission_key,
            effect
        }));

        // Además, resetear a "inherit" los permisos que NO están en el preset
        // (para que al cambiar de preset, los anteriores queden limpios)
        const { PERMISSION_CATALOG } = await import('../../shared/permissionCatalog.js');
        for (const perm of PERMISSION_CATALOG) {
            if (!effects[perm.key]) {
                items.push({ permission_key: perm.key, effect: 'inherit' });
            }
        }

        // 4. Aplicar overrides
        await saveUserPermissionOverrides(query, actorUserId, userId, items);

        // 5. Guardar referencia del preset activo en salespeople
        //    (columna opcional — la creamos si no existe)
        try {
            await query(`
                ALTER TABLE salespeople
                ADD COLUMN IF NOT EXISTS permission_preset_id BIGINT NULL,
                ADD COLUMN IF NOT EXISTS permission_preset_name TEXT NULL
            `);
            await query(
                `UPDATE salespeople
                    SET permission_preset_id = $1,
                        permission_preset_name = $2,
                        updated_at = NOW()
                  WHERE id::text = $3`,
                [presetId, preset.name, salespersonId]
            );
        } catch {
            // Si la tabla no soporta la columna, no es crítico
        }

        res.json({
            ok: true,
            preset_id: presetId,
            preset_name: preset.name,
            user_id: userId,
            username: userRows[0].username,
            overrides_applied: Object.keys(effects).length,
        });
    } catch (error) {
        serverError(res, error, 'Error aplicando preset al vendedor');
    }
};
