import { useState } from "react";
import { AlertCircle, ClipboardCheck, LayoutDashboard, Loader2, Plus, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router";
import { useApi } from "@/react-app/hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";

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
};

type ClientsResponse = {
  clients: Client[];
  stats?: {
    active_count?: number | string | null;
  };
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
  const clients = Array.isArray(data?.clients) ? data.clients : [];
  const activeCount = data?.stats?.active_count != null ? toNumber(data.stats.active_count) : clients.length;
  const topPriorityClients = [...clients]
    .sort((a, b) => toNumber(b.priority_score) - toNumber(a.priority_score))
    .slice(0, 10);
  const clientsWithoutRecentFollowup = clients.filter((client) => !client.recent_followup);

  const [taskState, setTaskState] = useState<Record<string, TaskState>>({});

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
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setTaskState((prev) => ({ ...prev, [id]: "created" }));
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
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
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 xl:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-300" />
                Top 10 por priority_score
              </h2>
              <p className="text-xs text-slate-400 mt-1">Ranking calculado en backend desde clientes activos.</p>
            </div>
          </div>

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
        </section>
      </div>

      <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-300" />
            Clientes sin seguimiento reciente
          </h2>
          <span className="text-sm text-slate-400">{loading ? "-" : clientsWithoutRecentFollowup.length} clientes</span>
        </div>

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
      </section>
    </div>
  );
}
