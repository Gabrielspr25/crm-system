import express from 'express';
import multer from 'multer';
import { processOCR } from '../controllers/ocrController.js';

const router = express.Router();

// Configuración de multer para memoria (máximo 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Ruta para procesar imagen
router.post('/process', upload.single('image'), processOCR);

export default router;
