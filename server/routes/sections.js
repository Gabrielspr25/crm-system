const express = require('express');
const Section = require('../models/Section');
const { protect, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Middleware para proteger todas las rutas
router.use(protect);

// @route   GET /api/sections
// @desc    Obtener todas las secciones
router.get('/', async (req, res) => {
  try {
    const { type, status, page = 1, limit = 10 } = req.query;
    
    // Filtros
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    // Paginación
    const skip = (page - 1) * limit;

    const sections = await Section.find(filter)
      .populate('parentSection', 'title slug')
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Section.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      results: sections.length,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: {
        sections
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/sections/public
// @desc    Obtener secciones públicas (sin autenticación)
router.get('/public', (req, res, next) => {
  // Remover middleware de protección para esta ruta
  req.skipAuth = true;
  next();
}, async (req, res) => {
  try {
    const sections = await Section.find({ 
      status: 'published',
      visibility: 'public',
      showInNav: true
    })
    .select('-fields.value') // No mostrar contenido completo
    .sort({ order: 1 });

    res.status(200).json({
      status: 'success',
      data: {
        sections
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/sections/:id
// @desc    Obtener sección por ID
router.get('/:id', async (req, res) => {
  try {
    const section = await Section.findById(req.params.id)
      .populate('parentSection', 'title slug');

    if (!section) {
      return res.status(404).json({
        status: 'fail',
        message: 'Sección no encontrada'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        section
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/sections/slug/:slug
// @desc    Obtener sección por slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const section = await Section.findOne({ slug: req.params.slug })
      .populate('parentSection', 'title slug');

    if (!section) {
      return res.status(404).json({
        status: 'fail',
        message: 'Sección no encontrada'
      });
    }

    // Verificar acceso
    if (section.visibility === 'private' && req.user.role === 'viewer') {
      return res.status(403).json({
        status: 'fail',
        message: 'No tienes acceso a esta sección'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        section
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   POST /api/sections
// @desc    Crear nueva sección
router.post('/', requirePermission('canCreateSections'), async (req, res) => {
  try {
    const newSection = await Section.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        section: newSection
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   PATCH /api/sections/:id
// @desc    Actualizar sección
router.patch('/:id', requirePermission('canEditSections'), async (req, res) => {
  try {
    const section = await Section.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!section) {
      return res.status(404).json({
        status: 'fail',
        message: 'Sección no encontrada'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        section
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   DELETE /api/sections/:id
// @desc    Eliminar sección
router.delete('/:id', requirePermission('canDeleteSections'), async (req, res) => {
  try {
    const section = await Section.findByIdAndDelete(req.params.id);

    if (!section) {
      return res.status(404).json({
        status: 'fail',
        message: 'Sección no encontrada'
      });
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   PATCH /api/sections/:id/publish
// @desc    Publicar/despublicar sección
router.patch('/:id/publish', requirePermission('canPublish'), async (req, res) => {
  try {
    const { status } = req.body; // 'published' o 'draft'
    
    const section = await Section.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!section) {
      return res.status(404).json({
        status: 'fail',
        message: 'Sección no encontrada'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        section
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   POST /api/sections/:id/fields
// @desc    Agregar campo dinámico a una sección
router.post('/:id/fields', requirePermission('canEditSections'), async (req, res) => {
  try {
    const { name, type, value, required } = req.body;
    
    const section = await Section.findById(req.params.id);
    
    if (!section) {
      return res.status(404).json({
        status: 'fail',
        message: 'Sección no encontrada'
      });
    }

    await section.addField(name, type, value, required);

    res.status(200).json({
      status: 'success',
      data: {
        section
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   PATCH /api/sections/reorder
// @desc    Reordenar secciones
router.patch('/reorder', requirePermission('canEditSections'), async (req, res) => {
  try {
    const { sections } = req.body; // Array de { id, order }

    // Actualizar orden de cada sección
    const updatePromises = sections.map(({ id, order }) => 
      Section.findByIdAndUpdate(id, { order })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      status: 'success',
      message: 'Orden actualizado correctamente'
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;