import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import {
    getConfig,
    patchConfig,
    getLogs,
} from '../controllers/tangoSyncController.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/config',  getConfig);
router.patch('/config', patchConfig);
router.get('/logs',    getLogs);

export default router;
