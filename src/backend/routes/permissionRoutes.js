import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import {
    getPermissionCatalog,
    getCurrentUserPermissions,
    getUserPermissions,
    updateUserPermissions
} from '../controllers/permissionController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/catalog', getPermissionCatalog);
router.get('/me', getCurrentUserPermissions);
router.get('/users/:id', requireRole(['admin', 'supervisor']), getUserPermissions);
router.put('/users/:id', requireRole(['admin', 'supervisor']), updateUserPermissions);

export default router;
