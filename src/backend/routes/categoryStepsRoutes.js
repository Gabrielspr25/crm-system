import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { query } from '../database/db.js';

const router = express.Router({ mergeParams: true });
router.use(authenticateToken);

// GET /api/categories/:id/steps
router.get('/', async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, category_id, step_name, step_order, created_at FROM category_steps WHERE category_id=$1 ORDER BY step_order ASC, id ASC',
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/categories/:id/steps
router.post('/', requireRole(['admin', 'supervisor']), async (req, res) => {
  const { step_name, step_order } = req.body || {};
  if (!step_name?.trim()) return res.status(400).json({ error: 'step_name requerido' });
  try {
    const ord = step_order !== undefined
      ? Number(step_order)
      : ((await query('SELECT COALESCE(MAX(step_order), 0) + 1 AS n FROM category_steps WHERE category_id=$1', [req.params.id]))[0]?.n ?? 1);
    const rows = await query(
      'INSERT INTO category_steps (category_id, step_name, step_order, created_at) VALUES ($1,$2,$3,NOW()) RETURNING *',
      [req.params.id, step_name.trim(), ord]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/categories/:id/steps/:stepId
router.patch('/:stepId', requireRole(['admin', 'supervisor']), async (req, res) => {
  const { step_name, step_order } = req.body || {};
  const sets = [], vals = [];
  let i = 1;
  if (step_name !== undefined) { sets.push('step_name=$' + i++); vals.push(step_name.trim()); }
  if (step_order !== undefined) { sets.push('step_order=$' + i++); vals.push(Number(step_order)); }
  if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
  vals.push(req.params.stepId);
  try {
    const rows = await query(
      'UPDATE category_steps SET ' + sets.join(',') + ' WHERE id=$' + i + ' AND category_id=$' + (i + 1) + ' RETURNING *',
      [...vals, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Paso no encontrado' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/categories/:id/steps/:stepId
router.delete('/:stepId', requireRole(['admin', 'supervisor']), async (req, res) => {
  try {
    await query('DELETE FROM category_steps WHERE id=$1 AND category_id=$2', [req.params.stepId, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
