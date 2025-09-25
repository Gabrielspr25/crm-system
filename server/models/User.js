const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email es requerido'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Email no válido']
  },
  password: {
    type: String,
    required: [true, 'Contraseña es requerida'],
    minlength: 6,
    select: false
  },
  name: {
    type: String,
    required: [true, 'Nombre es requerido'],
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'editor', 'viewer'],
    default: 'editor'
  },
  avatar: String,
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  // Permisos específicos
  permissions: {
    canCreateSections: {
      type: Boolean,
      default: true
    },
    canEditSections: {
      type: Boolean,
      default: true
    },
    canDeleteSections: {
      type: Boolean,
      default: false
    },
    canManageUsers: {
      type: Boolean,
      default: false
    },
    canManageMedia: {
      type: Boolean,
      default: true
    },
    canPublish: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Índices
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

// Middleware para hashear contraseña antes de guardar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Método para verificar contraseña
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Método para verificar permisos
userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'admin') return true;
  return this.permissions[permission] || false;
};

// Método para actualizar último login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

// Virtual para nombre completo (si se implementa firstName/lastName después)
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// Configurar permisos por rol
userSchema.pre('save', function(next) {
  if (this.isModified('role')) {
    switch(this.role) {
      case 'admin':
        this.permissions = {
          canCreateSections: true,
          canEditSections: true,
          canDeleteSections: true,
          canManageUsers: true,
          canManageMedia: true,
          canPublish: true
        };
        break;
      case 'editor':
        this.permissions = {
          canCreateSections: true,
          canEditSections: true,
          canDeleteSections: false,
          canManageUsers: false,
          canManageMedia: true,
          canPublish: true
        };
        break;
      case 'viewer':
        this.permissions = {
          canCreateSections: false,
          canEditSections: false,
          canDeleteSections: false,
          canManageUsers: false,
          canManageMedia: false,
          canPublish: false
        };
        break;
    }
  }
  next();
});

module.exports = mongoose.model('User', userSchema);