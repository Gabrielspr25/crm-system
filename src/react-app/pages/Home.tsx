import { useMemo, useState } from "react";
import { AlertCircle, BarChart3, Check, ChevronDown, ClipboardCheck, ClipboardList, LayoutDashboard, Loader2, Plus, Target, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router";
import { useApi } from "@/react-app/hooks/useApi";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

type Client = {
  id: string | number;
  name?: string | null;
  phone?: string | null;
  active_ban_count?: number | string | null;
  priority_score?: number | string | null;
  primary_contract_end_date?: string | null;
  recent_followup?: boolean | null;
  has_convergence?: boolean | null;
  related_ban?: string | null;
  ban_numbers?: string | null;
  vendor_name?: string | null;
  salesperson_id?: string | null;
};

type ClientsResponse = {
  clients: Client[];
  stats?: {
    active_count?: number | string | null;
  };
};

type Task = {
  id: number;
  agent_name?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  related_client_id?: string | null;
  assigned_salesperson_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-200 border-red-500/30",
  high: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  normal: "bg-blue-500/15 text-blue-200 border-blue-500/30",
  low: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

type GoalVendor = {
  vendor_id?: number | null;
  vendor_name?: string | null;
  salesperson_id?: string | null;
  total_goal?: number | null;
  total_earned?: number | null;
  percentage?: number | null;
  remaining?: number | null;
};

type GoalsResponse = {
  period?: string;
  summary?: {
    total_goal?: number | null;
    total_earned?: number | null;
    total_percentage?: number | null;
  };
  vendors?: GoalVendor[];
};

const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

// Mismo umbral que usa el backend (clientController.js: SCORING_EXPIRING_DAYS).
const EXPIRING_DAYS = 90;

const toNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatDate = (value?: string | null) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString();
};

const isExpiringSoon = (value?: string | null) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + EXPIRING_DAYS);
  return date <= horizon;
};

const getPrimaryBan = (banNumbers?: string | null) => {
  if (!banNumbers) return { primary: "-", extra: 0 };
  const parts = String(banNumbers)
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
  if (parts.length === 0) return { primary: "-", extra: 0 };
  return { primary: parts[0], extra: parts.length - 1 };
};

type Action = { label: string; cls: string };

type AlertType = "danger" | "warning" | "info" | "neutral";
type AlertItem = { type: AlertType; text: string };

const getAlertClass = (type: AlertType) => {
  switch (type) {
    case "danger":
      return "bg-red-500/10 text-red-300 p-2 rounded border border-red-500/20";
    case "warning":
      return "bg-amber-500/10 text-amber-300 p-2 rounded border border-amber-500/20";
    case "info":
      return "bg-blue-500/10 text-blue-300 p-2 rounded border border-blue-500/20";
    default:
      return "bg-slate-500/10 text-slate-300 p-2 rounded border border-slate-500/20";
  }
};

type AlertSourceRow = { name: string; total: number; done: number; pct: number };

const buildAlerts = (rows: AlertSourceRow[]): AlertItem[] => {
  const alerts: AlertItem[] = [];

  for (const row of rows) {
    if (row.name === "Sin asignar") continue;

    if (row.total >= 3 && row.pct < 40) {
      alerts.push({
        type: "danger",
        text: `Vendedor ${row.name} con bajo desempeño (${row.pct}%)`,
      });
    }

    if (row.total >= 5 && row.done === 0) {
      alerts.push({
        type: "warning",
        text: `${row.name} tiene carga alta sin ejecución`,
      });
    }

    if (row.total === 0) {
      alerts.push({
        type: "info",
        text: `${row.name} sin tareas asignadas`,
      });
    }
  }

  const unassigned = rows.find((r) => r.name === "Sin asignar");
  if (unassigned && unassigned.total > 0) {
    alerts.push({
      type: "neutral",
      text: `${unassigned.total} tareas sin asignar`,
    });
  }

  return alerts;
};

// Mapea priority_score numerico al enum TASK_PRIORITIES del backend
// (low/normal/high/urgent). Sin esto, el backend descartaria un numero
// y caeria al default 'normal', perdiendo la urgencia real.
const scoreToPriority = (score: number): string => {
  if (score >= 90) return "urgent";
  if (score >= 70) return "high";
  if (score >= 30) return "normal";
  return "low";
};

const suggestedAction = (client: Client): Action => {
  if (!client.recent_followup) {
    return { label: "Llamar hoy", cls: "bg-red-500/15 text-red-200 border-red-500/30" };
  }
  if (isExpiringSoon(client.primary_contract_end_date)) {
    return { label: "Renovar contrato", cls: "bg-amber-500/15 text-amber-200 border-amber-500/30" };
  }
  if (!client.has_convergence) {
    return { label: "Ofrecer convergente", cls: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30" };
  }
  return { label: "Mantener", cls: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" };
};

type TaskState = "idle" | "creating" | "created" | "error";

export default function Home() {
  const { data, loading, error } = useApi<ClientsResponse>("/api/clients?tab=active");
  const tasksApi = useApi<Task[]>("/api/agents/tasks?limit=500");
  // Endpoint existente. Mes hardcodeado a 2026-04 (unico periodo con datos en prod
  // segun el diagnostico). El endpoint ya filtra por rol server-side.
  const goalsApi = useApi<GoalsResponse>("/api/goals/performance?month=2026-04");
  const clients = Array.isArray(data?.clients) ? data.clients : [];
  const activeCount = data?.stats?.active_count != null ? toNumber(data.stats.active_count) : clients.length;
  const topPriorityClients = [...clients]
    .sort((a, b) => toNumber(b.priority_score) - toNumber(a.priority_score))
    .slice(0, 10);
  const clientsWithoutRecentFollowup = clients.filter((client) => !client.recent_followup);

  // Lookup id -> nombre + vendor para enriquecer tareas pendientes sin pegarle de nuevo al backend.
  const clientNameById = new Map<string, string>();
  const clientVendorById = new Map<string, string | null>();
  for (const c of clients) {
    if (c.id != null) {
      const cid = String(c.id);
      clientNameById.set(cid, c.name || "Sin nombre");
      clientVendorById.set(cid, c.vendor_name || null);
    }
  }

  const tasksRaw = Array.isArray(tasksApi.data) ? tasksApi.data : [];
  const pendingTasks = tasksRaw
    .filter((t) => (t.status || "").toLowerCase() === "pending")
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  // Identidad del usuario logueado para filtrar tareas por vendedor.
  const currentUser = useMemo(() => getCurrentUser(), []);
  const role = String(currentUser?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "supervisor";
  const mySalespersonId = currentUser?.salespersonId ? String(currentUser.salespersonId) : null;
  const [adminScope, setAdminScope] = useState<"all" | "mine">("all");

  // Vendedor solo ve sus tareas (las sin vendedor quedan ocultas para el vendedor).
  // Admin/supervisor ve todas; con toggle "mine" filtra a las suyas si tiene salespersonId.
  const visiblePendingTasks = pendingTasks.filter((task) => {
    const assigned = task.assigned_salesperson_id ? String(task.assigned_salesperson_id) : null;
    if (isAdmin) {
      if (adminScope === "mine") return assigned !== null && assigned === mySalespersonId;
      return true;
    }
    return assigned !== null && assigned === mySalespersonId;
  });

  // Lookup salesperson_id -> vendor_name desde clientes ya cargados.
  // No se hace fetch adicional; salespersons sin cliente activo aparecen con id corto.
  const vendorNameBySpId = new Map<string, string>();
  for (const c of clients) {
    if (c.salesperson_id && c.vendor_name) {
      vendorNameBySpId.set(String(c.salesperson_id), c.vendor_name);
    }
  }

  // Agrupar todas las tareas (no solo pending) por assigned_salesperson_id
  // para construir la tabla de desempeno por vendedor.
  type PerfRow = { key: string; name: string; total: number; done: number; pending: number; pct: number };
  const perfBuckets = new Map<string, { total: number; done: number; pending: number }>();
  for (const t of tasksRaw) {
    const key = t.assigned_salesperson_id ? String(t.assigned_salesperson_id) : "unassigned";
    const status = String(t.status || "").toLowerCase();
    let bucket = perfBuckets.get(key);
    if (!bucket) {
      bucket = { total: 0, done: 0, pending: 0 };
      perfBuckets.set(key, bucket);
    }
    bucket.total += 1;
    if (status === "done") bucket.done += 1;
    else if (status === "pending") bucket.pending += 1;
  }
  const performanceRows: PerfRow[] = Array.from(perfBuckets.entries())
    .map(([key, stats]) => ({
      key,
      name:
        key === "unassigned"
          ? "Sin asignar"
          : vendorNameBySpId.get(key) || `${key.slice(0, 8)}…`,
      total: stats.total,
      done: stats.done,
      pending: stats.pending,
      pct: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
    }))
    .sort((a, b) => (b.total - a.total) || a.name.localeCompare(b.name));

  // Alertas inteligentes derivadas del desempeno por vendedor.
  const alerts = buildAlerts(performanceRows);

  // Datos derivados para acordeon "Metas comerciales".
  const goalsRaw = goalsApi.data;
  const goalsVendorsAll = Array.isArray(goalsRaw?.vendors) ? goalsRaw.vendors : [];
  const goalsVendors = goalsVendorsAll
    .filter((v) => Number(v.total_goal || 0) > 0)
    .map((v) => ({
      vendor_id: v.vendor_id ?? null,
      vendor_name: String(v.vendor_name || "Sin nombre"),
      total_goal: Number(v.total_goal || 0),
      total_earned: Number(v.total_earned || 0),
      percentage: Number(v.percentage || 0),
      remaining: Number(v.remaining || 0),
    }))
    .sort((a, b) => b.total_goal - a.total_goal);
  const goalsSummary = goalsRaw?.summary || null;
  const goalsTotalGoal = Number(goalsSummary?.total_goal || 0);
  const goalsTotalEarned = Number(goalsSummary?.total_earned || 0);
  const goalsTotalPct = Number(goalsSummary?.total_percentage || 0);
  const goalsRemaining = Math.max(0, goalsTotalGoal - goalsTotalEarned);
  const goalsMaxBar = goalsVendors.reduce((max, v) => Math.max(max, v.total_goal), 0) || 1;
  const goalsAllZeroEarned = goalsVendors.length > 0 && goalsVendors.every((v) => v.total_earned === 0);

  const [taskState, setTaskState] = useState<Record<string, TaskState>>({});
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [showCompletedFlag, setShowCompletedFlag] = useState(false);

  const handleCompleteTask = async (taskId: number) => {
    setCompletingTaskId(taskId);
    try {
      const response = await authFetch(`/api/agents/tasks/${taskId}`, {
        method: "PATCH",
        json: { status: "done" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await tasksApi.refetch();
      setShowCompletedFlag(true);
      window.setTimeout(() => setShowCompletedFlag(false), 2500);
    } catch (err) {
      console.error("Error marcando tarea como completada:", err);
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleCreateTask = async (client: Client, banPrimary: string, actionLabel: string) => {
    const id = String(client.id);
    setTaskState((prev) => ({ ...prev, [id]: "creating" }));
    try {
      const response = await authFetch("/api/agents/tasks", {
        method: "POST",
        json: {
          agent_name: "Ventas",
          title: "Seguimiento cliente",
          description:
            `Cliente: ${client.name || "Sin nombre"}\n` +
            `BAN: ${banPrimary}\n` +
            `Accion sugerida: ${actionLabel}`,
          status: "pending",
          priority: scoreToPriority(toNumber(client.priority_score)),
          related_client_id: id,
          assigned_salesperson_id: client.salesperson_id || null,
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setTaskState((prev) => ({ ...prev, [id]: "created" }));
      // Refetch del widget de tareas pendientes para que aparezca de inmediato.
      void tasksApi.refetch();
      window.setTimeout(() => {
        setTaskState((prev) => ({ ...prev, [id]: "idle" }));
      }, 3000);
    } catch (err) {
      console.error("Error creando tarea:", err);
      setTaskState((prev) => ({ ...prev, [id]: "error" }));
      window.setTimeout(() => {
        setTaskState((prev) => ({ ...prev, [id]: "idle" }));
      }, 3000);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-blue-400" />
          Panel General
        </h1>
        <p className="text-slate-400 text-sm mt-1">Dashboard basico basado en clientes activos y memoria comercial.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Error cargando dashboard: {error}
        </div>
      )}

      {alerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase text-slate-400 flex items-center gap-2">
            Alertas
            <span className="text-xs text-slate-500 normal-case font-normal">
              ({alerts.length})
            </span>
          </h2>
          <div className="space-y-1.5">
            {alerts.map((a, i) => (
              <div key={i} className={`text-sm ${getAlertClass(a.type)}`}>
                {a.text}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* (2) Resumen ejecutivo — acordeón abierto */}
      <details open className="rounded-lg border border-slate-700 bg-slate-800/50 group">
        <summary className="cursor-pointer p-4 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-300" />
            Resumen ejecutivo
          </h2>
          <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="p-4 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Clientes activos</p>
              <p className="text-3xl font-bold text-white mt-2">{loading ? "-" : activeCount}</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-blue-500/15 text-blue-300 flex items-center justify-center">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
            </div>
          </div>
          <Link to="/clientes" className="inline-block text-sm text-blue-300 hover:text-blue-200 mt-4">
            Ver modulo de clientes
          </Link>
        </div>
      </details>

      {/* (3) Tareas pendientes — acordeón dinámico (abierto si hay) */}
      <details open={visiblePendingTasks.length > 0} className="rounded-lg border border-slate-700 bg-slate-800/50 group">
        <summary className="cursor-pointer p-4 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden gap-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-300" />
            Tareas pendientes
            {showCompletedFlag && (
              <span className="text-xs text-emerald-300 font-normal ml-2">Completada</span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">
              {tasksApi.loading ? "-" : `${visiblePendingTasks.length} tareas`}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="p-4 pt-0">
          {isAdmin && (
            <div className="flex justify-end mb-3">
              <div className="inline-flex rounded border border-slate-600 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setAdminScope("all")}
                  className={
                    "px-2 py-1 transition-colors " +
                    (adminScope === "all"
                      ? "bg-blue-500/20 text-blue-200"
                      : "text-slate-300 hover:bg-slate-700/40")
                  }
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setAdminScope("mine")}
                  className={
                    "px-2 py-1 border-l border-slate-600 transition-colors " +
                    (adminScope === "mine"
                      ? "bg-blue-500/20 text-blue-200"
                      : "text-slate-300 hover:bg-slate-700/40")
                  }
                >
                  Solo mías
                </button>
              </div>
            </div>
          )}

          {tasksApi.loading ? (
            <div className="h-24 flex items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : visiblePendingTasks.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              {isAdmin && adminScope === "mine"
                ? "No tenés tareas asignadas pendientes."
                : isAdmin
                ? "No hay tareas pendientes."
                : "No tenés tareas pendientes asignadas."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left py-2 pr-3 font-semibold">Tarea</th>
                    <th className="text-left py-2 px-3 font-semibold">Cliente</th>
                    <th className="text-left py-2 px-3 font-semibold">Vendedor</th>
                    <th className="text-center py-2 px-3 font-semibold">Prioridad</th>
                    <th className="text-right py-2 pl-3 font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {visiblePendingTasks.slice(0, 5).map((task) => {
                    const clientId = task.related_client_id ? String(task.related_client_id) : null;
                    const clientName = clientId ? clientNameById.get(clientId) || null : null;
                    const vendorName = clientId ? clientVendorById.get(clientId) || null : null;
                    const priority = String(task.priority || "normal").toLowerCase();
                    const priorityCls = PRIORITY_STYLE[priority] || PRIORITY_STYLE.normal;
                    const isCompleting = completingTaskId === task.id;
                    return (
                      <tr key={task.id} className="text-slate-200">
                        <td className="py-2 pr-3 font-medium">{task.title || "Sin título"}</td>
                        <td className="py-2 px-3 text-slate-300">
                          {clientName ? (
                            <Link
                              to={`/clientes?openClient=${clientId}`}
                              className="text-blue-300 hover:text-blue-200"
                            >
                              {clientName}
                            </Link>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {task.assigned_salesperson_id || vendorName ? (
                            <span>{vendorName || "-"}</span>
                          ) : (
                            <span className="text-slate-500 italic">Sin vendedor</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`text-xs rounded border px-2 py-1 ${priorityCls}`}>
                            {priority}
                          </span>
                        </td>
                        <td className="py-2 pl-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleCompleteTask(task.id)}
                            disabled={isCompleting}
                            className={
                              "inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors " +
                              (isCompleting
                                ? "bg-slate-500/15 text-slate-300 border-slate-500/30 cursor-wait"
                                : "bg-emerald-500/15 text-emerald-200 border-emerald-500/30 hover:bg-emerald-500/25")
                            }
                          >
                            {isCompleting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            {isCompleting ? "Completando…" : "Completar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>

      {/* (4) Desempeño por vendedor — acordeón abierto */}
      <details open className="rounded-lg border border-slate-700 bg-slate-800/50 group">
        <summary className="cursor-pointer p-4 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden gap-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-300" />
            Desempeño por vendedor
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">
              {tasksApi.loading
                ? "-"
                : `${performanceRows.length} ${performanceRows.length === 1 ? "vendedor" : "vendedores"}`}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="p-4 pt-0">
          {tasksApi.loading ? (
            <div className="h-24 flex items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : performanceRows.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              Sin actividad registrada en tareas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left py-2 pr-3 font-semibold">Vendedor</th>
                    <th className="text-center py-2 px-3 font-semibold">Total</th>
                    <th className="text-center py-2 px-3 font-semibold">Completadas</th>
                    <th className="text-center py-2 px-3 font-semibold">Pendientes</th>
                    <th className="text-right py-2 pl-3 font-semibold">% Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {performanceRows.map((row) => {
                    const pctCls =
                      row.total === 0
                        ? "text-slate-500"
                        : row.pct >= 70
                        ? "text-emerald-300"
                        : row.pct >= 40
                        ? "text-amber-300"
                        : "text-red-300";
                    return (
                      <tr key={row.key} className="text-slate-200">
                        <td className="py-2 pr-3 font-medium">
                          {row.key === "unassigned" ? (
                            <span className="text-slate-400 italic">{row.name}</span>
                          ) : (
                            row.name
                          )}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-300">{row.total}</td>
                        <td className="py-2 px-3 text-center text-emerald-300">{row.done}</td>
                        <td className="py-2 px-3 text-center text-amber-300">{row.pending}</td>
                        <td className={`py-2 pl-3 text-right font-semibold ${pctCls}`}>
                          {row.total > 0 ? `${row.pct}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>

      {/* (5) Metas comerciales — acordeón colapsado */}
      <details className="rounded-lg border border-slate-700 bg-slate-800/50 group">
        <summary className="cursor-pointer p-4 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden gap-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-300" />
            Metas comerciales
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">
              {goalsApi.loading
                ? "-"
                : goalsRaw?.period
                ? `Periodo ${goalsRaw.period}`
                : "Sin datos"}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="p-4 pt-0">
          {goalsApi.loading ? (
            <div className="h-24 flex items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : goalsApi.error ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              No se pudieron cargar las metas en este momento.
            </p>
          ) : goalsVendors.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              Sin metas cargadas para este periodo.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Resumen global */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                  <p className="text-xs uppercase font-semibold text-slate-400">Meta total</p>
                  <p className="text-xl font-bold text-white mt-1">{formatUSD(goalsTotalGoal)}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                  <p className="text-xs uppercase font-semibold text-slate-400">Vendido</p>
                  <p className="text-xl font-bold text-emerald-300 mt-1">{formatUSD(goalsTotalEarned)}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                  <p className="text-xs uppercase font-semibold text-slate-400">% Avance</p>
                  <p className={`text-xl font-bold mt-1 ${
                    goalsTotalPct >= 70
                      ? "text-emerald-300"
                      : goalsTotalPct >= 40
                      ? "text-amber-300"
                      : goalsTotalPct > 0
                      ? "text-red-300"
                      : "text-slate-500"
                  }`}>
                    {goalsTotalGoal > 0 ? `${goalsTotalPct.toFixed(1)}%` : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                  <p className="text-xs uppercase font-semibold text-slate-400">Restante</p>
                  <p className="text-xl font-bold text-amber-300 mt-1">{formatUSD(goalsRemaining)}</p>
                </div>
              </div>

              {goalsAllZeroEarned && (
                <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Metas cargadas, pero el avance vendido todavía no se está alimentando.
                </div>
              )}

              {/* Gráfica por vendedor */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Por vendedor</h3>
                <div className="space-y-3">
                  {goalsVendors.map((v) => {
                    const goalPct = (v.total_goal / goalsMaxBar) * 100;
                    const earnedPct = (v.total_earned / goalsMaxBar) * 100;
                    return (
                      <div key={`${v.vendor_id}-${v.vendor_name}`}>
                        <div className="flex justify-between text-xs text-slate-300 mb-1">
                          <span className="font-medium">{v.vendor_name}</span>
                          <span className="text-slate-400">
                            {formatUSD(v.total_earned)} / {formatUSD(v.total_goal)}
                          </span>
                        </div>
                        <div className="relative w-full bg-slate-900/60 rounded-full h-2 overflow-hidden border border-slate-700">
                          <div
                            className="absolute top-0 left-0 h-full bg-slate-500/40"
                            style={{ width: `${goalPct}%` }}
                          />
                          {v.total_earned > 0 && (
                            <div
                              className="absolute top-0 left-0 h-full bg-emerald-400"
                              style={{ width: `${earnedPct}%` }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tabla simple */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="text-left py-2 pr-3 font-semibold">Vendedor</th>
                      <th className="text-right py-2 px-3 font-semibold">Meta</th>
                      <th className="text-right py-2 px-3 font-semibold">Vendido</th>
                      <th className="text-right py-2 px-3 font-semibold">Restante</th>
                      <th className="text-right py-2 pl-3 font-semibold">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {goalsVendors.map((v) => {
                      const pct = Number(v.percentage || 0);
                      const pctCls =
                        pct >= 70
                          ? "text-emerald-300"
                          : pct >= 40
                          ? "text-amber-300"
                          : pct > 0
                          ? "text-red-300"
                          : "text-slate-500";
                      return (
                        <tr key={`tbl-${v.vendor_id}-${v.vendor_name}`} className="text-slate-200">
                          <td className="py-2 pr-3 font-medium">{v.vendor_name}</td>
                          <td className="py-2 px-3 text-right text-slate-300">{formatUSD(v.total_goal)}</td>
                          <td className="py-2 px-3 text-right text-emerald-300">{formatUSD(v.total_earned)}</td>
                          <td className="py-2 px-3 text-right text-amber-300">{formatUSD(v.remaining)}</td>
                          <td className={`py-2 pl-3 text-right font-semibold ${pctCls}`}>
                            {v.total_goal > 0 ? `${pct.toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </details>

      {/* (6) Top 10 clientes — acordeón colapsado */}
      <details className="rounded-lg border border-slate-700 bg-slate-800/50 group">
        <summary className="cursor-pointer p-4 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden gap-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-300" />
            Top 10 por priority_score
          </h2>
          <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="p-4 pt-0">
          <p className="text-xs text-slate-400 mb-3">Ranking calculado en backend desde clientes activos.</p>

          {loading ? (
            <div className="h-40 flex items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : topPriorityClients.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No hay clientes activos para mostrar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left py-2 pr-3 font-semibold">Cliente</th>
                    <th className="text-left py-2 px-3 font-semibold">BAN</th>
                    <th className="text-center py-2 px-3 font-semibold">Score</th>
                    <th className="text-center py-2 px-3 font-semibold">Seguimiento</th>
                    <th className="text-center py-2 px-3 font-semibold">Convergencia</th>
                    <th className="text-left py-2 px-3 font-semibold">Acción sugerida</th>
                    <th className="text-right py-2 pl-3 font-semibold">Tarea</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {topPriorityClients.map((client) => {
                    const ban = getPrimaryBan(client.ban_numbers);
                    const action = suggestedAction(client);
                    const tState = taskState[String(client.id)] || "idle";
                    return (
                      <tr key={client.id} className="text-slate-200">
                        <td className="py-2 pr-3">
                          <Link to={`/clientes?openClient=${client.id}`} className="font-semibold text-blue-300 hover:text-blue-200">
                            {client.name || "Sin nombre"}
                          </Link>
                          {client.vendor_name && <div className="text-xs text-slate-500">{client.vendor_name}</div>}
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {ban.primary}
                          {ban.extra > 0 && <span className="text-xs text-slate-500 ml-1">(+{ban.extra})</span>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="rounded bg-cyan-500/15 text-cyan-200 px-2 py-1 font-semibold">
                            {toNumber(client.priority_score)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {client.recent_followup ? (
                            <span className="text-xs text-emerald-300">OK</span>
                          ) : (
                            <span className="text-xs text-amber-300" title={`Vence: ${formatDate(client.primary_contract_end_date)}`}>Pendiente</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {client.has_convergence ? (
                            <span className="text-xs text-emerald-300">Sí</span>
                          ) : (
                            <span className="text-xs text-slate-400">No</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-xs rounded border px-2 py-1 font-medium ${action.cls}`}>
                            {action.label}
                          </span>
                        </td>
                        <td className="py-2 pl-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleCreateTask(client, ban.primary, action.label)}
                            disabled={tState === "creating" || tState === "created"}
                            className={
                              "inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors " +
                              (tState === "created"
                                ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
                                : tState === "error"
                                ? "bg-red-500/15 text-red-200 border-red-500/30 hover:bg-red-500/20"
                                : tState === "creating"
                                ? "bg-slate-500/15 text-slate-300 border-slate-500/30 cursor-wait"
                                : "bg-slate-700/40 text-slate-200 border-slate-600 hover:border-blue-400/50 hover:text-blue-200")
                            }
                          >
                            {tState === "creating" ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Creando…
                              </>
                            ) : tState === "created" ? (
                              <>
                                <ClipboardCheck className="w-3 h-3" />
                                Tarea creada
                              </>
                            ) : tState === "error" ? (
                              <>
                                <AlertCircle className="w-3 h-3" />
                                Reintentar
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                Crear tarea
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>

      {/* (6) Clientes sin seguimiento — acordeón colapsado */}
      <details className="rounded-lg border border-slate-700 bg-slate-800/50 group">
        <summary className="cursor-pointer p-4 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden gap-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-300" />
            Clientes sin seguimiento reciente
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{loading ? "-" : `${clientsWithoutRecentFollowup.length} clientes`}</span>
            <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <div className="p-4 pt-0">
          {loading ? (
            <div className="h-32 flex items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : clientsWithoutRecentFollowup.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Todos los clientes activos tienen seguimiento reciente.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {clientsWithoutRecentFollowup.slice(0, 12).map((client) => (
                <Link
                  key={client.id}
                  to={`/clientes?openClient=${client.id}`}
                  className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 hover:border-amber-400/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{client.name || "Sin nombre"}</p>
                      <p className="text-xs text-slate-400 mt-1">BAN: {client.ban_numbers || "-"}</p>
                    </div>
                    <span className="text-xs rounded bg-amber-500/15 text-amber-200 px-2 py-1">
                      {toNumber(client.priority_score)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
