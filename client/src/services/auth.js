import api from './api';

// Autenticación
export const login = async (email, password) => {
  return await api.post('/auth/login', { email, password });
};

export const getCurrentUser = async () => {
  return await api.get('/auth/me');
};

export const updateProfile = async (userData) => {
  return await api.patch('/auth/updateMe', userData);
};

export const updatePassword = async (passwordData) => {
  return await api.patch('/auth/updatePassword', passwordData);
};

export const register = async (userData) => {
  return await api.post('/auth/register', userData);
};