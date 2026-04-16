import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import { query } from '../database/db.js';

const router = express.Router({ mergeParams: true });
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const sql = 'SELECT cs.id AS step_id, cs.category_id, cs.step_name, cs.step_order, ' +
      'cat.name AS category_name, ' +
      'COALESCE(csp.is_done, false) AS is_done, ' +
      'csp.done_at, csp.notes, csp.id AS client_step_id ' +
      'FROM category_steps cs ' +
      'JOIN categories cat ON cat.id = cs.category_id ' +
      'LEFT JOIN client_steps csp ON csp.category_step_id = cs.id AND csp.client_id = $1 ' +
      'ORDER BY cat.name ASC, cs.step_order ASC, cs.id ASC';
    const rows = await query(sql, [req.params.clientId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:stepId', async (req, res) => {
  const { is_done, notes } = req.body || {};
  try {
    const sql = 'INSERT INTO client_steps (client_id, category_step_id, is_done, done_at, notes, updated_at) ' +
      'VALUES ($1, $2, $3, $4, $5, NOW()) ' +
      'ON CONFLICT (client_id, category_step_id) ' +
      'DO UPDATE SET ' +
      '  is_done    = EXCLUDED.is_done, ' +
      '  done_at    = CASE WHEN EXCLUDED.is_done THEN COALESCE(client_steps.done_at, NOW()) ELSE NULL END, ' +
      '  notes      = COALESCE(EXCLUDED.notes, client_steps.notes), ' +
      '  updated_at = NOW() ' +
      'RETURNING *';
    const rows = await query(sql, [req.params.clientId, req.params.stepId, Boolean(is_done), is_done ? new Date() : null, notes ?? null]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
