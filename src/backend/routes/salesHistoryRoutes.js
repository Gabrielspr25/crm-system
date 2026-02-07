import express from 'express';
import { getSalesHistory, createSalesHistory, syncFromReports } from '../controllers/salesHistoryController.js';

const router = express.Router();

// GET /api/sales-history?client_id=X - Obtener historial de ventas de un cliente
router.get('/', getSalesHistory);

// POST /api/sales-history - Crear nuevo registro manual en historial
router.post('/', createSalesHistory);

// POST /api/sales-history/sync-from-reports - Sincronizar desde subscriber_reports
router.post('/sync-from-reports', syncFromReports);

export default router;
