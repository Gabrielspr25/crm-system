import express from 'express';
import {
  createDeal,
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  getClientDeals,
  getDeals,
  getDealTasks,
  getPanelTasks,
  getSalespeople,
  getWorkflowTemplates,
  updateDealTaskStatus,
  updateWorkflowTemplate,
  syncClientDealsFromProspect
} from '../controllers/dealWorkflowController.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/salespeople', getSalespeople);

router.get('/workflow-templates', getWorkflowTemplates);
router.post('/workflow-templates', requireRole(['admin', 'supervisor']), createWorkflowTemplate);
router.put('/workflow-templates/:id', requireRole(['admin', 'supervisor']), updateWorkflowTemplate);
router.delete('/workflow-templates/:id', requireRole(['admin', 'supervisor']), deleteWorkflowTemplate);

router.get('/deals', getDeals);
router.post('/deals', createDeal);
router.get('/clients/:id/deals', getClientDeals);

router.get('/deal-tasks', getDealTasks);
router.patch('/deal-tasks/:id', updateDealTaskStatus);

// Sync deals from prospect
router.post('/clients/:clientId/sync', syncClientDealsFromProspect);

// Panel general tasks
router.get('/panel/tasks', getPanelTasks);

export default router;
