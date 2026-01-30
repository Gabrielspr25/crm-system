import express from 'express';
import { getReferidos, createReferido, updateReferido, deleteReferido, searchClientsBANsSubscribers, createClientQuick } from '../controllers/referidosController.js';

const router = express.Router();

// La autenticación se maneja en server-FINAL.js globalmente
// router.use(authenticateToken);

router.get('/', getReferidos);
router.post('/', createReferido);
router.put('/:id', updateReferido);
router.delete('/:id', deleteReferido);

// Nuevas rutas para búsqueda y creación rápida
router.get('/search', searchClientsBANsSubscribers);
router.post('/quick-client', createClientQuick);

export default router;
