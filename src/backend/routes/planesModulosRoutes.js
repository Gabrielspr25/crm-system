/**
 * planesModulosRoutes.js
 * Rutas para módulos de planes dinámicos (Fijos, Móviles, Inalámbrico)
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as ctrl from '../controllers/planesModulosController.js';

const router = express.Router();

// Directorio persistente — se crea si no existe al arrancar el módulo
const PDF_UPLOAD_DIR = '/opt/crmp/uploads/pdf-planes';
try { fs.mkdirSync(PDF_UPLOAD_DIR, { recursive: true }); } catch (_) {}

const upload = multer({
  dest: PDF_UPLOAD_DIR,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan archivos PDF'));
    }
  }
});

const requireAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').trim().toLowerCase();
  if (role === 'admin' || role === 'supervisor') return next();
  return res.status(403).json({ ok: false, error: 'Se requiere rol admin o supervisor.' });
};

// GET  /api/planes-modulos/admin/all     — todos los módulos (admin)
router.get('/admin/all', requireAdmin, ctrl.getAllModulosAdmin);

// GET  /api/planes-modulos/:pagina       — módulos activos de una página (público)
router.get('/:pagina', ctrl.getModulosByPagina);

// POST /api/planes-modulos               — crear módulo (admin)
router.post('/', requireAdmin, ctrl.createModulo);

// PUT  /api/planes-modulos/:id           — actualizar módulo (admin)
router.put('/:id', requireAdmin, ctrl.updateModulo);

// DELETE /api/planes-modulos/:id         — soft-delete (admin)
router.delete('/:id', requireAdmin, ctrl.deleteModulo);

// POST /api/planes-modulos/:id/upload-pdf — parsea PDF y reemplaza contenido (admin)
router.post('/:id/upload-pdf', requireAdmin, upload.single('pdf'), ctrl.uploadPdfModulo);

export default router;
