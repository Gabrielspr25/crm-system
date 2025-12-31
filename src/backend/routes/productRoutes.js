import { getProducts, createProduct, updateProduct, deleteProduct, getBusinessGoals, getVendorGoals } from '../controllers/productController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.get('/goals/business', getBusinessGoals);
router.get('/goals/vendors', getVendorGoals);

export default router;
