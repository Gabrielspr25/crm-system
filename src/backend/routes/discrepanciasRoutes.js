
import express from 'express';
import { getDiscrepancias, syncDiscrepancia } from '../controllers/discrepanciasController.js';
import { compareExcelAgainstDB, syncRemoteData } from '../controllers/manualComparisonController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getDiscrepancias);
router.post('/sync', syncDiscrepancia);
router.post('/compare-excel', compareExcelAgainstDB);
router.post('/sync-remote', syncRemoteData);

export default router;
