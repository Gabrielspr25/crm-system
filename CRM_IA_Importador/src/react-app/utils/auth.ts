const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export const authFetch = async (endpoint: string, options: RequestInit = {}) => {
  const headers: any = { ...(options.headers||{}), Accept:"application/json" };
  // Si no es FormData, forzar JSON por defecto
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  const res = await fetch(endpoint.startsWith("http")? endpoint : `${API_BASE_URL}${endpoint}`, { ...options, headers });
  return res;
};
