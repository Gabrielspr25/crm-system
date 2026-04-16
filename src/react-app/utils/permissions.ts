import { authFetch, getCurrentUser, type AuthUser } from "@/react-app/utils/auth";
import {
  PERMISSION_CATALOG,
  normalizePermissionKey,
  roleHasDefaultPermission,
} from "@/shared/permissionCatalog";

type PermissionCatalogItem = (typeof PERMISSION_CATALOG)[number];

export type PermissionEffect = "allow" | "deny" | "inherit";

export type PermissionOverrideEntry = {
  effect: PermissionEffect;
  updated_at?: string | null;
  updated_by?: string | null;
};

export type PermissionDecision = {
  allowed: boolean;
  source: "role" | "override";
  effect: PermissionEffect;
  role_default: boolean;
};

export type PermissionSnapshot = {
  user_id: string | null;
  role: string;
  overrides: Record<string, PermissionOverrideEntry>;
  permissions: Record<string, PermissionDecision>;
  loaded_at?: string;
};

export type PermissionCatalogResponse = {
  permissions: PermissionCatalogItem[];
  grouped: Record<string, PermissionCatalogItem[]>;
};

const STORAGE_KEYS = {
  snapshot: "crm_permissions_snapshot",
  catalog: "crm_permissions_catalog",
} as const;

const emitPermissionsUpdated = () => {
  try {
    window.dispatchEvent(new CustomEvent("permissions-updated"));
  } catch {
    // noop
  }
};

const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const getStoredPermissionSnapshot = (): PermissionSnapshot | null => {
  try {
    return parseJson<PermissionSnapshot>(localStorage.getItem(STORAGE_KEYS.snapshot));
  } catch {
    return null;
  }
};

export const setStoredPermissionSnapshot = (snapshot: PermissionSnapshot | null): void => {
  try {
    if (!snapshot) {
      localStorage.removeItem(STORAGE_KEYS.snapshot);
    } else {
      localStorage.setItem(STORAGE_KEYS.snapshot, JSON.stringify(snapshot));
    }
  } catch {
    // noop
  }
  emitPermissionsUpdated();
};

export const getStoredPermissionCatalog = (): PermissionCatalogResponse | null => {
  try {
    return parseJson<PermissionCatalogResponse>(localStorage.getItem(STORAGE_KEYS.catalog));
  } catch {
    return null;
  }
};

export const setStoredPermissionCatalog = (catalog: PermissionCatalogResponse | null): void => {
  try {
    if (!catalog) {
      localStorage.removeItem(STORAGE_KEYS.catalog);
    } else {
      localStorage.setItem(STORAGE_KEYS.catalog, JSON.stringify(catalog));
    }
  } catch {
    // noop
  }
  emitPermissionsUpdated();
};

export const clearStoredPermissions = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.snapshot);
    localStorage.removeItem(STORAGE_KEYS.catalog);
  } catch {
    // noop
  }
  emitPermissionsUpdated();
};

export const fetchPermissionCatalog = async (force = false): Promise<PermissionCatalogResponse> => {
  const cached = getStoredPermissionCatalog();
  if (cached && !force) {
    return cached;
  }

  const response = await authFetch("/api/permissions/catalog");
  if (!response.ok) {
    throw new Error("No se pudo cargar el catalogo de permisos");
  }

  const payload = (await response.json()) as PermissionCatalogResponse;
  setStoredPermissionCatalog(payload);
  return payload;
};

export const syncPermissionsFromServer = async (): Promise<PermissionSnapshot> => {
  const response = await authFetch("/api/permissions/me");
  if (!response.ok) {
    throw new Error("No se pudieron sincronizar los permisos");
  }

  const payload = (await response.json()) as PermissionSnapshot;
  const snapshot: PermissionSnapshot = {
    ...payload,
    loaded_at: new Date().toISOString(),
  };
  setStoredPermissionSnapshot(snapshot);
  return snapshot;
};

export const isPermissionAllowed = (
  permissionKey: string,
  user: AuthUser | null = getCurrentUser(),
  snapshot: PermissionSnapshot | null = getStoredPermissionSnapshot()
): boolean => {
  const normalizedKey = normalizePermissionKey(permissionKey);
  const userId = String(user?.userId || "").trim();
  const role = String(user?.role || "").trim().toLowerCase();

  if (!normalizedKey) return false;

  if (snapshot?.permissions) {
    const snapshotUserId = String(snapshot.user_id || "").trim();
    const canUseSnapshot = !snapshotUserId || !userId || snapshotUserId === userId;
    if (canUseSnapshot && snapshot.permissions[normalizedKey]) {
      return Boolean(snapshot.permissions[normalizedKey]?.allowed);
    }
  }

  return roleHasDefaultPermission(role, normalizedKey);
};

export const resolvePermissionDecision = (
  permissionKey: string,
  role: string,
  effect: PermissionEffect
): PermissionDecision => {
  const normalizedKey = normalizePermissionKey(permissionKey);
  const roleDefault = roleHasDefaultPermission(role, normalizedKey);
  const normalizedEffect: PermissionEffect =
    effect === "allow" || effect === "deny" || effect === "inherit" ? effect : "inherit";

  const allowed =
    normalizedEffect === "allow"
      ? true
      : normalizedEffect === "deny"
        ? false
        : roleDefault;

  return {
    allowed,
    source: normalizedEffect === "inherit" ? "role" : "override",
    effect: normalizedEffect,
    role_default: roleDefault,
  };
};
