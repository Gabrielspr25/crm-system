import express from 'express';
import { getVendors } from '../controllers/vendorController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getVendors);

export default router;
