import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import {
    createAgentDecision,
    createAgentMemory,
    createAgentRun,
    createAgentTask,
    getAgentDecisions,
    getAgentMemory,
    getAgentRuns,
    getAgentTasks,
    updateAgentTask
} from '../controllers/agentController.js';

const router = express.Router();

router.use(authenticateToken);

const adminOnly = requireRole(['admin', 'supervisor']);

// Memoria, decisiones y corridas: metadata operativa del Cuartel de Agentes,
// solo accesible para admin/supervisor.
router.get('/memory', adminOnly, getAgentMemory);
router.post('/memory', adminOnly, createAgentMemory);

router.get('/decisions', adminOnly, getAgentDecisions);
router.post('/decisions', adminOnly, createAgentDecision);

router.get('/runs', adminOnly, getAgentRuns);
router.post('/runs', adminOnly, createAgentRun);

// Tareas: GET filtra por rol, POST fuerza salespersonId del vendedor,
// PATCH valida dueno/admin (todo en el controller).
router.get('/tasks', getAgentTasks);
router.post('/tasks', createAgentTask);
router.patch('/tasks/:id', updateAgentTask);

export default router;
