import express from 'express';
import * as trackingController from '../controllers/trackingController.js';

const router = express.Router();

// Tracking pixel (apertura de email)
router.get('/pixel/:recipientId', trackingController.trackPixel);

// Tracking click (redirect con registro)
router.get('/click/:recipientId', trackingController.trackClick);

export default router;
