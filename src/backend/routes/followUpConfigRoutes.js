import express from 'express';
import { query } from '../database/db.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

const toBoolean = (value, fallback = true) => {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    return ['true', '1', 't', 'yes', 'si'].includes(normalized);
};

const toActiveInteger = (value, fallback = true) => toBoolean(value, fallback) ? 1 : 0;

const toOrderIndex = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
};

const validateName = (res, name, label) => {
    const cleanName = String(name || '').trim();
    if (!cleanName) {
        res.status(400).json({ error: `${label} es obligatorio` });
        return null;
    }
    return cleanName;
};

const getFollowUpSteps = async (_req, res) => {
    try {
        const rows = await query(
            `SELECT id, name, description, order_index, is_active, created_at, updated_at
               FROM follow_up_steps
              ORDER BY order_index ASC, id ASC`
        );
        res.json(rows);
    } catch (error) {
        console.error('Error getting follow-up steps:', error);
        res.status(500).json({ error: 'Error obteniendo pasos de seguimiento' });
    }
};

router.get('/follow-up-steps', getFollowUpSteps);
router.get('/follow-up-prospects/steps', getFollowUpSteps);

router.post('/follow-up-steps', async (req, res) => {
    const name = validateName(res, req.body?.name, 'El nombre del paso');
    if (!name) return;

    try {
        const rows = await query(
            `INSERT INTO follow_up_steps (name, description, order_index, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING id, name, description, order_index, is_active, created_at, updated_at`,
            [
                name,
                req.body?.description ? String(req.body.description).trim() : null,
                toOrderIndex(req.body?.order_index),
                toBoolean(req.body?.is_active, true)
            ]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating follow-up step:', error);
        res.status(500).json({ error: 'Error creando paso de seguimiento' });
    }
});

router.put('/follow-up-steps/:id', async (req, res) => {
    const name = validateName(res, req.body?.name, 'El nombre del paso');
    if (!name) return;

    try {
        const rows = await query(
            `UPDATE follow_up_steps
                SET name = $1,
                    description = $2,
                    order_index = $3,
                    is_active = $4,
                    updated_at = NOW()
              WHERE id = $5
              RETURNING id, name, description, order_index, is_active, created_at, updated_at`,
            [
                name,
                req.body?.description ? String(req.body.description).trim() : null,
                toOrderIndex(req.body?.order_index),
                toBoolean(req.body?.is_active, true),
                req.params.id
            ]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Paso de seguimiento no encontrado' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating follow-up step:', error);
        res.status(500).json({ error: 'Error actualizando paso de seguimiento' });
    }
});

router.delete('/follow-up-steps/:id', async (req, res) => {
    try {
        const usage = await query(
            'SELECT COUNT(*)::int AS total FROM follow_up_prospects WHERE step_id = $1',
            [req.params.id]
        );
        if (Number(usage[0]?.total || 0) > 0) {
            return res.status(400).json({ error: 'No se puede eliminar un paso usado por seguimientos' });
        }

        const rows = await query(
            'DELETE FROM follow_up_steps WHERE id = $1 RETURNING id',
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Paso de seguimiento no encontrado' });
        }
        res.json({ success: true, id: rows[0].id });
    } catch (error) {
        console.error('Error deleting follow-up step:', error);
        res.status(500).json({ error: 'Error eliminando paso de seguimiento' });
    }
});

router.get('/priorities', async (_req, res) => {
    try {
        const rows = await query(
            `SELECT id, name, color_hex, order_index, is_active, created_at, updated_at
               FROM priorities
              ORDER BY order_index ASC, id ASC`
        );
        res.json(rows);
    } catch (error) {
        console.error('Error getting priorities:', error);
        res.status(500).json({ error: 'Error obteniendo prioridades' });
    }
});

router.post('/priorities', async (req, res) => {
    const name = validateName(res, req.body?.name, 'El nombre de la prioridad');
    if (!name) return;

    try {
        const rows = await query(
            `INSERT INTO priorities (name, color_hex, order_index, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING id, name, color_hex, order_index, is_active, created_at, updated_at`,
            [
                name,
                String(req.body?.color_hex || '#3B82F6').trim(),
                toOrderIndex(req.body?.order_index),
                toActiveInteger(req.body?.is_active, true)
            ]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating priority:', error);
        res.status(500).json({ error: 'Error creando prioridad' });
    }
});

router.put('/priorities/:id', async (req, res) => {
    const name = validateName(res, req.body?.name, 'El nombre de la prioridad');
    if (!name) return;

    try {
        const rows = await query(
            `UPDATE priorities
                SET name = $1,
                    color_hex = $2,
                    order_index = $3,
                    is_active = $4,
                    updated_at = NOW()
              WHERE id = $5
              RETURNING id, name, color_hex, order_index, is_active, created_at, updated_at`,
            [
                name,
                String(req.body?.color_hex || '#3B82F6').trim(),
                toOrderIndex(req.body?.order_index),
                toActiveInteger(req.body?.is_active, true),
                req.params.id
            ]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Prioridad no encontrada' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating priority:', error);
        res.status(500).json({ error: 'Error actualizando prioridad' });
    }
});

router.delete('/priorities/:id', async (req, res) => {
    try {
        const usage = await query(
            'SELECT COUNT(*)::int AS total FROM follow_up_prospects WHERE priority_id = $1',
            [req.params.id]
        );
        if (Number(usage[0]?.total || 0) > 0) {
            return res.status(400).json({ error: 'No se puede eliminar una prioridad usada por seguimientos' });
        }

        const rows = await query(
            'DELETE FROM priorities WHERE id = $1 RETURNING id',
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Prioridad no encontrada' });
        }
        res.json({ success: true, id: rows[0].id });
    } catch (error) {
        console.error('Error deleting priority:', error);
        res.status(500).json({ error: 'Error eliminando prioridad' });
    }
});

export default router;
