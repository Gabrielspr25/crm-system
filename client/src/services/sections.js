import api from './api';

// Obtener todas las secciones
export const getSections = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return await api.get(`/sections?${query}`);
};

// Obtener secciones públicas
export const getPublicSections = async () => {
  return await api.get('/sections/public');
};

// Obtener sección por ID
export const getSectionById = async (id) => {
  return await api.get(`/sections/${id}`);
};

// Obtener sección por slug
export const getSectionBySlug = async (slug) => {
  return await api.get(`/sections/slug/${slug}`);
};

// Crear nueva sección
export const createSection = async (sectionData) => {
  return await api.post('/sections', sectionData);
};

// Actualizar sección
export const updateSection = async (id, sectionData) => {
  return await api.patch(`/sections/${id}`, sectionData);
};

// Eliminar sección
export const deleteSection = async (id) => {
  return await api.delete(`/sections/${id}`);
};

// Publicar/despublicar sección
export const toggleSectionStatus = async (id, status) => {
  return await api.patch(`/sections/${id}/publish`, { status });
};

// Agregar campo dinámico a sección
export const addSectionField = async (id, fieldData) => {
  return await api.post(`/sections/${id}/fields`, fieldData);
};

// Reordenar secciones
export const reorderSections = async (sections) => {
  return await api.patch('/sections/reorder', { sections });
};