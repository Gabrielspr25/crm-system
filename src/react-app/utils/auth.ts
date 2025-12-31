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
  const requestInit: RequestInit = { ...restOptions, headers, timeout: 30000 };

  try {
    const response = await fetch(url, requestInit);

    if (response.status === 401) {
      if (token) {
        // Intentar refrescar el token UNA SOLA VEZ
        console.log("🔄 Token expirado, intentando refrescar...");
        const newToken = await refreshAuthToken();
        if (newToken) {
          console.log("✅ Token refrescado exitosamente");
          const retryHeaders = new Headers(headers);
          retryHeaders.set("Authorization", `Bearer ${newToken}`);
          const retryResponse = await fetch(url, { ...requestInit, headers: retryHeaders });
          
          // Si el retry también falla con 401, logout definitivo
          if (retryResponse.status === 401) {
            console.error("❌ La solicitud falló después de refrescar. Token inválido.");
            clearAuthToken();
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login?reason=token_invalid';
            }
            return retryResponse;
          }
          return retryResponse;
        } else {
          console.warn("⚠️ No se pudo refrescar el token. Refresh token probablemente expirado.");
          clearAuthToken();
          if (!window.location.pathname.includes('/login')) {
            // Mostrar error amigable
            window.location.href = '/login?reason=session_expired';
          }
        }
      }
      
      // Sin token original
      clearAuthToken();
      if (!window.location.pathname.includes('/login')) {
        console.warn("⚠️ No hay token. Redirigiendo al login...");
        window.location.href = '/login?reason=no_token';
      }
    }

    return response;
  } catch (error) {
    // Manejar errores de conexión/timeout
    if (error instanceof TypeError) {
      console.error("❌ Error de conexión:", error.message);
      // Esto podría ser un timeout o desconexión de red
      clearAuthToken();
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?reason=connection_error';
      }
    }
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
