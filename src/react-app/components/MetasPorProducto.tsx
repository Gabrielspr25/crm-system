import { useEffect, useState, useCallback } from "react";
import { Target, RefreshCw, AlertTriangle, Sparkles, MoreVertical, DollarSign, Package, AlertCircle } from "lucide-react";
import { Link } from "react-router";
import { authFetch } from "@/react-app/utils/auth";
import IndicadorBolitas from "@/react-app/components/IndicadorBolitas";

interface NeedsReviewCount {
    count: number;
    period: string;
}

type Estado = "en_ritmo" | "empuja" | "enfoque_hoy";
type GoalType = "money" | "units";

interface MetaItem {
    product_type: string;
    sale_type: string;
    label: string;
    goal_type: GoalType;
    meta_amount: number;
    vendido_amount: number;
    meta_unidades?: number;
    vendido_unidades?: number;
    faltan: number;
    cuota_hoy: number;
    porcentaje: number;
    porcentaje_esperado: number;
    estado: Estado;
}

interface MyDayResponse {
    period: { year: number; month: number };
    business_days: { total: number; elapsed: number; remaining: number };
    items: MetaItem[];
    message?: string;
}

const ESTADO_BADGE: Record<Estado, { text: string; bg: string; fg: string }> = {
    en_ritmo: { text: "En ritmo", bg: "rgba(29,158,117,0.15)", fg: "#1D9E75" },
    empuja: { text: "Empuja", bg: "rgba(239,159,39,0.15)", fg: "#EF9F27" },
    enfoque_hoy: { text: "Enfoque hoy", bg: "rgba(226,75,74,0.15)", fg: "#E24B4A" },
};

const MONTH_NAMES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatMoney(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return "$0";
    return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatUnits(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return "0";
    return String(Math.round(value));
}

function formatAmount(value: number, goalType: GoalType): string {
    return goalType === "money" ? formatMoney(value) : formatUnits(value);
}

function formatCuotaUnits(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return "0";
    if (value < 1) return value.toFixed(2);
    return `~${Math.ceil(value)}`;
}

function formatCuotaTotalUnits(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return "0";
    if (value < 1) return "<1";
    return `~${Math.ceil(value)}`;
}

type MessagePart = { text: string; emphasis?: boolean };

function buildMessageParts(items: MetaItem[]): MessagePart[] {
    const conMeta = items.filter((i) => i.meta_amount > 0);
    if (conMeta.length === 0) {
        return [{ text: "Aún no tienes metas asignadas para este mes. Pídele al admin que las configure." }];
    }
    const enfoque = conMeta.filter((i) => i.estado === "enfoque_hoy");
    const empuja = conMeta.filter((i) => i.estado === "empuja");

    if (enfoque.length === 0 && empuja.length === 0) {
        return [{ text: "Vas excelente en todos. Mantén la racha." }];
    }
    if (enfoque.length > 0) {
        const top = enfoque.slice(0, 2);
        if (top.length === 1) {
            return [
                { text: "Hoy enfócate en " },
                { text: top[0].label, emphasis: true },
                { text: ". Cerrar 1 te pone al día." },
            ];
        }
        return [
            { text: "Hoy enfócate en " },
            { text: top[0].label, emphasis: true },
            { text: " y " },
            { text: top[1].label, emphasis: true },
            { text: ". Cerrar 1 de cada uno te pone al día." },
        ];
    }
    return [
        { text: "Empuja un poco " },
        { text: empuja[0].label, emphasis: true },
        { text: ". Con 1 venta hoy te emparejas." },
    ];
}

function buildSubtitle(pctGlobal: number, items: MetaItem[]): string {
    const conMeta = items.filter((i) => i.meta_amount > 0);
    if (conMeta.length === 0) return "Sin metas configuradas todavía";
    if (pctGlobal >= 100) return "¡Meta del mes cumplida! Sigue sumando";
    if (pctGlobal >= 75) return "Vas muy bien, sigue así";
    if (pctGlobal >= 40) return "Vas bien, sigue así";
    if (pctGlobal > 0) return "Empuja un poco más, hay tiempo";
    return "Empieza el mes fuerte. ¡Cada venta cuenta!";
}

interface MetasPorProductoProps {
    /**
     * Override de salesperson_id. Solo aplica si el caller (admin/supervisor)
     * quiere ver las metas de OTRO vendedor. Si se omite, el endpoint usa
     * el salesperson del usuario logueado.
     */
    salespersonId?: string | null;
}

export default function MetasPorProducto({ salespersonId }: MetasPorProductoProps = {}) {
    const [data, setData] = useState<MyDayResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reviewCount, setReviewCount] = useState<number>(0);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const qs = salespersonId ? `?salesperson_id=${encodeURIComponent(salespersonId)}` : "";
            const r = await authFetch(`/api/goals/my-day${qs}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const json = (await r.json()) as MyDayResponse;
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error cargando metas");
        } finally {
            setLoading(false);
        }
    }, [salespersonId]);

    const loadReviewCount = useCallback(async () => {
        try {
            const r = await authFetch("/api/subscriber-reports/needs-review-count");
            if (!r.ok) return;
            const json = (await r.json()) as NeedsReviewCount;
            setReviewCount(Number(json.count || 0));
        } catch {
            // fallo silencioso: no romper Mi Día por el banner
        }
    }, []);

    useEffect(() => {
        void load();
        void loadReviewCount();
    }, [load, loadReviewCount]);

    if (loading && !data) {
        return (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Cargando metas...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
                <button
                    onClick={() => void load()}
                    className="ml-auto rounded-md border border-red-500/40 px-2 py-0.5 text-xs text-red-100 hover:bg-red-500/15"
                >
                    Reintentar
                </button>
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

    const activeBuckets = [moneyMeta > 0 ? moneyPct : null, unitsMeta > 0 ? unitsPct : null].filter(
        (v): v is number => v !== null,
    );
    const pctGlobal = activeBuckets.length
        ? Math.round(activeBuckets.reduce((s, v) => s + v, 0) / activeBuckets.length)
        : 0;

    const diaActual = Math.max(
        1,
        Math.min(data.business_days.total, data.business_days.total - data.business_days.remaining + 1),
    );
    const messageParts = buildMessageParts(items);
    const monthLabel = MONTH_NAMES[(data.period.month - 1) % 12] || "";
    const subtitle = buildSubtitle(pctGlobal, items);
    const hasMoney = moneyMeta > 0;
    const hasUnits = unitsMeta > 0;

    return (
        <div className="space-y-3">
            {/* Alerta operativa: ventas Tango con datos incompletos */}
            {reviewCount > 0 && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2 text-amber-100 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-300" />
                        <span>
                            Hay <strong className="text-amber-50">{reviewCount}</strong> venta{reviewCount === 1 ? "" : "s"} de Tango en revisión este mes (no suman a tus metas hasta que se validen).
                        </span>
                    </div>
                    <Link
                        to="/reportes"
                        className="shrink-0 inline-flex items-center justify-center rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 px-3 py-1.5 text-xs font-semibold text-amber-50 whitespace-nowrap transition"
                    >
                        Ver en Comisiones
                    </Link>
                </div>
            )}

            {/* Header compacto (KPIs duales se renderizan en banda DashboardKPIs aparte) */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                        <div className="rounded-full p-2" style={{ background: "rgba(83,74,183,0.22)" }}>
                            <Target className="w-4 h-4" style={{ color: "#A099E6" }} />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-white capitalize leading-tight">
                                Tus metas de {monthLabel}
                            </h2>
                            <p className="text-[12px] text-slate-400 mt-0.5">{subtitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                            Día {diaActual} de {data.business_days.total} hábiles
                        </span>
                        <button
                            type="button"
                            className="rounded-full p-1 text-slate-500 hover:bg-white/5 hover:text-slate-300 transition"
                            aria-label="Más opciones"
                        >
                            <MoreVertical className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Por producto: dos columnas compactas */}
            <section className="grid gap-2 lg:grid-cols-2">
                <ColumnaProducto
                    title="FIJO + MPLS"
                    subtitle="DINERO"
                    icon={<DollarSign className="w-4 h-4" />}
                    iconColor="#34D399"
                    items={moneyItems}
                    totalMeta={moneyMeta}
                    totalVendido={moneyVendido}
                    totalFaltan={moneyFaltan}
                    goalType="money"
                />
                <ColumnaProducto
                    title="MÓVIL + CLAROTV + CLOUD"
                    subtitle="UNIDADES"
                    icon={<Package className="w-4 h-4" />}
                    iconColor="#60A5FA"
                    items={unitsItems}
                    totalMeta={unitsMeta}
                    totalVendido={unitsVendido}
                    totalFaltan={unitsFaltan}
                    goalType="units"
                />
            </section>

            {/* Footer: mensaje + link a comisiones */}
            <section
                className="rounded-2xl border p-4 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                style={{
                    borderColor: "rgba(96,130,235,0.45)",
                    background: "linear-gradient(135deg, rgba(30,58,138,0.55) 0%, rgba(67,56,202,0.55) 100%)",
                }}
            >
                <div className="flex items-start gap-3">
                    <div className="shrink-0 rounded-lg p-2" style={{ background: "rgba(160,153,230,0.25)" }}>
                        <Sparkles className="w-5 h-5" style={{ color: "#C7C2F4" }} />
                    </div>
                    <p className="text-[14px] leading-relaxed text-white">
                        {messageParts.map((part, i) =>
                            part.emphasis ? (
                                <strong key={i} style={{ color: "#FBA37D", fontWeight: 700 }}>
                                    {part.text}
                                </strong>
                            ) : (
                                <span key={i}>{part.text}</span>
                            ),
                        )}
                    </p>
                </div>
                <Link
                    to="/reportes"
                    className="shrink-0 inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-2 text-sm font-medium text-white whitespace-nowrap transition"
                >
                    Ver detalle de comisiones
                </Link>
            </section>
        </div>
    );
}

function KpiDual({
    label,
    money,
    moneySub,
    units,
    unitsSub,
    accent,
}: {
    label: string;
    money: string | null;
    moneySub?: string;
    units: string | null;
    unitsSub?: string;
    accent?: "green" | "purple";
}) {
    const styles =
        accent === "green"
            ? { bg: "rgba(20,83,45,0.55)", border: "rgba(34,197,94,0.35)", fgValue: "#FFFFFF", fgLabel: "#86EFAC", fgSub: "#BBF7D0" }
            : accent === "purple"
                ? { bg: "rgba(232,229,248,0.95)", border: "rgba(150,140,220,0.40)", fgValue: "#3B2F87", fgLabel: "#5B4FBE", fgSub: "#5B4FBE" }
                : { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", fgValue: "#FFFFFF", fgLabel: "#94A3B8", fgSub: "#94A3B8" };
    return (
        <div className="rounded-xl border px-3 py-2.5 flex flex-col gap-2" style={{ background: styles.bg, borderColor: styles.border }}>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: styles.fgLabel }}>
                {label}
            </div>
            {money !== null && (
                <div>
                    <div className="text-xl font-bold leading-none" style={{ color: styles.fgValue }}>
                        {money}
                    </div>
                    {moneySub && (
                        <div className="text-[10px] mt-1" style={{ color: styles.fgSub }}>
                            {moneySub}
                        </div>
                    )}
                </div>
            )}
            {units !== null && (
                <div>
                    <div className="text-xl font-bold leading-none" style={{ color: styles.fgValue }}>
                        {units}
                    </div>
                    {unitsSub && (
                        <div className="text-[10px] mt-1" style={{ color: styles.fgSub }}>
                            {unitsSub}
                        </div>
                    )}
                </div>
            )}
            {money === null && units === null && (
                <div className="text-xl font-bold leading-none" style={{ color: styles.fgValue }}>
                    0
                </div>
            )}
        </div>
    );
}

function ColumnaProducto({
    title,
    subtitle,
    icon,
    iconColor,
    items,
    totalMeta,
    totalVendido,
    totalFaltan,
    goalType,
}: {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    iconColor: string;
    items: MetaItem[];
    totalMeta: number;
    totalVendido: number;
    totalFaltan: number;
    goalType: GoalType;
}) {
    if (items.length === 0) return null;
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center rounded-md p-1" style={{ background: "rgba(255,255,255,0.06)", color: iconColor }}>
                    {icon}
                </span>
                <h3 className="text-sm font-semibold text-white">
                    {title} <span className="text-slate-400 font-normal text-[11px]">({subtitle})</span>
                </h3>
            </div>

            <div className="space-y-1.5">
                {items.map((item) => (
                    <ProductoCard key={`${item.product_type}-${item.sale_type}`} item={item} />
                ))}
            </div>

            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Resumen {goalType === "money" ? "Dinero" : "Unidades"}</span>
                <span className="text-slate-300 tabular-nums">
                    Meta <span className="font-semibold text-white">{formatAmount(totalMeta, goalType)}</span>
                    {"  ·  "}
                    Vendido <span className="font-semibold text-emerald-300">{formatAmount(totalVendido, goalType)}</span>
                    {"  ·  "}
                    Faltan <span className="font-semibold text-amber-300">{formatAmount(totalFaltan, goalType)}</span>
                </span>
            </div>
        </div>
    );
}

function KpiAvance({ pct }: { pct: number }) {
    // KPI compacto del avance global del mes — 5to slot junto a META/VENDIDO/FALTAN/HOY.
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    const color = clamped >= 70 ? "#22C55E" : clamped >= 40 ? "#EAB308" : "#EF4444";
    const ringSize = 56;
    const stroke = 6;
    const radius = (ringSize - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const dash = (clamped / 100) * circumference;
    return (
        <div
            className="rounded-xl border px-3 py-2.5 flex items-center gap-3"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
        >
            <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                    AVANCE DEL MES
                </div>
                <div className="text-xl font-bold leading-none text-white mt-1.5">{clamped}%</div>
                <div className="text-[10px] mt-1 text-slate-400">global</div>
            </div>
            <svg width={ringSize} height={ringSize} className="shrink-0">
                <circle
                    cx={ringSize / 2} cy={ringSize / 2} r={radius}
                    fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke}
                />
                <circle
                    cx={ringSize / 2} cy={ringSize / 2} r={radius}
                    fill="none" stroke={color} strokeWidth={stroke}
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                />
            </svg>
        </div>
    );
}

function ProductoCard({ item }: { item: MetaItem }) {
    const badge = ESTADO_BADGE[item.estado];
    const isMoney = item.goal_type === "money";
    const cuotaTexto = isMoney
        ? formatMoney(item.cuota_hoy)
        : formatCuotaUnits(item.cuota_hoy);
    const vendidoFmt = formatAmount(item.vendido_amount, item.goal_type);
    const metaFmt = formatAmount(item.meta_amount, item.goal_type);
    const faltanFmt = formatAmount(item.faltan, item.goal_type);

    return (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-medium text-slate-100 text-sm">{item.label}</span>
                <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap"
                    style={{ background: badge.bg, color: badge.fg }}
                >
                    {badge.text}
                </span>
            </div>

            {isMoney ? (
                <BarraProgreso percent={item.porcentaje} estado={item.estado} />
            ) : (
                <div className="my-1">
                    <IndicadorBolitas
                        vendido={Math.round(item.vendido_amount)}
                        meta={Math.round(item.meta_amount)}
                        estado={item.estado}
                    />
                </div>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
                <span className="text-slate-400">
                    Meta <span className="text-white font-semibold">{metaFmt}</span>
                </span>
                <span className="text-slate-400">
                    Vendido <span className="text-emerald-300 font-semibold">{vendidoFmt}</span>
                </span>
                <span className="text-slate-400">
                    Faltan <span className="text-amber-300 font-semibold">{faltanFmt}</span>
                </span>
                <span className="ml-auto" style={{ color: badge.fg }}>
                    Hoy <span className="font-semibold">{cuotaTexto}</span>
                </span>
            </div>
        </div>
    );
}

function BarraProgreso({ percent, estado }: { percent: number; estado: Estado }) {
    const color = ESTADO_BADGE[estado].fg;
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    return (
        <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-slate-700/50 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${clamped}%`, background: color }}
                />
            </div>
            <span className="text-[10px] tabular-nums" style={{ color }}>
                {clamped}%
            </span>
        </div>
    );
}
