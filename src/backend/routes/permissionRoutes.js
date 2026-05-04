import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import {
    getPermissionCatalog,
    getCurrentUserPermissions,
    getUserPermissions,
    updateUserPermissions
} from '../controllers/permissionController.js';
import {
    listPresets,
    createPreset,
    deletePreset,
    applyPresetToSalesperson,
} from '../controllers/permissionPresetController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/catalog', getPermissionCatalog);
router.get('/me', getCurrentUserPermissions);
router.get('/users/:id', requireRole(['admin', 'supervisor']), getUserPermissions);
router.put('/users/:id', requireRole(['admin', 'supervisor']), updateUserPermissions);

// Presets
router.get('/presets', requireRole(['admin', 'supervisor']), listPresets);
router.post('/presets', requireRole(['admin', 'supervisor']), createPreset);
router.delete('/presets/:id', requireRole(['admin']), deletePreset);
router.post('/presets/:id/apply-salesperson/:salespersonId', requireRole(['admin', 'supervisor']), applyPresetToSalesperson);

export default router;
