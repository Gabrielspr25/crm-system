import express from 'express';
import { getGoals, saveBusinessGoal, saveVendorGoal } from '../controllers/gestionController.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/goals', getGoals);
router.post('/goals/business', requireRole(['admin', 'supervisor']), saveBusinessGoal);
router.post('/goals/vendor', requireRole(['admin', 'supervisor']), saveVendorGoal);

export default router;
