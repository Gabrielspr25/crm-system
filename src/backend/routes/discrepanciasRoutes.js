
import express from 'express';
import { getDiscrepancias, syncDiscrepancia, compareExcel, updateRow } from '../controllers/discrepanciasController.js';
import { syncRemoteData } from '../controllers/manualComparisonController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getDiscrepancias);
router.post('/sync', syncDiscrepancia);
router.post('/compare-excel', compareExcel);
router.post('/update-row', updateRow);
router.post('/sync-remote', syncRemoteData);

export default router;
