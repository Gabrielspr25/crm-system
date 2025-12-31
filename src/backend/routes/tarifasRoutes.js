import express from 'express';
import multer from 'multer';
import * as tarifasController from '../controllers/tarifasController.js';

const router = express.Router();

// Configurar multer para archivos en memoria
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
    const allowedExts = ['.pdf', '.xlsx', '.xls', '.csv'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

// Parsear documento (PDF/Excel)
router.post('/parse-document', upload.single('file'), tarifasController.parseDocument);

// Estadísticas generales
router.get('/stats', tarifasController.getTarifasStats);

// Categorías
router.get('/categories', tarifasController.getCategories);

// Planes
router.get('/plans', tarifasController.getPlans);
router.get('/plans/:id', tarifasController.getPlanById);
router.post('/plans', tarifasController.createPlan);
router.put('/plans/:id', tarifasController.updatePlan);
router.delete('/plans/:id', tarifasController.deletePlan);

// Ofertas
router.get('/offers', tarifasController.getOffers);
router.post('/offers', tarifasController.createOffer);
router.put('/offers/:id', tarifasController.updateOffer);
router.delete('/offers/:id', tarifasController.deleteOffer);

// Beneficios
router.get('/benefits', tarifasController.getBenefits);
router.post('/benefits', tarifasController.createBenefit);
router.put('/benefits/:id', tarifasController.updateBenefit);
router.delete('/benefits/:id', tarifasController.deleteBenefit);

// Guías de Venta
router.get('/guides', tarifasController.getSalesGuides);
router.post('/guides', tarifasController.createSalesGuide);
router.put('/guides/:id', tarifasController.updateSalesGuide);
router.delete('/guides/:id', tarifasController.deleteSalesGuide);

// Historial
router.get('/history', tarifasController.getPlanHistory);

export default router;
