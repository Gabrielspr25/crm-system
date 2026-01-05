import express from 'express';
import { saveImportData, simulateImportData, getExcelColumns } from '../controllers/importController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/save', saveImportData);
router.post('/simulate', simulateImportData);
router.get('/excel-columns', getExcelColumns);

export default router;
