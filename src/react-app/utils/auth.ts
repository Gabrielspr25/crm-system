// ===============================================
// 🔐 AUTH UTILS - CRM PRO (versión estable 2025)
// ===============================================

// Configuración base del backend
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim() !== ""
    ? import.meta.env.VITE_API_BASE_URL
    : window.location.origin;

// Obtiene el token JWT guardado
export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem("crm_token");
  } catch {
    return null;
  }
};

// Guarda el token JWT
export const setAuthToken = (token: string): void => {
  try {
    localStorage.setItem("crm_token", token);
  } catch (err) {
    console.error("Error guardando token:", err);
  }
};

// Elimina el token (logout)
export const clearAuthToken = (): void => {
  try {
    localStorage.removeItem("crm_token");
  } catch {}
};

// ===============================================
// 🚀 authFetch - reemplazo de fetch con autenticación
// ===============================================
type AuthFetchOptions = RequestInit & {
  json?: unknown;
};

export const authFetch = async (
  endpoint: string,
  options: AuthFetchOptions = {}
): Promise<Response> => {
  const { json, ...restOptions } = options;
  const token = getAuthToken();

  const headers = new Headers(restOptions.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (json !== undefined) {
    restOptions.body = JSON.stringify(json);
    headers.set("Content-Type", "application/json");
  } else if (!(restOptions.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  const requestInit: RequestInit = { ...restOptions, headers };

  try {
    const response = await fetch(url, requestInit);

    // Si el token expiró o no es válido → intenta refrescarlo
    if (response.status === 401 && token) {
      const newToken = await refreshToken(token);
      if (newToken) {
        const retryHeaders = new Headers(headers);
        retryHeaders.set("Authorization", `Bearer ${newToken}`);
        return await fetch(url, { ...requestInit, headers: retryHeaders });
      } else {
        clearAuthToken();
      }
    }

    return response;
  } catch (err) {
    console.error("Error en authFetch:", err);
    throw err;
  }
};

// ===============================================
// 🔁 Refrescar token JWT
// ===============================================
const refreshToken = async (oldToken: string): Promise<string | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: oldToken }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data?.token) {
      setAuthToken(data.token);
      return data.token;
    }
    return null;
  } catch (err) {
    console.warn("No se pudo refrescar token:", err);
    return null;
  }
};

// ===============================================
// 🧩 Helper: login (opcional, para pruebas o integración)
// ===============================================
export const login = async (username: string, password: string) => {
  const res = await fetch(`${API_BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Credenciales inválidas");
  }

  const data = await res.json();
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
};
