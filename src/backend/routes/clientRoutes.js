import express from 'express';
import { getClients, getClientById, createClient, updateClient, mergeClients, searchClients, checkDuplicateClient, markClientChecked } from '../controllers/clientController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/merge', mergeClients);
router.get('/search', searchClients);
router.get('/check-duplicate', checkDuplicateClient);
router.get('/', getClients);
router.get('/:id', getClientById);
router.patch('/:id/mark-checked', markClientChecked);
router.post('/', createClient);
router.put('/:id', updateClient);

export default router;
