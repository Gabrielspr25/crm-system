import express from 'express';
import { getDashboardResumen } from '../controllers/dashboardController.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Solo admin y supervisor pueden ver el panel de metas
router.get('/resumen', requireRole(['admin', 'supervisor']), getDashboardResumen);

export default router;
