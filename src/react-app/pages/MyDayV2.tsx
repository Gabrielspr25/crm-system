// Mi Día v2 — vista directa de crm_deal_tasks.
// Una fila = una tarea pendiente real. Sin dedupe, sin fallbacks, sin
// follow_up_prospects. Fuente única: GET /api/my-day.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, CheckSquare, Clock3, Loader2, Phone, User } from "lucide-react";
import { useApi } from "@/react-app/hooks/useApi";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";
import { ClientManagementModal } from "@/react-app/pages/Clients";

type MyDayTask = {
  task_id: number;
  due_date: string | null;
  step_name: string;
  step_order: number;
  task_status: "in_progress" | "pending";
  seller_id: string | null;
  seller_name: string | null;
  deal_id: number;
  client_id: string;
  client_name: string;
  product_type: string | null;
  sale_type: string | null;
  ban_number: string | null;
  phone: string | null;
  source_label: string | null;
  badge: "atrasado" | "hoy" | "futuro" | "sin_fecha";
};

type PersonalTask = {
  id: number;
  title: string | null;
  status: string | null;
  due_date: string | null;
  created_at: string | null;
};

type Salesperson = { id: string; name: string; role?: string | null };

// "YYYY-MM-DD" → "MM/DD/YYYY" sin pasar por Date (evita TZ shift).
const formatYMD = (ymd: string | null) => {
  if (!ymd) return "Sin fecha";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : ymd;
};

const isPersonalPending = (t: PersonalTask) => {
  const s = String(t.status || "").toLowerCase();
  return s !== "done" && s !== "completed" && s !== "cancelled";
};

export default function MyDayV2() {
  const user = getCurrentUser();
  const role = String(user?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "supervisor";
  const userName = user?.salespersonName || user?.username || "Vendedor";

  const [adminSellerId, setAdminSellerId] = useState<string | null>(null);
  const url = useMemo(
    () => (isAdmin && adminSellerId ? `/api/my-day?seller_id=${encodeURIComponent(adminSellerId)}` : "/api/my-day"),
    [isAdmin, adminSellerId],
  );

  const myDayApi = useApi<MyDayTask[]>(url);
  const personalApi = useApi<PersonalTask[]>("/api/tasks");
  const salespeopleApi = useApi<Salesperson[]>("/api/salespeople");

  // Modal cliente
  const [clientDetail, setClientDetail] = useState<any | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const openClient = useCallback(async (clientId: string) => {
    setClientError(null);
    setLoadingClient(true);
    try {
      const res = await authFetch(`/api/clients/${encodeURIComponent(clientId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setClientDetail(data);
    } catch (e) {
      setClientError(e instanceof Error ? e.message : "No se pudo cargar el cliente");
    } finally {
      setLoadingClient(false);
    }
  }, []);

  // Refetch al cerrar modal (el usuario puede haber editado fechas).
  const closeClient = useCallback(async () => {
    setClientDetail(null);
    await myDayApi.refetch?.();
  }, [myDayApi]);

  // Agrupar por badge.
  const tasks = useMemo(() => (Array.isArray(myDayApi.data) ? myDayApi.data : []), [myDayApi.data]);
  const atrasadas = useMemo(() => tasks.filter((t) => t.badge === "atrasado"), [tasks]);
  const hoy = useMemo(() => tasks.filter((t) => t.badge === "hoy"), [tasks]);
  const futuras = useMemo(() => tasks.filter((t) => t.badge === "futuro"), [tasks]);
  const sinFecha = useMemo(() => tasks.filter((t) => t.badge === "sin_fecha"), [tasks]);

  const personales = useMemo(
    () => (Array.isArray(personalApi.data) ? personalApi.data : []).filter(isPersonalPending),
    [personalApi.data],
  );

  useEffect(() => {
    // Salespeople solo necesarios para admin.
    if (!isAdmin) return;
    salespeopleApi.refetch?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const adminSalespeople = useMemo(
    () => (Array.isArray(salespeopleApi.data) ? salespeopleApi.data : []),
    [salespeopleApi.data],
  );

  const totalPendientes = atrasadas.length + hoy.length + futuras.length + sinFecha.length;

  // Stubs para el modal cliente (Mi Día v2 no calcula follow-ups).
  const clientHasActiveFollowUp = () => false;
  const resolveFollowUpVendorId = () => null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06111f] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,15,29,0.96)_0%,rgba(9,17,33,0.99)_100%)]" />
      <div className="relative mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-6">
        {/* Header */}
        <header className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200">
                <Calendar className="h-3.5 w-3.5" /> Mi día (v2)
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white lg:text-3xl">
                Hola, {userName}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {totalPendientes} tareas comerciales pendientes · {personales.length} tareas personales
              </p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Vendedor</span>
                <select
                  value={adminSellerId || ""}
                  onChange={(e) => setAdminSellerId(e.target.value || null)}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-amber-400/40"
                >
                  <option value="">Todos</option>
                  {adminSalespeople.map((sp) => (
                    <option key={sp.id} value={String(sp.id)}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        {/* Estados generales */}
        {myDayApi.loading && (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando Mi Día…
          </div>
        )}
        {myDayApi.error && (
          <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
            Error: {myDayApi.error}
          </div>
        )}

        {/* Comercial */}
        <Section
          title="Atrasadas"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="red"
          count={atrasadas.length}
          tasks={atrasadas}
          onOpenClient={openClient}
        />
        <Section
          title="Hoy"
          icon={<Clock3 className="h-4 w-4" />}
          tone="amber"
          count={hoy.length}
          tasks={hoy}
          onOpenClient={openClient}
        />
        <Section
          title="Futuras"
          icon={<Calendar className="h-4 w-4" />}
          tone="sky"
          count={futuras.length}
          tasks={futuras}
          onOpenClient={openClient}
        />
        <Section
          title="Sin fecha"
          icon={<CheckSquare className="h-4 w-4" />}
          tone="slate"
          count={sinFecha.length}
          tasks={sinFecha}
          onOpenClient={openClient}
        />

        {/* Personales */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-slate-300" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">
              Tareas personales
            </h2>
            <span className="text-xs text-slate-500">{personales.length}</span>
          </div>
          {personales.length === 0 ? (
            <p className="text-sm text-slate-500">Sin tareas personales pendientes.</p>
          ) : (
            <ul className="space-y-2">
              {personales.map((t) => (
                <li
                  key={t.id}
                  className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2 text-sm text-slate-200"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate">{t.title || "(sin título)"}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {t.due_date ? formatYMD(String(t.due_date).slice(0, 10)) : "Sin fecha"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Modal cliente */}
        {loadingClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm text-slate-200">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando cliente…
            </div>
          </div>
        )}
        {clientError && (
          <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-200">
            {clientError}
          </div>
        )}
        {clientDetail && !loadingClient && (
          <ClientManagementModal
            key={clientDetail.id}
            client={clientDetail}
            onClose={closeClient}
            onEditSubscriber={() => {}}
            onAddSubscriber={() => {}}
            onRefreshClient={async () => {
              if (clientDetail?.id) await openClient(clientDetail.id);
            }}
            onFollowUpUpdated={async () => {
              await myDayApi.refetch?.();
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

// ── Subcomponente: una sección por badge ──
function Section({
  title,
  icon,
  tone,
  count,
  tasks,
  onOpenClient,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "red" | "amber" | "sky" | "slate";
  count: number;
  tasks: MyDayTask[];
  onOpenClient: (clientId: string) => void;
}) {
  const toneCls = {
    red: "border-red-400/30 bg-red-400/10 text-red-200",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    sky: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    slate: "border-slate-400/30 bg-slate-400/10 text-slate-200",
  }[tone];

  if (count === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${toneCls}`}>
          {icon}
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">{title}</h2>
        <span className="text-xs text-slate-500">{count}</span>
      </div>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li
            key={t.task_id}
            className="group flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5 transition hover:border-sky-400/30 hover:bg-white/[0.06]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-[14px] font-medium text-white">{t.client_name}</span>
                <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-500">
                  {t.product_type} {t.sale_type}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-slate-400">
                {t.ban_number && (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-slate-500">BAN</span> {t.ban_number}
                  </span>
                )}
                {t.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {t.phone}
                  </span>
                )}
                <span className="truncate text-slate-300">{t.step_name}</span>
                <span className="text-slate-400">· {formatYMD(t.due_date)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenClient(t.client_id)}
              className="shrink-0 rounded-lg bg-sky-500/90 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-sky-400"
            >
              Abrir cliente
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
