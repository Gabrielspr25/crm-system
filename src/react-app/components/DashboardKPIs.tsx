// Banda KPI ejecutiva — 5 cards full width arriba del dashboard Mi Día.
// Diseño: card grande con icono circular de color a la izquierda + número
// grande + subtítulo. AVANCE DEL MES incluye anillo de progreso.
// Datos reales desde /api/goals/my-day (mismo endpoint que MetasPorProducto).
import { useEffect, useState, useCallback } from "react";
import { Target, CheckCircle2, Clock, Activity, RefreshCw } from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";

type GoalType = "money" | "units";

interface MetaItem {
  goal_type: GoalType;
  meta_amount: number;
  vendido_amount: number;
  faltan: number;
  cuota_hoy: number;
}

interface MyDayResponse {
  items: MetaItem[];
  business_days: { total: number; elapsed: number; remaining: number };
}

interface Props {
  salespersonId?: string | null;
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatUnits(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return String(Math.round(value));
}

function formatCuotaTotalUnits(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value < 1) return value.toFixed(2);
  return `~${Math.ceil(value)}`;
}

export default function DashboardKPIs({ salespersonId }: Props = {}) {
  const [data, setData] = useState<MyDayResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = salespersonId ? `?salesperson_id=${encodeURIComponent(salespersonId)}` : "";
      const r = await authFetch(`/api/goals/my-day${qs}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [salespersonId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Cargando KPIs…
        </div>
      </div>
    );
  }
  if (!data) return null;

  const items = data.items || [];
  const moneyItems = items.filter((i) => i.goal_type === "money");
  const unitsItems = items.filter((i) => i.goal_type === "units");

  const moneyMeta = moneyItems.reduce((s, i) => s + i.meta_amount, 0);
  const moneyVendido = moneyItems.reduce((s, i) => s + i.vendido_amount, 0);
  const moneyFaltan = Math.max(0, moneyMeta - moneyVendido);
  const moneyCuotaHoy = moneyItems.reduce((s, i) => s + i.cuota_hoy, 0);
  const moneyPct = moneyMeta > 0 ? Math.round((moneyVendido / moneyMeta) * 100) : 0;

  const unitsMeta = unitsItems.reduce((s, i) => s + i.meta_amount, 0);
  const unitsVendido = unitsItems.reduce((s, i) => s + i.vendido_amount, 0);
  const unitsFaltan = unitsItems.reduce((s, i) => s + i.faltan, 0);
  const unitsCuotaHoy = unitsItems.reduce((s, i) => s + i.cuota_hoy, 0);
  const unitsPct = unitsMeta > 0 ? Math.round((unitsVendido / unitsMeta) * 100) : 0;

  const activeBuckets = [moneyMeta > 0 ? moneyPct : null, unitsMeta > 0 ? unitsPct : null]
    .filter((v): v is number => v !== null);
  const pctGlobal = activeBuckets.length
    ? Math.round(activeBuckets.reduce((s, v) => s + v, 0) / activeBuckets.length)
    : 0;

  const hasMoney = moneyMeta > 0;
  const hasUnits = unitsMeta > 0;
  const moneyPctText = hasMoney ? `${moneyPct}% del objetivo` : "sin meta $";
  const faltanPctText = hasMoney ? `${Math.max(0, 100 - moneyPct)}% por alcanzar` : `${unitsFaltan} unidades`;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <KpiCard
        icon={<Target className="w-5 h-5" />}
        iconBg="rgba(99,86,200,0.18)"
        iconFg="#A099E6"
        label="META TOTAL"
        primary={hasMoney ? formatMoney(moneyMeta) : formatUnits(unitsMeta)}
        secondary={hasUnits ? `${formatUnits(unitsMeta)} unidades` : "dinero"}
      />
      <KpiCard
        icon={<CheckCircle2 className="w-5 h-5" />}
        iconBg="rgba(34,197,94,0.18)"
        iconFg="#34D399"
        label="VENDIDO"
        primary={hasMoney ? formatMoney(moneyVendido) : formatUnits(unitsVendido)}
        secondary={moneyPctText}
      />
      <KpiCard
        icon={<Clock className="w-5 h-5" />}
        iconBg="rgba(245,158,11,0.18)"
        iconFg="#FBBF24"
        label="FALTAN"
        primary={hasMoney ? formatMoney(moneyFaltan) : formatUnits(unitsFaltan)}
        secondary={faltanPctText}
      />
      <KpiCard
        icon={<Activity className="w-5 h-5" />}
        iconBg="rgba(56,189,248,0.18)"
        iconFg="#38BDF8"
        label="HOY"
        primary={hasMoney ? formatMoney(moneyCuotaHoy) : formatCuotaTotalUnits(unitsCuotaHoy)}
        secondary={hasUnits ? `${formatCuotaTotalUnits(unitsCuotaHoy)} unidades` : "dinero/día"}
      />
      <KpiAvanceCard pct={pctGlobal} />
    </div>
  );
}

function KpiCard({
  icon,
  iconBg,
  iconFg,
  label,
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconFg: string;
  label: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
      <div
        className="shrink-0 inline-flex items-center justify-center rounded-xl"
        style={{ background: iconBg, color: iconFg, width: 44, height: 44 }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-400">
          {label}
        </div>
        <div className="text-2xl font-bold leading-tight text-white tabular-nums truncate">
          {primary}
        </div>
        <div className="text-[11px] text-slate-500 truncate">{secondary}</div>
      </div>
    </div>
  );
}

function KpiAvanceCard({ pct }: { pct: number }) {
  // 5to KPI: AVANCE DEL MES — número grande + barra horizontal + anillo SVG.
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const color = clamped >= 70 ? "#22C55E" : clamped >= 40 ? "#EAB308" : "#EF4444";
  const size = 44;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-400">
          AVANCE DEL MES
        </div>
        <div className="text-2xl font-bold leading-tight text-white tabular-nums">
          {clamped}%
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${clamped}%`, background: color }}
          />
        </div>
      </div>
      <svg width={size} height={size} className="shrink-0">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </div>
  );
}
