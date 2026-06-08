/**
 * planesModulosRoutes.js
 * Rutas para módulos de planes dinámicos (Fijos, Móviles, Inalámbrico)
 */

import express from 'express';
import * as ctrl from '../controllers/planesModulosController.js';

const router = express.Router();

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

export default router;
