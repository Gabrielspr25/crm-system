// Evolución diaria del vendido — gráfico ejecutivo:
//   línea azul: vendido acumulado real (de /api/goals/daily-evolution)
//   línea blanca dasheada: meta acumulada (prorrateada por día hábil)
// Toggle Dinero / Unidades.
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { LineChart as LineIcon, RefreshCw } from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";

type GoalType = "money" | "units";

interface DailyPoint {
  date: string;
  money_sold_day: number;
  units_sold_day: number;
}

interface DailyResponse {
  period: { year: number; month: number };
  business_days: { total: number; elapsed: number; remaining: number };
  series: DailyPoint[];
  message?: string;
}

interface MetaItem {
  goal_type: GoalType;
  meta_amount: number;
}

interface MyDayResponse {
  items: MetaItem[];
}

interface Props {
  salespersonId?: string | null;
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

function formatUnits(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return String(Math.round(value));
}

// Cuenta días hábiles (L-V) desde el 1 del mes hasta una fecha ISO inclusive.
function businessDaysUpTo(year: number, month: number, isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00`);
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const day = new Date(year, month - 1, d);
    if (day.getMonth() !== month - 1) break;
    if (day > target) break;
    const w = day.getDay();
    if (w !== 0 && w !== 6) count++;
  }
  return count;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function EvolucionDiaria({ salespersonId }: Props = {}) {
  const [daily, setDaily] = useState<DailyResponse | null>(null);
  const [goals, setGoals] = useState<MyDayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<GoalType>("money");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = salespersonId ? `?salesperson_id=${encodeURIComponent(salespersonId)}` : "";
      const [d, g] = await Promise.all([
        authFetch(`/api/goals/daily-evolution${qs}`),
        authFetch(`/api/goals/my-day${qs}`),
      ]);
      if (!d.ok) throw new Error(`HTTP ${d.status}`);
      if (!g.ok) throw new Error(`HTTP ${g.status}`);
      setDaily(await d.json());
      setGoals(await g.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando evolución");
    } finally {
      setLoading(false);
    }
  }, [salespersonId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Construye serie completa día-por-día (incluye días sin venta).
  // Meta acumulada se distribuye por día hábil (L-V).
  const chartData = useMemo(() => {
    if (!daily || !goals) return [];
    const { year, month } = daily.period;
    const totalDays = daysInMonth(year, month);
    const totalBusinessDays = daily.business_days.total || 1;

    const totalMeta = goals.items
      .filter((i) => i.goal_type === mode)
      .reduce((s, i) => s + (Number(i.meta_amount) || 0), 0);
    const metaPerBusinessDay = totalMeta / totalBusinessDays;

    // Mapa fecha→vendido del día.
    const soldMap = new Map<string, number>();
    for (const p of daily.series) {
      const v = mode === "money" ? p.money_sold_day : p.units_sold_day;
      soldMap.set(p.date, Number(v) || 0);
    }

    const todayISO = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();

    let soldCum = 0;
    const out: Array<{
      date: string;
      dayLabel: string;
      vendido: number | null;
      meta: number;
    }> = [];

    for (let day = 1; day <= totalDays; day++) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const businessElapsed = businessDaysUpTo(year, month, iso);
      const metaCum = Math.round(metaPerBusinessDay * businessElapsed * 100) / 100;

      const isFuture = iso > todayISO;
      if (!isFuture) {
        soldCum += soldMap.get(iso) || 0;
      }
      out.push({
        date: iso,
        dayLabel: String(day),
        vendido: isFuture ? null : Math.round(soldCum * 100) / 100,
        meta: metaCum,
      });
    }
    return out;
  }, [daily, goals, mode]);

  const lastVendido = useMemo(() => {
    const real = chartData.filter((p) => p.vendido !== null);
    return real.length > 0 ? Number(real[real.length - 1].vendido) || 0 : 0;
  }, [chartData]);
  const totalMetaActual = useMemo(() => {
    return chartData.length > 0 ? chartData[chartData.length - 1].meta : 0;
  }, [chartData]);

  const fmt = mode === "money" ? formatMoney : formatUnits;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LineIcon className="w-4 h-4 text-sky-300" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">
            Evolución diaria del vendido
          </h2>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => setMode("money")}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
              mode === "money" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Dinero
          </button>
          <button
            type="button"
            onClick={() => setMode("units")}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
              mode === "units" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Unidades
          </button>
        </div>
      </div>

      {loading && !daily && (
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Cargando…
        </div>
      )}
      {error && (
        <div className="text-xs text-red-300">Error: {error}</div>
      )}
      {!loading && chartData.length > 0 && (
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="dayLabel"
                  stroke="#64748B"
                  fontSize={10}
                  tickLine={false}
                  interval={Math.max(1, Math.floor(chartData.length / 8) - 1)}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={10}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v: number) => fmt(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0F172A",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "#E2E8F0",
                    fontSize: 12,
                  }}
                  formatter={(v: number, name: string) => [fmt(v), name === "vendido" ? "Vendido" : "Meta"]}
                  labelFormatter={(label) => `Día ${label}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "#94A3B8" }}
                  formatter={(value) => (value === "vendido" ? "Vendido acumulado" : "Meta acumulada")}
                />
                <Line
                  type="monotone"
                  dataKey="meta"
                  stroke="#E2E8F0"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  name="meta"
                />
                <Line
                  type="monotone"
                  dataKey="vendido"
                  stroke="#38BDF8"
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: "#38BDF8" }}
                  connectNulls={false}
                  name="vendido"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col justify-center gap-3 text-[11px]">
            <div>
              <div className="text-slate-500">Vendido</div>
              <div className="text-lg font-bold text-emerald-300">{fmt(lastVendido)}</div>
            </div>
            <div>
              <div className="text-slate-500">Meta a hoy</div>
              <div className="text-lg font-bold text-white">{fmt(totalMetaActual)}</div>
            </div>
            <div>
              <div className="text-slate-500">Avance</div>
              <div className="text-lg font-bold text-sky-300">
                {totalMetaActual > 0 ? Math.round((lastVendido / totalMetaActual) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
