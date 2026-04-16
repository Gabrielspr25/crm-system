import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { query } from '../database/db.js';

const router = express.Router();
router.use(authenticateToken);

// PATCH /api/category-steps/reorder  — bulk update step_order
router.patch('/reorder', requireRole(['admin', 'supervisor']), async (req, res) => {
  const steps = req.body?.steps;
  if (!Array.isArray(steps) || !steps.length) return res.status(400).json({ error: 'steps requerido' });
  try {
    await query('BEGIN');
    for (const { step_id, step_order } of steps) {
      await query('UPDATE category_steps SET step_order=$1 WHERE id=$2', [Number(step_order), step_id]);
    }
    await query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/category-steps/:stepId
router.put('/:stepId', requireRole(['admin', 'supervisor']), async (req, res) => {
  const { step_name, step_order } = req.body || {};
  const sets = [], vals = [];
  let i = 1;
  if (step_name !== undefined) { sets.push('step_name=$' + i++); vals.push(step_name.trim()); }
  if (step_order !== undefined) { sets.push('step_order=$' + i++); vals.push(Number(step_order)); }
  if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
  vals.push(req.params.stepId);
  try {
    const rows = await query('UPDATE category_steps SET ' + sets.join(',') + ' WHERE id=$' + i + ' RETURNING *', vals);
    if (!rows.length) return res.status(404).json({ error: 'Paso no encontrado' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/category-steps/:stepId
router.delete('/:stepId', requireRole(['admin', 'supervisor']), async (req, res) => {
  try {
    await query('DELETE FROM category_steps WHERE id=$1', [req.params.stepId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
