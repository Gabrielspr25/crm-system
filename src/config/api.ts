// Configuración de API para producción
const API_CONFIG = {
  development: {
    baseURL: 'http://localhost:3001/api',
  },
  production: {
    baseURL: 'https://crmp.ss-group.cloud/api',
  }
};

export const getApiConfig = () => {
  const isDev = window.location.hostname === 'localhost';
  return isDev ? API_CONFIG.development : API_CONFIG.production;
};

export const API_BASE_URL = getApiConfig().baseURL;