import express from 'express';
import { saveImportData } from '../controllers/importController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/save', saveImportData);

export default router;
