import express from 'express';
import { getDirectorOverview, patchDirectorGoal, markCommissionPaid } from '../controllers/directorController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.get('/overview', getDirectorOverview);
router.patch('/goal', patchDirectorGoal);
router.post('/mark-paid', markCommissionPaid);

export default router;
