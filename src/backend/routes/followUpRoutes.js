import express from 'express';
import { getFollowUpProspects, createFollowUpProspect, updateFollowUpProspect, getFollowUpSteps, returnFollowUpProspect, getFollowUpNotes, createFollowUpNote } from '../controllers/followUpController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getFollowUpProspects);
router.get('/steps', getFollowUpSteps);
router.get('/:id/notes', getFollowUpNotes);
router.post('/:id/notes', createFollowUpNote);
router.post('/', createFollowUpProspect);
router.put('/:id', updateFollowUpProspect);
router.put('/:id/return', returnFollowUpProspect);

export default router;
