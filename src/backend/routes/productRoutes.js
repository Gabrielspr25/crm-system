import express from 'express';
import { getProducts, getBusinessGoals, getVendorGoals } from '../controllers/productController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getProducts);
router.get('/goals/business', getBusinessGoals);
router.get('/goals/vendors', getVendorGoals);

export default router;
