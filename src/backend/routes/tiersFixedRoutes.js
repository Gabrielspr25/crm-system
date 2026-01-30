import express from 'express';
import { getTiersByProduct, createTierFixed, updateTierFixed, deleteTierFixed } from '../controllers/tiersFixedController.js';

const router = express.Router();

router.get('/product/:productId', getTiersByProduct);
router.post('/', createTierFixed);
router.put('/:id', updateTierFixed);
router.delete('/:id', deleteTierFixed);

export default router;
