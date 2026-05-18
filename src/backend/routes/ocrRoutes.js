import express from 'express';
import multer from 'multer';
import { processOCR, previewOCR } from '../controllers/ocrController.js';

const router = express.Router();

// Configuración de multer para memoria (máximo 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Ruta para procesar imagen
router.post('/process', upload.single('image'), processOCR);

// Fase 1 — OCR Inteligente: preview con tesseract.js en Node (sin DB).
// Acepta multipart con campo "image" o "file" (cualquiera de los dos).
router.post(
  '/preview',
  upload.any(),
  (req, _res, next) => {
    if (Array.isArray(req.files) && req.files.length > 0) {
      const picked =
        req.files.find((f) => f.fieldname === 'image') ||
        req.files.find((f) => f.fieldname === 'file') ||
        req.files[0];
      req.file = picked;
    }
    next();
  },
  previewOCR
);

export default router;
