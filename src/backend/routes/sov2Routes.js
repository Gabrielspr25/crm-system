import express from 'express';
import { authenticateToken } from '../middlewares/auth.js';
import {
  getSov2Opportunities,
  getSov2Metrics,
  getSov2OpportunityById,
  getSov2OpportunityNotes,
  createSov2OpportunityNote,
  updateSov2Opportunity,
  updateSov2OpportunityLine,
  updateSov2OpportunityProductValue,
  updateSov2OpportunityStep,
  getSov2Products,
  getSov2ProductSteps,
  createSov2Opportunity,
  createSov2OpportunityFromClient,
} from '../controllers/sov2Controller.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/opportunities', getSov2Opportunities);
router.post('/opportunities', createSov2Opportunity);
router.post('/opportunities/from-client', createSov2OpportunityFromClient);
router.get('/metrics', getSov2Metrics);
router.get('/opportunities/:id', getSov2OpportunityById);
router.get('/opportunities/:id/notes', getSov2OpportunityNotes);
router.post('/opportunities/:id/notes', createSov2OpportunityNote);
router.patch('/opportunities/:id', updateSov2Opportunity);
router.patch('/opportunities/:id/products/:productKey', updateSov2OpportunityProductValue);
router.patch('/opportunities/:id/lines/:lineId', updateSov2OpportunityLine);
router.patch('/opportunities/:id/steps/:stepId', updateSov2OpportunityStep);

router.get('/products', getSov2Products);
router.get('/products/:productKey/steps', getSov2ProductSteps);

export default router;
