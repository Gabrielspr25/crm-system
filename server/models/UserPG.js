const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: {
        msg: 'Email no válido'
      }
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: {
        args: [6, 100],
        msg: 'La contraseña debe tener al menos 6 caracteres'
      }
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Nombre es requerido'
      }
    }
  },
  role: {
    type: DataTypes.ENUM('admin', 'editor', 'viewer'),
    defaultValue: 'editor'
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Permisos como JSON
  permissions: {
    type: DataTypes.JSONB,
    defaultValue: {
      canCreateSections: true,
      canEditSections: true,
      canDeleteSections: false,
      canManageUsers: false,
      canManageMedia: true,
      canPublish: false
    }
  }
}, {
  timestamps: true,
  hooks: {
    beforeSave: async (user) => {
      // Hash password si ha cambiado
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
      
      // Configurar permisos por rol
      if (user.changed('role')) {
        switch(user.role) {
          case 'admin':
            user.permissions = {
              canCreateSections: true,
              canEditSections: true,
              canDeleteSections: true,
              canManageUsers: true,
              canManageMedia: true,
              canPublish: true
            };
            break;
          case 'editor':
            user.permissions = {
              canCreateSections: true,
              canEditSections: true,
              canDeleteSections: false,
              canManageUsers: false,
              canManageMedia: true,
              canPublish: true
            };
            break;
          case 'viewer':
            user.permissions = {
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
    }
  }
});

// Métodos de instancia
User.prototype.correctPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

User.prototype.hasPermission = function(permission) {
  if (this.role === 'admin') return true;
  return this.permissions?.[permission] || false;
};

User.prototype.updateLastLogin = async function() {
  this.lastLogin = new Date();
  return await this.save();
};

module.exports = User;