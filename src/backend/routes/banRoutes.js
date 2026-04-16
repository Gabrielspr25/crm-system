import express from 'express';
import { getBans, createBan, updateBan, deleteBan } from '../controllers/banController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getBans);
router.post('/', createBan);
router.put('/:id', updateBan);
router.delete('/:id', deleteBan);

export default router;
