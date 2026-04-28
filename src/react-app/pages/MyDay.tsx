import { useMemo } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  Calendar,
  CheckSquare,
  Loader2,
  Phone,
  ShieldAlert,
  Target,
} from "lucide-react";
import { useApi } from "@/react-app/hooks/useApi";
import { getCurrentUser } from "@/react-app/utils/auth";

// ── Tipos por endpoint (un sub-set mínimo de los campos reales) ──

type AgentTask = {
  id: number;
  title?: string | null;
  status?: string | null;
  due_date?: string | null;
  related_client_id?: string | null;
  assigned_salesperson_id?: string | null;
  created_at?: string | null;
};

type PersonalTask = {
  id: number;
  title?: string | null;
  status?: string | null;
  due_date?: string | null;
  follow_up_date?: string | null;
  task_kind?: "regular" | "client" | null;
  created_at?: string | null;
};

type DealTask = {
  id: number;
  deal_id?: number | null;
  step_name?: string | null;
  status?: string | null;
  due_date?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  created_at?: string | null;
};

type WorkflowTask = {
  id: number;
  client_id?: string | null;
  client_name?: string | null;
  status?: string | null;
  product_name?: string | null;
  product_key?: string | null;
  created_at?: string | null;
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
};

type Client = {
  id: string | number;
  name?: string | null;
  active_ban_count?: number | string | null;
  salesperson_id?: string | null;
};

type ClientsResponse = { clients: Client[] };

type GoalVendor = {
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

// ── Tarea unificada ──

type TaskKind = "agent" | "personal" | "deal" | "workflow";

type UnifiedTask = {
  uid: string; // único: kind+id
  kind: TaskKind;
  title: string;
  due_date: string | null; // ISO 'YYYY-MM-DD' o null
  client_id: string | null;
  client_name: string | null;
  link: string; // ruta a abrir
  created_at: string | null;
};

const KIND_LABEL: Record<TaskKind, string> = {
  agent: "Agente",
  personal: "Personal",
  deal: "Venta",
  workflow: "Paso",
};

const KIND_BADGE: Record<TaskKind, string> = {
  agent: "bg-blue-500/15 text-blue-200 border-blue-500/30",
  personal: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  deal: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  workflow: "bg-purple-500/15 text-purple-200 border-purple-500/30",
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
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
};

const dueKey = (v?: string | null): string | null => {
  if (!v) return null;
  return String(v).slice(0, 10);
};

const isPending = (status?: string | null) => {
  const s = String(status || "").toLowerCase();
  return s === "pending" || s === "in_progress";
};

// is_active acepta boolean o number 0/1 (BD inconsistente)
const isFollowUpActive = (f: FollowUp): boolean => {
  if (f.completed_date) return false;
  if (f.is_completed === true) return false;
  const a = f.is_active;
  if (a === false || a === 0) return false;
  return true;
};

export default function MyDay() {
  const user = getCurrentUser();
  const role = String(user?.role || "").toLowerCase();
  const userName = user?.salespersonName || user?.username || "Vendedor";
  const today = todayISO();
  const monthYM = currentMonthYM();

  // ── Endpoints (todos filtran por rol server-side donde aplica) ──
  const agentTasksApi = useApi<AgentTask[]>("/api/agents/tasks?limit=500");
  const personalTasksApi = useApi<PersonalTask[]>("/api/tasks");
  const dealTasksApi = useApi<DealTask[]>("/api/deal-tasks?pending_only=1");
  const workflowsApi = useApi<WorkflowTask[]>(
    "/api/client-product-workflows?pending_only=1",
  );
  const clientsApi = useApi<ClientsResponse>("/api/clients?tab=active");
  const followUpsApi = useApi<FollowUp[]>("/api/follow-up-prospects");
  const goalsApi = useApi<GoalsResponse>(
    `/api/goals/performance?month=${monthYM}`,
  );

  const agentTasks = useMemo(
    () => (Array.isArray(agentTasksApi.data) ? agentTasksApi.data : []),
    [agentTasksApi.data],
  );
  const personalTasks = useMemo(
    () => (Array.isArray(personalTasksApi.data) ? personalTasksApi.data : []),
    [personalTasksApi.data],
  );
  const dealTasks = useMemo(
    () => (Array.isArray(dealTasksApi.data) ? dealTasksApi.data : []),
    [dealTasksApi.data],
  );
  const workflows = useMemo(
    () => (Array.isArray(workflowsApi.data) ? workflowsApi.data : []),
    [workflowsApi.data],
  );
  const clients = useMemo(
    () => clientsApi.data?.clients || [],
    [clientsApi.data],
  );
  const followUps = useMemo(
    () => (Array.isArray(followUpsApi.data) ? followUpsApi.data : []),
    [followUpsApi.data],
  );
  const goalVendors = useMemo(
    () => goalsApi.data?.vendors || [],
    [goalsApi.data],
  );

  // ── Unificar tareas pendientes de las 4 fuentes ──
  const unifiedTasks: UnifiedTask[] = useMemo(() => {
    const out: UnifiedTask[] = [];

    for (const t of agentTasks) {
      if (!isPending(t.status)) continue;
      const cid = t.related_client_id ? String(t.related_client_id) : null;
      out.push({
        uid: `agent-${t.id}`,
        kind: "agent",
        title: t.title || "Sin título",
        due_date: dueKey(t.due_date),
        client_id: cid,
        client_name: null,
        link: "/tareas",
        created_at: t.created_at || null,
      });
    }

    for (const t of personalTasks) {
      if (!isPending(t.status)) continue;
      out.push({
        uid: `personal-${t.id}`,
        kind: "personal",
        title: t.title || "Sin título",
        due_date: dueKey(t.due_date) || dueKey(t.follow_up_date),
        client_id: null,
        client_name: null,
        link: "/tareas?tab=personales",
        created_at: t.created_at || null,
      });
    }

    for (const t of dealTasks) {
      if (!isPending(t.status)) continue;
      const cid = t.client_id ? String(t.client_id) : null;
      const titleParts = [t.step_name || "Paso de venta"];
      if (t.client_name) titleParts.push(`(${t.client_name})`);
      out.push({
        uid: `deal-${t.id}`,
        kind: "deal",
        title: titleParts.join(" "),
        due_date: dueKey(t.due_date),
        client_id: cid,
        client_name: t.client_name || null,
        link: cid ? `/clientes?openClient=${cid}&tab=pasos` : "/tareas",
        created_at: t.created_at || null,
      });
    }

    for (const t of workflows) {
      if (!isPending(t.status)) continue;
      const cid = t.client_id ? String(t.client_id) : null;
      const productLabel = t.product_name || t.product_key || "producto";
      const titleParts = [`Paso pendiente: ${productLabel}`];
      if (t.client_name) titleParts.push(`(${t.client_name})`);
      out.push({
        uid: `workflow-${t.id}`,
        kind: "workflow",
        title: titleParts.join(" "),
        due_date: null, // workflow no tiene due_date confiable
        client_id: cid,
        client_name: t.client_name || null,
        link: cid ? `/clientes?openClient=${cid}&tab=pasos` : "/tareas",
        created_at: t.created_at || null,
      });
    }

    return out;
  }, [agentTasks, personalTasks, dealTasks, workflows]);

  // ── Sub-grupos de tareas: atrasadas / hoy / sin fecha ──
  const overdueTasks = useMemo(
    () =>
      unifiedTasks
        .filter((t) => t.due_date && t.due_date < today)
        .sort((a, b) =>
          String(a.due_date || "").localeCompare(String(b.due_date || "")),
        ),
    [unifiedTasks, today],
  );

  const todayTasks = useMemo(
    () =>
      unifiedTasks
        .filter((t) => t.due_date && t.due_date === today)
        .sort((a, b) =>
          String(a.created_at || "").localeCompare(String(b.created_at || "")),
        ),
    [unifiedTasks, today],
  );

  const noDateTasks = useMemo(
    () =>
      unifiedTasks
        .filter((t) => !t.due_date)
        .sort((a, b) =>
          String(a.created_at || "").localeCompare(String(b.created_at || "")),
        ),
    [unifiedTasks],
  );

  // ── Seguimientos: activos (no completados, no cancelados) agrupados ──
  const activeFollowUps = useMemo(
    () => followUps.filter(isFollowUpActive),
    [followUps],
  );

  const followUpOverdue = useMemo(
    () =>
      activeFollowUps
        .filter((f) => {
          const k = dueKey(f.next_call_date);
          return k !== null && k < today;
        })
        .sort((a, b) =>
          String(a.next_call_date || "").localeCompare(
            String(b.next_call_date || ""),
          ),
        ),
    [activeFollowUps, today],
  );

  const followUpToday = useMemo(
    () =>
      activeFollowUps
        .filter((f) => dueKey(f.next_call_date) === today)
        .sort((a, b) =>
          String(a.next_call_date || "").localeCompare(
            String(b.next_call_date || ""),
          ),
        ),
    [activeFollowUps, today],
  );

  const followUpNoDate = useMemo(
    () =>
      activeFollowUps.filter((f) => !dueKey(f.next_call_date)),
    [activeFollowUps],
  );
  // futuros (next_call_date > today) se omiten — viven en /seguimiento

  // ── Avance del mes ──
  const myGoalRow = useMemo(() => {
    if (role === "vendedor") {
      return goalVendors[0] || null;
    }
    if (goalVendors.length === 0) return null;
    const totalGoal = goalVendors.reduce(
      (s, v) => s + Number(v.total_goal || 0),
      0,
    );
    const totalEarned = goalVendors.reduce(
      (s, v) => s + Number(v.total_earned || 0),
      0,
    );
    const pct =
      totalGoal > 0
        ? Math.round((totalEarned / totalGoal) * 1000) / 10
        : 0;
    return {
      vendor_name: "Equipo",
      total_goal: totalGoal,
      total_earned: totalEarned,
      percentage: pct,
      remaining: Math.max(0, totalGoal - totalEarned),
    };
  }, [goalVendors, role]);

  // ── Top 3 acción: clientes activos sin tarea/seguimiento en NINGUNA fuente ──
  const top3Action = useMemo(() => {
    const clientIdsBlocked = new Set<string>();

    // 1) agent_tasks pending con related_client_id
    for (const t of agentTasks) {
      if (!isPending(t.status)) continue;
      if (t.related_client_id)
        clientIdsBlocked.add(String(t.related_client_id));
    }
    // 2) deal_tasks pendientes (vienen ya filtradas pending_only)
    for (const t of dealTasks) {
      if (!isPending(t.status)) continue;
      if (t.client_id) clientIdsBlocked.add(String(t.client_id));
    }
    // 3) workflows pendientes (vienen ya filtrados pending_only)
    for (const t of workflows) {
      if (!isPending(t.status)) continue;
      if (t.client_id) clientIdsBlocked.add(String(t.client_id));
    }
    // 4) follow_up activo (con o sin fecha)
    for (const f of activeFollowUps) {
      if (f.client_id) clientIdsBlocked.add(String(f.client_id));
    }
    // (personal_tasks no tiene FK directa a cliente — se omite)

    return clients
      .filter((c) => !clientIdsBlocked.has(String(c.id)))
      .slice(0, 3);
  }, [clients, agentTasks, dealTasks, workflows, activeFollowUps]);

  // ── Estado global de carga / error ──
  const isLoading =
    agentTasksApi.loading ||
    personalTasksApi.loading ||
    dealTasksApi.loading ||
    workflowsApi.loading ||
    clientsApi.loading ||
    followUpsApi.loading ||
    goalsApi.loading;

  const hasError =
    !!agentTasksApi.error ||
    !!personalTasksApi.error ||
    !!dealTasksApi.error ||
    !!workflowsApi.error ||
    !!clientsApi.error ||
    !!followUpsApi.error ||
    !!goalsApi.error;

  const goalPct = Number(myGoalRow?.percentage || 0);
  const goalBarColor =
    goalPct >= 70
      ? "bg-emerald-500"
      : goalPct >= 40
        ? "bg-amber-500"
        : "bg-red-500";

  // ── Render helpers ──
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
        className="text-sm flex items-start justify-between gap-2"
      >
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span
            className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${KIND_BADGE[t.kind]} shrink-0 mt-0.5`}
          >
            {KIND_LABEL[t.kind]}
          </span>
          <Link
            to={t.link}
            className={`truncate hover:underline ${titleColor}`}
          >
            {t.title}
          </Link>
        </div>
        <span className={`text-xs whitespace-nowrap shrink-0 ${dateColor}`}>
          {tone === "red" && t.due_date
            ? `Vencía ${formatDate(t.due_date)}`
            : t.due_date
              ? formatDate(t.due_date)
              : "sin fecha"}
        </span>
      </li>
    );
  };

  const renderFollowUp = (f: FollowUp, tone: "red" | "amber" | "slate") => {
    const dateColor =
      tone === "red"
        ? "text-red-300"
        : tone === "amber"
          ? "text-slate-400"
          : "text-slate-500";
    const labelDate = f.next_call_date
      ? formatDate(f.next_call_date)
      : "sin agendar";
    const cid = f.client_id ? String(f.client_id) : null;
    const name = f.client_name || f.company_name || "Sin cliente";
    return (
      <li
        key={f.id}
        className="text-sm flex items-center justify-between gap-2"
      >
        {cid ? (
          <Link
            to={`/clientes?openClient=${cid}`}
            className="text-blue-300 hover:text-blue-200 font-medium truncate"
          >
            {name}
          </Link>
        ) : (
          <span className="truncate">{name}</span>
        )}
        <span className={`text-xs whitespace-nowrap shrink-0 ${dateColor}`}>
          {labelDate}
        </span>
      </li>
    );
  };

  return (
    <div className="space-y-6 text-slate-100">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-400" />
            Mi día
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Buen día, {userName}. Esto es lo que tenés para hoy (
            {new Date().toLocaleDateString()}).
          </p>
        </div>
        {isLoading && (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        )}
      </header>

      {overdueTasks.length > 0 && (
        <div className="bg-red-900/40 border-2 border-red-500 rounded-lg p-4 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-red-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-semibold text-red-100">
              Tienes {overdueTasks.length} tarea
              {overdueTasks.length === 1 ? "" : "s"} atrasada
              {overdueTasks.length === 1 ? "" : "s"} — resuélvela
              {overdueTasks.length === 1 ? "" : "s"} antes de continuar
            </p>
            <p className="text-xs text-red-200/80 mt-0.5">
              Las acciones recomendadas se desbloquean cuando estés al día.
            </p>
          </div>
        </div>
      )}

      <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase text-slate-400 flex items-center gap-2 mb-3">
          <CheckSquare className="w-4 h-4" />
          Tareas de hoy
          <span className="text-xs text-slate-500 normal-case font-normal">
            ({overdueTasks.length} atrasadas · {todayTasks.length} hoy ·{" "}
            {noDateTasks.length} sin fecha)
          </span>
        </h2>

        {unifiedTasks.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            No hay tareas pendientes en ninguna fuente.
          </p>
        ) : (
          <div className="space-y-3">
            {overdueTasks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-red-300 uppercase mb-1.5">
                  Atrasadas ({overdueTasks.length})
                </h3>
                <ul className="space-y-1">
                  {overdueTasks.map((t) => renderTaskRow(t, "red"))}
                </ul>
              </div>
            )}
            {todayTasks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-amber-300 uppercase mb-1.5">
                  Para hoy ({todayTasks.length})
                </h3>
                <ul className="space-y-1">
                  {todayTasks.map((t) => renderTaskRow(t, "amber"))}
                </ul>
              </div>
            )}
            {noDateTasks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-1.5">
                  Sin fecha ({noDateTasks.length})
                </h3>
                <ul className="space-y-1">
                  {noDateTasks.slice(0, 10).map((t) => renderTaskRow(t, "slate"))}
                  {noDateTasks.length > 10 && (
                    <li className="text-xs text-slate-500 italic pt-1">
                      +{noDateTasks.length - 10} más sin fecha
                    </li>
                  )}
                </ul>
              </div>
            )}
            {overdueTasks.length === 0 &&
              todayTasks.length === 0 &&
              noDateTasks.length === 0 && (
                <p className="text-sm text-slate-400 italic">
                  Tenés tareas pendientes pero ninguna calza en estos grupos.
                </p>
              )}
          </div>
        )}
      </section>

      <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase text-slate-400 flex items-center gap-2 mb-3">
          <Phone className="w-4 h-4" />
          Mis seguimientos
          <span className="text-xs text-slate-500 normal-case font-normal">
            ({followUpOverdue.length} atrasados · {followUpToday.length} hoy ·{" "}
            {followUpNoDate.length} sin agendar)
          </span>
        </h2>

        {activeFollowUps.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            No tenés clientes en seguimiento activo.
          </p>
        ) : followUpOverdue.length === 0 &&
          followUpToday.length === 0 &&
          followUpNoDate.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            Todos los seguimientos activos están agendados a futuro.
          </p>
        ) : (
          <div className="space-y-3">
            {followUpOverdue.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-red-300 uppercase mb-1.5">
                  Atrasados ({followUpOverdue.length})
                </h3>
                <ul className="space-y-1">
                  {followUpOverdue.map((f) => renderFollowUp(f, "red"))}
                </ul>
              </div>
            )}
            {followUpToday.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-amber-300 uppercase mb-1.5">
                  Para hoy ({followUpToday.length})
                </h3>
                <ul className="space-y-1">
                  {followUpToday.map((f) => renderFollowUp(f, "amber"))}
                </ul>
              </div>
            )}
            {followUpNoDate.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-1.5">
                  Sin agendar ({followUpNoDate.length})
                </h3>
                <ul className="space-y-1">
                  {followUpNoDate.slice(0, 10).map((f) =>
                    renderFollowUp(f, "slate"),
                  )}
                  {followUpNoDate.length > 10 && (
                    <li className="text-xs text-slate-500 italic pt-1">
                      +{followUpNoDate.length - 10} más sin agendar
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase text-slate-400 flex items-center gap-2 mb-3">
          <Target className="w-4 h-4" />
          Mi avance del mes
          <span className="text-xs text-slate-500 normal-case font-normal">
            ({goalsApi.data?.period || monthYM})
          </span>
        </h2>

        {!myGoalRow ? (
          <p className="text-sm text-slate-400 italic">
            No hay meta configurada para este período.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-400 uppercase">Meta</div>
                <div className="text-lg font-semibold">
                  {formatUSD(Number(myGoalRow.total_goal || 0))}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase">Avance</div>
                <div className="text-lg font-semibold text-emerald-300">
                  {formatUSD(Number(myGoalRow.total_earned || 0))}
                </div>
                <div className="text-xs text-slate-500">
                  {goalPct.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase">Restante</div>
                <div className="text-lg font-semibold text-amber-300">
                  {formatUSD(Number(myGoalRow.remaining || 0))}
                </div>
              </div>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all ${goalBarColor}`}
                style={{ width: `${Math.min(100, goalPct)}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {overdueTasks.length === 0 && (
        <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-semibold uppercase text-slate-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Top 3 acción
            <span className="text-xs text-slate-500 normal-case font-normal">
              (clientes activos sin tarea ni seguimiento en ninguna fuente)
            </span>
          </h2>

          {top3Action.length === 0 ? (
            <p className="text-sm text-slate-400 italic">
              {clients.length === 0
                ? "No hay clientes activos asignados."
                : "Todos los clientes activos tienen tarea o seguimiento programado."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {top3Action.map((c) => (
                <li
                  key={String(c.id)}
                  className="text-sm flex items-center justify-between gap-2"
                >
                  <Link
                    to={`/clientes?openClient=${c.id}`}
                    className="text-blue-300 hover:text-blue-200 font-medium truncate"
                  >
                    {c.name || "Sin nombre"}
                  </Link>
                  {c.active_ban_count != null && (
                    <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                      {c.active_ban_count} BAN
                      {Number(c.active_ban_count) === 1 ? "" : "s"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {hasError && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 text-xs rounded p-3">
          Algunas fuentes no respondieron correctamente. Datos parciales
          mostrados.
        </div>
      )}
    </div>
  );
}
