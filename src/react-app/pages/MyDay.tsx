import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock3,
  Edit,
  FileText,
  Loader2,
  Phone,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
} from "lucide-react";
import { useApi } from "@/react-app/hooks/useApi";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";
import { ClientManagementModal } from "@/react-app/pages/Clients";
import MetasPorProducto from "@/react-app/components/MetasPorProducto";
import DistribucionDonuts from "@/react-app/components/DistribucionDonuts";
import EvolucionDiaria from "@/react-app/components/EvolucionDiaria";
import DashboardKPIs from "@/react-app/components/DashboardKPIs";

// ── Tipos por endpoint (un sub-set mínimo de los campos reales) ──

type AgentTask = {
  id: number;
  title?: string | null;
  status?: string | null;
  due_date?: string | null;
  client_id?: string | null;
  related_client_id?: string | null;
  assigned_salesperson_id?: string | null;
  created_at?: string | null;
};

type PersonalTask = {
  id: number;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  due_date?: string | null;
  follow_up_date?: string | null;
  follow_up_time?: string | null;
  task_kind?: "regular" | "client" | null;
  client_id?: string | null;
  client_name?: string | null;
  notes?: string | null;
  priority?: string | null;
  assigned_user_id?: string | null;
  assigned_name?: string | null;
  assigned_username?: string | null;
  custom_fields?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type DealTask = {
  id: number;
  deal_id?: number | null;
  step_name?: string | null;
  step_order?: number | string | null;
  status?: string | null;
  due_date?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

// Fila de /api/my-day — 1 fila = 1 cliente en seguimiento (follow_up_prospects).
// La task viene de LEFT JOIN LATERAL contra crm_deal_tasks (opcional).
// Si task_id es null → cliente en seguimiento sin paso comercial activo.
type MyDayTask = {
  follow_up_id: number;
  client_id: string;
  client_name: string | null;
  salesperson_id: string | null;
  task_id: number | null;
  step_name: string | null;
  task_status: "in_progress" | "pending" | null;
  due_date: string | null;
  ban_number: string | null;
  phone: string | null;
  product_type: string | null;
  badge: "sin_tarea" | "sin_fecha" | "atrasado" | "hoy" | "futuro";
};

type WorkflowTask = {
  id: number;
  client_id?: string | null;
  client_name?: string | null;
  status?: string | null;
  product_name?: string | null;
  product_key?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FollowUp = {
  id: number;
  client_id?: string | null;
  client_name?: string | null;
  company_name?: string | null;
  next_call_date?: string | null;
  last_call_date?: string | null;
  is_completed?: boolean | null;
  is_active?: boolean | number | null;
  completed_date?: string | null;
  notes?: string | null;
  // Suma de monthly_value de suscriptores activos del cliente. Pipeline, NO vendido.
  projected_monthly_value?: number | string | null;
  last_note?: {
    text?: string | null;
    at?: string | null;
    author?: string | null;
  } | null;
};

type Client = {
  id: string | number;
  name?: string | null;
  business_name?: string | null;
  active_ban_count?: number | string | null;
  salesperson_id?: string | number | null;
  vendor_id?: number | null;
  vendor_name?: string | null;
};

type ClientsResponse = { clients: Client[] };

type Vendor = {
  id: number;
  salesperson_id?: string | number | null;
};

type GoalVendor = {
  salesperson_id?: string | null;
  vendor_name?: string | null;
  total_goal?: number | null;
  total_earned?: number | null;
  percentage?: number | null;
  remaining?: number | null;
};

type GoalsResponse = {
  period?: string;
  vendors?: GoalVendor[];
};

type FollowUpActionMode = "schedule" | "complete";

type TopActionItem = {
  clientId: string;
  clientName: string;
  score: number;
  reason: string;
  nextTaskName: string | null;
  overdueSteps: number;
  pendingSteps: number;
  noDateSteps: number;
  latestNoteText: string | null;
  latestNoteAt: string | null;
  status: FollowUpSummary["status"];
};

let clientDetailRequestId = 0;

// ── Tarea unificada ──

type TaskKind = "agent" | "client" | "personal";

type UnifiedTask = {
  uid: string; // Ãƒºnico: kind+id
  kind: TaskKind;
  title: string;
  due_date: string | null; // ISO 'YYYY-MM-DD' o null
  client_id: string | null;
  client_name: string | null;
  created_at: string | null;
};

type FollowUpTask = {
  uid: string;
  title: string;
  due_date: string | null;
  client_id: string;
  client_name: string;
  created_at: string | null;
};

type FollowUpDeal = {
  id: number;
  client_id: string;
  client_name: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
  product_type: string;
  sale_type: string;
  source_type?: string | null;
  source_ref?: string | null;
  source_label?: string | null;
  subscriber_id?: string | null;
  ban_number?: string | null;
  phone?: string | null;
  is_orphan?: boolean;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  tasks: DealTask[];
};

type FollowUpSummary = {
  clientId: string;
  clientName: string;
  companyName: string | null;
  prospectId: number | null;
  nextCallDate: string | null;
  deals: FollowUpDeal[];
  tasks: DealTask[];
  primaryDeal: FollowUpDeal | null;
  totalDeals: number;
  totalSteps: number;
  completedSteps: number;
  pendingSteps: number;
  overdueSteps: number;
  noDateSteps: number;
  nextTask: DealTask | null;
  lastCompletedTask: DealTask | null;
  status: "complete" | "pending" | "overdue" | "no-date" | "no-steps";
  hasSteps: boolean;
  latestNoteText: string | null;
  latestNoteAt: string | null;
  latestNoteAuthor: string | null;
  projectedMonthlyValue: number;
};

type MyDayTab = "commercial" | "personal";

const KIND_LABEL: Record<TaskKind, string> = {
  agent: "Agente",
  client: "Cliente",
  personal: "Personal",
};

const KIND_BADGE: Record<TaskKind, string> = {
  agent: "bg-blue-500/15 text-blue-200 border-blue-500/30",
  client: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  personal: "bg-amber-500/15 text-amber-200 border-amber-500/30",
};

// ── Utilidades de fecha ──

const todayISO = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const currentMonthYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const formatDate = (v?: string | null) => {
  if (!v) return "—";
  // YYYY-MM-DD se parsea como UTC en JS — fuerzo medianoche local
  // para evitar shift de día en zonas con UTC negativo (Puerto Rico).
  const raw = String(v);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
};

const formatDateTimeShort = (v?: string | null) => {
  if (!v) return "Sin fecha";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleString("es-PR", { dateStyle: "short", timeStyle: "short" });
};

const clampText = (value: string, maxLen: number) => {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
};

const dueKey = (v?: string | null): string | null => {
  if (!v) return null;
  return String(v).slice(0, 10);
};

const normalizeTaskDate = (task: {
  due_date?: string | null;
  follow_up_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}) => {
  return dueKey(task.due_date) || dueKey(task.follow_up_date) || dueKey(task.created_at) || dueKey(task.updated_at);
};

const addDaysISO = (v: string | null, days: number) => {
  const base = v ? new Date(v) : new Date();
  if (Number.isNaN(base.getTime())) return todayISO();
  base.setDate(base.getDate() + days);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
};

const isPending = (status?: string | null) => {
  const s = String(status || "").toLowerCase();
  return s === "pending" || s === "in_progress";
};

const normalizeTaskClientId = (task: { client_id?: string | number | null; related_client_id?: string | number | null }) => {
  const value = task.client_id || task.related_client_id;
  return value ? String(value) : null;
};

async function fetchJson<T>(url: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...rest } = init;
  const response = await authFetch(url, json !== undefined ? { ...rest, json } : rest);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// is_active acepta boolean o number 0/1 (BD inconsistente)
const isFollowUpActive = (f: FollowUp): boolean => {
  if (f.completed_date) return false;
  if (f.is_completed === true) return false;
  const a = f.is_active;
  if (a === false || a === 0) return false;
  return true;
};

const isRealDealTask = (task: DealTask | null | undefined) => {
  if (!task) return false;
  const id = Number(task.id);
  const dealId = Number(task.deal_id);
  const stepOrder = Number(task.step_order);
  return (
    Number.isFinite(id) &&
    id > 0 &&
    Number.isFinite(dealId) &&
    dealId > 0 &&
    Number.isFinite(stepOrder) &&
    stepOrder > 0 &&
    String(task.step_name || "").trim().length > 0
  );
};

const normalizeDealStatus = (value?: string | null) => {
  const status = String(value || "").trim().toLowerCase();
  if (status === "done") return "done";
  if (status === "in_progress") return "in_progress";
  return "pending";
};

// Solo task.due_date — sin fallback a updated_at/created_at. Una task sin
// fecha asignada debe tratarse como "sin fecha", no como "su fecha de
// modificación". Antes el fallback hacía que tasks in_progress sin due_date
// ganaran el sort de nextTask con su updated_at viejo y desplazaran a tasks
// con due_date real (ver caso CONSEJO DE TITULARES).
const getTaskDue = (task?: DealTask | null) => dueKey(task?.due_date);

function getDealDisplayName(deal: FollowUpDeal) {
  const sourceLabel = String(deal.source_label || "").trim();
  const product = String(deal.product_type || "").trim();
  const sale = String(deal.sale_type || "").trim();
  const parts = [sourceLabel, product, sale].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : `Seguimiento #${deal.id}`;
}

function getTaskDisplayName(task?: DealTask | null) {
  const stepName = String(task?.step_name || "").trim();
  if (stepName) return stepName;
  return "Sin tarea definida";
}

function getTaskStatusLabel(task?: DealTask | null, todayValue?: string) {
  if (!task) return "Sin pasos";
  const status = normalizeDealStatus(task.status);
  const due = getTaskDue(task);
  if (status === "done") return "Completado";
  if (due && todayValue && due < todayValue) return "Atrasado";
  if (status === "in_progress") return "En progreso";
  return due ? "Pendiente" : "Fecha requerida";
}

function getTaskDueLabel(task?: DealTask | null, todayValue?: string) {
  if (!task) return "Sin pasos";
  const due = getTaskDue(task);
  const status = normalizeDealStatus(task.status);
  if (status === "done") {
    return due ? `Fecha: ${formatDate(due)}` : "Sin fecha";
  }
  if (!due) return "Fecha requerida";
  if (todayValue && due < todayValue) return `Atrasado · ${formatDate(due)}`;
  if (due === todayValue) return "Vence hoy";
  return `Vence ${formatDate(due)}`;
}

function getTaskHeadline(task?: DealTask | null) {
  if (!task) return "Sin tarea definida";
  const stepNumber = Number(task.step_order);
  const stepText = Number.isFinite(stepNumber) && stepNumber > 0 ? `Paso ${stepNumber}` : null;
  const taskText = getTaskDisplayName(task);
  return stepText ? `${stepText} · ${taskText}` : taskText;
}

type NoteEntry = {
  text: string;
  at: string | null;
  author: string | null;
};

const NOTE_BLOCK_REGEX = /(?:^|\n\n)---\s*(?:NOTA|SEGUIMIENTO TERMINADO|DEVUELTO A POOL)\s*---\n?/gi;

function parseNoteBlocks(notes?: string | null): NoteEntry[] {
  const raw = String(notes || "").trim();
  if (!raw) return [];

  const blocks = raw
    .split(NOTE_BLOCK_REGEX)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return [{
      text: raw,
      at: null,
      author: null,
    }];
  }

  return blocks.map((block) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const first = lines[0] || "";
    const metaMatch = first.match(/^\[(.+?)\](?:\s*[-|]\s*(.+))?$/);
    const at = metaMatch ? metaMatch[1] : null;
    const author = metaMatch && metaMatch[2] ? metaMatch[2] : null;
    const body = metaMatch ? lines.slice(1).join("\n").trim() : lines.join("\n").trim();
    return {
      text: body || first,
      at,
      author,
    };
  }).filter((entry) => entry.text.length > 0);
}

function extractLatestNote(notes?: string | null): NoteEntry | null {
  const blocks = parseNoteBlocks(notes);
  return blocks.length > 0 ? blocks[blocks.length - 1] : null;
}

function extractFollowUpLatestNote(followUp: FollowUp): NoteEntry | null {
  const structured = followUp.last_note;
  if (structured && String(structured.text || "").trim()) {
    return {
      text: String(structured.text || "").trim(),
      at: structured.at || null,
      author: structured.author || null,
    };
  }

  return extractLatestNote(followUp.notes);
}

function summarizeFollowUpClient(
  followUp: FollowUp,
  deals: FollowUpDeal[],
  today: string
): FollowUpSummary {
  const normalizedDeals = (Array.isArray(deals) ? deals : [])
    .map((deal) => ({
      ...deal,
      tasks: (Array.isArray(deal.tasks) ? deal.tasks : [])
        .map((task) => ({ ...task, status: normalizeDealStatus(task.status) }))
        .filter(isRealDealTask)
        .sort((a, b) => Number(a.step_order) - Number(b.step_order)),
    }))
    .filter((deal) => deal.tasks.length > 0);

  const tasks = normalizedDeals.flatMap((deal) => deal.tasks);
  const pendingTasks = tasks.filter((task) => normalizeDealStatus(task.status) !== "done");
  const completedTasks = tasks.filter((task) => normalizeDealStatus(task.status) === "done");

  // Regla: la "próxima task" es la del paso ACTIVO del workflow.
  //   - Prioridad 1: status = 'in_progress' (el paso que se está trabajando ahora).
  //   - Fallback: cualquier pending (cuando no hay in_progress, edge case).
  //   - Done nunca entra (ya excluido en pendingTasks).
  // Esto evita que un paso futuro (pending) con fecha vieja domine sobre el
  // paso activo. Ver Caso CONSEJO DE TITULARES (fu#212).
  const inProgressTasks = pendingTasks.filter(
    (task) => normalizeDealStatus(task.status) === "in_progress"
  );
  const nextTaskCandidates = inProgressTasks.length > 0 ? inProgressTasks : pendingTasks;

  const nextTask =
    [...nextTaskCandidates]
      .sort((a, b) => {
        const aDate = getTaskDue(a) || "9999-12-31";
        const bDate = getTaskDue(b) || "9999-12-31";
        const dateCmp = aDate.localeCompare(bDate);
        if (dateCmp !== 0) return dateCmp;
        return Number(a.step_order) - Number(b.step_order);
      })[0] || null;

  const lastCompletedTask =
    [...completedTasks]
      .sort((a, b) => {
        const aDate = a.completed_at || a.updated_at || a.created_at || "";
        const bDate = b.completed_at || b.updated_at || b.created_at || "";
        const dateCmp = String(bDate).localeCompare(String(aDate));
        if (dateCmp !== 0) return dateCmp;
        return Number(b.step_order) - Number(a.step_order);
      })[0] || null;

  // Source of truth único: crm_deal_tasks.due_date (vía nextTask).
  // Ya NO hay fallback a follow_up_prospects.next_call_date — esa columna
  // queda solo para /seguimiento legacy (se sincroniza por Fix A en backend).
  const nextDate = getTaskDue(nextTask);
  // overdue/noDate se calculan sobre las mismas candidatas que nextTask
  // (in_progress > pending). Mantiene coherencia: el badge "Atrasado" refleja
  // el estado del paso activo, no de pasos futuros con fecha vieja.
  const overdueSteps = nextTaskCandidates.filter((task) => {
    const due = getTaskDue(task);
    return due !== null && due < today;
  }).length;
  const noDateSteps = nextTaskCandidates.filter((task) => !getTaskDue(task)).length;

  let status: FollowUpSummary["status"] = "no-steps";
  if (tasks.length > 0) {
    if (pendingTasks.length === 0) {
      status = "complete";
    } else if (overdueSteps > 0) {
      status = "overdue";
    } else if (!nextDate) {
      status = "no-date";
    } else {
      status = "pending";
    }
  }

  const primaryDeal = normalizedDeals.find((deal) => deal.tasks.some((task) => normalizeDealStatus(task.status) !== "done"))
    || normalizedDeals[0]
    || null;
  const latestNote = extractFollowUpLatestNote(followUp);

  return {
    clientId: String(followUp.client_id || ""),
    clientName: String(followUp.client_name || followUp.company_name || "").trim(),
    companyName: String(followUp.company_name || followUp.client_name || "").trim() || null,
    prospectId: Number(followUp.id || 0) || null,
    nextCallDate: nextDate || null,
    deals: normalizedDeals,
    tasks,
    primaryDeal,
    totalDeals: normalizedDeals.length,
    totalSteps: tasks.length,
    completedSteps: completedTasks.length,
    pendingSteps: pendingTasks.length,
    overdueSteps,
    noDateSteps,
    nextTask,
    lastCompletedTask,
    status,
    hasSteps: tasks.length > 0,
    latestNoteText: latestNote?.text || null,
    latestNoteAt: latestNote?.at || null,
    latestNoteAuthor: latestNote?.author || null,
    projectedMonthlyValue: Number(followUp.projected_monthly_value) || 0,
  };
}

export default function MyDay() {
  const user = getCurrentUser();
  const userRole = String(user?.role || "").trim().toLowerCase();
  const isAdminUser = userRole === "admin" || userRole === "supervisor";
  const userName = user?.salespersonName || user?.username || "Vendedor";
  const today = todayISO();
  const monthYM = currentMonthYM();
  // Filtro admin: null = "Todos", o un salesperson_id específico.
  // Solo afecta a admin/supervisor; vendedor normal nunca ve el dropdown.
  // Default admin: su propio salesperson_id si tiene; si no, Todos (null).
  const initialAdminSpId = isAdminUser && user?.salespersonId != null
    ? String(user.salespersonId)
    : null;
  const [adminSelectedSpId, setAdminSelectedSpId] = useState<string | null>(initialAdminSpId);
  const [clientDetail, setClientDetail] = useState<any | null>(null);
  const [loadingClientDetail, setLoadingClientDetail] = useState(false);
  const [clientDetailError, setClientDetailError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MyDayTab>("commercial");
  const [updatingPersonalTask, setUpdatingPersonalTask] = useState<number | null>(null);

  // ── Filtro admin: null = "Todos" (sin filtro); ID = ese vendedor. ──
  // Vendedor normal nunca activa el filtro. Calculado antes de los endpoints
  // porque /api/my-day usa ?seller_id= en la URL.
  const adminFilterSpId = isAdminUser ? adminSelectedSpId : null;

  // ── Endpoints (todos filtran por rol server-side donde aplica) ──
  // Fuente única comercial = /api/my-day (crm_deal_tasks). Ya no usamos
  // /api/agents/tasks, /api/follow-up-prospects, /api/vendors.
  const myDayUrl = adminFilterSpId
    ? `/api/my-day?seller_id=${encodeURIComponent(adminFilterSpId)}`
    : "/api/my-day";
  const myDayApi = useApi<MyDayTask[]>(myDayUrl);
  const personalTasksApi = useApi<PersonalTask[]>("/api/tasks");
  const clientsApi = useApi<ClientsResponse>("/api/clients?tab=active");
  const goalsApi = useApi<GoalsResponse>(
    `/api/goals/performance?month=${monthYM}`,
  );
  const salespeopleApi = useApi<Array<{ id: string; name: string; role?: string | null }>>("/api/salespeople");
  const currentUserSalespersonId = user?.salespersonId != null ? String(user.salespersonId) : null;

  // Cuentas demo/test que no deben aparecer en el filtro admin.
  const DEMO_SALESPERSON_NAMES = useMemo(
    () => new Set(["juan pérez", "juan perez", "maría gonzález", "maria gonzalez"]),
    [],
  );
  const adminSalespeople = useMemo(() => {
    const list = Array.isArray(salespeopleApi.data) ? salespeopleApi.data : [];
    return list.filter((sp) => !DEMO_SALESPERSON_NAMES.has(String(sp.name || "").trim().toLowerCase()));
  }, [salespeopleApi.data, DEMO_SALESPERSON_NAMES]);

  const personalTasks = useMemo(
    () => (Array.isArray(personalTasksApi.data) ? personalTasksApi.data : []),
    [personalTasksApi.data],
  );
  const clients = useMemo(() => {
    const all = clientsApi.data?.clients || [];
    if (!adminFilterSpId) return all;
    return all.filter((c: any) => String(c?.salesperson_id || "") === adminFilterSpId);
  }, [clientsApi.data, adminFilterSpId]);
  const goalVendors = useMemo(
    () => goalsApi.data?.vendors || [],
    [goalsApi.data],
  );
  const [actionModal, setActionModal] = useState<{
    mode: "schedule" | "complete";
    clientId: string;
    clientName: string;
    taskId: number;
    taskName: string;
    dueDate: string;
  } | null>(null);
  const [followUpActionMessage, setFollowUpActionMessage] = useState<string | null>(null);

  // ── Fuente única comercial: /api/my-day (crm_deal_tasks). ──
  const dealTasks = useMemo(
    () => (Array.isArray(myDayApi.data) ? myDayApi.data : []),
    [myDayApi.data],
  );

  const personalOnlyTasks = useMemo(
    () =>
      personalTasks
        .sort((a, b) => {
          const aDone = String(a.status || "").toLowerCase() === "done" ? 1 : 0;
          const bDone = String(b.status || "").toLowerCase() === "done" ? 1 : 0;
          if (aDone !== bDone) return aDone - bDone;
          return String(normalizeTaskDate(a) || "9999").localeCompare(
            String(normalizeTaskDate(b) || "9999"),
          );
        }),
    [personalTasks],
  );

  // ── Sub-grupos de tareas comerciales: por badge del servidor. ──
  const overdueTasks = useMemo(
    () =>
      dealTasks
        .filter((t) => t.badge === "atrasado")
        .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || ""))),
    [dealTasks],
  );

  const todayTasks = useMemo(
    () =>
      dealTasks
        .filter((t) => t.badge === "hoy")
        .sort((a, b) => String(a.client_name || "").localeCompare(String(b.client_name || ""))),
    [dealTasks],
  );

  const futureTasks = useMemo(
    () =>
      dealTasks
        .filter((t) => t.badge === "futuro")
        .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || ""))),
    [dealTasks],
  );

  const noDateTasks = useMemo(
    () =>
      dealTasks
        .filter((t) => t.badge === "sin_fecha")
        .sort((a, b) => String(a.client_name || "").localeCompare(String(b.client_name || ""))),
    [dealTasks],
  );

  const noTaskTasks = useMemo(
    () =>
      dealTasks
        .filter((t) => t.badge === "sin_tarea")
        .sort((a, b) => String(a.client_name || "").localeCompare(String(b.client_name || ""))),
    [dealTasks],
  );

  const pendingPersonalTasks = useMemo(
    () => personalOnlyTasks.filter((task) => isPending(task.status)),
    [personalOnlyTasks],
  );

  const personalOverdueTasks = useMemo(
    () => pendingPersonalTasks.filter((task) => {
      const due = normalizeTaskDate(task);
      return due !== null && due < today;
    }),
    [pendingPersonalTasks, today],
  );

  const personalTodayTasks = useMemo(
    () => pendingPersonalTasks.filter((task) => {
      const due = normalizeTaskDate(task);
      return due !== null && due === today;
    }),
    [pendingPersonalTasks, today],
  );

  const personalNoDateTasks = useMemo(
    () => pendingPersonalTasks.filter((task) => !normalizeTaskDate(task)),
    [pendingPersonalTasks],
  );

  const completedPersonalTasks = useMemo(
    () => personalOnlyTasks.filter((task) => String(task.status || "").toLowerCase() === "done"),
    [personalOnlyTasks],
  );

  // followUpSummaries y derivados: eliminados.
  // Reemplazados por `dealTasks` + sub-grupos (overdueTasks/todayTasks/...)
  // calculados desde /api/my-day.badge. Ver bloque de sub-grupos arriba.

  // ── Proyección de pipeline (NO vendido, NO metas, NO Tango). ──
  // Sumas de projected_monthly_value sobre los seguimientos visibles.
  // projection eliminada: ya no se renderiza en el dashboard ejecutivo.
  // Los donuts y la evolución diaria viven en componentes dedicados que
  // consumen /api/goals/my-day directamente.

  const commercialOverdueCount = overdueTasks.length;
  const commercialTodayCount = todayTasks.length;
  const commercialNoDateCount = noDateTasks.length;
  // futuros (next_call_date > today) se omiten — viven en /seguimiento

  // ── Avance del mes ──
  const myGoalRow = useMemo(() => {
    if (!currentUserSalespersonId) return null;
    return (
      goalVendors.find(
        (vendor) => String(vendor.salesperson_id || "") === currentUserSalespersonId,
      ) || null
    );
  }, [currentUserSalespersonId, goalVendors]);
  const hasPersonalGoal = Number(myGoalRow?.total_goal || 0) > 0;

  // ── Estado global de carga / error ──
  const isLoading =
    myDayApi.loading ||
    personalTasksApi.loading ||
    clientsApi.loading ||
    goalsApi.loading;

  const hasError =
    !!myDayApi.error ||
    !!personalTasksApi.error ||
    !!clientsApi.error ||
    !!goalsApi.error;

  const goalPct = Number(myGoalRow?.percentage || 0);
  const goalBarColor =
    goalPct >= 70
      ? "bg-emerald-500"
      : goalPct >= 40
        ? "bg-amber-500"
        : "bg-red-500";

  // ── Render helpers ──
  const loadClientDetail = async (clientId: string | number) => {
    const requestSeq = ++clientDetailRequestId;
    setClientDetailError(null);
    setLoadingClientDetail(true);
    setClientDetail(null);
    console.log("[MyDay] loadClientDetail iniciado", { clientId });

    try {
      const normalizedClientId = String(clientId).trim();
      if (!normalizedClientId) {
        throw new Error("No se encontró el ID real del cliente.");
      }

      const encodedClientId = encodeURIComponent(normalizedClientId);
      const clientUrl = `/api/clients/${encodedClientId}`;
      const bansUrl = `/api/bans?client_id=${encodedClientId}`;
      const subscribersUrl = `/api/subscribers?client_id=${encodedClientId}`;
      console.log("[MyDay] loadClientDetail URLs", {
        clientId,
        clientUrl,
        bansUrl,
        subscribersUrl,
      });
      const clientFromList = clients.find((client) => String(client.id) === normalizedClientId) || null;
      const [clientResponse, bansResponse, subscribersResponse] = await Promise.all([
        authFetch(clientUrl),
        authFetch(bansUrl),
        authFetch(subscribersUrl),
      ]);

      if (requestSeq !== clientDetailRequestId) return;

      console.log("[MyDay] loadClientDetail response status", {
        clientId,
        clientStatus: clientResponse.status,
        bansStatus: bansResponse.status,
        subscribersStatus: subscribersResponse.status,
      });

      if (!clientResponse.ok) {
        const errorData = await clientResponse.json().catch(() => ({ error: "Error desconocido" }));
        console.log("[MyDay] loadClientDetail error data", {
          clientId,
          clientUrl,
          errorData,
        });
        throw new Error(errorData.error || "Error al cargar el cliente");
      }

      const client = await clientResponse.json();
      console.log("[MyDay] loadClientDetail data recibida", {
        clientId,
        clientUrl,
        client,
        clientFromList,
      });
      const mergedClient = clientFromList
        ? { ...clientFromList, ...client }
        : client;
      const completeClient = {
        ...mergedClient,
        id: mergedClient?.id ?? normalizedClientId,
        name: mergedClient?.name || clientFromList?.name || clientFromList?.business_name || "Cliente sin nombre",
        business_name: mergedClient?.business_name ?? clientFromList?.business_name ?? null,
        salesperson_id: mergedClient?.salesperson_id ?? clientFromList?.salesperson_id ?? null,
        vendor_id: mergedClient?.vendor_id ?? clientFromList?.vendor_id ?? null,
        vendor_name: mergedClient?.vendor_name ?? clientFromList?.vendor_name ?? null,
      };
      console.log("[MyDay] loadClientDetail selectedClient final", {
        clientId,
        selectedClient: completeClient,
      });

      const allSubscribers = subscribersResponse.ok ? await subscribersResponse.json() : [];
      const clientBans = bansResponse.ok ? await bansResponse.json() : [];
      const bans = (Array.isArray(clientBans) ? clientBans : []).map((ban: any) => ({
        ...ban,
        subscribers: (Array.isArray(allSubscribers) ? allSubscribers : []).filter((s: any) => String(s.ban_id) === String(ban.id)),
      }));

      if (requestSeq === clientDetailRequestId) {
        setClientDetail({ ...completeClient, bans });
      }
    } catch (error) {
      if (requestSeq === clientDetailRequestId) {
        console.error("[MyDay] loadClientDetail fallo", { clientId, error });
        setClientDetailError("No se pudo abrir cliente: client_id inválido o detalle no encontrado");
      }
    } finally {
      if (requestSeq === clientDetailRequestId) {
        setLoadingClientDetail(false);
      }
    }
  };

  const handleTaskClick = (task: UnifiedTask) => {
    if (!task.client_id) {
      return;
    }
    loadClientDetail(task.client_id);
  };

  // "Tiene seguimiento activo" se redefine como "tiene tarea pending/in_progress".
  // El modal cliente lo usa para decidir si mostrar acciones de seguimiento.
  const clientHasActiveFollowUp = (clientId: number) =>
    dealTasks.some((t) => String(t.client_id || "") === String(clientId));

  // Sin /api/vendors no podemos resolver vendor_id desde salesperson_id en este
  // contexto. El modal de cliente usa vendor_id si viene en el client; si no,
  // retornamos null y el modal cae a su propio fallback.
  const resolveFollowUpVendorId = (client: { vendor_id?: number | null }) => {
    const vendorId = Number(client.vendor_id);
    if (Number.isFinite(vendorId) && vendorId > 0) return vendorId;
    return null;
  };

  const handleUnavailableSubscriberAction = () => {
    setClientDetailError("Gestiona suscriptores desde el módulo Clientes para mantener el flujo completo.");
  };

  const saveScheduledTask = useCallback(async () => {
    if (!actionModal) return;
    try {
      if (actionModal.mode === "schedule") {
        await fetchJson(`/api/deal-tasks/${actionModal.taskId}`, {
          method: "PATCH",
          json: { due_date: actionModal.dueDate || null },
        });
        setFollowUpActionMessage(`Fecha agendada para ${actionModal.clientName}.`);
      } else {
        if (!actionModal.dueDate) {
          setFollowUpActionMessage("Asigna fecha al paso antes de marcarlo como completado.");
          return;
        }
        await fetchJson(`/api/deal-tasks/${actionModal.taskId}`, {
          method: "PATCH",
          json: { status: "done", due_date: actionModal.dueDate },
        });
        setFollowUpActionMessage(`Paso completado para ${actionModal.clientName}.`);
      }
      setActionModal(null);
      await myDayApi.refetch();
    } catch (error) {
      setFollowUpActionMessage(error instanceof Error ? error.message : "Error actualizando el seguimiento.");
    }
  }, [actionModal, myDayApi]);

  const updatePersonalTask = async (taskId: number, payload: Record<string, unknown>) => {
    setUpdatingPersonalTask(taskId);
    try {
      const response = await authFetch(`/api/tasks/${taskId}`, { method: "PUT", json: payload });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error actualizando tarea" }));
        throw new Error(errorData.error || "Error actualizando tarea");
      }
      await personalTasksApi.refetch();
    } catch (error) {
      setClientDetailError(error instanceof Error ? error.message : "Error actualizando tarea personal.");
    } finally {
      setUpdatingPersonalTask(null);
    }
  };

  const deletePersonalTask = async (taskId: number) => {
    if (!confirm("Eliminar esta tarea personal?")) return;
    setUpdatingPersonalTask(taskId);
    try {
      const response = await authFetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error eliminando tarea" }));
        throw new Error(errorData.error || "Error eliminando tarea");
      }
      await personalTasksApi.refetch();
    } catch (error) {
      setClientDetailError(error instanceof Error ? error.message : "Error eliminando tarea personal.");
    } finally {
      setUpdatingPersonalTask(null);
    }
  };

  const editPersonalTask = async (task: PersonalTask) => {
    const nextTitle = prompt("Titulo", task.title || "");
    if (nextTitle === null) return;
    const nextNotes = prompt("Notas", task.notes || "");
    if (nextNotes === null) return;
    await updatePersonalTask(task.id, { title: nextTitle, notes: nextNotes });
  };

  const renderTaskRow = (t: UnifiedTask, tone: "red" | "amber" | "slate") => {
    const dateColor =
      tone === "red"
        ? "text-red-300"
        : tone === "amber"
          ? "text-slate-400"
          : "text-slate-500";
    const titleColor =
      tone === "red" ? "text-red-100" : "text-slate-100";
    return (
      <li
        key={t.uid}
        onClick={() => handleTaskClick(t)}
        className={`group flex items-start justify-between gap-3 rounded-2xl border border-white/6 bg-white/4 px-3 py-2 text-sm backdrop-blur-sm transition-all ${t.client_id ? "cursor-pointer hover:border-sky-400/25 hover:bg-sky-400/8 hover:shadow-[0_12px_32px_rgba(56,189,248,0.12)]" : "cursor-default"}`}
        title={t.client_id ? "Abrir detalle del cliente" : undefined}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span
            className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${KIND_BADGE[t.kind]}`}
          >
            {KIND_LABEL[t.kind]}
          </span>
          <div className="min-w-0 flex-1">
            <span className={`block truncate font-medium ${t.client_id ? "group-hover:text-sky-100" : ""} ${titleColor}`}>
              {t.title}
            </span>
            {t.client_name && (
              <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                {t.client_name}
              </span>
            )}
          </div>
        </div>
        <span className={`shrink-0 whitespace-nowrap text-xs ${dateColor}`}>
          {tone === "red" && t.due_date
            ? `Vencía ${formatDate(t.due_date)}`
            : t.due_date
              ? formatDate(t.due_date)
              : "sin fecha"}
        </span>
      </li>
    );
  };

  const priorityLabel = (value?: string | null) => {
    const normalized = String(value || "normal").toLowerCase();
    if (normalized === "high") return "Alta";
    if (normalized === "low") return "Baja";
    return "Normal";
  };

  const customValue = (task: PersonalTask, keys: string[]) => {
    const fields = task.custom_fields && typeof task.custom_fields === "object" ? task.custom_fields : {};
    for (const key of keys) {
      const value = fields[key];
      if (value !== null && value !== undefined && String(value).trim()) return String(value);
    }
    return null;
  };

  const renderPersonalTask = (task: PersonalTask) => {
    const due = normalizeTaskDate(task);
    const category = customValue(task, ["category", "categoria", "tipo"]);
    const reminder = task.follow_up_date
      ? `${formatDate(task.follow_up_date)}${task.follow_up_time ? ` ${task.follow_up_time}` : ""}`
      : customValue(task, ["reminder", "recordatorio"]);
    const responsible = task.assigned_name || task.assigned_username || task.assigned_user_id || "Sin responsable";
    const isDone = String(task.status || "").toLowerCase() === "done";
    const busy = updatingPersonalTask === task.id;

    return (
      <li key={task.id} className="rounded-2xl border border-white/6 bg-white/5 p-3 shadow-[0_18px_40px_rgba(2,8,23,0.18)] backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {normalizeTaskClientId(task) ? (
                <button
                  type="button"
                  onClick={() => void loadClientDetail(normalizeTaskClientId(task) as string)}
                  className={`text-left text-sm font-semibold hover:underline ${isDone ? "text-slate-500 line-through" : "text-slate-100"}`}
                >
                  {task.title || "Sin título"}
                </button>
              ) : (
                <h3 className={`text-sm font-semibold ${isDone ? "text-slate-500 line-through" : "text-slate-100"}`}>
                  {task.title || "Sin título"}
                </h3>
              )}
              <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                {task.status || "pending"}
              </span>
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200">
                {priorityLabel(task.priority)}
              </span>
            </div>
            {(task.description || task.notes) && (
              <p className="mt-1 text-xs text-slate-400">{task.description || task.notes}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span>Vence: {due ? formatDate(due) : "sin fecha"}</span>
              <span>Categoría: {category || "sin categoría"}</span>
              <span>Recordatorio: {reminder || "sin recordatorio"}</span>
              <span>Responsable: {responsible}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!isDone && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void updatePersonalTask(task.id, { status: "done" })}
                className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 disabled:opacity-50"
              >
                Completar
              </button>
            )}
            {!isDone && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void updatePersonalTask(task.id, { due_date: addDaysISO(due, 1) })}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 disabled:opacity-50"
              >
                Posponer
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void editPersonalTask(task)}
              className="rounded border border-slate-700 p-1.5 text-slate-300 disabled:opacity-50"
              title="Editar"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void deletePersonalTask(task.id)}
              className="rounded border border-red-500/30 p-1.5 text-red-300 disabled:opacity-50"
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-slate-600">Futuro: convertir en cliente/oportunidad</div>
      </li>
    );
  };

  const renderFollowUp = (f: FollowUpTask, tone: "red" | "amber" | "slate") => {
    const dateColor =
      tone === "red"
        ? "text-red-300"
        : tone === "amber"
          ? "text-slate-400"
          : "text-slate-500";
    const labelDate = f.due_date ? formatDate(f.due_date) : "sin agendar";
    const name = String(f.client_name || f.title || "").trim();
    if (!name) return null;
    return (
      <li
        key={f.uid}
        className="text-sm flex items-center justify-between gap-2"
      >
        <button
          type="button"
          onClick={() => void loadClientDetail(f.client_id)}
          className="text-left text-blue-300 hover:text-blue-200 font-medium truncate"
          title="Abrir detalle del cliente"
        >
          {name}
        </button>
        <span className={`text-xs whitespace-nowrap shrink-0 ${dateColor}`}>
          {labelDate}
        </span>
      </li>
    );
  };

  // Render de una tarea comercial real (1 fila = 1 task de crm_deal_tasks).
  // Reemplaza al viejo renderFollowUpSummary (que agrupaba por cliente).
  const renderDealTask = (t: MyDayTask) => {
    const badgeVisual =
      t.badge === "atrasado"
        ? { icon: <AlertTriangle className="h-5 w-5" />, cls: "border-red-400/30 bg-red-400/12 text-red-200", label: "Atrasado" }
        : t.badge === "hoy"
          ? { icon: <Clock3 className="h-5 w-5" />, cls: "border-amber-400/30 bg-amber-400/12 text-amber-200", label: "Hoy" }
          : t.badge === "sin_fecha"
            ? { icon: <Calendar className="h-5 w-5" />, cls: "border-slate-400/30 bg-slate-400/12 text-slate-200", label: "Sin fecha" }
            : { icon: <Calendar className="h-5 w-5" />, cls: "border-sky-400/30 bg-sky-400/12 text-sky-200", label: "Futuro" };

    const dateLabel = t.due_date ? formatDate(t.due_date) : "Sin fecha";
    const meta: string[] = [];
    if (t.product_type) meta.push(`${t.product_type}${t.sale_type ? ` ${t.sale_type}` : ""}`);
    if (t.ban_number) meta.push(`BAN ${t.ban_number}`);
    if (t.phone) meta.push(t.phone);

    return (
      <article
        key={`task-${t.task_id}`}
        className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 transition-all hover:border-sky-400/30 hover:bg-white/[0.06]"
      >
        <div className={`shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${badgeVisual.cls}`}>
          {badgeVisual.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-[15px] font-semibold text-white">
              {t.client_name || "Cliente sin nombre"}
            </h3>
            <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-400">{badgeVisual.label}</span>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-slate-400">
            {t.step_name}
            <span className="text-slate-500"> · {dateLabel}</span>
            {meta.length > 0 && <span className="text-slate-500"> · {meta.join(" · ")}</span>}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadClientDetail(t.client_id)}
            className="rounded-lg bg-sky-500 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-sky-400"
          >
            Abrir cliente
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06111f] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,15,29,0.96)_0%,rgba(9,17,33,0.99)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.12),transparent_65%)]" />
      <div className="relative mx-auto max-w-[1200px] space-y-6 px-4 py-6 lg:px-6">
        {/* Header compacto */}
        <header className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200">
            <Sparkles className="h-3.5 w-3.5" />
            Mi día
          </div>
          <h1 className="mt-4 flex items-center gap-3 text-3xl font-semibold tracking-tight text-white">
            <Calendar className="h-7 w-7 text-sky-300" />
            Hola, {userName}
          </h1>
          <p className="mt-2 text-sm text-slate-400">{formatDate(today)}</p>
        </header>

        {/* Banda KPI ejecutiva: 5 cards full width arriba del dashboard. */}
        <DashboardKPIs salespersonId={adminFilterSpId || undefined} />

        {/* Banda de seguimientos: base = follow_up_prospects (TODOS los
            clientes en seguimiento). Cada fila puede no tener task
            (sin_tarea), no tener fecha (sin_fecha), o tener fecha
            (atrasado/hoy/futuro). Hasta 8 visibles, expandible. */}
        <FollowUpsBand
          items={dealTasks}
          loading={myDayApi.loading}
          counts={{
            overdue: overdueTasks.length,
            today: todayTasks.length,
            future: futureTasks.length,
            noDate: noDateTasks.length,
            noTask: noTaskTasks.length,
          }}
          onOpenClient={loadClientDetail}
        />

        {/* Layout principal del dashboard: 2 columnas en desktop.
            Izquierda: TUS METAS DE MAYO (dinero + unidades).
            Derecha:   DISTRIBUCION (donuts) + EVOLUCION (línea) apilados. */}
        <div className="grid gap-3 lg:grid-cols-2 items-start">
          <div className="space-y-3">
            <MetasPorProducto salespersonId={adminFilterSpId || undefined} />
          </div>
          <div className="space-y-3">
            <DistribucionDonuts salespersonId={adminFilterSpId || undefined} />
            <EvolucionDiaria salespersonId={adminFilterSpId || undefined} />
          </div>
        </div>

        {/* Modal cliente — disparado por "Abrir" en la banda de pasos. */}
        {loadingClientDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm">
            <div className="rounded-3xl border border-white/10 bg-[#0f172a] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
              <div className="flex items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
                <span className="text-lg text-white">Cargando detalles del cliente...</span>
              </div>
            </div>
          </div>
        )}

        {clientDetailError && (
          <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-amber-400/30 bg-[#111827] px-4 py-3 text-sm text-amber-100 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-3">
              <span>{clientDetailError}</span>
              <button
                type="button"
                onClick={() => setClientDetailError(null)}
                className="text-amber-200 hover:text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {clientDetail && !loadingClientDetail && (
          <ClientManagementModal
            key={clientDetail.id}
            client={clientDetail}
            onClose={() => setClientDetail(null)}
            onEditSubscriber={handleUnavailableSubscriberAction}
            onAddSubscriber={handleUnavailableSubscriberAction}
            onRefreshClient={async () => {
              if (clientDetail?.id) await loadClientDetail(clientDetail.id);
            }}
            onFollowUpUpdated={async () => {
              await myDayApi.refetch();
            }}
            clientHasActiveFollowUp={clientHasActiveFollowUp}
            resolveFollowUpVendorId={resolveFollowUpVendorId}
            initialTab="tareas"
          />
        )}
      </div>
    </div>
  );
}

// =========================================================================
// FollowUpsBand — banda de clientes en seguimiento.
// Render: orden ya viene del backend (atrasado → hoy → futuro → sin_fecha →
// sin_tarea). Mostramos hasta 8; el resto detrás de "Ver todos".
// =========================================================================
function FollowUpsBand({
  items,
  loading,
  counts,
  onOpenClient,
}: {
  items: MyDayTask[];
  loading: boolean;
  counts: { overdue: number; today: number; future: number; noDate: number; noTask: number };
  onOpenClient: (clientId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const MAX_COLLAPSED = 8;
  const total = items.length;
  const visible = expanded ? items : items.slice(0, MAX_COLLAPSED);

  if (total === 0 && !loading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[12px] text-slate-400">
          <Clock3 className="h-3.5 w-3.5 text-sky-300" />
          Sin clientes en seguimiento.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          <Clock3 className="h-3.5 w-3.5 text-sky-300" />
          Clientes en seguimiento
          <span className="text-slate-500">·</span>
          <span className="text-[10px] normal-case tracking-normal text-slate-400">
            {counts.overdue} atrasados · {counts.today} hoy · {counts.future} futuros · {counts.noDate} sin fecha · {counts.noTask} sin tarea
          </span>
        </h2>
        {total > MAX_COLLAPSED && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300 hover:bg-white/10"
          >
            {expanded ? `Colapsar` : `Ver todos (${total})`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
        {visible.map((t) => (
          <FollowUpItem key={`fu-${t.follow_up_id}`} item={t} onOpenClient={onOpenClient} />
        ))}
      </div>
    </section>
  );
}

function FollowUpItem({
  item,
  onOpenClient,
}: {
  item: MyDayTask;
  onOpenClient: (clientId: string) => void;
}) {
  const tone =
    item.badge === "atrasado"
      ? "border-red-400/40 bg-red-400/10 text-red-200"
      : item.badge === "hoy"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
        : item.badge === "futuro"
          ? "border-sky-400/40 bg-sky-400/10 text-sky-200"
          : item.badge === "sin_fecha"
            ? "border-slate-400/40 bg-slate-400/10 text-slate-200"
            : "border-purple-400/40 bg-purple-400/10 text-purple-200";

  const badgeLabel =
    item.badge === "atrasado"
      ? "Atrasado"
      : item.badge === "hoy"
        ? "Hoy"
        : item.badge === "futuro"
          ? "Futuro"
          : item.badge === "sin_fecha"
            ? "Sin fecha"
            : "Sin tarea";

  // Texto principal de fecha: prioridad visual.
  const dateMain =
    item.badge === "sin_tarea"
      ? "Sin tarea"
      : item.badge === "sin_fecha"
        ? "Sin fecha"
        : item.due_date
          ? formatDate(item.due_date)
          : "Sin fecha";

  // Meta secundaria: step / BAN / teléfono / producto.
  const metaParts: string[] = [];
  if (item.step_name) metaParts.push(item.step_name);
  if (item.product_type) metaParts.push(item.product_type);
  if (item.ban_number) metaParts.push(`BAN ${item.ban_number}`);
  if (item.phone) metaParts.push(item.phone);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5">
      <span className={`shrink-0 rounded border px-1.5 py-0 text-[9px] uppercase tracking-wide ${tone}`}>
        {badgeLabel}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13px] font-semibold text-white">
            {item.client_name || "Cliente sin nombre"}
          </span>
          <span className="shrink-0 text-[12px] font-medium text-slate-200">{dateMain}</span>
        </div>
        {metaParts.length > 0 && (
          <div className="truncate text-[11px] text-slate-400">{metaParts.join(" · ")}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onOpenClient(item.client_id)}
        className="shrink-0 rounded-md bg-sky-500/90 px-2 py-0.5 text-[11px] font-medium text-white transition hover:bg-sky-400"
      >
        Abrir
      </button>
    </div>
  );
}
