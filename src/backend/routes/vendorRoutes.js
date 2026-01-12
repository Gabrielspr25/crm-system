import express from 'express';
import { getVendors, createVendor, updateVendor, deleteVendor } from '../controllers/vendorController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getVendors);
router.post('/', createVendor);
router.put('/:id', updateVendor);
router.delete('/:id', deleteVendor);

export default router;
