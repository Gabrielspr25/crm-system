import express from 'express';
import { getSubscribers, createSubscriber, updateSubscriber, cancelSubscriber, reactivateSubscriber } from '../controllers/subscriberController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getSubscribers);
router.post('/', createSubscriber);
router.put('/:id', updateSubscriber);
router.put('/:id/cancel', cancelSubscriber);
router.put('/:id/reactivate', reactivateSubscriber);

export default router;
