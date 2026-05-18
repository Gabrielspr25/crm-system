import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import {
    getSubscriberReports,
    getSubscriberReportsAudit,
    updateSubscriberReport,
    getReportsComparison,
    deleteSubscriberReport,
    getNeedsReviewCount
} from '../controllers/subscriberReportsController.js';

const router = express.Router();

router.use(authenticateToken);

// GET /api/subscriber-reports?month=YYYY-MM
router.get('/', getSubscriberReports);

// GET /api/subscriber-reports/comparison — debe ir antes de /:subscriberId
router.get('/comparison', getReportsComparison);

// GET /api/subscriber-reports/needs-review-count?month=YYYY-MM
router.get('/needs-review-count', getNeedsReviewCount);

// GET /api/subscriber-reports/audit
router.get('/audit', getSubscriberReportsAudit);

// PUT /api/subscriber-reports/:subscriberId
router.put('/:subscriberId', updateSubscriberReport);

// DELETE /api/subscriber-reports/:subscriberId
router.delete('/:subscriberId', deleteSubscriberReport);

export default router;
