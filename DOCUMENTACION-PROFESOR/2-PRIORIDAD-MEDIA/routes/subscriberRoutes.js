import express from 'express';
import { getSubscribers, createSubscriber, updateSubscriber } from '../controllers/subscriberController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getSubscribers);
router.post('/', createSubscriber);
router.put('/:id', updateSubscriber);

export default router;
