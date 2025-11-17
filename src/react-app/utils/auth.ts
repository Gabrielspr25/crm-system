// ===============================================
// 🔐 AUTH UTILS - CRM PRO (versión estable 2025)
// ===============================================

// Configuración base del backend
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim() !== ""
    ? import.meta.env.VITE_API_BASE_URL
    : window.location.origin;

const STORAGE_KEYS = {
  accessToken: "crm_token",
  refreshToken: "crm_refresh_token",
  user: "crm_user",
} as const;

export type AuthUser = {
  userId: string | number | null;
  username: string;
  salespersonId: string | number | null;
  salespersonName: string | null;
  role: string;
};

const safeParseUser = (raw: string | null): AuthUser | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.accessToken);
  } catch {
    return null;
  }
};

export const setAuthToken = (token: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.accessToken, token);
  } catch (error) {
    console.error("Error guardando token:", error);
  }
};

const getRefreshToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.refreshToken);
  } catch {
    return null;
  }
};

const setRefreshToken = (token: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.refreshToken, token);
  } catch (error) {
    console.error("Error guardando refresh token:", error);
  }
};

const setStoredUser = (user: AuthUser): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  } catch (error) {
    console.error("Error guardando usuario:", error);
  }
};

export const getCurrentUser = (): AuthUser | null => {
  try {
    return safeParseUser(localStorage.getItem(STORAGE_KEYS.user));
  } catch {
    return null;
  }
};

export const getCurrentRole = (): string | null => {
  const role = getCurrentUser()?.role;
  return role ? role.toLowerCase() : null;
};

export const clearAuthToken = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.user);
  } catch {
    /* noop */
  }
};

export const setCurrentUser = (user: AuthUser | null): void => {
  if (!user) {
    try {
      localStorage.removeItem(STORAGE_KEYS.user);
    } catch {
      /* noop */
    }
    return;
  }
  setStoredUser(user);
};

export const logout = (): void => {
  clearAuthToken();
};

const persistSession = (options: {
  token?: string;
  refreshToken?: string;
  user?: AuthUser;
}) => {
  const { token, refreshToken, user } = options;
  if (token) {
    setAuthToken(token);
    // Disparar evento cuando se guarda el token
    window.dispatchEvent(new CustomEvent('token-updated'));
  }
  if (refreshToken) setRefreshToken(refreshToken);
  if (user) setStoredUser(user);
};

type AuthFetchOptions = RequestInit & {
  json?: unknown;
};

const refreshAuthToken = async (): Promise<string | null> => {
  const token = getRefreshToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json().catch(() => null);
    if (data?.token) {
      persistSession({
        token: data.token,
        refreshToken: data.refresh_token,
        user: data.user,
      });
      return data.token as string;
    }
    return null;
  } catch (error) {
    console.warn("No se pudo refrescar token:", error);
    return null;
  }
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

    if (response.status === 401) {
      if (token) {
        // Intentar refrescar el token
        const newToken = await refreshAuthToken();
        if (newToken) {
          const retryHeaders = new Headers(headers);
          retryHeaders.set("Authorization", `Bearer ${newToken}`);
          const retryResponse = await fetch(url, { ...requestInit, headers: retryHeaders });
          // Si el retry también falla con 401, redirigir
          if (retryResponse.status === 401) {
            clearAuthToken();
            if (!window.location.pathname.includes('/login')) {
              console.warn("⚠️ Token no pudo ser refrescado. Redirigiendo al login...");
              window.location.href = '/login';
              return retryResponse; // Retornar la respuesta pero la redirección ya está en curso
            }
          }
          return retryResponse;
        }
      }
      // Si no hay token o no se pudo refrescar, limpiar y redirigir al login
      clearAuthToken();
      // Solo redirigir si no estamos ya en la página de login
      if (!window.location.pathname.includes('/login')) {
        console.warn("⚠️ Token inválido o expirado. No hay token en localStorage. Redirigiendo al login...");
        // Mostrar mensaje más claro al usuario
        if (typeof window !== 'undefined' && window.localStorage) {
          const hadToken = !!localStorage.getItem('crm_token');
          if (!hadToken) {
            console.warn("💡 Solución: Inicia sesión nuevamente para obtener un nuevo token.");
          }
        }
        window.location.href = '/login';
      }
    }

    return response;
  } catch (error) {
    console.error("Error en authFetch:", error);
    throw error;
  }
};

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
  if (data?.token) {
    persistSession({
      token: data.token,
      refreshToken: data.refresh_token,
      user: data.user,
    });
    // Disparar evento para que los hooks sepan que hay un nuevo token
    window.dispatchEvent(new CustomEvent('token-updated'));
  }
  return data;
};
