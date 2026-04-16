import express from 'express';
import { runSystemDiagnostics } from '../controllers/systemController.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

// GET /api/system/diagnostics - Ejecutar diagnóstico completo
router.get('/diagnostics', authenticateToken, requireRole(['admin', 'supervisor']), runSystemDiagnostics);

export default router;
