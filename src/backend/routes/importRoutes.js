import express from 'express';
import { saveImportData, simulateImportData } from '../controllers/importController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/save', saveImportData);
router.post('/simulate', simulateImportData);

export default router;
