/**
 * equiposListaRoutes.js
 * Rutas para la Lista de Precios de Equipos PYMES/CORP
 */

import express from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/equiposListaController.js';

const router = express.Router();

const requireEquiposAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').trim().toLowerCase();
  if (role === 'admin' || role === 'supervisor') return next();
  return res.status(403).json({ ok: false, error: 'No tienes permisos para administrar la lista de equipos.' });
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan archivos Excel (.xlsx / .xls)'));
    }
  },
});

// GET /api/equipos-lista          — todos los equipos activos (público)
router.get('/', ctrl.getEquipos);

// GET /api/equipos-lista/uploads  — historial de uploads (admin)
router.get('/uploads', requireEquiposAdmin, ctrl.getUploads);

// POST /api/equipos-lista/preview — preview sin guardar (admin)
router.post('/preview', requireEquiposAdmin, upload.single('file'), ctrl.previewUpload);

// POST /api/equipos-lista/upload  — subir y aplicar lista (admin)
router.post('/upload', requireEquiposAdmin, upload.single('file'), ctrl.uploadLista);

export default router;
