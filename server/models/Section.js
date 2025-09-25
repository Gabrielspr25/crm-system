const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  type: {
    type: String,
    enum: ['page', 'technology', 'innovation', 'about', 'contact', 'custom'],
    default: 'custom'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  order: {
    type: Number,
    default: 0
  },
  // Campos dinámicos que pueden variar por sección
  fields: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['text', 'richtext', 'image', 'video', 'media', 'gallery'],
      required: true
    },
    value: mongoose.Schema.Types.Mixed,
    required: {
      type: Boolean,
      default: false
    }
  }],
  // SEO
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  },
  // Control de acceso
  visibility: {
    type: String,
    enum: ['public', 'private', 'password'],
    default: 'public'
  },
  password: String,
  // Configuración de visualización
  template: {
    type: String,
    default: 'default'
  },
  showInNav: {
    type: Boolean,
    default: true
  },
  parentSection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  }
}, {
  timestamps: true
});

// Índices para optimizar búsquedas
sectionSchema.index({ slug: 1 });
sectionSchema.index({ type: 1, status: 1 });
sectionSchema.index({ order: 1 });

// Middleware para generar slug automáticamente
sectionSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Método para obtener campos por tipo
sectionSchema.methods.getFieldsByType = function(type) {
  return this.fields.filter(field => field.type === type);
};

// Método para agregar campo dinámico
sectionSchema.methods.addField = function(name, type, value, required = false) {
  this.fields.push({ name, type, value, required });
  return this.save();
};

module.exports = mongoose.model('Section', sectionSchema);