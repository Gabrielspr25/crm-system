/**
 * planesModulosRoutes.js
 * Rutas para módulos de planes dinámicos (Fijos, Móviles, Inalámbrico)
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as ctrl from '../controllers/planesModulosController.js';
import * as previewCtrl from '../controllers/planesPreviewController.js';

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

// Multer para el constructor: acepta PDF y Excel
const uploadDoc = multer({
  dest: PDF_UPLOAD_DIR,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('Solo se aceptan archivos PDF o Excel'));
  }
});

// ── Constructor de Ofertas (preview + apply) ──
// POST /api/planes-modulos/preview            — sube doc, detecta tipo, devuelve diff (NO aplica)
router.post('/preview', requireAdmin, uploadDoc.single('documento'), previewCtrl.previewDocumento);
// POST /api/planes-modulos/apply/:previewId   — aplica cambios de un preview aprobado
router.post('/apply/:previewId', requireAdmin, previewCtrl.applyPreview);

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
