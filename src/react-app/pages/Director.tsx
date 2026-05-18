// Panel Director — vista ejecutiva del equipo.
// Solo admin/supervisor. Lee /api/director/overview en una sola llamada.
// Tabla con acordeón: click en vendedor → breakdown por producto asignado.
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  AlertCircle, BarChart3, Calendar, CheckCircle2, ChevronRight,
  Clock, DollarSign, Loader2, Settings, Target, TrendingUp, Users,
} from "lucide-react";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

type GoalType = "money" | "units";
type Health = "good" | "warn" | "danger";
type Severity = "info" | "warn" | "danger";

interface Product {
  product_type: string;
  sale_type: string;
  label: string;
  goal_type: GoalType;
  meta: number;
  vendido: number;
  faltan: number;
  porcentaje: number;
}

interface Vendor {
  salesperson_id: string;
  name: string;
  role: string;
  meta_money: number;
  vendido_money: number;
  meta_units: number;
  vendido_units: number;
  porcentaje: number;
  porcentaje_esperado: number;
  estado: string;
  health: Health;
  tareas_pendientes: number;
  tareas_atrasadas: number;
  last_sale_at: string | null;
  last_sale_label: string;
  days_since_last_sale: number | null;
  // Fase 2B
  a_pagar: number;
  a_pagar_pagado: number;
  ventas_pagadas: number;
  ventas_totales: number;
  all_paid: boolean;
  hoy_money: number;
  hoy_units: number;
  products: Product[];
}

interface Summary {
  total_vendors: number;
  vendors_con_meta: number;
  team_goal_money: number;
  team_sold_money: number;
  team_remaining_money: number;
  team_goal_units: number;
  team_sold_units: number;
  team_pct_money: number;
  team_overdue_tasks: number;
  team_pending_tasks: number;
  team_a_pagar: number;
  team_a_pagar_pagado: number;
  team_a_pagar_pendiente: number;
  tango_in_review: number;
  unassigned_clients: number;
  pct_esperado: number;
  health: { good: number; warn: number; danger: number };
}

interface Alert {
  type: string;
  severity: Severity;
  vendor_id?: string;
  vendor_name?: string;
  message: string;
}

interface Overview {
  period: { year: number; month: number };
  business_days: { total: number; elapsed: number; remaining: number };
  summary: Summary;
  vendors: Vendor[];
  alerts: Alert[];
}

const fmtMoney = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  return `$${Math.round(n).toLocaleString("en-US")}`;
};
const fmtUnits = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return "0";
  return String(Math.round(n));
};
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const initials = (name: string) =>
  name.trim().charAt(0).toUpperCase() || "?";

// Paleta estable para avatares (hash básico por id)
const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-500",
  "from-cyan-500 to-sky-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-pink-500 to-rose-500",
  "from-violet-500 to-purple-500",
  "from-red-500 to-rose-500",
  "from-teal-500 to-cyan-500",
];
const avatarColor = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
};

const pctTextClass = (pct: number, pctEsperado: number) => {
  if (pct >= pctEsperado * 0.9) return "text-emerald-400";
  if (pct >= pctEsperado * 0.5) return "text-amber-400";
  return "text-[#EF6F6C]";
};
const pctBarColor = (h: Health) =>
  h === "good" ? "bg-emerald-400" : h === "warn" ? "bg-amber-400" : "bg-[#EF6F6C]";

export default function Director() {
  const user = getCurrentUser();
  const role = String(user?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "supervisor";

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await authFetch("/api/director/overview");
      if (!r.ok) {
        const msg = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(msg.error || `HTTP ${r.status}`);
      }
      setData(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando panel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const toggleRow = (id: string) => {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#06111f] text-slate-300 p-8 flex items-center justify-center">
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-6 py-4 text-sm text-amber-100">
          Solo accesible para admin/supervisor.
        </div>
      </div>
    );
  }

  const periodLabel = data
    ? `${MONTH_NAMES[(data.period.month - 1) % 12]} ${data.period.year}`
    : "";

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-200">
      <div className="mx-auto max-w-[1480px] px-6 py-7">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl inline-flex items-center justify-center" style={{ background: "rgba(99,86,200,0.2)", color: "#A099E6" }}>
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-white leading-tight">Panel Director</h1>
              <p className="text-[13px] text-slate-400">Visión completa del equipo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-[13px] text-slate-300">
                Período: <strong className="text-white capitalize font-semibold">{periodLabel}</strong>
              </span>
            )}
            {data && (
              <span className="inline-flex items-center gap-2 rounded-xl bg-sky-400/10 border border-sky-400/25 px-3.5 py-2 text-[12px] font-medium text-sky-300">
                Día {data.business_days.total - data.business_days.remaining + 1} de {data.business_days.total} hábiles
              </span>
            )}
          </div>
        </div>

        {loading && !data && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando panel director…
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200 mb-4">
            Error: {error}
            <button onClick={() => void load()} className="ml-3 underline">Reintentar</button>
          </div>
        )}

        {data && <>
          {/* ====== KPIs equipo (6 cards: meta / vendido / faltan / a pagar / atrasadas / tango) ====== */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            <KpiCard
              icon={<Target className="w-5 h-5" />}
              iconBg="rgba(99,86,200,0.18)" iconFg="#A099E6"
              label="META EQUIPO"
              value={fmtMoney(data.summary.team_goal_money)}
              sub={`${data.summary.vendors_con_meta} vendedores activos`}
            />
            <KpiCard
              icon={<CheckCircle2 className="w-5 h-5" />}
              iconBg="rgba(52,211,153,0.18)" iconFg="#34D399"
              label="VENDIDO / GANANCIA" valueColor="#34D399"
              value={fmtMoney(data.summary.team_sold_money)}
              sub={`${data.summary.team_pct_money}% del objetivo`}
            />
            <KpiCard
              icon={<Clock className="w-5 h-5" />}
              iconBg="rgba(245,158,11,0.18)" iconFg="#F59E0B"
              label="FALTAN" valueColor="#FBBF24"
              value={fmtMoney(data.summary.team_remaining_money)}
              sub={`${data.business_days.remaining} días restantes`}
            />
            <KpiCard
              icon={<DollarSign className="w-5 h-5" />}
              iconBg="rgba(251,191,36,0.18)" iconFg="#FBBF24"
              label="A PAGAR" valueColor="#FBBF24"
              value={fmtMoney(data.summary.team_a_pagar_pendiente)}
              sub={`Pagado ${fmtMoney(data.summary.team_a_pagar_pagado)} / Total ${fmtMoney(data.summary.team_a_pagar)}`}
            />
            <KpiCard
              icon={<AlertCircle className="w-5 h-5" />}
              iconBg="rgba(239,111,108,0.18)" iconFg="#EF6F6C"
              label="TAREAS ATRASADAS" valueColor="#EF6F6C"
              value={String(data.summary.team_overdue_tasks)}
              sub={`${data.summary.team_pending_tasks} pendientes totales`}
            />
            <KpiCard
              icon={<Settings className="w-5 h-5" />}
              iconBg="rgba(56,189,248,0.18)" iconFg="#38BDF8"
              label="TANGO REVISIÓN" valueColor="#38BDF8"
              value={String(data.summary.tango_in_review)}
              sub="ventas sin validar"
            />
          </div>

          {/* ====== Salud equipo ====== */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 mb-5 flex flex-wrap items-center gap-6">
            <div>
              <div className="text-[11px] font-bold tracking-[0.16em] text-slate-300">SALUD DEL EQUIPO</div>
              <div className="text-[11px] text-slate-500 mt-1">Distribución según % vs ritmo esperado</div>
            </div>
            <div className="flex-1 min-w-[200px] max-w-[380px] h-2.5 rounded-full overflow-hidden flex bg-slate-800/50">
              {data.summary.vendors_con_meta > 0 && (<>
                <div className="bg-emerald-400" style={{ width: `${(data.summary.health.good / data.summary.vendors_con_meta) * 100}%` }} />
                <div className="bg-amber-400" style={{ width: `${(data.summary.health.warn / data.summary.vendors_con_meta) * 100}%` }} />
                <div className="bg-[#EF6F6C]" style={{ width: `${(data.summary.health.danger / data.summary.vendors_con_meta) * 100}%` }} />
              </>)}
            </div>
            <div className="flex gap-4 text-[12px]">
              <span className="flex items-center gap-2"><Dot color="#34D399" /><b>{data.summary.health.good}</b><span className="text-slate-400">en ritmo</span></span>
              <span className="flex items-center gap-2"><Dot color="#F59E0B" /><b>{data.summary.health.warn}</b><span className="text-slate-400">empujando</span></span>
              <span className="flex items-center gap-2"><Dot color="#EF6F6C" /><b>{data.summary.health.danger}</b><span className="text-slate-400">en riesgo</span></span>
            </div>
          </div>

          {/* ====== Layout 2 columnas: tabla + alertas ====== */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">

            {/* Tabla vendedores */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-[13px] font-bold tracking-[0.12em] text-white">RANKING DE VENDEDORES</h2>
                <span className="text-[11px] text-slate-400">click para ver detalle por producto</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[13px] tabular-nums">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/10">
                      <th className="w-8"></th>
                      <th className="text-left font-semibold py-2 px-2">Vendedor</th>
                      <th className="text-right font-semibold py-2 px-2">Meta</th>
                      <th className="text-right font-semibold py-2 px-2">Vendido / Ganancia</th>
                      <th className="text-right font-semibold py-2 px-2">%</th>
                      <th className="text-right font-semibold py-2 px-2">Hoy</th>
                      <th className="text-right font-semibold py-2 px-2">A pagar</th>
                      <th className="text-right font-semibold py-2 px-2">Atras.</th>
                      <th className="text-right font-semibold py-2 px-2">Últ. venta</th>
                      <th className="text-right font-semibold py-2 px-2">Estado</th>
                      <th className="text-right font-semibold py-2 px-2">Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vendors.map((v) => {
                      const isOpen = openRows.has(v.salesperson_id);
                      return (
                        <FragmentRow
                          key={v.salesperson_id}
                          v={v}
                          isOpen={isOpen}
                          onToggle={() => toggleRow(v.salesperson_id)}
                          pctEsperado={data.summary.pct_esperado}
                          period={data.period}
                          onAfterMutation={load}
                        />
                      );
                    })}
                    {data.vendors.length === 0 && (
                      <tr><td colSpan={11} className="py-6 text-center text-slate-500 text-sm italic">Sin vendedores en este período</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sidebar alertas */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-[13px] font-bold tracking-[0.12em] text-white">ALERTAS</h2>
                <span className="text-[11px] text-slate-400">{data.alerts.length} activas</span>
              </div>
              {data.alerts.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Sin alertas. Todo el equipo opera con normalidad.</p>
              ) : (
                <div className="space-y-2">
                  {data.alerts.map((a, i) => (
                    <AlertCard key={i} alert={a} />
                  ))}
                </div>
              )}
            </div>

          </div>

          <p className="mt-5 text-[11px] text-slate-500 text-center">
            <b className="text-slate-400">HOY</b> = Faltan ÷ días hábiles restantes (L–V) ·
            Estados: <span className="text-emerald-400 font-semibold">en ritmo</span> ≥90% del esperado ·
            <span className="text-amber-400 font-semibold"> empuja</span> 50–90% ·
            <span className="text-[#EF6F6C] font-semibold"> en riesgo</span> &lt;50%
          </p>
        </>}
      </div>
    </div>
  );
}

// ============================================================
// Sub-componentes
// ============================================================

function KpiCard({ icon, iconBg, iconFg, label, value, valueColor, sub }: {
  icon: React.ReactNode; iconBg: string; iconFg: string;
  label: string; value: string; valueColor?: string; sub: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="w-[42px] h-[42px] rounded-xl inline-flex items-center justify-center shrink-0" style={{ background: iconBg, color: iconFg }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold tracking-[0.16em] text-slate-400">{label}</div>
        <div className="text-2xl font-bold leading-tight tabular-nums truncate" style={{ color: valueColor || "white" }}>{value}</div>
        <div className="text-[11px] text-slate-500 tabular-nums truncate">{sub}</div>
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />;
}

function FragmentRow({ v, isOpen, onToggle, pctEsperado, period, onAfterMutation }: {
  v: Vendor; isOpen: boolean; onToggle: () => void; pctEsperado: number;
  period: { year: number; month: number };
  onAfterMutation: () => void | Promise<void>;
}) {
  const [paying, setPaying] = useState(false);
  const togglePaid = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (paying) return;
    const action = v.all_paid ? "DESMARCAR" : "MARCAR";
    if (!confirm(`${action} comisión de ${v.name} (${fmtMoney(v.a_pagar)}) como pagada para ${period.month}/${period.year}?`)) return;
    setPaying(true);
    try {
      const r = await authFetch("/api/director/mark-paid", {
        method: "POST",
        json: { salesperson_id: v.salesperson_id, year: period.year, month: period.month, paid: !v.all_paid },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await onAfterMutation();
    } catch (err) {
      alert("Error al marcar pago: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-white/5 transition-colors ${isOpen ? "bg-sky-400/[0.04]" : "hover:bg-white/[0.025]"}`}
      >
        <td className="text-center text-slate-500 py-3">
          <ChevronRight className={`w-4 h-4 inline transition-transform ${isOpen ? "rotate-90 text-sky-400" : ""}`} />
        </td>
        <td className="py-3 px-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(v.salesperson_id)} text-white font-bold text-xs flex items-center justify-center`}>
              {initials(v.name)}
            </div>
            <div>
              <div className="font-semibold text-white">{v.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{v.role}</div>
            </div>
          </div>
        </td>
        <td className="text-right py-3 px-2">{fmtMoney(v.meta_money)}</td>
        <td className="text-right py-3 px-2 text-emerald-400 font-semibold">{fmtMoney(v.vendido_money)}</td>
        <td className="text-right py-3 px-2">
          <span className={`font-bold ${pctTextClass(v.porcentaje, pctEsperado)}`}>{v.porcentaje}%</span>
          <span className="inline-block w-14 h-1.5 ml-2 align-middle bg-slate-700/60 rounded-full overflow-hidden">
            <span className={`block h-full rounded-full ${pctBarColor(v.health)}`} style={{ width: `${Math.min(100, v.porcentaje)}%` }} />
          </span>
        </td>
        <td className="text-right py-3 px-2 text-sky-300 font-semibold">{fmtMoney(v.hoy_money)}</td>
        <td className="text-right py-3 px-2 text-amber-300 font-semibold">{fmtMoney(v.a_pagar)}</td>
        <td className="text-right py-3 px-2">
          <span className={v.tareas_atrasadas > 0 ? "text-[#EF6F6C] font-bold" : "text-slate-500"}>
            {v.tareas_atrasadas}
          </span>
        </td>
        <td className="text-right py-3 px-2 text-slate-400">{v.last_sale_label}</td>
        <td className="text-right py-3 px-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold"
            style={{
              backgroundColor: v.health === "good" ? "rgba(52,211,153,0.10)" : v.health === "warn" ? "rgba(245,158,11,0.10)" : "rgba(239,111,108,0.10)",
              color: v.health === "good" ? "#34D399" : v.health === "warn" ? "#F59E0B" : "#EF6F6C",
            }}
          >
            ● {v.estado === "en_ritmo" ? "En ritmo" : v.estado === "empuja" ? "Empuja" : "En riesgo"}
          </span>
        </td>
        <td className="text-right py-3 px-2">
          <button
            type="button"
            onClick={togglePaid}
            disabled={paying || v.a_pagar <= 0}
            title={v.a_pagar <= 0 ? "Sin comisión que pagar" : v.all_paid ? "Desmarcar pagado" : "Marcar como pagado"}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition ${
              v.all_paid
                ? "bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25"
                : v.a_pagar > 0
                  ? "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10"
                  : "bg-transparent text-slate-600 cursor-not-allowed"
            }`}
          >
            {paying ? "..." : v.all_paid ? "✓ Pagado" : "Marcar"}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-slate-900/40 border-b border-white/10">
          <td colSpan={11} className="p-4">
            <VendorDetail v={v} period={period} onAfterMutation={onAfterMutation} />
          </td>
        </tr>
      )}
    </>
  );
}

function VendorDetail({ v, period, onAfterMutation }: {
  v: Vendor;
  period: { year: number; month: number };
  onAfterMutation: () => void | Promise<void>;
}) {
  const moneyProds = v.products.filter(p => p.goal_type === "money");
  const unitsProds = v.products.filter(p => p.goal_type === "units");

  if (moneyProds.length === 0 && unitsProds.length === 0) {
    return (
      <div className="text-center text-slate-500 italic text-sm py-4">
        Este vendedor no tiene metas asignadas para este mes.
      </div>
    );
  }

  const cols = moneyProds.length > 0 && unitsProds.length > 0 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1";

  return (
    <div className={`grid ${cols} gap-3`}>
      {moneyProds.length > 0 && (
        <ProductBlock title="DINERO" tag="bg-sky-400/10 text-sky-400" subtitle={moneyProds.map(p => p.label.split(" ")[0]).filter((v, i, a) => a.indexOf(v) === i).join(" · ")} products={moneyProds} type="money" salespersonId={v.salesperson_id} period={period} onAfterMutation={onAfterMutation} />
      )}
      {unitsProds.length > 0 && (
        <ProductBlock title="UNIDADES" tag="bg-cyan-400/10 text-cyan-400" subtitle={unitsProds.map(p => p.label.split(" ")[0]).filter((v, i, a) => a.indexOf(v) === i).join(" · ")} products={unitsProds} type="units" salespersonId={v.salesperson_id} period={period} onAfterMutation={onAfterMutation} />
      )}
    </div>
  );
}

function ProductBlock({ title, tag, subtitle, products, type, salespersonId, period, onAfterMutation }: {
  title: string; tag: string; subtitle: string; products: Product[]; type: GoalType;
  salespersonId: string;
  period: { year: number; month: number };
  onAfterMutation: () => void | Promise<void>;
}) {
  const totalMeta = products.reduce((s, p) => s + p.meta, 0);
  const totalVendido = products.reduce((s, p) => s + p.vendido, 0);
  const fmt = type === "money" ? fmtMoney : fmtUnits;
  const barColor = type === "money" ? "bg-sky-400" : "bg-cyan-400";

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between border-b border-white/8 pb-2 mb-2">
        <div className="flex items-baseline gap-2 text-[10px] font-bold tracking-[0.18em] text-white">
          <span className={`px-1.5 py-0.5 rounded text-[9px] ${tag}`}>{title}</span>
          <span>{subtitle}</span>
        </div>
        <div className="text-[11px] text-slate-400 tabular-nums">
          Meta <b className="text-white">{fmt(totalMeta)}</b> · Vendido <span className="text-emerald-400 font-semibold">{fmt(totalVendido)}</span>
        </div>
      </div>

      <div className="grid text-[10px] uppercase tracking-wider text-slate-500 py-1 px-2"
           style={{ gridTemplateColumns: "90px 1fr 90px 70px 70px 44px", gap: "8px" }}>
        <div>Producto</div><div></div>
        <div className="text-right">Meta</div>
        <div className="text-right">Vendido</div>
        <div className="text-right">Faltan</div>
        <div className="text-right">%</div>
      </div>

      <div className="space-y-1.5">
        {products.map((p) => (
          <ProductRow key={`${p.product_type}-${p.sale_type}`} p={p} type={type} barColor={barColor} fmt={fmt} salespersonId={salespersonId} period={period} onAfterMutation={onAfterMutation} />
        ))}
      </div>
    </div>
  );
}

function ProductRow({ p, type, barColor, fmt, salespersonId, period, onAfterMutation }: {
  p: Product; type: GoalType; barColor: string; fmt: (n: number) => string;
  salespersonId: string;
  period: { year: number; month: number };
  onAfterMutation: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(p.meta));
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setValue(String(p.meta));
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);
  const save = async () => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      alert("Monto inválido. Usá un número >= 0.");
      return;
    }
    if (amount === p.meta) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const r = await authFetch("/api/director/goal", {
        method: "PATCH",
        json: {
          salesperson_id: salespersonId,
          product_type: p.product_type,
          sale_type: p.sale_type,
          year: period.year,
          month: period.month,
          amount,
        },
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(e.error || `HTTP ${r.status}`);
      }
      setEditing(false);
      await onAfterMutation();
    } catch (err) {
      alert("Error guardando meta: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid items-center text-[12px] py-1 px-2 rounded hover:bg-white/[0.02]"
         style={{ gridTemplateColumns: "90px 1fr 90px 70px 70px 44px", gap: "8px" }}>
      <span className="font-medium text-white">{p.label}</span>
      <span className="h-1 bg-slate-700/60 rounded-full overflow-hidden">
        <span className={`block h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, p.porcentaje)}%` }} />
      </span>
      {editing ? (
        <span className="flex items-center justify-end gap-1">
          <input
            type="number"
            min="0"
            step={type === "money" ? "0.01" : "1"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancelEdit(); }}
            disabled={saving}
            autoFocus
            className="w-[70px] text-right bg-slate-800 border border-sky-400/40 rounded px-1 py-0.5 text-white tabular-nums focus:outline-none"
          />
          <button onClick={save} disabled={saving} title="Guardar (Enter)" className="text-emerald-400 hover:text-emerald-300">✓</button>
          <button onClick={cancelEdit} disabled={saving} title="Cancelar (Esc)" className="text-slate-500 hover:text-slate-300">✕</button>
        </span>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          title="Click para editar meta"
          className="text-right text-white font-semibold tabular-nums hover:text-sky-300 hover:underline cursor-pointer"
        >
          {fmt(p.meta)}
        </button>
      )}
      <span className="text-right text-emerald-400 font-semibold tabular-nums">{fmt(p.vendido)}</span>
      <span className="text-right text-amber-400 tabular-nums">{fmt(p.faltan)}</span>
      <span className={`text-right font-bold tabular-nums ${p.porcentaje >= 70 ? "text-emerald-400" : p.porcentaje >= 30 ? "text-amber-400" : "text-[#EF6F6C]"}`}>
        {p.porcentaje}%
      </span>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const border = alert.severity === "danger" ? "border-l-[#EF6F6C]" : alert.severity === "warn" ? "border-l-amber-400" : "border-l-sky-400";
  return (
    <div className={`bg-white/[0.04] border border-white/8 border-l-4 rounded-lg px-3.5 py-2.5 ${border}`}>
      <div className="text-[12px] font-bold text-white mb-0.5">
        {alert.vendor_name ? alert.vendor_name : "Sistema"}
      </div>
      <div className="text-[12px] text-slate-300">{alert.message}</div>
    </div>
  );
}
