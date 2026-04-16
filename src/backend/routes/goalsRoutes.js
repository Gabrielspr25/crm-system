import express from 'express';
import * as goalsController from '../controllers/goalsController.js';

const router = express.Router();

// GET /api/goals/latest-period - Último periodo con metas visibles para el usuario
router.get('/latest-period', goalsController.getLatestPeriod);

// GET /api/goals/performance - Rendimiento global de metas vs comisiones
router.get('/performance', goalsController.getPerformance);

// GET /api/goals/products/:salespersonId - Desglose por producto de un vendedor
router.get('/products/:salespersonId', goalsController.getProductGoals);

// GET /api/goals/by-period - Obtener todas las metas de un periodo
router.get('/by-period', goalsController.getByPeriod);

// POST /api/goals/save - Guardar o actualizar una meta individual
router.post('/save', goalsController.saveGoal);

export default router;
