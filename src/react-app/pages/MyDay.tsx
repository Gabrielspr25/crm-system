import { useMemo } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  Calendar,
  CheckSquare,
  Loader2,
  Phone,
  Target,
} from "lucide-react";
import { useApi } from "@/react-app/hooks/useApi";
import { getCurrentUser } from "@/react-app/utils/auth";

type Task = {
  id: number;
  title?: string | null;
  status?: string | null;
  due_date?: string | null;
  related_client_id?: string | null;
  assigned_salesperson_id?: string | null;
  created_at?: string | null;
};

type FollowUp = {
  id: number;
  client_id?: string | null;
  client_name?: string | null;
  next_call_date?: string | null;
  is_completed?: boolean | null;
  is_active?: boolean | null;
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

export default function MyDay() {
  const user = getCurrentUser();
  const role = String(user?.role || "").toLowerCase();
  const userName = user?.salespersonName || user?.username || "Vendedor";
  const today = todayISO();
  const monthYM = currentMonthYM();

  const tasksApi = useApi<Task[]>("/api/agents/tasks?limit=500");
  const clientsApi = useApi<ClientsResponse>("/api/clients?tab=active");
  const followUpsApi = useApi<FollowUp[]>("/api/follow-up-prospects");
  const goalsApi = useApi<GoalsResponse>(`/api/goals/performance?month=${monthYM}`);

  const tasks = useMemo(
    () => (Array.isArray(tasksApi.data) ? tasksApi.data : []),
    [tasksApi.data],
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

  const pendingTasks = useMemo(
    () => tasks.filter((t) => String(t.status || "").toLowerCase() === "pending"),
    [tasks],
  );

  const overdueTasks = useMemo(
    () =>
      pendingTasks
        .filter((t) => t.due_date && String(t.due_date).slice(0, 10) < today)
        .sort((a, b) =>
          String(a.due_date || "").localeCompare(String(b.due_date || "")),
        ),
    [pendingTasks, today],
  );

  const todayTasks = useMemo(
    () =>
      pendingTasks
        .filter((t) => t.due_date && String(t.due_date).slice(0, 10) === today)
        .sort((a, b) =>
          String(a.created_at || "").localeCompare(String(b.created_at || "")),
        ),
    [pendingTasks, today],
  );

  const dueFollowUps = useMemo(
    () =>
      followUps
        .filter((f) => {
          if (f.is_completed) return false;
          if (f.is_active === false) return false;
          if (!f.next_call_date) return false;
          return String(f.next_call_date).slice(0, 10) <= today;
        })
        .sort((a, b) =>
          String(a.next_call_date || "").localeCompare(
            String(b.next_call_date || ""),
          ),
        ),
    [followUps, today],
  );

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
    const pct = totalGoal > 0 ? Math.round((totalEarned / totalGoal) * 1000) / 10 : 0;
    return {
      vendor_name: "Equipo",
      total_goal: totalGoal,
      total_earned: totalEarned,
      percentage: pct,
      remaining: Math.max(0, totalGoal - totalEarned),
    };
  }, [goalVendors, role]);

  const top3Action = useMemo(() => {
    const clientIdsWithTask = new Set<string>();
    for (const t of pendingTasks) {
      if (t.related_client_id) clientIdsWithTask.add(String(t.related_client_id));
    }
    const clientIdsWithFollowUp = new Set<string>();
    for (const f of followUps) {
      if (f.is_completed) continue;
      if (f.is_active === false) continue;
      if (f.client_id) clientIdsWithFollowUp.add(String(f.client_id));
    }
    return clients
      .filter((c) => {
        const cid = String(c.id);
        return (
          !clientIdsWithTask.has(cid) && !clientIdsWithFollowUp.has(cid)
        );
      })
      .slice(0, 3);
  }, [clients, pendingTasks, followUps]);

  const isLoading =
    tasksApi.loading ||
    clientsApi.loading ||
    followUpsApi.loading ||
    goalsApi.loading;
  const hasError =
    !!tasksApi.error ||
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

      <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase text-slate-400 flex items-center gap-2 mb-3">
          <CheckSquare className="w-4 h-4" />
          Tareas de hoy
          <span className="text-xs text-slate-500 normal-case font-normal">
            ({overdueTasks.length} atrasadas · {todayTasks.length} hoy)
          </span>
        </h2>

        {pendingTasks.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            No hay tareas pendientes.
          </p>
        ) : overdueTasks.length === 0 && todayTasks.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            Tenés {pendingTasks.length} tarea
            {pendingTasks.length === 1 ? "" : "s"} pendiente
            {pendingTasks.length === 1 ? "" : "s"} pero ninguna con fecha
            límite hoy o atrasada.
          </p>
        ) : (
          <div className="space-y-3">
            {overdueTasks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-red-300 uppercase mb-1.5">
                  Atrasadas ({overdueTasks.length})
                </h3>
                <ul className="space-y-1">
                  {overdueTasks.map((t) => (
                    <li
                      key={t.id}
                      className="text-sm flex items-center justify-between gap-2 text-red-100"
                    >
                      <span className="truncate">
                        {t.title || "Sin título"}
                      </span>
                      <span className="text-xs text-red-300 whitespace-nowrap shrink-0">
                        Vence {formatDate(t.due_date)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {todayTasks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-amber-300 uppercase mb-1.5">
                  Para hoy ({todayTasks.length})
                </h3>
                <ul className="space-y-1">
                  {todayTasks.map((t) => (
                    <li
                      key={t.id}
                      className="text-sm flex items-center justify-between gap-2"
                    >
                      <span className="truncate">
                        {t.title || "Sin título"}
                      </span>
                      <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                        {formatDate(t.due_date)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase text-slate-400 flex items-center gap-2 mb-3">
          <Phone className="w-4 h-4" />
          Seguimientos para hoy
          <span className="text-xs text-slate-500 normal-case font-normal">
            ({dueFollowUps.length})
          </span>
        </h2>

        {dueFollowUps.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            No hay seguimientos pendientes para hoy.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {dueFollowUps.map((f) => (
              <li
                key={f.id}
                className="text-sm flex items-center justify-between gap-2"
              >
                {f.client_id ? (
                  <Link
                    to={`/clientes?openClient=${f.client_id}`}
                    className="text-blue-300 hover:text-blue-200 font-medium truncate"
                  >
                    {f.client_name || "Sin cliente"}
                  </Link>
                ) : (
                  <span className="truncate">
                    {f.client_name || "Sin cliente"}
                  </span>
                )}
                <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                  {formatDate(f.next_call_date)}
                </span>
              </li>
            ))}
          </ul>
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

      <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase text-slate-400 flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4" />
          Top 3 acción
          <span className="text-xs text-slate-500 normal-case font-normal">
            (clientes activos sin tarea ni seguimiento)
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

      {hasError && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 text-xs rounded p-3">
          Algunas fuentes no respondieron correctamente. Datos parciales
          mostrados.
        </div>
      )}
    </div>
  );
}
