import express from 'express';
import { runFullSystemTest } from '../controllers/systemTestController.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.post('/full', authenticateToken, requireRole(['admin']), runFullSystemTest);

export default router;
