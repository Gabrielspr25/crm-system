
import express from 'express';
import { getDiscrepancias, syncDiscrepancia, compareExcel, updateRow } from '../controllers/discrepanciasController.js';
import { syncRemoteData } from '../controllers/manualComparisonController.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getDiscrepancias);
router.post('/sync', requireRole(['admin', 'supervisor']), syncDiscrepancia);
router.post('/compare-excel', compareExcel);
router.post('/update-row', requireRole(['admin', 'supervisor']), updateRow);
router.post('/sync-remote', requireRole(['admin', 'supervisor']), syncRemoteData);

export default router;
