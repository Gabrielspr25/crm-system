import express from 'express';
import { getFollowUpProspects, createFollowUpProspect, updateFollowUpProspect } from '../controllers/followUpController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getFollowUpProspects);
router.post('/', createFollowUpProspect);
router.put('/:id', updateFollowUpProspect);

export default router;
