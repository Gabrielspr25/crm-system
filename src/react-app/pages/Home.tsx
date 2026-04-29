import { Fragment, useMemo, useState } from "react";
import { AlertCircle, BarChart3, Check, ChevronDown, ClipboardCheck, ClipboardList, LayoutDashboard, Loader2, Plus, RefreshCw, ShieldAlert, Target, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router";
import { useApi } from "@/react-app/hooks/useApi";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";
import { isPermissionAllowed } from "@/react-app/utils/permissions";

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
  due_date?: string | null;
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

type ExternalSale = {
  tango_ventaid: number;
  ban: string;
  ventatipoid: number;
  fechaactivacion: string | null;
  vendedor: string | null;
  cliente: string | null;
  com_empresa: number;
  com_vendedor: number;
  motivo: string;
};

type DescuadreState = "idle" | "loading" | "success" | "error";

type DescuadreData = {
  count: number;
  sample: ExternalSale[];
  motivos: Record<string, number>;
  truncated: boolean;
  lastChecked: string;
};

// Etiqueta amigable para ventatipoid (FASE 1 + FASE 2).
const VENTATIPO_LABELS: Record<number, string> = {
  138: "Móvil REN (PYMES)",
  139: "Móvil NEW (PYMES)",
  140: "Fijo REN (PYMES)",
  141: "Fijo NEW (PYMES)",
  25: "Móvil NEW (Claro Update)",
  26: "Móvil REN (Claro Update)",
  121: "Fijo NEW (2 Play)",
  41: "Fijo NEW (3 Play)", 42: "Fijo NEW (3 Play)", 43: "Fijo NEW (3 Play)",
  44: "Fijo NEW (3 Play)", 45: "Fijo NEW (3 Play)", 46: "Fijo NEW (3 Play)",
  47: "Fijo NEW (3 Play)", 48: "Fijo NEW (3 Play)", 49: "Fijo NEW (3 Play)",
  50: "Fijo NEW (3 Play)",
};

// Cutoff para descuadres: solo trabajamos desde 2026-01-01 en adelante.
// Las ventas Tango anteriores son ruido historico y se ignoran en UI.
const DESCUADRE_CUTOFF = "2026-01-01";

const isExternalSaleFrom2026 = (s: ExternalSale): boolean => {
  if (!s.fechaactivacion) return false;
  return s.fechaactivacion >= DESCUADRE_CUTOFF;
};

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
type AlertKind = "unassigned_tasks";
type AlertItem = { type: AlertType; text: string; kind?: AlertKind };

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
      kind: "unassigned_tasks",
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
  const [expandedActivityKeys, setExpandedActivityKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleActivityExpand = (key: string) => {
    setExpandedActivityKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
  type PerfRow = { key: string; name: string; total: number; done: number; pending: number; in_progress: number; pct: number };
  const perfBuckets = new Map<string, { total: number; done: number; pending: number; in_progress: number }>();
  for (const t of tasksRaw) {
    const key = t.assigned_salesperson_id ? String(t.assigned_salesperson_id) : "unassigned";
    const status = String(t.status || "").toLowerCase();
    let bucket = perfBuckets.get(key);
    if (!bucket) {
      bucket = { total: 0, done: 0, pending: 0, in_progress: 0 };
      perfBuckets.set(key, bucket);
    }
    bucket.total += 1;
    if (status === "done") bucket.done += 1;
    else if (status === "pending") bucket.pending += 1;
    else if (status === "in_progress") bucket.in_progress += 1;
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
      in_progress: stats.in_progress,
      pct: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
    }))
    // Orden: % cumplimiento asc; si empatan, pendientes desc; ultimo desempate name asc.
    .sort((a, b) => (a.pct - b.pct) || (b.pending - a.pending) || a.name.localeCompare(b.name));

  // Gate del bloque "Actividad de vendedores hoy" — usa el arbol de permisos
  // existente (vendors.view), no roles hardcodeados.
  const canSeeTeamActivity = isPermissionAllowed("vendors.view", currentUser);

  // Actividad operativa por vendedor (hoy). Solo se construye si el permiso
  // esta otorgado para no gastar ciclos en datos que no se van a renderizar.
  type ActivityState = "red" | "green" | "amber" | "gray";
  type ActivityRow = {
    key: string;
    name: string;
    pending: number;
    overdue: number;
    doneToday: number;
    state: ActivityState;
  };
  const todayKey = new Date().toISOString().slice(0, 10);
  const activityRows: ActivityRow[] = canSeeTeamActivity
    ? (() => {
        type Bucket = { pending: number; overdue: number; doneToday: number };
        const buckets = new Map<string, Bucket>();
        for (const t of tasksRaw) {
          const key = t.assigned_salesperson_id
            ? String(t.assigned_salesperson_id)
            : "unassigned";
          let bucket = buckets.get(key);
          if (!bucket) {
            bucket = { pending: 0, overdue: 0, doneToday: 0 };
            buckets.set(key, bucket);
          }
          const status = String(t.status || "").toLowerCase();
          const dueKey = t.due_date ? String(t.due_date).slice(0, 10) : null;
          const updKey = t.updated_at
            ? String(t.updated_at).slice(0, 10)
            : null;
          if (status === "pending") {
            bucket.pending += 1;
            if (dueKey && dueKey < todayKey) bucket.overdue += 1;
          } else if (status === "done" && updKey === todayKey) {
            bucket.doneToday += 1;
          }
        }
        return Array.from(buckets.entries())
          .map(([key, b]) => {
            const name =
              key === "unassigned"
                ? "Sin asignar"
                : vendorNameBySpId.get(key) || `${key.slice(0, 8)}…`;
            let state: ActivityState;
            if (b.overdue > 0) state = "red";
            else if (b.doneToday > 0) state = "green";
            else if (b.pending > 0) state = "amber";
            else state = "gray";
            return {
              key,
              name,
              pending: b.pending,
              overdue: b.overdue,
              doneToday: b.doneToday,
              state,
            };
          })
          .sort(
            (a, b) =>
              b.overdue - a.overdue ||
              b.pending - a.pending ||
              a.name.localeCompare(b.name),
          );
      })()
    : [];

  // Detalle de tareas atrasadas por vendedor (top 5, ordenadas por due_date asc).
  // Solo se materializa si el bloque es visible.
  const OVERDUE_DETAIL_LIMIT = 5;
  const overdueDetailByVendor = canSeeTeamActivity
    ? (() => {
        const grouped = new Map<string, Task[]>();
        for (const t of tasksRaw) {
          const status = String(t.status || "").toLowerCase();
          if (status !== "pending") continue;
          const dueKey = t.due_date ? String(t.due_date).slice(0, 10) : null;
          if (!dueKey || dueKey >= todayKey) continue;
          const key = t.assigned_salesperson_id
            ? String(t.assigned_salesperson_id)
            : "unassigned";
          const list = grouped.get(key) || [];
          list.push(t);
          grouped.set(key, list);
        }
        for (const list of grouped.values()) {
          list.sort((a, b) =>
            String(a.due_date || "").localeCompare(String(b.due_date || "")),
          );
        }
        return grouped;
      })()
    : new Map<string, Task[]>();

  // Alertas inteligentes derivadas del desempeno por vendedor.
  const alerts = buildAlerts(performanceRows);

  // Detalle de la alerta "tareas sin asignar": top 5 mas recientes,
  // solo status pending y assigned_salesperson_id null/vacio.
  const unassignedTasksDetail = tasksRaw
    .filter((t) => {
      const noAssignee = !t.assigned_salesperson_id;
      const isPending = String(t.status || "").toLowerCase() === "pending";
      return noAssignee && isPending;
    })
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 5);

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

  // Estado del acordeon "Descuadre CRM vs Tango". Solo admin/supervisor lo ven.
  // No se persiste; se reinicia en cada carga del panel.
  const [descuadreState, setDescuadreState] = useState<DescuadreState>("idle");
  const [descuadreData, setDescuadreData] = useState<DescuadreData | null>(null);
  const [descuadreError, setDescuadreError] = useState<string | null>(null);
  const [showDescuadreDetail, setShowDescuadreDetail] = useState(false);

  const handleDescuadreCheck = async () => {
    setDescuadreState("loading");
    setDescuadreError(null);
    try {
      const response = await authFetch("/api/tango/sync", { method: "POST" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      const ext = json.external_sales || {};
      setDescuadreData({
        count: Number(ext.count || 0),
        sample: Array.isArray(ext.sample) ? ext.sample : [],
        motivos: ext.motivos || {},
        truncated: Boolean(ext.truncated),
        lastChecked: new Date().toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit" }),
      });
      setDescuadreState("success");
    } catch (err) {
      console.error("Error verificando descuadre:", err);
      setDescuadreError(err instanceof Error ? err.message : "Error desconocido");
      setDescuadreState("error");
    }
  };

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
            {alerts.map((a, i) => {
              if (a.kind === "unassigned_tasks") {
                return (
                  <details key={i} className={`text-sm ${getAlertClass(a.type)} group`}>
                    <summary className="cursor-pointer flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
                      <span>{a.text}</span>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180 opacity-70" />
                    </summary>
                    <div className="mt-2 pt-2 border-t border-slate-500/20 space-y-1">
                      {unassignedTasksDetail.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          No hay tareas pending sin asignar (la cuenta refleja todos los estados).
                        </p>
                      ) : (
                        unassignedTasksDetail.map((t) => {
                          const clientId = t.related_client_id ? String(t.related_client_id) : null;
                          const clientName = clientId ? clientNameById.get(clientId) || null : null;
                          return (
                            <div key={t.id} className="flex items-start justify-between gap-2 text-xs">
                              <div className="flex-1 min-w-0">
                                {clientName && clientId ? (
                                  <Link
                                    to={`/clientes?openClient=${clientId}`}
                                    className="text-blue-300 hover:text-blue-200 font-medium"
                                  >
                                    {clientName}
                                  </Link>
                                ) : (
                                  <span className="text-slate-500">— sin cliente</span>
                                )}
                                <span className="text-slate-400"> · {t.title || "Sin título"}</span>
                              </div>
                              <span className="text-slate-500 whitespace-nowrap shrink-0">
                                {formatDate(t.created_at || null)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </details>
                );
              }
              return (
                <div key={i} className={`text-sm ${getAlertClass(a.type)}`}>
                  {a.text}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* (1.5) Descuadre CRM vs Tango — solo admin/supervisor */}
      {isAdmin && (
        <details className="rounded-lg border border-slate-700 bg-slate-800/50 group" open={descuadreState === "success" && descuadreData !== null && descuadreData.count > 0}>
          <summary className="cursor-pointer p-4 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden gap-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ShieldAlert className={`w-5 h-5 ${descuadreState === "success" && descuadreData && descuadreData.count > 0 ? "text-amber-300" : "text-slate-400"}`} />
              Descuadre CRM vs Tango
            </h2>
            <div className="flex items-center gap-3">
              {descuadreState === "success" && descuadreData && (
                <span className={`text-sm ${descuadreData.count > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                  {descuadreData.count > 0
                    ? `${descuadreData.count.toLocaleString("es-PR")} fuera`
                    : "Sin descuadre"}
                </span>
              )}
              <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
            </div>
          </summary>
          <div className="p-4 pt-0">
            {descuadreState === "idle" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  Detecta ventas que están en Tango pero no en el CRM
                  (BAN no existe en CRM o venta sin BAN).
                </p>
                <p className="text-xs text-amber-200/80 bg-amber-500/10 border border-amber-500/20 rounded p-2">
                  Ejecutar verificación dispara un sync con Tango (puede tardar unos segundos).
                </p>
                <button
                  type="button"
                  onClick={handleDescuadreCheck}
                  className="inline-flex items-center gap-2 rounded border border-blue-500/40 bg-blue-500/15 hover:bg-blue-500/25 text-blue-200 px-3 py-1.5 text-sm font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Ejecutar verificación de descuadre (sync Tango)
                </button>
              </div>
            )}

            {descuadreState === "loading" && (
              <div className="h-24 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Sincronizando con Tango...</span>
              </div>
            )}

            {descuadreState === "error" && (
              <div className="space-y-3">
                <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded p-2">
                  Error: {descuadreError || "no se pudo completar el sync"}
                </p>
                <button
                  type="button"
                  onClick={handleDescuadreCheck}
                  className="inline-flex items-center gap-2 rounded border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-200 px-3 py-1.5 text-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reintentar
                </button>
              </div>
            )}

            {descuadreState === "success" && descuadreData && (() => {
              // Filtramos external_sales para mostrar solo desde 2026-01-01.
              // Las ventas anteriores (historicas) se ignoran como ruido.
              const sample2026 = descuadreData.sample.filter(isExternalSaleFrom2026);
              const motivos2026 = sample2026.reduce<Record<string, number>>((acc, s) => {
                acc[s.motivo] = (acc[s.motivo] || 0) + 1;
                return acc;
              }, {});
              const hasAnyVisible = sample2026.length > 0;
              return (
              <div className="space-y-3">
                {descuadreData.count === 0 ? (
                  <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded p-2">
                    Sin descuadre. Todas las ventas Tango filtradas están en CRM.
                  </p>
                ) : !hasAnyVisible ? (
                  <div className="space-y-2">
                    <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded p-2">
                      Sin descuadre desde 2026-01-01. Todas las ventas Tango recientes están en CRM.
                    </p>
                    <p className="text-xs text-slate-500">
                      Total reportado por el sync (incluye históricos): {descuadreData.count.toLocaleString("es-PR")}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-amber-200">
                      <strong className="text-amber-100">{sample2026.length.toLocaleString("es-PR")}</strong> ventas Tango desde 2026-01-01 fuera del CRM
                      <span className="text-xs text-slate-500"> (en muestra de {descuadreData.sample.length.toLocaleString("es-PR")})</span>
                    </p>
                    <div className="text-xs text-slate-400 space-y-0.5">
                      {Object.entries(motivos2026).map(([motivo, n]) => (
                        <div key={motivo}>
                          <span className="text-slate-500">{motivo}:</span>{" "}
                          <span className="text-slate-300">{Number(n).toLocaleString("es-PR")}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 italic">
                      Total reportado por el sync (incluye históricos pre-2026): {descuadreData.count.toLocaleString("es-PR")}.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Última verificación: {descuadreData.lastChecked}</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleDescuadreCheck}
                    className="inline-flex items-center gap-2 rounded border border-slate-600 bg-slate-700/40 hover:border-blue-400/50 text-slate-200 hover:text-blue-200 px-3 py-1.5 text-sm font-medium transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Verificar de nuevo
                  </button>
                  {hasAnyVisible && (
                    <button
                      type="button"
                      onClick={() => setShowDescuadreDetail((v) => !v)}
                      className="inline-flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 px-3 py-1.5 text-sm font-medium transition-colors"
                    >
                      {showDescuadreDetail ? "Ocultar detalle" : `Ver detalle (${sample2026.length} casos 2026+)`}
                    </button>
                  )}
                </div>

                {showDescuadreDetail && hasAnyVisible && (
                  <div className="space-y-2">
                    {descuadreData.truncated && (
                      <p className="text-xs text-slate-400">
                        Sample del backend truncado a {descuadreData.sample.length.toLocaleString("es-PR")} de {descuadreData.count.toLocaleString("es-PR")} totales (incluye pre-2026). Acá se muestran solo los {sample2026.length.toLocaleString("es-PR")} con fechaactivacion ≥ 2026-01-01.
                      </p>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700 text-slate-400">
                            <th className="text-left py-2 pr-3 font-semibold">BAN</th>
                            <th className="text-left py-2 px-3 font-semibold">Cliente</th>
                            <th className="text-left py-2 px-3 font-semibold">Vendedor</th>
                            <th className="text-left py-2 px-3 font-semibold">Fecha</th>
                            <th className="text-right py-2 px-3 font-semibold">Monto</th>
                            <th className="text-left py-2 pl-3 font-semibold">Tipo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/60">
                          {sample2026.map((s, i) => {
                            const tipoLabel = VENTATIPO_LABELS[s.ventatipoid] || `Tipo ${s.ventatipoid}`;
                            return (
                              <tr key={`${s.tango_ventaid}-${i}`} className="text-slate-200">
                                <td className="py-2 pr-3">
                                  {s.ban ? (
                                    <Link
                                      to={`/clientes?searchBan=${encodeURIComponent(s.ban)}`}
                                      className="text-blue-300 hover:text-blue-200 font-mono text-xs"
                                    >
                                      {s.ban}
                                    </Link>
                                  ) : (
                                    <span className="text-slate-500 italic text-xs">sin BAN</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-slate-300 text-xs">{s.cliente || "-"}</td>
                                <td className="py-2 px-3 text-slate-300 text-xs">{s.vendedor || "-"}</td>
                                <td className="py-2 px-3 text-slate-400 text-xs">{s.fechaactivacion || "-"}</td>
                                <td className="py-2 px-3 text-right text-slate-300 text-xs">{formatUSD(Number(s.com_empresa || 0))}</td>
                                <td className="py-2 pl-3 text-slate-400 text-xs">{tipoLabel}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}
          </div>
        </details>
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
                    <th className="text-center py-2 px-3 font-semibold">En progreso</th>
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
                        <td className="py-2 px-3 text-center text-blue-300">{row.in_progress}</td>
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

      {/* (4.5) Actividad de vendedores hoy — solo con permiso vendors.view */}
      {canSeeTeamActivity && (
        <details className="rounded-lg border border-slate-700 bg-slate-800/50 group">
          <summary className="cursor-pointer p-4 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden gap-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-300" />
              Actividad de vendedores hoy
              <span className="text-sm font-normal text-slate-400">
                ({activityRows.length}{" "}
                {activityRows.length === 1 ? "vendedor" : "vendedores"})
              </span>
            </h2>
            <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-slate-700 p-4">
            {tasksApi.loading ? (
              <p className="text-sm text-slate-400 italic">Cargando...</p>
            ) : activityRows.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                Sin actividad registrada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-700">
                      <th className="py-2 pr-3 font-medium">Vendedor</th>
                      <th className="py-2 px-3 text-center font-medium">
                        Pendientes
                      </th>
                      <th className="py-2 px-3 text-center font-medium">
                        Atrasadas
                      </th>
                      <th className="py-2 px-3 text-center font-medium">
                        Hechas hoy
                      </th>
                      <th className="py-2 px-3 text-right font-medium">
                        Estado
                      </th>
                      <th className="py-2 pl-3 text-right font-medium w-24">
                        {/* acciones */}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityRows.map((row) => {
                      const stateLabel =
                        row.state === "red"
                          ? "Atrasado"
                          : row.state === "green"
                            ? "Al día"
                            : row.state === "amber"
                              ? "Pendiente"
                              : "Sin actividad";
                      const stateCls =
                        row.state === "red"
                          ? "text-red-300 bg-red-500/10 border-red-500/30"
                          : row.state === "green"
                            ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                            : row.state === "amber"
                              ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
                              : "text-slate-400 bg-slate-500/10 border-slate-500/30";
                      const isExpanded = expandedActivityKeys.has(row.key);
                      const overdueList =
                        overdueDetailByVendor.get(row.key) || [];
                      const visibleOverdue = overdueList.slice(
                        0,
                        OVERDUE_DETAIL_LIMIT,
                      );
                      const extraOverdue = Math.max(
                        0,
                        overdueList.length - OVERDUE_DETAIL_LIMIT,
                      );
                      return (
                        <Fragment key={row.key}>
                          <tr className="border-b border-slate-700/50 last:border-0">
                            <td className="py-2 pr-3 text-slate-100">
                              {row.name}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-300">
                              {row.pending}
                            </td>
                            <td
                              className={`py-2 px-3 text-center font-semibold ${row.overdue > 0 ? "text-red-300" : "text-slate-500"}`}
                            >
                              {row.overdue}
                            </td>
                            <td
                              className={`py-2 px-3 text-center font-semibold ${row.doneToday > 0 ? "text-emerald-300" : "text-slate-500"}`}
                            >
                              {row.doneToday}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span
                                className={`inline-block text-xs px-2 py-0.5 rounded border ${stateCls}`}
                              >
                                {stateLabel}
                              </span>
                            </td>
                            <td className="py-2 pl-3 text-right">
                              {row.overdue > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleActivityExpand(row.key)
                                  }
                                  className="text-xs text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline"
                                >
                                  {isExpanded
                                    ? "Ocultar"
                                    : `Ver atrasadas (${row.overdue})`}
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && row.overdue > 0 && (
                            <tr className="bg-slate-900/40 border-b border-slate-700/50">
                              <td colSpan={6} className="py-3 px-4">
                                {visibleOverdue.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic">
                                    Sin detalle disponible.
                                  </p>
                                ) : (
                                  <ul className="space-y-1.5">
                                    {visibleOverdue.map((t) => {
                                      const cid = t.related_client_id
                                        ? String(t.related_client_id)
                                        : null;
                                      const cname = cid
                                        ? clientNameById.get(cid) || null
                                        : null;
                                      return (
                                        <li
                                          key={t.id}
                                          className="text-xs flex items-start justify-between gap-3"
                                        >
                                          <div className="flex-1 min-w-0">
                                            <span className="text-slate-100">
                                              {t.title || "Sin título"}
                                            </span>
                                            {cname && cid ? (
                                              <>
                                                <span className="text-slate-500">
                                                  {" · "}
                                                </span>
                                                <Link
                                                  to={`/clientes?openClient=${cid}`}
                                                  className="text-blue-300 hover:text-blue-200"
                                                >
                                                  {cname}
                                                </Link>
                                              </>
                                            ) : (
                                              <span className="text-slate-500">
                                                {" · sin cliente"}
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-red-300 whitespace-nowrap shrink-0">
                                            Vencía{" "}
                                            {formatDate(t.due_date || null)}
                                          </span>
                                        </li>
                                      );
                                    })}
                                    {extraOverdue > 0 && (
                                      <li className="text-xs text-slate-400 italic pt-1">
                                        +{extraOverdue} más atrasada
                                        {extraOverdue === 1 ? "" : "s"}
                                      </li>
                                    )}
                                  </ul>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      )}

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
