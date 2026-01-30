import express from 'express';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/userController.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

// Todas las rutas de usuarios requieren autenticación y rol de admin o supervisor
// (Ajustar según reglas de negocio, aquí asumo que solo admin/supervisor gestionan usuarios)
router.use(authenticateToken);
router.use(requireRole(['admin', 'supervisor']));

router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
