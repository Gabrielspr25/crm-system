// ===============================================
// AUTH UTILS - CRM PRO
// ===============================================

const defaultApiBaseUrl = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : window.location.origin;

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim() !== ""
    ? import.meta.env.VITE_API_BASE_URL
    : defaultApiBaseUrl;

const STORAGE_KEYS = {
  accessToken: "crm_token",
  refreshToken: "crm_refresh_token",
  user: "crm_user",
} as const;

const emitAuthStateChanged = (): void => {
  try {
    window.dispatchEvent(new CustomEvent("token-updated"));
  } catch {
    // noop
  }
};

const tokenHasExpiration = (token: string | null): boolean => {
  if (!token) return false;
  try {
    const [, payload] = token.split(".");
    if (!payload) return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded));
    return typeof decoded?.exp === "number";
  } catch {
    return false;
  }
};

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
    localStorage.removeItem("crm_permissions_snapshot");
    localStorage.removeItem("crm_permissions_catalog");
  } catch {
    // noop
  }
  emitAuthStateChanged();
};

export const setCurrentUser = (user: AuthUser | null): void => {
  if (!user) {
    try {
      localStorage.removeItem(STORAGE_KEYS.user);
    } catch {
      // noop
    }
    emitAuthStateChanged();
    return;
  }
  setStoredUser(user);
  emitAuthStateChanged();
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
  }
  if (refreshToken) setRefreshToken(refreshToken);
  if (user) setStoredUser(user);
  emitAuthStateChanged();
};

type AuthFetchOptions = RequestInit & {
  json?: unknown;
};

const tryJsonFetch = async (
  paths: string[],
  options: {
    method?: string;
    json?: unknown;
    headers?: Record<string, string>;
  } = {}
) => {
  let lastResponse: Response | null = null;
  let lastPayload: any = null;
  let lastPath = paths[paths.length - 1] || "";

  for (const path of paths) {
    lastPath = path;

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    let body: string | undefined;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body,
    });

    const payload = await response.json().catch(() => ({}));

    if (response.ok) {
      return { response, payload, path };
    }

    lastResponse = response;
    lastPayload = payload;

    const errorText = String(payload?.error || "").toLowerCase();
    const looksLikeWrongRoute =
      response.status === 404 ||
      errorText.includes("token no proporcionado") ||
      errorText.includes("token requerido") ||
      errorText.includes("ruta");

    if (!looksLikeWrongRoute) {
      break;
    }
  }

  return { response: lastResponse, payload: lastPayload, path: lastPath };
};

const refreshAuthToken = async (): Promise<string | null> => {
  const token = getRefreshToken();
  if (!token) return null;

  try {
    const { response, payload } = await tryJsonFetch(
      ["/api/token/refresh", "/api/auth/refresh-token"],
      {
        method: "POST",
        json: { refresh_token: token },
      }
    );

    if (!response?.ok) {
      return null;
    }

    if (payload?.token) {
      persistSession({
        token: payload.token,
        refreshToken: payload.refresh_token,
        user: payload.user,
      });
      return payload.token as string;
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
        if (!tokenHasExpiration(token)) {
          console.warn("401 recibido con token persistente. No se cierra sesion automaticamente.");
          return response;
        }

        console.log("Token expirado, intentando refrescar...");
        const newToken = await refreshAuthToken();
        if (newToken) {
          console.log("Token refrescado exitosamente");
          const retryHeaders = new Headers(headers);
          retryHeaders.set("Authorization", `Bearer ${newToken}`);
          const retryResponse = await fetch(url, { ...requestInit, headers: retryHeaders });

          if (retryResponse.status === 401) {
            console.error("La solicitud fallo despues de refrescar. Token invalido.");
            clearAuthToken();
            if (!window.location.pathname.includes("/login")) {
              window.location.href = "/login?reason=token_invalid";
            }
            return retryResponse;
          }
          return retryResponse;
        }

        console.warn("No se pudo refrescar el token. Refresh token probablemente expirado.");
        clearAuthToken();
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/login?reason=session_expired";
        }
      }

      clearAuthToken();
      if (!window.location.pathname.includes("/login")) {
        console.warn("No hay token. Redirigiendo al login...");
        window.location.href = "/login?reason=no_token";
      }
    }

    return response;
  } catch (error) {
    if (error instanceof TypeError) {
      console.error("Error de conexion:", error.message);
      clearAuthToken();
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login?reason=connection_error";
      }
    }
    console.error("Error en authFetch:", error);
    throw error;
  }
};

export const devAdminLogin = async () => {
  const { response, payload } = await tryJsonFetch(
    ["/api/auth/dev-admin"],
    { method: "POST" }
  );

  if (!response?.ok) {
    throw new Error("Dev login failed");
  }

  if (payload?.token) {
    persistSession({
      token: payload.token,
      user: payload.user,
    });
  }
  return payload;
};

export const login = async (username: string, password: string) => {
  const { response, payload } = await tryJsonFetch(
    ["/api/login", "/api/auth/login"],
    {
      method: "POST",
      json: { username, password },
    }
  );

  if (!response?.ok) {
    const rawError = String(payload?.error || "").trim();
    if (
      rawError.toLowerCase().includes("token no proporcionado") ||
      rawError.toLowerCase().includes("token requerido")
    ) {
      throw new Error("El servicio de login esta mal configurado. El usuario no deberia ver un error de token aqui.");
    }
    throw new Error(rawError || "Credenciales invalidas");
  }

  if (payload?.token) {
    persistSession({
      token: payload.token,
      refreshToken: payload.refresh_token,
      user: payload.user,
    });
  }
  return payload;
};
