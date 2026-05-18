// Distribucion del vendido — dos donuts lado a lado:
//   izq DINERO: Fijo New + Fijo Ren + MPLS (vendido en $)
//   der UNIDADES: Movil New + Movil Ren + ClaroTV + Cloud (unidades vendidas)
// Datos reales desde /api/goals/my-day. NO mezcla ejes incompatibles.
import { useEffect, useState, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieIcon, RefreshCw } from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";

type GoalType = "money" | "units";

interface MetaItem {
  label: string;
  goal_type: GoalType;
  vendido_amount: number;
}

interface MyDayResponse {
  items: MetaItem[];
}

interface Props {
  salespersonId?: string | null;
}

// Paleta consistente con el dashboard. Cada producto un color estable.
const PRODUCT_COLOR: Record<string, string> = {
  "Fijo New": "#60A5FA",
  "Fijo Ren": "#A78BFA",
  "MPLS": "#F472B6",
  "Movil New": "#22D3EE",
  "Movil Ren": "#34D399",
  "ClaroTV": "#FBBF24",
  "Cloud": "#F87171",
};

function colorFor(label: string): string {
  return PRODUCT_COLOR[label] || "#94A3B8";
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatUnits(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return String(Math.round(value));
}

export default function DistribucionDonuts({ salespersonId }: Props = {}) {
  const [data, setData] = useState<MyDayResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = salespersonId ? `?salesperson_id=${encodeURIComponent(salespersonId)}` : "";
      const r = await authFetch(`/api/goals/my-day${qs}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as MyDayResponse;
      setData(json);
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
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Cargando distribución…
        </div>
      </div>
    );
  }
  if (!data) return null;

  const items = data.items || [];
  const moneyItems = items
    .filter((i) => i.goal_type === "money" && (i.vendido_amount || 0) > 0)
    .map((i) => ({ name: i.label, value: Math.round(Number(i.vendido_amount) * 100) / 100 }));
  const unitsItems = items
    .filter((i) => i.goal_type === "units" && (i.vendido_amount || 0) > 0)
    .map((i) => ({ name: i.label, value: Math.round(Number(i.vendido_amount)) }));

  const totalMoney = moneyItems.reduce((s, x) => s + x.value, 0);
  const totalUnits = unitsItems.reduce((s, x) => s + x.value, 0);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2">
        <PieIcon className="w-4 h-4 text-sky-300" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">
          Distribución del vendido
        </h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <DonutCard
          title="Dinero"
          subtitle="Fijo · MPLS"
          data={moneyItems}
          total={totalMoney}
          totalLabel={formatMoney(totalMoney)}
          formatValue={formatMoney}
          allCategories={["Fijo New", "Fijo Ren", "MPLS"]}
        />
        <DonutCard
          title="Unidades"
          subtitle="Movil · ClaroTV · Cloud"
          data={unitsItems}
          total={totalUnits}
          totalLabel={formatUnits(totalUnits)}
          formatValue={formatUnits}
          allCategories={["Movil New", "Movil Ren", "ClaroTV", "Cloud"]}
        />
      </div>
    </section>
  );
}

function DonutCard({
  title,
  subtitle,
  data,
  total,
  totalLabel,
  formatValue,
  allCategories,
}: {
  title: string;
  subtitle: string;
  data: { name: string; value: number }[];
  total: number;
  totalLabel: string;
  formatValue: (v: number) => string;
  allCategories: string[];
}) {
  const hasData = data.length > 0;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-[13px] font-semibold text-white">{title}</h3>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{subtitle}</span>
      </div>
      <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
        <div className="relative h-[140px]">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={60}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={colorFor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#0F172A",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "#E2E8F0",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatValue(v)}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full rounded-full border-2 border-dashed border-white/10" />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-[10px] text-slate-500">Total</div>
            <div className="text-base font-bold text-white">{totalLabel}</div>
          </div>
        </div>
        <ul className="space-y-1 text-[11px]">
          {allCategories.map((cat) => {
            const entry = data.find((d) => d.name === cat);
            const value = entry?.value || 0;
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <li key={cat} className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ background: colorFor(cat) }}
                />
                <span className="flex-1 truncate text-slate-300">{cat}</span>
                <span className="tabular-nums text-white font-medium">{formatValue(value)}</span>
                <span className="tabular-nums text-slate-500 text-[10px] w-9 text-right">({pct}%)</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
