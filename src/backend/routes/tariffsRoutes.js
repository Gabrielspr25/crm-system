
import express from 'express';
import { getPlans, createPlan, updatePlan, deletePlan, getCategories } from '../controllers/tariffsController.js';

const router = express.Router();

router.get('/categories', getCategories);
router.get('/plans', getPlans);
router.post('/plans', createPlan);
router.put('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

export default router;
