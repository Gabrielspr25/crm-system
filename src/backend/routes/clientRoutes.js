import express from 'express';
import { getClients, getClientById, createClient, updateClient } from '../controllers/clientController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getClients);
router.get('/:id', getClientById);
router.post('/', createClient);
router.put('/:id', updateClient);

export default router;
