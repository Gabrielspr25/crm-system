import { useEffect, useMemo, useState } from "react";
import {
  BookMarked,
  ChevronDown,
  ChevronRight,
  KeyRound,
  RefreshCw,
  Save,
  Search,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";
import {
  fetchPermissionCatalog,
  isPermissionAllowed,
  resolvePermissionDecision,
  syncPermissionsFromServer,
  type PermissionCatalogResponse,
  type PermissionEffect,
} from "@/react-app/utils/permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  permissions: Record<
    string,
    { allowed: boolean; source: "role" | "override"; effect: PermissionEffect; role_default: boolean }
  >;
};

type Preset = {
  id: number;
  name: string;
  effects: Record<string, PermissionEffect>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULE_TITLES: Record<string, string> = {
  navigation: "🧭 Navegación",
  clients: "👥 Clientes",
  followup: "📞 Seguimiento",
  emails: "✉️ Correos",
  campaigns: "📣 Campañas",
  vendors: "🏪 Vendedores",
  products: "📦 Productos",
  categories: "🗂️ Categorías",
  goals: "🎯 Metas",
  reports: "💰 Comisiones",
  cognos: "📊 Cognos",
  importer: "📥 Importador",
  tango: "🔌 Tango",
  audit: "📋 Historial",
  profile: "👤 Perfil",
  users: "🔑 Usuarios y Permisos",
  security: "🛡️ Control y Seguridad",
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function EffectBadge({ effect, allowed }: { effect: PermissionEffect; allowed: boolean }) {
  if (effect === "allow")
    return (
      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
        Permitido
      </span>
    );
  if (effect === "deny")
    return (
      <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
        Bloqueado
      </span>
    );
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
        allowed
          ? "bg-slate-700/60 text-slate-300"
          : "bg-slate-800/60 text-slate-500"
      }`}
    >
      {allowed ? "✓ Rol" : "✗ Rol"}
    </span>
  );
}

// ─── Module accordion ─────────────────────────────────────────────────────────

function ModuleSection({
  moduleKey,
  permissions,
  draftEffects,
  canManageOverrides,
  selectedUserRole,
  onEffectChange,
}: {
  moduleKey: string;
  permissions: Array<{ key: string; label: string; kind: string }>;
  draftEffects: Record<string, PermissionEffect>;
  canManageOverrides: boolean;
  selectedUserRole: string;
  onEffectChange: (key: string, value: PermissionEffect) => void;
}) {
  const [open, setOpen] = useState(true);

  const overrideCount = permissions.filter(
    (p) => (draftEffects[p.key] || "inherit") !== "inherit"
  ).length;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-800/40"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
          )}
          <span className="font-semibold text-slate-100">
            {MODULE_TITLES[moduleKey] || moduleKey}
          </span>
          <span className="text-xs text-slate-500">{permissions.length} permisos</span>
        </div>
        {overrideCount > 0 && (
          <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
            {overrideCount} override{overrideCount !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {/* Permission grid */}
      {open && (
        <div className="px-5 pb-5">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {permissions.map((permission) => {
              const effect = draftEffects[permission.key] || "inherit";
              const resolved = resolvePermissionDecision(
                permission.key,
                selectedUserRole,
                effect
              );
              const isOverridden = effect !== "inherit";

              return (
                <div
                  key={permission.key}
                  className={`rounded-xl border p-3 transition ${
                    isOverridden
                      ? "border-blue-500/30 bg-blue-500/5"
                      : "border-slate-800 bg-slate-950/50"
                  }`}
                >
                  {/* Label + badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-100 leading-snug">
                        {permission.label}
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5 truncate">
                        {permission.key}
                      </div>
                    </div>
                    <EffectBadge effect={effect} allowed={resolved.allowed} />
                  </div>

                  {/* Select */}
                  <select
                    value={effect}
                    disabled={!canManageOverrides}
                    onChange={(e) =>
                      onEffectChange(permission.key, e.target.value as PermissionEffect)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {EFFECT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Preset panel ─────────────────────────────────────────────────────────────

function PresetsPanel({
  presets,
  loadingPresets,
  onSave,
  onApply,
  onDelete,
  canDelete,
}: {
  presets: Preset[];
  loadingPresets: boolean;
  onSave: (name: string) => Promise<void>;
  onApply: (preset: Preset) => void;
  onDelete: (id: number) => Promise<void>;
  canDelete: boolean;
}) {
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleSave = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSaving(true);
    await onSave(trimmed);
    setNewName("");
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BookMarked className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-semibold text-slate-100">Plantillas guardadas</span>
      </div>

      {/* Guardar nueva */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Nombre de la plantilla..."
          maxLength={100}
          className="flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 placeholder:text-slate-600"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !newName.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "..." : "Guardar"}
        </button>
      </div>

      {/* Lista de presets */}
      {loadingPresets ? (
        <p className="text-xs text-slate-500">Cargando plantillas...</p>
      ) : presets.length === 0 ? (
        <p className="text-xs text-slate-500">
          No hay plantillas guardadas. Configura los permisos de un usuario y guarda como plantilla para reutilizarla.
        </p>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-100 truncate">{preset.name}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  {Object.keys(preset.effects).length} overrides guardados
                </div>
              </div>
              <button
                type="button"
                onClick={() => onApply(preset)}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
              >
                Aplicar
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(preset.id)}
                  disabled={deletingId === preset.id}
                  className="rounded-lg border border-red-500/20 bg-red-500/5 p-1.5 text-red-400 transition hover:bg-red-500/15 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UsersPermissionsPage() {
  const currentUser = getCurrentUser();
  const canViewPage = isPermissionAllowed("nav.users_permissions", currentUser);
  const canManageOverrides = isPermissionAllowed("users.permissions.manage", currentUser);
  const isAdmin = currentUser?.role === "admin";

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

  const [presets, setPresets] = useState<Preset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);

  const selectedUser = useMemo(
    () => users.find((u) => String(u.id) === String(selectedUserId)) || null,
    [users, selectedUserId]
  );

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      const username = String(u.username || "").toLowerCase();
      const salesperson = String(u.salesperson_name || "").toLowerCase();
      const role = String(u.role || "").toLowerCase();
      return username.includes(term) || salesperson.includes(term) || role.includes(term);
    });
  }, [searchTerm, users]);

  const groupedPermissions = useMemo(() => {
    const grouped = catalog?.grouped || {};
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  // ── Load base data ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingUsers(true);
      setLoadingCatalog(true);
      setLoadingPresets(true);
      setError(null);

      try {
        const [usersRes, catalogRes, presetsRes] = await Promise.all([
          authFetch("/api/users"),
          fetchPermissionCatalog(),
          authFetch("/api/permissions/presets"),
        ]);

        if (!usersRes.ok) throw new Error("No se pudo cargar la lista de usuarios");

        const usersPayload = (await usersRes.json()) as UserRecord[];
        const presetsPayload = presetsRes.ok ? ((await presetsRes.json()) as Preset[]) : [];

        if (cancelled) return;

        setUsers(Array.isArray(usersPayload) ? usersPayload : []);
        setCatalog(catalogRes);
        setPresets(Array.isArray(presetsPayload) ? presetsPayload : []);

        if (!selectedUserId && usersPayload.length > 0) {
          setSelectedUserId(String(usersPayload[0].id));
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Error cargando permisos");
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
          setLoadingCatalog(false);
          setLoadingPresets(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Load selected user permissions ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const loadUserPerms = async () => {
      if (!selectedUserId || !catalog) {
        setDraftEffects({});
        return;
      }

      setLoadingPermissions(true);
      setError(null);

      try {
        const res = await authFetch(`/api/permissions/users/${selectedUserId}`);
        if (!res.ok) throw new Error("No se pudieron cargar los permisos del usuario");

        const payload = (await res.json()) as UserPermissionPayload;
        if (cancelled) return;

        const next = Object.fromEntries(
          catalog.permissions.map((p) => [
            p.key,
            payload.overrides?.[p.key]?.effect || "inherit",
          ])
        ) as Record<string, PermissionEffect>;

        setDraftEffects(next);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Error cargando el usuario");
      } finally {
        if (!cancelled) setLoadingPermissions(false);
      }
    };

    loadUserPerms();
    return () => { cancelled = true; };
  }, [catalog, selectedUserId]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleEffectChange = (key: string, value: PermissionEffect) => {
    setDraftEffects((prev) => ({ ...prev, [key]: value }));
  };

  const handleRefresh = async () => {
    setStatusMessage(null);
    setError(null);
    setLoadingUsers(true);
    setLoadingCatalog(true);
    setLoadingPresets(true);

    try {
      const [usersRes, catalogRes, presetsRes] = await Promise.all([
        authFetch("/api/users"),
        fetchPermissionCatalog(true),
        authFetch("/api/permissions/presets"),
      ]);
      if (!usersRes.ok) throw new Error("No se pudo refrescar la lista de usuarios");

      const usersPayload = (await usersRes.json()) as UserRecord[];
      const presetsPayload = presetsRes.ok ? ((await presetsRes.json()) as Preset[]) : [];

      setUsers(Array.isArray(usersPayload) ? usersPayload : []);
      setCatalog(catalogRes);
      setPresets(Array.isArray(presetsPayload) ? presetsPayload : []);
      setStatusMessage("Datos refrescados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo refrescar");
    } finally {
      setLoadingUsers(false);
      setLoadingCatalog(false);
      setLoadingPresets(false);
    }
  };

  const handleSave = async () => {
    if (!selectedUserId || !catalog) return;

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const res = await authFetch(`/api/permissions/users/${selectedUserId}`, {
        method: "PUT",
        json: {
          permissions: catalog.permissions.map((p) => ({
            permission_key: p.key,
            effect: draftEffects[p.key] || "inherit",
          })),
        },
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(String((payload as { error?: string })?.error || "No se pudieron guardar los permisos"));
      }

      const payload = (await res.json()) as UserPermissionPayload;
      const next = Object.fromEntries(
        catalog.permissions.map((p) => [
          p.key,
          payload.overrides?.[p.key]?.effect || "inherit",
        ])
      ) as Record<string, PermissionEffect>;

      setDraftEffects(next);
      setStatusMessage("Permisos guardados correctamente.");

      if (String(currentUser?.userId || "") === String(selectedUserId)) {
        await syncPermissionsFromServer().catch(() => null);
      }

      const usersRes = await authFetch("/api/users");
      if (usersRes.ok) {
        const usersPayload = (await usersRes.json()) as UserRecord[];
        setUsers(Array.isArray(usersPayload) ? usersPayload : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreset = async (name: string) => {
    if (!catalog) return;

    // Solo guardar los que no son "inherit"
    const effects: Record<string, PermissionEffect> = {};
    for (const [key, effect] of Object.entries(draftEffects)) {
      if (effect !== "inherit") effects[key] = effect;
    }

    try {
      const res = await authFetch("/api/permissions/presets", {
        method: "POST",
        json: { name, effects },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(String((payload as { error?: string })?.error || "No se pudo guardar la plantilla"));
      }
      const saved = (await res.json()) as Preset;
      setPresets((prev) => {
        const filtered = prev.filter((p) => p.id !== saved.id);
        return [...filtered, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      setStatusMessage(`Plantilla "${name}" guardada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando plantilla");
    }
  };

  const handleApplyPreset = (preset: Preset) => {
    if (!catalog) return;
    const next = Object.fromEntries(
      catalog.permissions.map((p) => [
        p.key,
        preset.effects[p.key] || "inherit",
      ])
    ) as Record<string, PermissionEffect>;
    setDraftEffects(next);
    setStatusMessage(`Plantilla "${preset.name}" aplicada. Revisa y guarda para confirmar.`);
  };

  const handleDeletePreset = async (id: number) => {
    try {
      const res = await authFetch(`/api/permissions/presets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar la plantilla");
      setPresets((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando plantilla");
    }
  };

  // ── Guard ───────────────────────────────────────────────────────────────────

  if (!canViewPage) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
          No tienes acceso a Usuarios y Permisos.
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6 text-slate-100">

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
            <Shield className="h-4 w-4" />
            Permisos por usuario
          </div>
          <h1 className="mt-3 text-3xl font-bold">Usuarios y Permisos</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Configura overrides por usuario. Guarda configuraciones como plantillas para aplicarlas rápidamente a otros usuarios.
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

      {/* Alerts */}
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
          Modo lectura. Tu usuario puede revisar permisos pero no guardar cambios.
        </div>
      )}

      {/* Main layout */}
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">

        {/* Sidebar: users + presets */}
        <aside className="space-y-4">
          {/* User list */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar usuario..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-10 pr-3 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
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
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        active
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-100 truncate">
                            {user.username}
                          </div>
                          <div className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">
                            {user.role}
                          </div>
                        </div>
                        {(user.permission_overrides_count || 0) > 0 && (
                          <div className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-300 flex-shrink-0">
                            {user.permission_overrides_count} override{user.permission_overrides_count !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                      <div className="mt-1.5 text-xs text-slate-500 truncate">
                        {user.salesperson_name || "Sin vendedor enlazado"}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Presets panel */}
          {canManageOverrides && (
            <PresetsPanel
              presets={presets}
              loadingPresets={loadingPresets}
              onSave={handleSavePreset}
              onApply={handleApplyPreset}
              onDelete={handleDeletePreset}
              canDelete={isAdmin}
            />
          )}
        </aside>

        {/* Main: user info + permissions */}
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          {!selectedUser ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-400">
              Selecciona un usuario para ver sus permisos.
            </div>
          ) : (
            <div className="space-y-5">
              {/* User info cards */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex items-center gap-3">
                  <div className="rounded-xl bg-blue-500/10 p-2 text-blue-300">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400">Usuario</div>
                    <div className="font-semibold text-slate-100 truncate">{selectedUser.username}</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-300">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Rol base</div>
                    <div className="font-semibold uppercase text-slate-100">{selectedUser.role}</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-300">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400">Último acceso</div>
                    <div className="font-semibold text-slate-100 text-sm truncate">
                      {formatDate(selectedUser.last_login)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Permissions */}
              {loadingCatalog || loadingPermissions ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-400">
                  Cargando permisos del usuario...
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedPermissions.map(([moduleKey, permissions]) => (
                    <ModuleSection
                      key={moduleKey}
                      moduleKey={moduleKey}
                      permissions={permissions as Array<{ key: string; label: string; kind: string }>}
                      draftEffects={draftEffects}
                      canManageOverrides={canManageOverrides}
                      selectedUserRole={selectedUser.role}
                      onEffectChange={handleEffectChange}
                    />
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
