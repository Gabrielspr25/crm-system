import express from 'express';
import { getMyDay } from '../controllers/myDayController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.get('/', getMyDay);

export default router;
