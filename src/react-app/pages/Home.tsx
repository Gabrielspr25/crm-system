import { useMemo, useState } from "react";
import { AlertCircle, Check, ClipboardCheck, LayoutDashboard, Loader2, Plus } from "lucide-react";
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

type SubscriberReportRow = {
  subscriber_id: string;
  vendor_id?: string | null;
  vendor_name?: string | null;
  line_kind?: "movil" | "fijo" | null;
  line_type?: string | null;
  company_earnings?: number | string | null;
  vendor_commission?: number | string | null;
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

// Helpers de fecha para selector mes/año
function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function getPreviousMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return yyyymm;
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function formatMonthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return yyyymm;
  const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${months[m - 1]} ${y}`;
}

export default function Home() {
  // ── Filtros del Panel General ──
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentYearMonth);
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>(""); // "" = todos (admin) | salesperson_id

  const previousMonth = getPreviousMonth(selectedMonth);
  const [yyyy, mm] = selectedMonth.split("-").map(Number);

  const { data, loading, error } = useApi<ClientsResponse>("/api/clients?tab=active");
  const tasksApi = useApi<Task[]>("/api/agents/tasks?limit=500");
  // Mes seleccionado (default: mes en curso)
  const goalsApi = useApi<GoalsResponse>(`/api/goals/performance?month=${selectedMonth}`);
  const reportsApi = useApi<SubscriberReportRow[]>(
    `/api/subscriber-reports?month=${selectedMonth}`,
  );
  const productGoalsApi = useApi<{ business: Record<string, number>; vendors: Array<{ vendor_id: number; vendor_name: string; salesperson_id?: string | null; goals: Record<string, number>; goalsByName?: Record<string, number> }> }>(
    `/api/gestion/goals?year=${yyyy}&month=${mm}`,
  );
  // Mes anterior — para deltas/comparativa (sugerencia A)
  const reportsPrevApi = useApi<SubscriberReportRow[]>(
    `/api/subscriber-reports?month=${previousMonth}`,
  );
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

  // Top 5 vendedores con menor cumplimiento.
  // Excluye "Sin asignar" (no es un vendedor real) y filas con total=0
  // (pct=0 ficticio). El orden ya viene asc por % desde performanceRows.
  const bottomPerformers = performanceRows
    .filter((r) => r.key !== "unassigned" && r.total > 0)
    .slice(0, 5);

  // ── Bloque final lanzamiento: cruzar metas + comisiones + tareas por vendedor ──
  const reportsRaw = Array.isArray(reportsApi.data) ? reportsApi.data : [];

  type VendorMetric = {
    key: string; // salesperson_id o nombre upper
    vendor_name: string;
    has_meta: boolean;
    total_goal: number;
    total_earned: number;
    pct_meta: number; // 0 si !has_meta
    remaining: number;
    commission: number;
    sales_count: number;
    products_movil: number;
    products_fijo: number;
    tasks_total: number;
    tasks_done: number;
    tasks_pending: number;
    tasks_in_progress: number;
    pct_tareas: number;
    state: "verde" | "amarillo" | "rojo" | "gris";
  };

  // Indexar por salesperson_id (UUID) cuando exista, fallback a nombre upper.
  const vendorMetricsMap = new Map<string, VendorMetric>();

  const upsert = (key: string, name: string): VendorMetric => {
    let m = vendorMetricsMap.get(key);
    if (!m) {
      m = {
        key,
        vendor_name: name,
        has_meta: false,
        total_goal: 0,
        total_earned: 0,
        pct_meta: 0,
        remaining: 0,
        commission: 0,
        sales_count: 0,
        products_movil: 0,
        products_fijo: 0,
        tasks_total: 0,
        tasks_done: 0,
        tasks_pending: 0,
        tasks_in_progress: 0,
        pct_tareas: 0,
        state: "gris",
      };
      vendorMetricsMap.set(key, m);
    }
    if (!m.vendor_name && name) m.vendor_name = name;
    return m;
  };

  // 1) Metas y vendido (de /api/goals/performance)
  const goalsVendorsForMetrics = Array.isArray(goalsApi.data?.vendors) ? goalsApi.data.vendors : [];
  for (const v of goalsVendorsForMetrics) {
    const key = v.salesperson_id ? String(v.salesperson_id) : `name:${String(v.vendor_name || "").toUpperCase()}`;
    const m = upsert(key, v.vendor_name || "");
    const goal = Number(v.total_goal || 0);
    const earned = Number(v.total_earned || 0);
    m.total_goal = goal;
    m.total_earned = earned;
    m.has_meta = goal > 0;
    m.pct_meta = goal > 0 ? Math.round((earned / goal) * 1000) / 10 : 0;
    m.remaining = Math.max(0, goal - earned);
  }

  // 2) Comisiones (de /api/subscriber-reports?month=...)
  for (const r of reportsRaw) {
    const key = r.vendor_id
      ? String(r.vendor_id)
      : `name:${String(r.vendor_name || "").toUpperCase()}`;
    const m = upsert(key, r.vendor_name || "");
    const vc = Number(r.vendor_commission || 0);
    if (Number.isFinite(vc)) m.commission += vc;
    m.sales_count += 1;
    if (r.line_kind === "movil") m.products_movil += 1;
    else if (r.line_kind === "fijo") m.products_fijo += 1;
  }

  // 3) Tareas (de /api/agents/tasks, ya agrupadas en performanceRows)
  for (const p of performanceRows) {
    if (p.key === "unassigned") continue;
    const m = upsert(p.key, p.name);
    m.tasks_total = p.total;
    m.tasks_done = p.done;
    m.tasks_pending = p.pending;
    m.tasks_in_progress = p.in_progress;
    m.pct_tareas = p.pct;
  }

  // Estado del vendedor (heuristica simple):
  //   verde:    has_meta && pct_meta >= 70 && tasks_pending < 10
  //   amarillo: has_meta && (pct_meta >= 40 OR tasks_pending entre 10 y 19)
  //   rojo:     has_meta && pct_meta < 40 OR tasks_pending >= 20 OR sin ventas con tareas
  //   gris:     sin meta y sin actividad
  const computeState = (m: VendorMetric): VendorMetric["state"] => {
    if (!m.has_meta && m.tasks_total === 0 && m.commission === 0) return "gris";
    const lowConv = m.tasks_done >= 5 && m.commission === 0;
    if (m.has_meta) {
      if (m.pct_meta >= 70 && m.tasks_pending < 10) return "verde";
      if (m.pct_meta >= 40 && m.tasks_pending < 20 && !lowConv) return "amarillo";
      return "rojo";
    }
    // Sin meta: rojo si hay actividad sin resultados, amarillo si hay actividad con resultados
    if (m.tasks_pending >= 10 || lowConv) return "rojo";
    if (m.tasks_total > 0 || m.commission > 0) return "amarillo";
    return "gris";
  };
  for (const m of vendorMetricsMap.values()) {
    m.state = computeState(m);
  }

  const vendorMetricsRows: VendorMetric[] = Array.from(vendorMetricsMap.values())
    .filter((m) => m.has_meta || m.tasks_total > 0 || m.commission > 0)
    .sort((a, b) => a.vendor_name.localeCompare(b.vendor_name));

  // ── Vista personal: vendedor o admin que selecciona un vendedor ──
  // Si admin tiene selectedVendorFilter -> ve panel personal de ese vendedor.
  // Si admin sin filtro ("Todos") -> ve agregado del equipo en otro layout.
  // Vendedor: siempre ve lo suyo.
  const targetSalespersonId = !isAdmin
    ? mySalespersonId
    : (selectedVendorFilter || null);
  const showAdminAggregate = isAdmin && !selectedVendorFilter;

  // myMetric: meta, vendido, comisión, ventas, móvil, fijo, tareas (del vendedor objetivo)
  const myMetric = targetSalespersonId ? vendorMetricsMap.get(targetSalespersonId) : null;
  // Sus clientes (del listado ya cargado de /api/clients?tab=active)
  const myClients = targetSalespersonId
    ? clients.filter((c) => c.salesperson_id && String(c.salesperson_id) === targetSalespersonId)
    : [];
  const myClientsCount = myClients.length;
  const myClientsFollowedRecently = myClients.filter((c) => c.recent_followup).length;
  const myClientsWithoutFollowup = myClients.filter((c) => !c.recent_followup);

  // ── Metas por producto del vendedor logueado ──
  // Regla de negocio (definida por Gabriel 2026-04-30):
  //   - Movil Ren / Movil New  → meta en CANTIDAD de líneas (achieved = count)
  //   - Fijo Ren / Fijo New / MPLS / Claro TV / Cloud → meta en USD (achieved = SUM company_earnings)
  type GoalUnit = "USD" | "LINES";
  const goalUnitOf = (productName: string): GoalUnit => {
    const n = productName.toLowerCase();
    if (n.includes("movil") || n.includes("móvil")) return "LINES";
    return "USD"; // Fijo, MPLS, Claro TV, Cloud
  };
  type ProductMetric = { name: string; target: number; achievedCommission: number; companyEarnings: number; lines: number; pct: number; unit: GoalUnit };
  const myProductMetrics: ProductMetric[] = (() => {
    if (!targetSalespersonId) return [];
    const allVendorGoals = productGoalsApi.data?.vendors || [];
    const myGoals = allVendorGoals.find((v) => String(v.salesperson_id || "") === targetSalespersonId);
    if (!myGoals || !myGoals.goalsByName) return [];

    const myReports = (Array.isArray(reportsApi.data) ? reportsApi.data : []).filter((r: any) => {
      return r.salesperson_id ? String(r.salesperson_id) === targetSalespersonId : true;
    });
    const labelOf = (r: any): string | null => {
      const k = String(r.line_kind || "").toLowerCase();
      const t = String(r.line_type || "").toUpperCase();
      if (k === "movil" && t === "REN") return "Movil Ren";
      if (k === "movil" && t === "NEW") return "Movil New";
      if (k === "fijo"  && t === "REN") return "Fijo Ren";
      if (k === "fijo"  && t === "NEW") return "Fijo New";
      return null;
    };
    const achievedByProduct = new Map<string, { commission: number; lines: number; earnings: number }>();
    for (const r of myReports) {
      const label = labelOf(r);
      if (!label) continue;
      const cur = achievedByProduct.get(label) || { commission: 0, lines: 0, earnings: 0 };
      cur.commission += Number((r as any).vendor_commission || 0);
      cur.earnings += Number((r as any).company_earnings || 0);
      cur.lines += 1;
      achievedByProduct.set(label, cur);
    }
    const orderedNames = ["Fijo Ren", "Fijo New", "Movil Ren", "Movil New", "Claro TV", "Cloud", "MPLS"];
    const goalsByName = myGoals.goalsByName as Record<string, number>;
    const allNames = new Set<string>([...Object.keys(goalsByName), ...achievedByProduct.keys()]);
    return orderedNames
      .filter((n) => allNames.has(n))
      .concat([...allNames].filter((n) => !orderedNames.includes(n)))
      .map((name) => {
        const target = Number(goalsByName[name] || 0);
        const ach = achievedByProduct.get(name) || { commission: 0, lines: 0, earnings: 0 };
        const unit = goalUnitOf(name);
        // Móvil: meta = líneas, cumplido = líneas vendidas.
        // Fijo/MPLS/ClaroTV/Cloud: meta = USD de comisión, cumplido = comisión cobrada.
        const achievedForPct = unit === "LINES" ? ach.lines : ach.commission;
        const pct = target > 0 ? Math.round((achievedForPct / target) * 1000) / 10 : 0;
        return { name, target, achievedCommission: ach.commission, companyEarnings: ach.earnings, lines: ach.lines, pct, unit };
      });
  })();
  const hasAnyProductGoal = myProductMetrics.some((p) => p.target > 0);

  // ── Comisiones por cliente (del vendedor objetivo) ──
  type ClientCommission = { client_id: string; client_name: string; vendor_name: string; lines: number; commission: number };
  const myCommissionsByClient: ClientCommission[] = (() => {
    const reports = Array.isArray(reportsApi.data) ? reportsApi.data : [];
    // Filtrar por vendedor objetivo si hay; admin "Todos" ve todos.
    const filtered = targetSalespersonId
      ? reports.filter((r: any) => r.salesperson_id ? String(r.salesperson_id) === targetSalespersonId : false)
      : reports;
    const byClient = new Map<string, ClientCommission>();
    for (const r of filtered as any[]) {
      const cid = r.client_id ? String(r.client_id) : "_sin_id";
      const name = r.client_business_name || r.client_name || "Sin nombre";
      const vname = r.vendor_name || "—";
      const cur = byClient.get(cid) || { client_id: cid, client_name: name, vendor_name: vname, lines: 0, commission: 0 };
      cur.lines += 1;
      cur.commission += Number(r.vendor_commission || 0);
      byClient.set(cid, cur);
    }
    return Array.from(byClient.values()).sort((a, b) => b.commission - a.commission);
  })();

  // ── Comparativa con mes anterior (sugerencia A) ──
  // Comisión total del vendedor objetivo en el mes anterior.
  const previousMonthCommission = (() => {
    const reports = Array.isArray(reportsPrevApi.data) ? reportsPrevApi.data : [];
    const filtered = targetSalespersonId
      ? reports.filter((r: any) => r.salesperson_id ? String(r.salesperson_id) === targetSalespersonId : false)
      : reports;
    return filtered.reduce((s: number, r: any) => s + Number(r.vendor_commission || 0), 0);
  })();
  const previousMonthSales = (() => {
    const reports = Array.isArray(reportsPrevApi.data) ? reportsPrevApi.data : [];
    const filtered = targetSalespersonId
      ? reports.filter((r: any) => r.salesperson_id ? String(r.salesperson_id) === targetSalespersonId : false)
      : reports;
    return filtered.length;
  })();
  const currentCommission = myMetric?.commission || 0;
  const commissionDelta = previousMonthCommission > 0 ? ((currentCommission - previousMonthCommission) / previousMonthCommission) * 100 : null;
  const currentSales = myMetric?.sales_count || 0;
  const salesDelta = previousMonthSales > 0 ? ((currentSales - previousMonthSales) / previousMonthSales) * 100 : null;

  // ── Alertas de productos sin avance (sugerencia C) ──
  const productsAtRisk = myProductMetrics.filter((p) => p.target > 0 && p.pct < 30);

  // ── KPI cumplimiento REAL (promedio % por producto, cap 100% c/u) ──
  // Esto refleja la realidad: si tenés 1 producto en 226% y 5 en 0%, el cap
  // a 100% en ese 1 + el promedio de los demás da una cifra honesta (≈17%),
  // no engañosa (era 182% antes). Productos sin meta no cuentan.
  const cumplimientoRealOf = (productMetrics: { target: number; pct: number }[]) => {
    const withGoal = productMetrics.filter((p) => p.target > 0);
    if (withGoal.length === 0) return 0;
    const sum = withGoal.reduce((s, p) => s + Math.min(100, p.pct), 0);
    return Math.round((sum / withGoal.length) * 10) / 10;
  };
  const myCumplimientoReal = cumplimientoRealOf(myProductMetrics);
  // Suma de metas USD del vendedor (KPI "META")
  const myMetaUSDTotal = myProductMetrics
    .filter((p) => p.unit === "USD" && p.target > 0)
    .reduce((s, p) => s + p.target, 0);

  // ── Tareas por estado (vendedor objetivo o equipo) ──
  const tasksByState = (() => {
    const filtered = tasksRaw.filter((t) => {
      const assigned = t.assigned_salesperson_id ? String(t.assigned_salesperson_id) : null;
      if (showAdminAggregate) return true; // admin "Todos" → todas
      if (targetSalespersonId) return assigned === targetSalespersonId;
      return false;
    });
    let pending = 0, in_progress = 0, done = 0;
    for (const t of filtered) {
      const s = String(t.status || "").toLowerCase();
      if (s === "pending") pending++;
      else if (s === "in_progress" || s === "doing") in_progress++;
      else if (s === "done" || s === "completed") done++;
    }
    return { pending, in_progress, done, total: filtered.length };
  })();

  // ── Top 5 clientes sin seguimiento (críticos = mayor priority_score) ──
  // Fuente: clientes ya cargados en /api/clients?tab=active.
  // Vendedor: solo los suyos. Admin sin filtro: todos los del equipo.
  // Admin con vendor X: los del vendor X.
  const baseSinSeguimiento = (() => {
    if (showAdminAggregate) return clientsWithoutRecentFollowup;
    if (targetSalespersonId) {
      return clients.filter((c) =>
        !c.recent_followup &&
        c.salesperson_id &&
        String(c.salesperson_id) === targetSalespersonId
      );
    }
    return [];
  })();
  const topSinSeguimiento = [...baseSinSeguimiento]
    .sort((a, b) => toNumber(b.priority_score) - toNumber(a.priority_score))
    .slice(0, 5);

  // ── Agregados del EQUIPO para gráfico de productos (admin "Todos") ──
  // Suma metas y achieved de cada producto cross-vendedor.
  type TeamProductMetric = { name: string; unit: GoalUnit; target: number; achieved: number; lines: number; pct: number };
  const teamProductMetrics: TeamProductMetric[] = (() => {
    if (!showAdminAggregate) return [];
    const allVendorGoals = productGoalsApi.data?.vendors || [];
    const reports = Array.isArray(reportsApi.data) ? reportsApi.data : [];
    const labelOf = (r: any): string | null => {
      const k = String(r.line_kind || "").toLowerCase();
      const t = String(r.line_type || "").toUpperCase();
      if (k === "movil" && t === "REN") return "Movil Ren";
      if (k === "movil" && t === "NEW") return "Movil New";
      if (k === "fijo"  && t === "REN") return "Fijo Ren";
      if (k === "fijo"  && t === "NEW") return "Fijo New";
      return null;
    };
    // Suma metas del equipo por producto.
    const targetByProduct = new Map<string, number>();
    for (const vg of allVendorGoals) {
      const goalsByName = (vg as any).goalsByName as Record<string, number> | undefined;
      if (!goalsByName) continue;
      for (const [name, target] of Object.entries(goalsByName)) {
        if (!Number.isFinite(target) || target <= 0) continue;
        targetByProduct.set(name, (targetByProduct.get(name) || 0) + Number(target));
      }
    }
    // Suma achieved del equipo por producto.
    const achByProduct = new Map<string, { commission: number; lines: number }>();
    for (const r of reports as any[]) {
      const label = labelOf(r);
      if (!label) continue;
      const cur = achByProduct.get(label) || { commission: 0, lines: 0 };
      cur.commission += Number(r.vendor_commission || 0);
      cur.lines += 1;
      achByProduct.set(label, cur);
    }
    const orderedNames = ["Fijo Ren", "Fijo New", "Movil Ren", "Movil New", "Claro TV", "Cloud", "MPLS"];
    const allNames = new Set<string>([...targetByProduct.keys(), ...achByProduct.keys()]);
    return orderedNames
      .filter((n) => allNames.has(n))
      .concat([...allNames].filter((n) => !orderedNames.includes(n)))
      .map((name) => {
        const target = targetByProduct.get(name) || 0;
        const ach = achByProduct.get(name) || { commission: 0, lines: 0 };
        const unit = goalUnitOf(name);
        const achievedForPct = unit === "LINES" ? ach.lines : ach.commission;
        const pct = target > 0 ? Math.round((achievedForPct / target) * 1000) / 10 : 0;
        return { name, unit, target, achieved: ach.commission, lines: ach.lines, pct };
      });
  })();
  // Cumplimiento real agregado del equipo (mismo criterio: cap 100% por producto)
  const teamCumplimientoReal = cumplimientoRealOf(teamProductMetrics);
  const teamMetaUSDTotal = teamProductMetrics
    .filter((p) => p.unit === "USD" && p.target > 0)
    .reduce((s, p) => s + p.target, 0);
  // Totales de ventas y ganancia empresa del equipo
  const allReports = Array.isArray(reportsApi.data) ? reportsApi.data : [];
  const teamSalesCount = allReports.length;
  const teamCommissionTotal = allReports.reduce((s: number, r: any) => s + Number(r.vendor_commission || 0), 0);
  const teamCompanyEarningsTotal = allReports.reduce((s: number, r: any) => s + Number(r.company_earnings || 0), 0);
  const teamPaidTotal = allReports.reduce((s: number, r: any) => s + Number(r.paid_amount || 0), 0);
  const teamCommissionsPending = Math.max(0, teamCommissionTotal - teamPaidTotal);

  // Comisiones a pagar del vendedor objetivo
  const myReportsForPay = targetSalespersonId
    ? allReports.filter((r: any) => String(r.salesperson_id || "") === targetSalespersonId)
    : [];
  const myPaidTotal = myReportsForPay.reduce((s: number, r: any) => s + Number(r.paid_amount || 0), 0);
  const myCommissionsPending = Math.max(0, (myMetric?.commission || 0) - myPaidTotal);

  // ── Detección de mes sin actividad ──
  // Modo "sin actividad" cuando NO hay ventas en el mes seleccionado.
  // Para vendedor: 0 ventas suyas. Para admin sin filtro: 0 ventas del equipo.
  // Para admin con vendor X: 0 ventas de ese vendor.
  const myActiveSalesCount = (myMetric?.sales_count || 0);
  const noActivity = showAdminAggregate ? teamSalesCount === 0 : (targetSalespersonId ? myActiveSalesCount === 0 : false);
  // Mes anterior con datos (sí hay reports → ofrecer "ir al mes anterior")
  const prevMonthReports = Array.isArray(reportsPrevApi.data) ? reportsPrevApi.data : [];
  const prevMonthHasData = showAdminAggregate
    ? prevMonthReports.length > 0
    : (targetSalespersonId
        ? prevMonthReports.some((r: any) => String(r.salesperson_id || "") === targetSalespersonId)
        : false);
  const prevMonthSalesCountForTarget = targetSalespersonId
    ? prevMonthReports.filter((r: any) => String(r.salesperson_id || "") === targetSalespersonId).length
    : prevMonthReports.length;

  // KPIs unificados según vista
  const kpiSalesCount = showAdminAggregate ? teamSalesCount : (myMetric?.sales_count || 0);
  const kpiMeta = showAdminAggregate ? teamMetaUSDTotal : myMetaUSDTotal;
  const kpiCumplimiento = showAdminAggregate ? teamCumplimientoReal : myCumplimientoReal;
  const kpiCompanyEarnings = showAdminAggregate ? teamCompanyEarningsTotal : (myMetric?.total_earned || 0);
  const kpiCommission = showAdminAggregate ? teamCommissionTotal : (myMetric?.commission || 0);
  const kpiCommissionsPending = showAdminAggregate ? teamCommissionsPending : myCommissionsPending;

  // ── Tarjetas por vendedor (admin "Todos") ──
  // Para cada vendedor activo: sus productos + cumplimiento real + stats.
  type VendorCard = {
    key: string;
    vendor_name: string;
    sales_count: number;
    commission: number;
    company_earnings: number;
    cumplimiento_real: number;
    state: "verde" | "amarillo" | "rojo" | "gris";
    tasks_pending: number;
    sin_seguimiento_count: number;
    products: ProductMetric[];
  };
  const vendorCards: VendorCard[] = (() => {
    if (!showAdminAggregate) return [];
    const allVendorGoals = productGoalsApi.data?.vendors || [];
    const reports = Array.isArray(reportsApi.data) ? reportsApi.data : [];
    const labelOf = (r: any): string | null => {
      const k = String(r.line_kind || "").toLowerCase();
      const t = String(r.line_type || "").toUpperCase();
      if (k === "movil" && t === "REN") return "Movil Ren";
      if (k === "movil" && t === "NEW") return "Movil New";
      if (k === "fijo"  && t === "REN") return "Fijo Ren";
      if (k === "fijo"  && t === "NEW") return "Fijo New";
      return null;
    };
    return vendorMetricsRows
      .filter((m) => m.has_meta || m.commission > 0 || m.tasks_pending > 0 || m.sales_count > 0)
      .map((m) => {
        // Productos del vendedor
        const myGoals = allVendorGoals.find((v) => String((v as any).salesperson_id || "") === m.key);
        const goalsByName = (myGoals as any)?.goalsByName as Record<string, number> | undefined;
        const myReports = reports.filter((r: any) => String(r.salesperson_id || "") === m.key);
        const ach = new Map<string, { commission: number; lines: number; earnings: number }>();
        for (const r of myReports as any[]) {
          const label = labelOf(r);
          if (!label) continue;
          const cur = ach.get(label) || { commission: 0, lines: 0, earnings: 0 };
          cur.commission += Number(r.vendor_commission || 0);
          cur.lines += 1;
          cur.earnings += Number(r.company_earnings || 0);
          ach.set(label, cur);
        }
        const orderedNames = ["Fijo Ren", "Fijo New", "Movil Ren", "Movil New", "Claro TV", "Cloud", "MPLS"];
        const allNames = new Set<string>([...(goalsByName ? Object.keys(goalsByName) : []), ...ach.keys()]);
        const products: ProductMetric[] = orderedNames
          .filter((n) => allNames.has(n))
          .map((name) => {
            const target = Number(goalsByName?.[name] || 0);
            const a = ach.get(name) || { commission: 0, lines: 0, earnings: 0 };
            const unit = goalUnitOf(name);
            const achievedForPct = unit === "LINES" ? a.lines : a.commission;
            const pct = target > 0 ? Math.round((achievedForPct / target) * 1000) / 10 : 0;
            return { name, target, achievedCommission: a.commission, companyEarnings: a.earnings, lines: a.lines, pct, unit };
          });
        const cumplimiento = cumplimientoRealOf(products);
        const sinSegCount = clients.filter((c) =>
          !c.recent_followup &&
          c.salesperson_id &&
          String(c.salesperson_id) === m.key
        ).length;
        // Estado en base al cumplimiento real (no al pct_meta engañoso)
        let state: VendorCard["state"] = "gris";
        if (cumplimiento >= 70) state = "verde";
        else if (cumplimiento >= 40) state = "amarillo";
        else if (m.has_meta || m.sales_count > 0) state = "rojo";
        return {
          key: m.key,
          vendor_name: m.vendor_name,
          sales_count: m.sales_count,
          commission: m.commission,
          company_earnings: m.total_earned,
          cumplimiento_real: cumplimiento,
          state,
          tasks_pending: m.tasks_pending,
          sin_seguimiento_count: sinSegCount,
          products,
        };
      })
      .sort((a, b) => b.cumplimiento_real - a.cumplimiento_real);
  })();

  // ── Vendedores sin actividad este mes (admin) ──
  // Vendedores con meta cargada o que tuvieron actividad en mes anterior
  // pero 0 ventas este mes.
  type InactiveVendor = { key: string; vendor_name: string; had_meta: boolean; prev_sales: number; tasks_pending: number };
  const inactiveVendors: InactiveVendor[] = (() => {
    if (!isAdmin) return [];
    const prevByVendor = new Map<string, number>();
    for (const r of prevMonthReports as any[]) {
      const k = String(r.salesperson_id || "");
      if (!k) continue;
      prevByVendor.set(k, (prevByVendor.get(k) || 0) + 1);
    }
    return vendorMetricsRows
      .filter((m) => m.sales_count === 0 && (m.has_meta || (prevByVendor.get(m.key) || 0) > 0))
      .map((m) => ({
        key: m.key,
        vendor_name: m.vendor_name,
        had_meta: m.has_meta,
        prev_sales: prevByVendor.get(m.key) || 0,
        tasks_pending: m.tasks_pending,
      }))
      .sort((a, b) => b.prev_sales - a.prev_sales);
  })();

  // ── Alertas de productos del EQUIPO (vista admin "Todos") ──
  // Por cada vendedor con metas, calcula sus productos con < 30% cumplimiento
  // y los agrega a una lista plana ordenada por menor cumplimiento.
  type TeamProductAtRisk = { vendor_name: string; vendor_id: string; product: string; unit: GoalUnit; achieved: number; target: number; pct: number; lines: number };
  const teamProductsAtRisk: TeamProductAtRisk[] = (() => {
    if (!isAdmin || selectedVendorFilter) return []; // solo admin "Todos"
    const allVendorGoals = productGoalsApi.data?.vendors || [];
    const reports = Array.isArray(reportsApi.data) ? reportsApi.data : [];
    const labelOf = (r: any): string | null => {
      const k = String(r.line_kind || "").toLowerCase();
      const t = String(r.line_type || "").toUpperCase();
      if (k === "movil" && t === "REN") return "Movil Ren";
      if (k === "movil" && t === "NEW") return "Movil New";
      if (k === "fijo"  && t === "REN") return "Fijo Ren";
      if (k === "fijo"  && t === "NEW") return "Fijo New";
      return null;
    };
    const items: TeamProductAtRisk[] = [];
    for (const vg of allVendorGoals) {
      const goalsByName = (vg as any).goalsByName as Record<string, number> | undefined;
      if (!goalsByName) continue;
      const spId = String((vg as any).salesperson_id || "");
      const vendorReports = reports.filter((r: any) => String(r.salesperson_id || "") === spId);
      // Sumar achieved por producto del vendor.
      const ach = new Map<string, { commission: number; lines: number }>();
      for (const r of vendorReports as any[]) {
        const label = labelOf(r);
        if (!label) continue;
        const cur = ach.get(label) || { commission: 0, lines: 0 };
        cur.commission += Number(r.vendor_commission || 0);
        cur.lines += 1;
        ach.set(label, cur);
      }
      for (const [productName, target] of Object.entries(goalsByName)) {
        if (!Number.isFinite(target) || target <= 0) continue;
        const unit = goalUnitOf(productName);
        const a = ach.get(productName) || { commission: 0, lines: 0 };
        const achievedForPct = unit === "LINES" ? a.lines : a.commission;
        const pct = (achievedForPct / Number(target)) * 100;
        if (pct < 30) {
          items.push({
            vendor_name: vg.vendor_name || "Sin nombre",
            vendor_id: spId,
            product: productName,
            unit,
            achieved: unit === "LINES" ? a.lines : a.commission,
            target: Number(target),
            pct: Math.round(pct * 10) / 10,
            lines: a.lines,
          });
        }
      }
    }
    return items.sort((a, b) => a.pct - b.pct);
  })();

  // ── Export CSV de comisiones por cliente (sugerencia D) ──
  const exportCommissionsCSV = () => {
    if (myCommissionsByClient.length === 0) return;
    const rows = [
      ["Cliente", "Vendedor", "Líneas", "Comisión USD"],
      ...myCommissionsByClient.map(c => [c.client_name, c.vendor_name, String(c.lines), c.commission.toFixed(2)]),
      ["TOTAL", "", String(myCommissionsByClient.reduce((s, c) => s + c.lines, 0)), myCommissionsByClient.reduce((s, c) => s + c.commission, 0).toFixed(2)],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }); // BOM para Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comisiones-${selectedMonth}${targetSalespersonId ? "-" + (myMetric?.vendor_name || "vendedor") : "-todos"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Ranking: pct_meta desc, commission desc, tasks_pending asc
  const rankingRows = [...vendorMetricsRows].sort((a, b) => {
    if (b.pct_meta !== a.pct_meta) return b.pct_meta - a.pct_meta;
    if (b.commission !== a.commission) return b.commission - a.commission;
    return a.tasks_pending - b.tasks_pending;
  });

  // Alertas comerciales
  type CommercialAlert = { tone: "danger" | "warning" | "info"; text: string };
  const commercialAlerts: CommercialAlert[] = [];
  for (const m of vendorMetricsRows) {
    if (m.tasks_pending >= 15) {
      commercialAlerts.push({ tone: "danger", text: `${m.vendor_name}: ${m.tasks_pending} tareas pendientes — exceso de carga` });
    }
    if (m.tasks_done >= 5 && m.commission === 0) {
      commercialAlerts.push({ tone: "danger", text: `${m.vendor_name}: ${m.tasks_done} tareas hechas pero sin comisión generada — baja conversión` });
    }
    if (!m.has_meta && (m.tasks_total > 0 || m.commission > 0)) {
      commercialAlerts.push({ tone: "warning", text: `${m.vendor_name}: opera sin meta asignada` });
    }
    if (m.has_meta && m.commission === 0 && m.tasks_total > 0) {
      commercialAlerts.push({ tone: "danger", text: `${m.vendor_name}: sin ventas en el período (meta ${formatUSD(m.total_goal)})` });
    }
  }
  // Cliente prioritario sin tarea
  const clientIdsWithTask = new Set<string>();
  for (const t of tasksRaw) {
    if (t.related_client_id) clientIdsWithTask.add(String(t.related_client_id));
  }
  const priorityClientsNoTask = topPriorityClients.filter(
    (c) => c.id != null && !clientIdsWithTask.has(String(c.id)),
  );
  if (priorityClientsNoTask.length > 0) {
    commercialAlerts.push({
      tone: "warning",
      text: `${priorityClientsNoTask.length} cliente${priorityClientsNoTask.length === 1 ? "" : "s"} prioritario${priorityClientsNoTask.length === 1 ? "" : "s"} sin tarea creada`,
    });
  }

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
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* ─── Header con filtros ─── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-blue-400" />
            Panel General
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {formatMonthLabel(selectedMonth)}
            {targetSalespersonId && myMetric ? ` · ${myMetric.vendor_name}` : (showAdminAggregate ? ' · Equipo completo' : '')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-500 block">Mes</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || getCurrentYearMonth())}
              className="bg-slate-800 border border-slate-600 text-white rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {isAdmin && (
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-500 block">Vendedor</label>
              <select
                value={selectedVendorFilter}
                onChange={(e) => setSelectedVendorFilter(e.target.value)}
                className="bg-slate-800 border border-slate-600 text-white rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
              >
                <option value="">Todos (equipo)</option>
                {vendorMetricsRows
                  .filter((m) => m.key && m.key !== "unassigned")
                  .map((m) => (
                    <option key={m.key} value={m.key}>{m.vendor_name}</option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Error cargando dashboard: {error}
        </div>
      )}

      {/* ─── Banner: mes sin actividad ─── */}
      {noActivity && (
        <section className="rounded-xl border border-slate-600 bg-gradient-to-br from-slate-800/70 to-slate-900/50 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-300" />
                Sin actividad en {formatMonthLabel(selectedMonth)}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {showAdminAggregate
                  ? 'El equipo no registró ventas este mes.'
                  : (targetSalespersonId === mySalespersonId
                    ? 'Aún no tenés ventas registradas este mes.'
                    : `${myMetric?.vendor_name || 'Este vendedor'} no tiene ventas este mes.`)}
                {' '}Las tareas y clientes sin seguimiento siguen abajo.
              </p>
            </div>
            {prevMonthHasData && (
              <button
                type="button"
                onClick={() => setSelectedMonth(previousMonth)}
                className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/15 hover:bg-blue-500/25 text-blue-200 px-4 py-2.5 text-sm font-semibold transition-colors"
                title={`Cambiar al mes anterior · ${formatMonthLabel(previousMonth)}`}
              >
                ← Ver {formatMonthLabel(previousMonth)} ({prevMonthSalesCountForTarget} {prevMonthSalesCountForTarget === 1 ? 'venta' : 'ventas'})
              </button>
            )}
          </div>
        </section>
      )}

      {/* ─── KPIs banda (5 cards admin / 4 cards vendedor) — solo si HAY actividad ─── */}
      {!noActivity && (myMetric || showAdminAggregate) && (
        <div className={`grid grid-cols-2 ${isAdmin ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3`}>
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Ventas</p>
            <p className="text-4xl font-black text-white mt-1 leading-none">{kpiSalesCount}</p>
            <p className="text-xs text-slate-500 mt-1">líneas {showAdminAggregate ? 'del equipo' : 'mías'}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Meta</p>
            <p className="text-4xl font-black text-white mt-1 leading-none">{formatUSD(kpiMeta)}</p>
            <p className="text-xs text-slate-500 mt-1">USD del mes</p>
          </div>
          <div className={`rounded-xl border-2 p-4 ${kpiCumplimiento >= 70 ? 'border-emerald-400 bg-emerald-500/10' : kpiCumplimiento >= 40 ? 'border-amber-400 bg-amber-500/10' : 'border-red-400 bg-red-500/10'}`}>
            <p className="text-[11px] uppercase font-bold tracking-wider text-slate-300">Cumpl. real</p>
            <p className={`text-4xl font-black mt-1 leading-none ${kpiCumplimiento >= 70 ? 'text-emerald-300' : kpiCumplimiento >= 40 ? 'text-amber-300' : 'text-red-300'}`}>
              {kpiCumplimiento.toFixed(0)}%
            </p>
            <p className="text-xs text-slate-400 mt-1">prom. productos</p>
          </div>
          {isAdmin ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-[11px] uppercase font-bold tracking-wider text-emerald-300">Ganancia emp.</p>
              <p className="text-4xl font-black text-emerald-200 mt-1 leading-none">{formatUSD(kpiCompanyEarnings)}</p>
              <p className="text-xs text-emerald-300/70 mt-1">{showAdminAggregate ? 'del equipo' : 'del vendedor'}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
              <p className="text-[11px] uppercase font-bold tracking-wider text-blue-300">Mi comisión</p>
              <p className="text-4xl font-black text-blue-200 mt-1 leading-none">{formatUSD(kpiCommission)}</p>
              <p className="text-xs text-blue-300/70 mt-1">cobrada</p>
            </div>
          )}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-[11px] uppercase font-bold tracking-wider text-amber-300">A pagar</p>
            <p className="text-4xl font-black text-amber-200 mt-1 leading-none">{formatUSD(kpiCommissionsPending)}</p>
            <div className="flex items-center justify-between text-[10px] mt-1.5 pt-1.5 border-t border-amber-500/20">
              <span className="text-emerald-300/80">✓ pagado <span className="font-mono font-semibold text-emerald-300">{formatUSD(showAdminAggregate ? teamPaidTotal : myPaidTotal)}</span></span>
              <span className="text-amber-300/80">pendiente</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Helper: tarjeta de vendedor con productos integrados ─── */}
      {/* Botón "Volver al equipo" si admin tiene vendedor seleccionado */}
      {isAdmin && selectedVendorFilter && (
        <div>
          <button
            type="button"
            onClick={() => setSelectedVendorFilter("")}
            className="text-xs rounded border border-slate-600 hover:border-blue-400/60 text-slate-300 hover:text-blue-200 px-2.5 py-1.5 font-medium transition-colors"
          >
            ← Volver al equipo
          </button>
        </div>
      )}

      {/* ─── Vendedores sin actividad este mes (admin) ─── */}
      {isAdmin && inactiveVendors.length > 0 && (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold text-amber-200 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Vendedores sin actividad · {inactiveVendors.length}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {inactiveVendors.map((iv) => (
              <button
                key={iv.key}
                type="button"
                onClick={() => setSelectedVendorFilter(iv.key)}
                className="text-left rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 p-3 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white truncate">{iv.vendor_name}</span>
                  {iv.had_meta && <span className="text-[9px] uppercase font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5">Tiene meta</span>}
                </div>
                <p className="text-[11px] text-slate-400">
                  Mes anterior: <span className="text-slate-200 font-semibold">{iv.prev_sales} {iv.prev_sales === 1 ? 'venta' : 'ventas'}</span>
                  {iv.tasks_pending > 0 && <span className="ml-2">· <span className="text-amber-300">{iv.tasks_pending} tareas pend.</span></span>}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ─── Admin sin filtro: grid de tarjetas por vendedor ─── */}
      {!noActivity && showAdminAggregate && vendorCards.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Vendedores · {vendorCards.length} activos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {vendorCards.map((vc) => {
              const visibleProducts = vc.products.filter((p) => p.target > 0 || p.lines > 0 || p.achievedCommission > 0);
              const stateColor = vc.state === "verde" ? "border-emerald-500/40" :
                                 vc.state === "amarillo" ? "border-amber-500/40" :
                                 vc.state === "rojo" ? "border-red-500/40" :
                                 "border-slate-700";
              const pctColor = vc.cumplimiento_real >= 70 ? 'text-emerald-300' : vc.cumplimiento_real >= 40 ? 'text-amber-300' : 'text-red-300';
              return (
                <button
                  key={vc.key}
                  type="button"
                  onClick={() => setSelectedVendorFilter(vc.key)}
                  className={`text-left rounded-xl border-2 ${stateColor} bg-slate-800/50 hover:bg-slate-800/80 hover:scale-[1.01] transition-all p-3 space-y-2`}
                  title={`Ver detalle de ${vc.vendor_name}`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{vc.vendor_name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{vc.sales_count} ventas · {formatUSD(vc.commission)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xl font-bold ${pctColor}`}>{vc.cumplimiento_real.toFixed(0)}%</p>
                      <p className="text-[9px] uppercase text-slate-500">cumpl. real</p>
                    </div>
                  </div>
                  {/* Productos compactos con ganancia empresa abajo */}
                  {visibleProducts.length > 0 ? (
                    <div className="space-y-2 pt-1 border-t border-slate-700/60">
                      {visibleProducts.map((p) => {
                        const achievedNum = p.unit === "LINES" ? p.lines : p.achievedCommission;
                        const fmtAch = p.unit === "LINES" ? `${p.lines}L` : formatUSD(achievedNum).replace('US$', '$');
                        const fmtTar = p.unit === "LINES" ? `${p.target}L` : formatUSD(p.target).replace('US$', '$');
                        const barColor = p.pct >= 100 ? '#10b981' : p.pct >= 70 ? '#3b82f6' : p.pct >= 40 ? '#f59e0b' : '#ef4444';
                        return (
                          <div key={p.name} className="space-y-0.5">
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-slate-300 w-16 shrink-0 truncate" title={p.name}>{p.name}</span>
                              <div className="flex-1 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-700/60">
                                {p.target > 0 && (
                                  <div className="h-full" style={{ width: `${Math.min(100, p.pct)}%`, backgroundColor: barColor }} />
                                )}
                              </div>
                              <span className="text-slate-400 font-mono shrink-0 w-20 text-right">
                                {p.target > 0 ? `${fmtAch}/${fmtTar}` : fmtAch}
                              </span>
                              <span className={`font-bold font-mono shrink-0 w-10 text-right ${p.pct >= 100 ? 'text-emerald-300' : p.pct >= 70 ? 'text-blue-300' : p.pct >= 40 ? 'text-amber-300' : 'text-red-300'}`}>
                                {p.target > 0 ? `${p.pct.toFixed(0)}%` : '—'}
                              </span>
                            </div>
                            {p.companyEarnings > 0 && (
                              <p className="text-[10px] text-emerald-400/70 ml-[72px]">
                                ↳ ganancia empresa: <span className="font-mono font-semibold text-emerald-300">{formatUSD(p.companyEarnings)}</span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-700/60">Sin productos cargados</p>
                  )}
                  {/* Footer mini-stats */}
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-700/60">
                    <span className="text-slate-400">
                      {vc.tasks_pending > 0 ? <span className="text-amber-300 font-semibold">{vc.tasks_pending} tareas</span> : '0 tareas'}
                      {' · '}
                      {vc.sin_seguimiento_count > 0 ? <span className="text-amber-300/80">{vc.sin_seguimiento_count} sin seg.</span> : '0 sin seg.'}
                    </span>
                    <span className="text-blue-300/70">Ver detalle →</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Vendedor / admin con vendor X: tarjeta grande con productos ─── */}
      {!noActivity && !showAdminAggregate && myMetric && myProductMetrics.length > 0 && (
        <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              {targetSalespersonId === mySalespersonId ? 'Mis productos' : `Productos · ${myMetric.vendor_name}`}
            </h2>
            <span className={`text-xs uppercase font-bold border rounded-full px-2 py-0.5 ${myCumplimientoReal >= 70 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : myCumplimientoReal >= 40 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-red-500/20 text-red-300 border-red-500/40'}`}>
              {myCumplimientoReal.toFixed(0)}% cumpl. real
            </span>
          </div>
          <div className="space-y-2">
            {myProductMetrics.filter((p) => p.target > 0 || p.lines > 0 || p.achievedCommission > 0).map((p) => {
              const achievedNum = p.unit === "LINES" ? p.lines : p.achievedCommission;
              const fmtAch = p.unit === "LINES" ? `${p.lines} líneas` : formatUSD(achievedNum);
              const fmtTar = p.unit === "LINES" ? `${p.target} líneas` : formatUSD(p.target);
              const barColor = p.pct >= 100 ? '#10b981' : p.pct >= 70 ? '#3b82f6' : p.pct >= 40 ? '#f59e0b' : '#ef4444';
              return (
                <div key={p.name} className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{p.name}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-900 rounded px-1.5 py-0.5 border border-slate-700">
                        {p.unit === "LINES" ? "cant" : "USD"}
                      </span>
                      <span className="text-xs text-slate-300">
                        <span className="text-slate-100 font-semibold">{fmtAch}</span>
                        {p.target > 0 && <span className="text-slate-500"> / {fmtTar}</span>}
                      </span>
                    </div>
                    <span className={`text-sm font-bold font-mono ${p.pct >= 100 ? 'text-emerald-300' : p.pct >= 70 ? 'text-blue-300' : p.pct >= 40 ? 'text-amber-300' : 'text-red-300'}`}>
                      {p.target > 0 ? `${p.pct.toFixed(0)}%` : '—'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-700">
                    {p.target > 0 && (
                      <div className="h-full transition-all" style={{ width: `${Math.min(100, p.pct)}%`, backgroundColor: barColor }} />
                    )}
                  </div>
                  {/* Ganancia empresa por producto — solo admin (vendedor no la ve por regla) */}
                  {isAdmin && p.companyEarnings > 0 && (
                    <p className="text-[11px] text-emerald-400/80 mt-1.5">
                      ↳ ganancia empresa: <span className="font-mono font-semibold text-emerald-300">{formatUSD(p.companyEarnings)}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Tareas (3 estados) + Sin seguimiento (top 5) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tareas */}
        <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-blue-300" />
              Tareas {showAdminAggregate ? 'del equipo' : 'mías'}
            </h2>
            <Link to="/tareas" className="text-xs text-blue-300 hover:text-blue-200">Ver módulo →</Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center">
              <p className="text-2xl font-bold text-amber-300">{tasksByState.pending}</p>
              <p className="text-[10px] uppercase font-semibold text-amber-300/80">Pendientes</p>
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-center">
              <p className="text-2xl font-bold text-blue-300">{tasksByState.in_progress}</p>
              <p className="text-[10px] uppercase font-semibold text-blue-300/80">En progreso</p>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-300">{tasksByState.done}</p>
              <p className="text-[10px] uppercase font-semibold text-emerald-300/80">Completadas</p>
            </div>
          </div>
        </section>

        {/* Sin seguimiento (top 5) */}
        <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-300" />
              Sin seguimiento {showAdminAggregate ? 'del equipo' : 'míos'}
              {baseSinSeguimiento.length > 0 && (
                <span className="text-xs text-amber-300 normal-case font-normal">· {baseSinSeguimiento.length} total</span>
              )}
            </h2>
            <Link to="/clientes" className="text-xs text-blue-300 hover:text-blue-200">Ver todos →</Link>
          </div>
          {topSinSeguimiento.length === 0 ? (
            <p className="text-sm text-slate-400 py-3 text-center">Sin clientes sin seguimiento 🎉</p>
          ) : (
            <ul className="space-y-1.5">
              {topSinSeguimiento.map((c) => {
                const cid = String(c.id);
                const ts = taskState[cid] || "idle";
                const banPrimary = (c as any).bans?.[0]?.ban_number || (c as any).primary_ban || "—";
                const hasId = c.id != null && c.id !== "";
                return (
                  <li key={c.id || c.name} className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900/40 px-2.5 py-1.5">
                    {hasId ? (
                      <Link to={`/clientes?id=${c.id}`} className="flex-1 min-w-0 truncate text-sm text-white hover:text-blue-300" title="Ver ficha del cliente">
                        {c.name || "Sin nombre"}
                      </Link>
                    ) : (
                      <span className="flex-1 min-w-0 truncate text-sm text-slate-400 italic" title="Cliente sin ID — no hay ficha asociada">
                        {c.name || "Sin nombre"} <span className="text-[10px]">(sin enlace)</span>
                      </span>
                    )}
                    {c.priority_score != null && (
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">p{toNumber(c.priority_score).toFixed(0)}</span>
                    )}
                    {showAdminAggregate && (c as any).vendor_name && (
                      <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{(c as any).vendor_name}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCreateTask(c, banPrimary, "Llamar/contactar al cliente")}
                      disabled={ts === "creating" || ts === "created"}
                      className={`text-[10px] rounded border px-1.5 py-0.5 font-medium transition-colors flex items-center gap-1 shrink-0 ${
                        ts === "created" ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200" :
                        ts === "error" ? "border-red-500/40 bg-red-500/15 text-red-200" :
                        "border-blue-500/40 bg-blue-500/15 hover:bg-blue-500/25 text-blue-200 disabled:opacity-50"
                      }`}
                      title="Crear tarea de seguimiento"
                    >
                      {ts === "creating" ? <Loader2 className="w-3 h-3 animate-spin" /> :
                       ts === "created" ? <Check className="w-3 h-3" /> :
                       <Plus className="w-3 h-3" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
