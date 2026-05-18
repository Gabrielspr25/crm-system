import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, Users, Target, DollarSign, RefreshCw,
  CheckCircle2, AlertTriangle, Award, BarChart3
} from "lucide-react";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface ProductStat {
  product_name: string;
  target:   number;
  actual:   number;
  pct:      number;
  revenue:  number;
}

interface VendorProductStat {
  actual: number;
  target: number;
  pct:    number;
}

interface VendorStat {
  vendor_id:     string | number;
  vendor_name:   string;
  total_sales:   number;
  total_revenue: number;
  total_target:  number;
  pct_total:     number;
  new_count:     number;
  ren_count:     number;
  by_product:    Record<string, VendorProductStat>;
}

interface DashboardData {
  period: { year: number; month: number };
  kpis: {
    total_goal:    number;
    total_actual:  number;
    pct_complied:  number;
    total_vendors: number;
    new_clients:   number;
    total_revenue: number;
  };
  by_product: ProductStat[];
  by_vendor:  VendorStat[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("es-PR", {
    year: "numeric", month: "long",
  });
}

function pctColor(pct: number) {
  if (pct >= 100) return "text-emerald-400";
  if (pct >= 75)  return "text-blue-400";
  if (pct >= 50)  return "text-yellow-400";
  return "text-red-400";
}

function barColor(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 75)  return "bg-blue-500";
  if (pct >= 50)  return "bg-yellow-500";
  return "bg-red-500";
}

function semaforo(pct: number) {
  if (pct >= 100) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" title="Meta cumplida" />;
  if (pct >= 75)  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400"   title="Buen ritmo" />;
  if (pct >= 50)  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" title="En riesgo" />;
  return               <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"    title="Crítico" />;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function MetasDashboard() {
  const now          = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentUser = getCurrentUser();
  const canViewCompanyFinancials = String(currentUser?.role || "").toLowerCase() === "admin";

  const [year,    setYear]    = useState(currentYear);
  const [month,   setMonth]   = useState(currentMonth);
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await authFetch(`/api/dashboard/resumen?year=${year}&month=${month}`);
      if (!r.ok) throw new Error(`Error ${r.status}`);
      setData(await r.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { void load(); }, [load]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i, 1).toLocaleDateString("es-PR", { month: "long" }),
  }));

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Panel de Metas
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Cumplimiento de metas del negocio por vendedor y producto
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {monthOptions.map(o => (
              <option key={o.value} value={o.value} className="capitalize">{o.label}</option>
            ))}
          </select>

          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <button
            onClick={() => void load()}
            disabled={loading}
            className="p-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && !data && (
        <div className="flex items-center justify-center h-64 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Cargando datos...
        </div>
      )}

      {data && (
        <>
          {/* ── Período activo ── */}
          <p className="text-slate-400 text-sm -mt-4 capitalize">
            Período: <span className="text-white font-medium">{monthLabel(data.period.year, data.period.month)}</span>
          </p>

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard
              icon={<Target className="w-5 h-5 text-blue-400" />}
              label="Cumplimiento global"
              value={`${data.kpis.pct_complied}%`}
              sub={`${data.kpis.total_actual} / ${data.kpis.total_goal} unidades`}
              accent={pctColor(data.kpis.pct_complied)}
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
              label="Ventas totales"
              value={String(data.kpis.total_actual)}
              sub="activaciones en el período"
            />
            {canViewCompanyFinancials && (
              <KpiCard
                icon={<DollarSign className="w-5 h-5 text-yellow-400" />}
                label="Ingresos mensuales"
                value={`$${data.kpis.total_revenue.toLocaleString("en-US", { minimumFractionDigits: 0 })}`}
                sub="valor de planes activos"
              />
            )}
            <KpiCard
              icon={<Target className="w-5 h-5 text-slate-400" />}
              label="Meta del período"
              value={String(data.kpis.total_goal)}
              sub="unidades objetivo"
            />
            <KpiCard
              icon={<Users className="w-5 h-5 text-purple-400" />}
              label="Clientes nuevos"
              value={String(data.kpis.new_clients)}
              sub="creados este período"
            />
            <KpiCard
              icon={<Award className="w-5 h-5 text-orange-400" />}
              label="Vendedores activos"
              value={String(data.kpis.total_vendors)}
              sub="con actividad en el período"
            />
          </div>

          {/* ── Metas por Producto ── */}
          <section>
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
              Cumplimiento por Producto — Negocio
            </h2>
            {data.by_product.length === 0 ? (
              <p className="text-slate-500 text-sm">Sin metas configuradas para este período.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.by_product.map(p => (
                  <ProductCard key={p.product_name} p={p} showRevenue={canViewCompanyFinancials} />
                ))}
              </div>
            )}
          </section>

          {/* ── Ranking de Vendedores ── */}
          <section>
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
              Ranking de Vendedores
            </h2>
            {data.by_vendor.length === 0 ? (
              <p className="text-slate-500 text-sm">Sin ventas registradas en este período.</p>
            ) : (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left">
                      <th className="px-4 py-3 text-slate-400 font-semibold text-xs uppercase">#</th>
                      <th className="px-4 py-3 text-slate-400 font-semibold text-xs uppercase">Vendedor</th>
                      <th className="px-4 py-3 text-slate-400 font-semibold text-xs uppercase text-center">Ventas</th>
                      <th className="px-4 py-3 text-slate-400 font-semibold text-xs uppercase text-center">Meta</th>
                      <th className="px-4 py-3 text-slate-400 font-semibold text-xs uppercase text-center">Cumpl.</th>
                      <th className="px-4 py-3 text-slate-400 font-semibold text-xs uppercase text-center">NEW</th>
                      <th className="px-4 py-3 text-slate-400 font-semibold text-xs uppercase text-center">REN</th>
                      {canViewCompanyFinancials && (
                        <th className="px-4 py-3 text-slate-400 font-semibold text-xs uppercase text-right">Ingresos</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_vendor.map((v, idx) => (
                      <tr key={String(v.vendor_id)} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-medium">
                          {idx === 0 ? <span className="text-yellow-400 font-bold">🥇</span>
                           : idx === 1 ? <span className="text-slate-300 font-bold">🥈</span>
                           : idx === 2 ? <span className="text-orange-400 font-bold">🥉</span>
                           : <span className="text-slate-500">{idx + 1}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {semaforo(v.pct_total)}
                            <span className="text-white font-medium">{v.vendor_name}</span>
                          </div>
                          {/* mini desglose por producto */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(v.by_product).map(([pname, ps]) => (
                              <span
                                key={pname}
                                className="text-xs bg-slate-700 text-slate-300 rounded px-1.5 py-0.5"
                                title={`${pname}: ${ps.actual}${ps.target > 0 ? ` / ${ps.target}` : ''}`}
                              >
                                {pname.replace('Movil', 'Móvil')} {ps.actual}{ps.target > 0 ? `/${ps.target}` : ''}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-white font-semibold">{v.total_sales}</td>
                        <td className="px-4 py-3 text-center text-slate-400">{v.total_target > 0 ? v.total_target : "—"}</td>
                        <td className="px-4 py-3 text-center">
                          {v.total_target > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className={`font-bold text-sm ${pctColor(v.pct_total)}`}>{v.pct_total}%</span>
                              <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${barColor(v.pct_total)}`}
                                  style={{ width: `${Math.min(v.pct_total, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : <span className="text-slate-600 text-xs">sin meta</span>}
                        </td>
                        <td className="px-4 py-3 text-center text-emerald-400 font-medium">{v.new_count}</td>
                        <td className="px-4 py-3 text-center text-blue-400 font-medium">{v.ren_count}</td>
                        {canViewCompanyFinancials && (
                          <td className="px-4 py-3 text-right text-slate-300">
                            ${v.total_revenue.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Leyenda de semáforo ── */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-700/50">
            <span className="font-medium text-slate-400">Semáforo:</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400"/> ≥ 100% meta cumplida</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-blue-400"/>   75–99% buen ritmo</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400"/>50–74% en riesgo</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-red-500"/>   &lt; 50% crítico</span>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------
function KpiCard({
  icon, label, value, sub, accent = "text-white"
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</span></div>
      <p className={`text-2xl font-bold leading-none ${accent}`}>{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function ProductCard({ p, showRevenue }: { p: ProductStat; showRevenue: boolean }) {
  const clampedPct = Math.min(p.pct, 100);
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${p.pct >= 100 ? "text-emerald-400" : "text-slate-500"}`} />
          <span className="text-white font-semibold text-sm">{p.product_name}</span>
        </div>
        <span className={`text-lg font-bold ${pctColor(p.pct)}`}>{p.pct}%</span>
      </div>

      {/* Barra de progreso */}
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(p.pct)}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-slate-400">
        <span>Real: <span className="text-white font-medium">{p.actual}</span></span>
        <span>Meta: <span className="text-white font-medium">{p.target > 0 ? p.target : "—"}</span></span>
        {showRevenue && (
          <span className="text-slate-500">${p.revenue.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
        )}
      </div>
    </div>
  );
}
