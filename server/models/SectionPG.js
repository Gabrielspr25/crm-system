const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Section = sequelize.define('Section', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Título es requerido'
      }
    }
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  type: {
    type: DataTypes.ENUM('page', 'technology', 'innovation', 'about', 'contact', 'custom'),
    defaultValue: 'custom'
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived'),
    defaultValue: 'draft'
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Campos dinámicos como JSON
  fields: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  // SEO
  seo: {
    type: DataTypes.JSONB,
    defaultValue: {
      metaTitle: '',
      metaDescription: '',
      keywords: []
    }
  },
  // Control de acceso
  visibility: {
    type: DataTypes.ENUM('public', 'private', 'password'),
    defaultValue: 'public'
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Configuración de visualización
  template: {
    type: DataTypes.STRING,
    defaultValue: 'default'
  },
  showInNav: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  parentSectionId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Sections',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  hooks: {
    beforeSave: (section) => {
      // Generar slug automáticamente si no existe
      if (!section.slug && section.title) {
        section.slug = section.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }
    }
  }
});

// Relaciones
Section.belongsTo(Section, { 
  foreignKey: 'parentSectionId', 
  as: 'parentSection' 
});
Section.hasMany(Section, { 
  foreignKey: 'parentSectionId', 
  as: 'childSections' 
});

// Métodos de instancia
Section.prototype.getFieldsByType = function(type) {
  return this.fields.filter(field => field.type === type);
};

Section.prototype.addField = async function(name, type, value, required = false) {
  const newField = { name, type, value, required };
  this.fields = [...this.fields, newField];
  return await this.save();
};

module.exports = Section;