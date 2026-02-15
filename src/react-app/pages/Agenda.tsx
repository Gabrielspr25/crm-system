import { useState, useMemo } from "react";
import {
  CalendarCheck,
  Phone,
  Clock,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  Calendar as CalendarIcon,
  Search,
  ExternalLink,
  TrendingUp,
  DollarSign,
  Target,
  Users,
  BarChart3,
  Package,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { useApi } from "../hooks/useApi";
import { useNavigate } from "react-router";
import { getCurrentUser } from "../utils/auth";

// ============ Types ============
interface FollowUpProspect {
  id: number;
  company_name: string;
  client_id: string | null;
  priority_id: number | null;
  vendor_id: number | null;
  step_id: number | null;
  next_call_date: string | null;
  last_call_date: string | null;
  notes: string | null;
  priority_name?: string;
  priority_color?: string;
  vendor_name?: string;
  step_name?: string;
  contact_phone?: string;
}

interface PerformanceVendor {
  vendor_id: number;
  vendor_name: string;
  salesperson_id: string;
  total_goal: number;
  total_earned: number;
  percentage: number;
  remaining: number;
}

interface PerformanceData {
  period: string;
  summary: { total_goal: number; total_earned: number; total_percentage: number } | null;
  vendors: PerformanceVendor[];
}

interface VendorGoal {
  id: number;
  vendor_id: number | null;
  vendor_name: string | null;
  product_id: number | null;
  product_name: string | null;
  period_type: string;
  period_year: number;
  period_month: number | null;
  target_amount: number;
  current_amount: number;
  is_active: number;
}

// ============ Helpers ============
const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtK = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n.toFixed(0)}`);

const getCurrentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const toLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899", "#10b981", "#f97316", "#6366f1"];

function getWorkingDaysRemaining(): number {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  let days = 0;
  const cur = new Date(today);
  while (cur <= lastDay) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ============ Custom Tooltip ============
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-300 font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-white">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
          {p.name}: <strong>{fmt(p.value)}</strong>
        </p>
      ))}
    </div>
  );
};

// ============ Main Component ============
export default function Agenda() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "supervisor";
  const currentMonth = useMemo(() => getCurrentMonth(), []);
  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1;

  // Data fetching
  const { data: prospects, loading: l1 } = useApi<FollowUpProspect[]>("/api/follow-up-prospects");
  const { data: performance, loading: l2 } = useApi<PerformanceData>(`/api/goals/performance?month=${currentMonth}`);
  // Product goals - for vendors load their goals, for admin load all active goals
  const goalsUrl = !isAdmin
    ? `/api/goals?period_year=${currentYear}&period_month=${currentMonthNum}`
    : `/api/goals?period_year=${currentYear}&period_month=${currentMonthNum}`;
  const { data: vendorGoals, loading: l3 } = useApi<VendorGoal[]>(goalsUrl);
  const { data: businessGoals, loading: l4 } = useApi<VendorGoal[]>(
    `/api/product-goals?period_year=${currentYear}&period_month=${currentMonthNum}`
  );

  // ---- Product progress (admin: business goals, vendor: their goals) ----
  const productProgress = useMemo(() => {
    const goals = isAdmin ? businessGoals : vendorGoals;
    if (!goals || goals.length === 0) return [];
    const map = new Map<number, { name: string; target: number; current: number }>();
    goals.forEach((g) => {
      const pid = g.product_id || 0;
      const name = g.product_name || "Sin producto";
      if (!map.has(pid)) map.set(pid, { name, target: 0, current: 0 });
      const entry = map.get(pid)!;
      entry.target += g.target_amount;
      entry.current += g.current_amount;
    });
    return Array.from(map.entries())
      .map(([id, p]) => ({
        id,
        name: p.name,
        target: p.target,
        current: p.current,
        pct: p.target > 0 ? (p.current / p.target) * 100 : 0,
        remaining: Math.max(0, p.target - p.current),
      }))
      .sort((a, b) => b.target - a.target);
  }, [isAdmin, vendorGoals, businessGoals]);

  // ---- Vendor chart data ----
  const vendorChartData = useMemo(() => {
    if (!performance?.vendors) return [];
    return performance.vendors
      .filter((v) => v.total_goal > 0)
      .sort((a, b) => b.percentage - a.percentage)
      .map((v) => ({
        name: v.vendor_name.split(" ")[0],
        Meta: v.total_goal,
        Ganado: v.total_earned,
        pct: v.percentage,
      }));
  }, [performance]);

  // ---- Donut data for overall completion ----
  const donutData = useMemo(() => {
    const summary = isAdmin ? performance?.summary : null;
    const myPerf = !isAdmin
      ? performance?.vendors?.find((v) => v.salesperson_id === currentUser?.salespersonId)
      : null;
    const pct = isAdmin ? (summary?.total_percentage ?? 0) : (myPerf?.percentage ?? 0);
    const earned = isAdmin ? (summary?.total_earned ?? 0) : (myPerf?.total_earned ?? 0);
    const goal = isAdmin ? (summary?.total_goal ?? 0) : (myPerf?.total_goal ?? 0);
    return { pct, earned, goal, remaining: Math.max(0, goal - earned) };
  }, [performance, isAdmin, currentUser]);

  const radialData = useMemo(
    () => [{ name: "Cumplimiento", value: Math.min(donutData.pct, 100), fill: donutData.pct >= 80 ? "#22c55e" : donutData.pct >= 50 ? "#eab308" : "#ef4444" }],
    [donutData]
  );

  // ---- Pie chart for product distribution ----
  const pieData = useMemo(() => {
    return productProgress.filter((p) => p.target > 0).map((p, i) => ({
      name: p.name,
      value: p.target,
      fill: COLORS[i % COLORS.length],
    }));
  }, [productProgress]);

  // ---- Agenda stats ----
  const stats = useMemo(() => {
    if (!prospects) return { today: 0, overdue: 0, upcoming: 0 };
    const todayStr = toLocalDate(new Date());
    return prospects.reduce(
      (acc, p) => {
        if (!p.next_call_date) return acc;
        const callStr = toLocalDate(new Date(p.next_call_date));
        if (callStr === todayStr) acc.today++;
        else if (callStr < todayStr) acc.overdue++;
        else acc.upcoming++;
        return acc;
      },
      { today: 0, overdue: 0, upcoming: 0 }
    );
  }, [prospects]);

  const sortedProspects = useMemo(() => {
    if (!prospects) return [];
    return [...prospects]
      .filter((p) => p.next_call_date)
      .sort((a, b) => new Date(a.next_call_date!).getTime() - new Date(b.next_call_date!).getTime())
      .filter(
        (p) =>
          p.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.vendor_name && p.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
  }, [prospects, searchTerm]);

  const groupedAgenda = useMemo(() => {
    const groups: { title: string; items: FollowUpProspect[]; type: "overdue" | "today" | "upcoming" }[] = [
      { title: "Atrasados", items: [], type: "overdue" },
      { title: "Para Hoy", items: [], type: "today" },
      { title: "Próximos", items: [], type: "upcoming" },
    ];
    const todayStr = toLocalDate(new Date());
    sortedProspects.forEach((p) => {
      if (!p.next_call_date) return;
      const callStr = toLocalDate(new Date(p.next_call_date));
      if (callStr < todayStr) groups[0].items.push(p);
      else if (callStr === todayStr) groups[1].items.push(p);
      else groups[2].items.push(p);
    });
    return groups.filter((g) => g.items.length > 0);
  }, [sortedProspects]);

  const myPerformance = useMemo(() => {
    if (isAdmin || !performance?.vendors) return null;
    return performance.vendors.find((v) => v.salesperson_id === currentUser?.salespersonId) || null;
  }, [performance, currentUser, isAdmin]);

  const workingDays = useMemo(() => getWorkingDaysRemaining(), []);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });

  const loading = l1 || l2 || l3 || l4;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin border-4 border-blue-500 border-t-transparent rounded-full h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-8 h-8 text-blue-500" />
            Panel General
          </h1>
          <p className="text-slate-400 mt-1">
            {isAdmin ? "Resumen ejecutivo del negocio" : `Hola, ${currentUser?.salespersonName || currentUser?.username}`}
            {" · "}
            <span className="text-slate-500">
              {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
            {workingDays} días laborables restantes
          </span>
        </div>
      </div>

      {/* ====== ROW 1: KPIs + Radial Chart ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* KPI Cards - 8 cols */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            label={isAdmin ? "Meta Negocio" : "Mi Meta"}
            value={fmt(donutData.goal)}
            icon={<Target className="w-5 h-5" />}
            trend={null}
            color="blue"
          />
          <KpiCard
            label="Comisiones"
            value={fmt(donutData.earned)}
            icon={<DollarSign className="w-5 h-5" />}
            trend={donutData.pct > 0 ? { value: `${donutData.pct.toFixed(0)}%`, up: donutData.pct >= 50 } : null}
            color="green"
          />
          <KpiCard
            label="Faltante"
            value={fmt(donutData.remaining)}
            icon={<BarChart3 className="w-5 h-5" />}
            trend={null}
            color={donutData.remaining === 0 ? "green" : "amber"}
          />
          <KpiCard
            label="Gestiones"
            value={String(stats.overdue + stats.today + stats.upcoming)}
            icon={<Phone className="w-5 h-5" />}
            trend={stats.overdue > 0 ? { value: `${stats.overdue} atrasadas`, up: false } : null}
            color={stats.overdue > 0 ? "red" : "slate"}
          />
        </div>

        {/* Radial gauge - 4 cols */}
        <div className="lg:col-span-4 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Cumplimiento</p>
          <div className="w-36 h-36 relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="75%"
                outerRadius="100%"
                data={radialData}
                startAngle={210}
                endAngle={-30}
                barSize={12}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={8}
                  background={{ fill: "#1e293b" }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={`text-3xl font-black ${
                  donutData.pct >= 80 ? "text-green-400" : donutData.pct >= 50 ? "text-yellow-400" : "text-red-400"
                }`}
              >
                {donutData.pct.toFixed(0)}%
              </span>
              <span className="text-[10px] text-slate-500">del mes</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {fmt(donutData.earned)} de {fmt(donutData.goal)}
          </p>
        </div>
      </div>

      {/* ====== ROW 2: Product Progress + Chart ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Product Progress Table */}
        <div className="lg:col-span-7 bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-400" />
              Progreso por Producto
            </h2>
            {!isAdmin && (
              <span className="text-[10px] text-slate-500">
                Diaria necesaria para cumplir
              </span>
            )}
          </div>
          {productProgress.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No hay metas de producto configuradas
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {productProgress.map((p, i) => {
                const dailyNeeded = workingDays > 0 ? p.remaining / workingDays : 0;
                return (
                  <div key={p.id} className="px-5 py-3 hover:bg-slate-700/20 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-sm font-medium text-white truncate max-w-[200px]">
                          {p.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-400">
                          {fmt(p.current)}{" "}
                          <span className="text-slate-600">/ {fmt(p.target)}</span>
                        </span>
                        <span
                          className={`font-bold min-w-[3rem] text-right ${
                            p.pct >= 80 ? "text-green-400" : p.pct >= 50 ? "text-yellow-400" : "text-red-400"
                          }`}
                        >
                          {p.pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(100, p.pct)}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                      {p.remaining > 0 && (
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">
                          {fmtK(dailyNeeded)}/día
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Product Distribution Pie */}
        <div className="lg:col-span-5 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            Distribución de Metas
          </h2>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Sin datos</div>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl text-xs">
                            <p className="text-white font-semibold">{payload[0].name}</p>
                            <p className="text-slate-300">{fmt(payload[0].value as number)}</p>
                          </div>
                        ) : null
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                {pieData.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs truncate">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.fill }} />
                    <span className="text-slate-300 truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ====== ROW 3: Vendor Performance (Admin) or Personal Progress (Vendor) ====== */}
      {isAdmin && performance?.vendors && performance.vendors.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Rendimiento del Equipo
            </h2>
            <button
              onClick={() => navigate("/metas")}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              Detalle <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Bar chart + compact table */}
          <div className="grid grid-cols-1 xl:grid-cols-2">
            {/* Chart */}
            <div className="p-4 border-b xl:border-b-0 xl:border-r border-slate-700/30">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorChartData} barGap={2}>
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={50} />
                    <Tooltip content={ChartTooltip} />
                    <Bar dataKey="Meta" fill="#334155" radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="Ganado" radius={[4, 4, 0, 0]} barSize={24}>
                      {vendorChartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.pct >= 80 ? "#22c55e" : entry.pct >= 50 ? "#eab308" : "#ef4444"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Compact table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
                    <th className="text-left px-4 py-2.5 font-semibold">Vendedor</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Meta</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Ganado</th>
                    <th className="text-center px-4 py-2.5 font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.vendors
                    .sort((a, b) => b.percentage - a.percentage)
                    .map((v) => (
                      <tr key={v.vendor_id} className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 py-2 text-white font-medium">{v.vendor_name}</td>
                        <td className="px-4 py-2 text-right text-slate-400">{fmtK(v.total_goal)}</td>
                        <td className="px-4 py-2 text-right text-green-400 font-semibold">{fmtK(v.total_earned)}</td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className={`inline-flex items-center gap-0.5 font-bold ${
                              v.percentage >= 80 ? "text-green-400" : v.percentage >= 50 ? "text-yellow-400" : "text-red-400"
                            }`}
                          >
                            {v.percentage.toFixed(0)}%
                            <div className="w-12 h-1 bg-slate-700 rounded-full overflow-hidden ml-1">
                              <div
                                className={`h-full rounded-full ${
                                  v.percentage >= 80 ? "bg-green-500" : v.percentage >= 50 ? "bg-yellow-500" : "bg-red-500"
                                }`}
                                style={{ width: `${Math.min(100, v.percentage)}%` }}
                              />
                            </div>
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Vendor: Personal progress bar */}
      {!isAdmin && myPerformance && myPerformance.total_goal > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-white">Mi Progreso Total</span>
            <span className="text-xs text-slate-400">
              {fmt(myPerformance.total_earned)} / {fmt(myPerformance.total_goal)}
            </span>
          </div>
          <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                myPerformance.percentage >= 80
                  ? "bg-gradient-to-r from-green-600 to-green-400"
                  : myPerformance.percentage >= 50
                  ? "bg-gradient-to-r from-yellow-600 to-yellow-400"
                  : "bg-gradient-to-r from-red-600 to-red-400"
              }`}
              style={{ width: `${Math.min(100, myPerformance.percentage)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-slate-500">
            <span>0%</span>
            <span>{myPerformance.percentage.toFixed(1)}% completado</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* ====== ROW 4: Gestiones Pendientes ====== */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-400" />
            Gestiones Pendientes
          </h2>
          <div className="flex items-center gap-2">
            {/* Mini stat badges */}
            {stats.overdue > 0 && (
              <span className="bg-red-500/15 text-red-400 border border-red-500/20 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {stats.overdue} atrasadas
              </span>
            )}
            <span className="bg-blue-500/15 text-blue-400 border border-blue-500/20 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" /> {stats.today} hoy
            </span>
            <span className="bg-slate-700/50 text-slate-400 border border-slate-600/30 text-xs px-2.5 py-1 rounded-lg">
              {stats.upcoming} próximas
            </span>
            <div className="relative ml-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500 transition-all w-44"
              />
            </div>
            <button
              onClick={() => navigate("/seguimiento")}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all text-xs font-semibold"
            >
              Ver Todo <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Agenda list - compact */}
        {groupedAgenda.length === 0 ? (
          <div className="text-center py-10 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
            <CheckCircle2 className="w-10 h-10 text-green-500/40 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-300">¡Todo al día!</p>
            <p className="text-xs text-slate-500">No hay gestiones pendientes.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedAgenda.map((group) => (
              <div key={group.title}>
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      group.type === "overdue"
                        ? "bg-red-500/20 text-red-400"
                        : group.type === "today"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-slate-700/50 text-slate-400"
                    }`}
                  >
                    {group.title}
                  </span>
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-[10px] text-slate-500">{group.items.length}</span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                  {group.items.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/seguimiento?edit=${item.id}`)}
                      className="bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 hover:border-blue-500/40 rounded-xl px-4 py-2.5 transition-all cursor-pointer group/c flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            group.type === "overdue"
                              ? "bg-red-500/10 text-red-500"
                              : group.type === "today"
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-slate-700/50 text-slate-400"
                          }`}
                        >
                          <Phone size={14} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-slate-200 group-hover/c:text-white truncate text-xs">
                            {item.company_name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                              <Clock size={9} /> {formatDate(item.next_call_date!)}
                            </span>
                            {item.priority_name && (
                              <span
                                className="px-1 py-0 rounded text-[8px] font-bold uppercase text-white/90"
                                style={{ backgroundColor: item.priority_color }}
                              >
                                {item.priority_name}
                              </span>
                            )}
                            {item.step_name && (
                              <span className="text-[9px] text-slate-400 bg-slate-700/30 px-1 rounded border border-slate-600/40">
                                {item.step_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 hidden sm:block">{item.vendor_name || ""}</span>
                        <ExternalLink size={12} className="text-slate-600 group-hover/c:text-blue-400 transition-colors" />
                      </div>
                    </div>
                  ))}
                  {group.items.length > 8 && (
                    <button
                      onClick={() => navigate("/seguimiento")}
                      className="col-span-full text-xs text-blue-400 hover:text-blue-300 py-1"
                    >
                      +{group.items.length - 8} más →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ KPI Card ============
function KpiCard({
  label,
  value,
  icon,
  trend,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend: { value: string; up: boolean } | null;
  color: "blue" | "green" | "red" | "amber" | "slate";
}) {
  const colors: Record<string, { bg: string; border: string; label: string; icon: string }> = {
    blue: { bg: "from-blue-500/8 to-blue-600/4", border: "border-blue-500/15", label: "text-blue-400", icon: "text-blue-500/60" },
    green: { bg: "from-green-500/8 to-green-600/4", border: "border-green-500/15", label: "text-green-400", icon: "text-green-500/60" },
    red: { bg: "from-red-500/8 to-red-600/4", border: "border-red-500/15", label: "text-red-400", icon: "text-red-500/60" },
    amber: { bg: "from-amber-500/8 to-amber-600/4", border: "border-amber-500/15", label: "text-amber-400", icon: "text-amber-500/60" },
    slate: { bg: "from-slate-500/8 to-slate-600/4", border: "border-slate-600/15", label: "text-slate-400", icon: "text-slate-500/60" },
  };
  const c = colors[color];

  return (
    <div className={`bg-gradient-to-br ${c.bg} border ${c.border} rounded-xl p-4 relative overflow-hidden`}>
      <div className={`absolute right-3 top-3 ${c.icon}`}>{icon}</div>
      <p className={`${c.label} font-bold uppercase tracking-wider text-[10px]`}>{label}</p>
      <p className="text-2xl font-black text-white mt-1 leading-tight">{value}</p>
      {trend && (
        <p className={`text-[10px] mt-1 flex items-center gap-0.5 ${trend.up ? "text-green-400" : "text-red-400"}`}>
          {trend.up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {trend.value}
        </p>
      )}
    </div>
  );
}
