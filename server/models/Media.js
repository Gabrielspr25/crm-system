const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true
  },
  filename: {
    type: String,
    required: true,
    unique: true
  },
  path: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video', 'document', 'audio'],
    required: true
  },
  // Para imágenes
  dimensions: {
    width: Number,
    height: Number
  },
  thumbnails: [{
    size: String, // 'small', 'medium', 'large'
    path: String,
    width: Number,
    height: Number
  }],
  // Metadatos adicionales
  alt: String,
  title: String,
  caption: String,
  description: String,
  // Asociaciones
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  },
  fieldName: String, // Nombre del campo al que pertenece
  // Control de acceso
  isPublic: {
    type: Boolean,
    default: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Índices
mediaSchema.index({ type: 1 });
mediaSchema.index({ sectionId: 1 });
mediaSchema.index({ uploadedBy: 1 });
mediaSchema.index({ filename: 1 });

// Virtual para URL completa
mediaSchema.virtual('url').get(function() {
  return `/uploads/${this.filename}`;
});

// Método para obtener thumbnail
mediaSchema.methods.getThumbnail = function(size = 'medium') {
  const thumbnail = this.thumbnails.find(thumb => thumb.size === size);
  return thumbnail ? `/uploads/thumbnails/${thumbnail.path}` : this.url;
};

// Método estático para validar tipo de archivo
mediaSchema.statics.getFileType = function(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'document';
};

module.exports = mongoose.model('Media', mediaSchema);