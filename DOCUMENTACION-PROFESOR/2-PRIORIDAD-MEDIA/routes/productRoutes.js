import express from 'express';
import { getProducts, createProduct, updateProduct, deleteProduct, getBusinessGoals, getVendorGoals, getProductTiers, getAllTiers, createTier, updateTier, deleteTier } from '../controllers/productController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.get('/goals/business', getBusinessGoals);
router.get('/goals/vendors', getVendorGoals);
router.get('/tiers', getAllTiers);
router.get('/:id/tiers', getProductTiers);
router.post('/tiers', createTier);
router.put('/tiers/:id', updateTier);
router.delete('/tiers/:id', deleteTier);

export default router;
