const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Función para generar JWT
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Función para crear y enviar token
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  
  // Remover contraseña del output
  user.password = undefined;
  
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

// @route   POST /api/auth/register
// @desc    Registrar nuevo usuario (solo admin)
router.post('/register', protect, async (req, res) => {
  try {
    // Solo admin puede crear usuarios
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Solo administradores pueden crear usuarios'
      });
    }

    const { name, email, password, role } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'fail',
        message: 'Ya existe un usuario con este email'
      });
    }

    // Crear usuario
    const newUser = await User.create({
      name,
      email,
      password,
      role: role || 'editor'
    });

    createSendToken(newUser, 201, res);
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Iniciar sesión
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) Verificar si email y password existen
    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Por favor proporciona email y contraseña'
      });
    }

    // 2) Verificar si el usuario existe y password es correcto
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({
        status: 'fail',
        message: 'Email o contraseña incorrectos'
      });
    }

    // 3) Verificar si el usuario está activo
    if (!user.isActive) {
      return res.status(401).json({
        status: 'fail',
        message: 'Tu cuenta ha sido desactivada. Contacta al administrador.'
      });
    }

    // 4) Actualizar último login
    await user.updateLastLogin();

    // 5) Si todo está bien, enviar token
    createSendToken(user, 200, res);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Obtener usuario actual
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   PATCH /api/auth/updateMe
// @desc    Actualizar datos del usuario actual
router.patch('/updateMe', protect, async (req, res) => {
  try {
    // 1) Crear error si usuario intenta actualizar contraseña
    if (req.body.password || req.body.passwordConfirm) {
      return res.status(400).json({
        status: 'fail',
        message: 'Esta ruta no es para actualizar contraseñas. Usa /updatePassword.'
      });
    }

    // 2) Campos permitidos para actualizar
    const allowedFields = ['name', 'email'];
    const filteredBody = {};
    
    Object.keys(req.body).forEach(el => {
      if (allowedFields.includes(el)) {
        filteredBody[el] = req.body[el];
      }
    });

    // 3) Actualizar usuario
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      filteredBody,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   PATCH /api/auth/updatePassword
// @desc    Actualizar contraseña
router.patch('/updatePassword', protect, async (req, res) => {
  try {
    const { passwordCurrent, password, passwordConfirm } = req.body;

    // 1) Obtener usuario de la base de datos
    const user = await User.findById(req.user.id).select('+password');

    // 2) Verificar contraseña actual
    if (!(await user.correctPassword(passwordCurrent, user.password))) {
      return res.status(401).json({
        status: 'fail',
        message: 'Contraseña actual incorrecta'
      });
    }

    // 3) Verificar que las nuevas contraseñas coincidan
    if (password !== passwordConfirm) {
      return res.status(400).json({
        status: 'fail',
        message: 'Las contraseñas no coinciden'
      });
    }

    // 4) Actualizar contraseña
    user.password = password;
    await user.save();

    // 5) Enviar JWT
    createSendToken(user, 200, res);
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;