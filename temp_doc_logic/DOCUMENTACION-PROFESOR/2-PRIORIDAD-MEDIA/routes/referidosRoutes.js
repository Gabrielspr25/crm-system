import express from 'express';
import { getReferidos, createReferido, updateReferido, deleteReferido } from '../controllers/referidosController.js';

const router = express.Router();

// La autenticación se maneja en server-FINAL.js globalmente
// router.use(authenticateToken);

router.get('/', getReferidos);
router.post('/', createReferido);
router.put('/:id', updateReferido);
router.delete('/:id', deleteReferido);

export default router;
