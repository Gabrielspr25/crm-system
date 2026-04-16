import express from 'express';
import multer from 'multer';
import { getSubscribers, createSubscriber, updateSubscriber, cancelSubscriber, reactivateSubscriber, markNoRenewNow, markPendingRenewal, renewSubscriber, pasteSync, extractImageFiltered as extractImage } from '../controllers/subscriberController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticateToken);

router.get('/', getSubscribers);
router.post('/', createSubscriber);
router.put('/:id', updateSubscriber);
router.put('/:id/cancel', cancelSubscriber);
router.put('/:id/reactivate', reactivateSubscriber);
router.put('/:id/no-renueva-ahora', markNoRenewNow);
router.put('/:id/pending-renewal', markPendingRenewal);
router.put('/:id/renewal', renewSubscriber);
router.post('/extract-image', upload.single('file'), extractImage);
router.post('/paste-sync', pasteSync);

export default router;
