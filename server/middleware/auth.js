const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    // 1) Obtener token del header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'fail',
        message: 'No estás logueado. Por favor inicia sesión para acceder.'
      });
    }

    // 2) Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Verificar si el usuario existe
    const currentUser = await User.findById(decoded.id).select('+password');
    if (!currentUser) {
      return res.status(401).json({
        status: 'fail',
        message: 'El usuario ya no existe.'
      });
    }

    // 4) Verificar si el usuario está activo
    if (!currentUser.isActive) {
      return res.status(401).json({
        status: 'fail',
        message: 'Tu cuenta ha sido desactivada. Contacta al administrador.'
      });
    }

    // 5) Agregar usuario a la request
    req.user = currentUser;
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'fail',
      message: 'Token inválido. Por favor inicia sesión nuevamente.'
    });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: 'No tienes permisos para realizar esta acción.'
      });
    }
    next();
  };
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user.hasPermission(permission)) {
      return res.status(403).json({
        status: 'fail',
        message: `No tienes el permiso requerido: ${permission}`
      });
    }
    next();
  };
};

module.exports = {
  protect,
  restrictTo,
  requirePermission
};