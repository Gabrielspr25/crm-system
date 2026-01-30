import express from 'express';
import { runSystemDiagnostics } from '../controllers/systemController.js';

const router = express.Router();

// GET /api/system/diagnostics - Ejecutar diagnóstico completo
router.get('/diagnostics', runSystemDiagnostics);

export default router;
