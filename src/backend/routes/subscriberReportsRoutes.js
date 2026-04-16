import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import {
    getSubscriberReports,
    updateSubscriberReport,
    getReportsComparison
} from '../controllers/subscriberReportsController.js';

const router = express.Router();

router.use(authenticateToken);

// GET /api/subscriber-reports?month=YYYY-MM
router.get('/', getSubscriberReports);

// GET /api/subscriber-reports/comparison — debe ir antes de /:subscriberId
router.get('/comparison', getReportsComparison);

// PUT /api/subscriber-reports/:subscriberId
router.put('/:subscriberId', updateSubscriberReport);

export default router;
