import express from 'express';
import { login, refreshToken, devAdminLogin, getMe } from '../controllers/authController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/dev-admin', devAdminLogin);
router.post('/refresh-token', refreshToken);
router.get('/me', authenticateToken, getMe);

export default router;
