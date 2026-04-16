import { useEffect, useMemo, useState } from "react";
import { KeyRound, RefreshCw, Save, Search, Shield, UserRound } from "lucide-react";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";
import {
  fetchPermissionCatalog,
  isPermissionAllowed,
  resolvePermissionDecision,
  syncPermissionsFromServer,
  type PermissionCatalogResponse,
  type PermissionEffect,
} from "@/react-app/utils/permissions";

type UserRecord = {
  id: string;
  username: string;
  salesperson_id?: string | null;
  salesperson_name?: string | null;
  role: string;
  created_at?: string | null;
  last_login?: string | null;
  permission_overrides_count?: number;
};

type UserPermissionPayload = {
  user: {
    userId: string;
    username: string;
    salespersonId?: string | null;
    salespersonName?: string | null;
    role: string;
  };
  overrides: Record<string, { effect: PermissionEffect }>;
  permissions: Record<string, { allowed: boolean; source: "role" | "override"; effect: PermissionEffect; role_default: boolean }>;
};

const MODULE_TITLES: Record<string, string> = {
  navigation: "Navegacion",
  tasks: "Tareas",
  clients: "Clientes",
  followup: "Seguimiento",
  emails: "Correos",
  campaigns: "Campanas",
  vendors: "Vendedores",
  products: "Productos",
  categories: "Categorias",
  goals: "Metas",
  reports: "Comisiones",
  cognos: "Cognos",
  importer: "Importador",
  tango: "Tango",
  audit: "Historial",
  profile: "Perfil",
  users: "Usuarios y Permisos",
  security: "Control y Seguridad",
};

const EFFECT_OPTIONS: Array<{ value: PermissionEffect; label: string }> = [
  { value: "inherit", label: "Heredar" },
  { value: "allow", label: "Permitir" },
  { value: "deny", label: "Bloquear" },
];

const formatDate = (value?: string | null) => {
  if (!value) return "Nunca";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Nunca";
  return parsed.toLocaleString();
};

export default function UsersPermissionsPage() {
  const currentUser = getCurrentUser();
  const canViewPage = isPermissionAllowed("nav.users_permissions", currentUser);
  const canManageOverrides = isPermissionAllowed("users.permissions.manage", currentUser);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogResponse | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [draftEffects, setDraftEffects] = useState<Record<string, PermissionEffect>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedUser = useMemo(
    () => users.find((user) => String(user.id) === String(selectedUserId)) || null,
    [users, selectedUserId]
  );

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => {
      const username = String(user.username || "").toLowerCase();
      const salesperson = String(user.salesperson_name || "").toLowerCase();
      const role = String(user.role || "").toLowerCase();
      return username.includes(term) || salesperson.includes(term) || role.includes(term);
    });
  }, [searchTerm, users]);

  const groupedPermissions = useMemo(() => {
    const grouped = catalog?.grouped || {};
    return Object.entries(grouped).sort(([left], [right]) => left.localeCompare(right));
  }, [catalog]);

  useEffect(() => {
    let cancelled = false;

    const loadBaseData = async () => {
      setLoadingUsers(true);
      setLoadingCatalog(true);
      setError(null);

      try {
        const [usersResponse, catalogResponse] = await Promise.all([
          authFetch("/api/users"),
          fetchPermissionCatalog(),
        ]);

        if (!usersResponse.ok) {
          throw new Error("No se pudo cargar la lista de usuarios");
        }

        const usersPayload = (await usersResponse.json()) as UserRecord[];
        if (cancelled) return;

        setUsers(Array.isArray(usersPayload) ? usersPayload : []);
        setCatalog(catalogResponse);

        if (!selectedUserId && usersPayload.length > 0) {
          setSelectedUserId(String(usersPayload[0].id));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error cargando permisos");
        }
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
          setLoadingCatalog(false);
        }
      }
    };

    loadBaseData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadUserPermissions = async () => {
      if (!selectedUserId || !catalog) {
        setDraftEffects({});
        return;
      }

      setLoadingPermissions(true);
      setError(null);

      try {
        const response = await authFetch(`/api/permissions/users/${selectedUserId}`);
        if (!response.ok) {
          throw new Error("No se pudieron cargar los permisos del usuario");
        }

        const payload = (await response.json()) as UserPermissionPayload;
        if (cancelled) return;

        const nextEffects = Object.fromEntries(
          catalog.permissions.map((permission) => [
            permission.key,
            payload.overrides?.[permission.key]?.effect || "inherit",
          ])
        ) as Record<string, PermissionEffect>;

        setDraftEffects(nextEffects);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error cargando el usuario");
        }
      } finally {
        if (!cancelled) {
          setLoadingPermissions(false);
        }
      }
    };

    loadUserPermissions();

    return () => {
      cancelled = true;
    };
  }, [catalog, selectedUserId]);

  const handleRefresh = async () => {
    setStatusMessage(null);
    setError(null);
    setLoadingUsers(true);
    setLoadingCatalog(true);

    try {
      const [usersResponse, catalogResponse] = await Promise.all([
        authFetch("/api/users"),
        fetchPermissionCatalog(true),
      ]);

      if (!usersResponse.ok) {
        throw new Error("No se pudo refrescar la lista de usuarios");
      }

      const usersPayload = (await usersResponse.json()) as UserRecord[];
      setUsers(Array.isArray(usersPayload) ? usersPayload : []);
      setCatalog(catalogResponse);
      setStatusMessage("Datos refrescados.");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "No se pudo refrescar");
    } finally {
      setLoadingUsers(false);
      setLoadingCatalog(false);
    }
  };

  const handleSave = async () => {
    if (!selectedUserId || !catalog) return;

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await authFetch(`/api/permissions/users/${selectedUserId}`, {
        method: "PUT",
        json: {
          permissions: catalog.permissions.map((permission) => ({
            permission_key: permission.key,
            effect: draftEffects[permission.key] || "inherit",
          })),
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(String(payload?.error || "No se pudieron guardar los permisos"));
      }

      const payload = (await response.json()) as UserPermissionPayload;
      const nextEffects = Object.fromEntries(
        catalog.permissions.map((permission) => [
          permission.key,
          payload.overrides?.[permission.key]?.effect || "inherit",
        ])
      ) as Record<string, PermissionEffect>;

      setDraftEffects(nextEffects);
      setStatusMessage("Permisos guardados.");

      if (String(currentUser?.userId || "") === String(selectedUserId)) {
        await syncPermissionsFromServer().catch(() => null);
      }

      const usersResponse = await authFetch("/api/users");
      if (usersResponse.ok) {
        const usersPayload = (await usersResponse.json()) as UserRecord[];
        setUsers(Array.isArray(usersPayload) ? usersPayload : []);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!canViewPage) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
          No tienes acceso a Usuarios y Permisos.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 text-slate-100">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
            <Shield className="h-4 w-4" />
            Permisos por usuario
          </div>
          <h1 className="mt-3 text-3xl font-bold">Usuarios y Permisos</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Esta etapa ya permite overrides por usuario con fallback al rol. Lo que quede en heredar sigue usando el comportamiento actual.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canManageOverrides || saving || loadingPermissions || !selectedUserId}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar permisos"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {statusMessage && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {statusMessage}
        </div>
      )}

      {!canManageOverrides && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Estás en modo lectura. Tu usuario puede revisar permisos, pero no guardar cambios.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar usuario..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-10 pr-3 text-sm text-slate-100 outline-none transition focus:border-blue-500"
            />
          </div>

          <div className="mt-4 space-y-2">
            {loadingUsers ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400">
                Cargando usuarios...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400">
                No hay usuarios para ese filtro.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const active = String(user.id) === String(selectedUserId);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setStatusMessage(null);
                      setSelectedUserId(String(user.id));
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{user.username}</div>
                        <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{user.role}</div>
                      </div>
                      <div className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">
                        {user.permission_overrides_count || 0} override(s)
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-400">
                      {user.salesperson_name || "Sin vendedor enlazado"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          {!selectedUser ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-400">
              Selecciona un usuario para ver sus permisos.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-blue-500/10 p-2 text-blue-300">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Usuario</div>
                      <div className="font-semibold text-slate-100">{selectedUser.username}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-300">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Rol base</div>
                      <div className="font-semibold uppercase text-slate-100">{selectedUser.role}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-300">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Ultimo acceso</div>
                      <div className="font-semibold text-slate-100">{formatDate(selectedUser.last_login)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {loadingCatalog || loadingPermissions ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-400">
                  Cargando permisos del usuario...
                </div>
              ) : (
                <div className="space-y-5">
                  {groupedPermissions.map(([moduleKey, permissions]) => (
                    <div key={moduleKey} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-100">
                            {MODULE_TITLES[moduleKey] || moduleKey}
                          </h2>
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            {permissions.length} permiso(s)
                          </p>
                        </div>
                        <div className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                          Base: {selectedUser.role}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {permissions.map((permission) => {
                          const effect = draftEffects[permission.key] || "inherit";
                          const resolved = resolvePermissionDecision(permission.key, selectedUser.role, effect);

                          return (
                            <div
                              key={permission.key}
                              className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 lg:grid-cols-[minmax(0,1fr)_180px_130px]"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-slate-100">{permission.label}</div>
                                <div className="mt-1 text-xs text-slate-500">{permission.key}</div>
                              </div>

                              <select
                                value={effect}
                                disabled={!canManageOverrides}
                                onChange={(event) =>
                                  setDraftEffects((previous) => ({
                                    ...previous,
                                    [permission.key]: event.target.value as PermissionEffect,
                                  }))
                                }
                                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {EFFECT_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>

                              <div
                                className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ${
                                  resolved.allowed
                                    ? "bg-emerald-500/10 text-emerald-300"
                                    : "bg-red-500/10 text-red-300"
                                }`}
                              >
                                {resolved.allowed ? "Permitido" : "Bloqueado"}
                              </div>

                              <div className="lg:col-span-3 flex flex-wrap items-center gap-2 text-xs">
                                <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-400">
                                  tipo: {permission.kind}
                                </span>
                                <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-400">
                                  fuente: {resolved.source === "role" ? "rol" : "override"}
                                </span>
                                <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-400">
                                  base rol: {resolved.role_default ? "permitido" : "bloqueado"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
