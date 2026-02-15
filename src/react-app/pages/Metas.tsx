import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Target,
  TrendingUp,
  DollarSign,
  Calendar,
  Award,
  Settings,
  ChevronDown,
  ChevronUp,
  Receipt,
  Minus,
  Wallet,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { getCurrentUser } from "@/react-app/utils/auth";

/* ── Types ─────────────────────────────────────────── */

interface ProductDetail {
  product_id: string;
  product_name: string;
  goal: number;
  earned: number;
  percentage: number;
}

interface VendorPerformance {
  vendor_id: number;
  vendor_name: string;
  salesperson_id: string;
  commission_percentage: number;
  products: ProductDetail[];
  total_goal: number;
  total_earned: number;
  retention: number;
  net: number;
  percentage: number;
  remaining: number;
  sale_count: number;
  monthly_value: number;
  period: string;
}

interface PerformanceSummary {
  total_goal: number;
  total_earned: number;
  total_retention: number;
  total_net: number;
  total_percentage: number;
}

interface PerformanceData {
  period: string;
  summary: PerformanceSummary | null;
  vendors: VendorPerformance[];
}

/* ── Helpers ───────────────────────────────────────── */

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pctColor = (pct: number) =>
  pct > 100
    ? "text-purple-400 bg-purple-500/20"
    : pct >= 80
    ? "text-emerald-400 bg-emerald-500/20"
    : pct >= 50
    ? "text-blue-400 bg-blue-500/20"
    : "text-amber-400 bg-amber-500/20";

const barColor = (pct: number) =>
  pct > 100
    ? "bg-purple-500"
    : pct >= 80
    ? "bg-emerald-500"
    : pct >= 50
    ? "bg-blue-500"
    : "bg-amber-500";

/* ── Component ─────────────────────────────────────── */

export default function Metas() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [expandedVendor, setExpandedVendor] = useState<number | null>(null);

  const { data: performanceData, loading } = useApi<PerformanceData>(
    `/api/goals/performance?month=${selectedMonth}`
  );

  const summary = performanceData?.summary;
  const vendors = performanceData?.vendors || [];

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString("es-ES", { year: "numeric", month: "long" }),
      });
    }
    return options;
  }, []);

  const toggleVendor = (id: number) =>
    setExpandedVendor((prev) => (prev === id ? null : id));

  /* ── Render ────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl animate-pulse">Cargando metas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ─── Header ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Target className="w-8 h-8 text-emerald-500" />
            Metas del Equipo
          </h1>
          <p className="text-slate-400 mt-1">
            Rendimiento de ventas y comisiones vs objetivos mensuales
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => navigate("/metas/configurar")}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
            >
              <Settings className="w-4 h-4" />
              Configurar Metas
            </button>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── Global Summary (admin) ─── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SummaryCard
            icon={<Target className="w-5 h-5" />}
            label="Meta Total"
            value={fmt(summary.total_goal)}
            accent="purple"
          />
          <SummaryCard
            icon={<DollarSign className="w-5 h-5" />}
            label="Comisiones"
            value={fmt(summary.total_earned)}
            accent="emerald"
          />
          <SummaryCard
            icon={<Receipt className="w-5 h-5" />}
            label="Retención 10%"
            value={`-${fmt(summary.total_retention)}`}
            accent="red"
          />
          <SummaryCard
            icon={<Wallet className="w-5 h-5" />}
            label="Neto"
            value={fmt(summary.total_net)}
            accent="cyan"
          />
          <SummaryCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="% Cumplido"
            value={`${summary.total_percentage.toFixed(1)}%`}
            accent="blue"
          />
        </div>
      )}

      {/* ─── Vendor Cards ─── */}
      {vendors.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center text-slate-400">
          <Target className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No hay metas asignadas para este mes</p>
          {isAdmin && (
            <button
              onClick={() => navigate("/metas/configurar")}
              className="mt-4 text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              Configurar metas →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {vendors.map((v) => (
            <VendorCard
              key={v.vendor_id}
              vendor={v}
              expanded={expandedVendor === v.vendor_id}
              onToggle={() => toggleVendor(v.vendor_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Summary Card ─────────────────────────────────── */

const accentMap: Record<string, string> = {
  purple: "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400",
  emerald: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400",
  red: "from-red-500/20 to-red-600/10 border-red-500/30 text-red-400",
  cyan: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400",
  blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400",
  amber: "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400",
};

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  const cls = accentMap[accent] || accentMap.blue;
  return (
    <div className={`bg-gradient-to-br ${cls} border rounded-2xl p-5`}>
      <div className="flex items-center gap-2 mb-1 opacity-80">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
    </div>
  );
}

/* ── Vendor Card ──────────────────────────────────── */

function VendorCard({
  vendor: v,
  expanded,
  onToggle,
}: {
  vendor: VendorPerformance;
  expanded: boolean;
  onToggle: () => void;
}) {
  const progressPct = Math.min(v.percentage, 100);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden transition-all">
      {/* Collapsed Row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-700/30 transition-colors text-left"
      >
        {/* Avatar */}
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
          {v.vendor_name.charAt(0)}
        </div>

        {/* Name + progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white text-lg truncate">{v.vendor_name}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pctColor(v.percentage)}`}>
              {v.percentage.toFixed(1)}%
            </span>
          </div>
          <div className="mt-1.5 h-2 bg-slate-700 rounded-full overflow-hidden max-w-md">
            <div
              className={`h-full ${barColor(v.percentage)} rounded-full transition-all duration-700`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Totals */}
        <div className="hidden sm:flex items-center gap-6 text-right shrink-0">
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Meta</div>
            <div className="text-sm font-bold text-white">{fmt(v.total_goal)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Comisiones</div>
            <div className="text-sm font-bold text-emerald-400">{fmt(v.total_earned)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Neto</div>
            <div className="text-sm font-bold text-cyan-400">{fmt(v.net)}</div>
          </div>
        </div>

        {/* Toggle icon */}
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
        )}
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-slate-700 p-6 bg-slate-900/30 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Mobile totals */}
          <div className="sm:hidden grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500 font-bold">META</div>
              <div className="text-sm font-bold text-white">{fmt(v.total_goal)}</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500 font-bold">COMISIONES</div>
              <div className="text-sm font-bold text-emerald-400">{fmt(v.total_earned)}</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500 font-bold">NETO</div>
              <div className="text-sm font-bold text-cyan-400">{fmt(v.net)}</div>
            </div>
          </div>

          {/* Product table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase">
                <th className="text-left pb-2 font-bold">Producto</th>
                <th className="text-right pb-2 font-bold">Meta</th>
                <th className="text-right pb-2 font-bold">Ganado</th>
                <th className="text-right pb-2 font-bold">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {v.products.map((p) => (
                <tr key={p.product_id} className="hover:bg-slate-800/40">
                  <td className="py-2 text-slate-300 font-medium">{p.product_name}</td>
                  <td className="py-2 text-right text-slate-400">{fmt(p.goal)}</td>
                  <td className="py-2 text-right text-emerald-400 font-semibold">
                    {fmt(p.earned)}
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        p.goal > 0 ? pctColor(p.percentage) : "text-slate-600"
                      }`}
                    >
                      {p.goal > 0 ? `${p.percentage.toFixed(0)}%` : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Totals */}
            <tfoot>
              {/* Total Comisiones */}
              <tr className="border-t-2 border-slate-600">
                <td className="pt-3 pb-1 font-bold text-white flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Total Comisiones
                </td>
                <td className="pt-3 pb-1 text-right font-bold text-white">
                  {fmt(v.total_goal)}
                </td>
                <td className="pt-3 pb-1 text-right font-bold text-emerald-400">
                  {fmt(v.total_earned)}
                </td>
                <td className="pt-3 pb-1 text-right">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${pctColor(v.percentage)}`}>
                    {v.percentage.toFixed(1)}%
                  </span>
                </td>
              </tr>

              {/* Retención 10% */}
              <tr>
                <td className="py-1 text-red-400 flex items-center gap-1">
                  <Minus className="w-4 h-4" />
                  Retención 10% Hacienda
                </td>
                <td />
                <td className="py-1 text-right text-red-400 font-semibold">
                  ({fmt(v.retention)})
                </td>
                <td />
              </tr>

              {/* Neto */}
              <tr className="border-t border-slate-600">
                <td className="pt-2 font-bold text-cyan-400 flex items-center gap-1 text-base">
                  <Award className="w-4 h-4" />
                  Neto a Cobrar
                </td>
                <td />
                <td className="pt-2 text-right font-black text-cyan-400 text-base">
                  {fmt(v.net)}
                </td>
                <td />
              </tr>

              {/* Info: ventas del mes */}
              {v.sale_count > 0 && (
                <tr>
                  <td colSpan={4} className="pt-3 text-xs text-slate-500">
                    {v.sale_count} venta{v.sale_count !== 1 ? "s" : ""} registrada
                    {v.sale_count !== 1 ? "s" : ""} · Valor mensual: {fmt(v.monthly_value)}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>

          {/* Remaining */}
          {v.remaining > 0 && (
            <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-semibold">
                Falta {fmt(v.remaining)} para cumplir la meta
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
