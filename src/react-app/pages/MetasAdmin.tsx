import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, Target, AlertTriangle, CheckCircle2, RefreshCw, Lock } from "lucide-react";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

interface Vendor {
    id: number;
    name: string;
    salesperson_id?: string | null;
    is_active?: number;
}

type GoalType = "money" | "units";

interface CategoryItem {
    product_type: string;
    sale_type: string;
    label: string;
    goal_type: GoalType;
    target_amount: number;
}

interface UnitsResponse {
    vendor_id: number;
    period: { year: number; month: number };
    locked: boolean;
    items: CategoryItem[];
}

const MONTH_OPTIONS = [
    { value: 1, label: "enero" },
    { value: 2, label: "febrero" },
    { value: 3, label: "marzo" },
    { value: 4, label: "abril" },
    { value: 5, label: "mayo" },
    { value: 6, label: "junio" },
    { value: 7, label: "julio" },
    { value: 8, label: "agosto" },
    { value: 9, label: "septiembre" },
    { value: 10, label: "octubre" },
    { value: 11, label: "noviembre" },
    { value: 12, label: "diciembre" },
];

function isPastMonthClient(year: number, month: number): boolean {
    const now = new Date();
    const currentYM = now.getFullYear() * 12 + now.getMonth();
    const requested = year * 12 + (month - 1);
    return requested < currentYM;
}

export default function MetasAdmin() {
    const currentUser = getCurrentUser();
    const role = String(currentUser?.role || "").toLowerCase();
    const canEdit = role === "admin" || role === "supervisor";

    const now = new Date();
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vendorId, setVendorId] = useState<number | null>(null);
    const [year, setYear] = useState<number>(now.getFullYear());
    const [month, setMonth] = useState<number>(now.getMonth() + 1);
    const [items, setItems] = useState<CategoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [locked, setLocked] = useState(false);
    const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

    // Cargar vendedores
    useEffect(() => {
        authFetch("/api/vendors")
            .then((r) => r.json())
            .then((data: Vendor[]) => {
                const list = Array.isArray(data) ? data.filter((v) => v.is_active !== 0) : [];
                setVendors(list);
                if (list.length > 0 && vendorId === null) {
                    setVendorId(list[0].id);
                }
            })
            .catch(() => setVendors([]));
    }, [vendorId]);

    // Cargar metas
    const load = useCallback(async () => {
        if (!vendorId) return;
        setLoading(true);
        setMessage(null);
        try {
            const r = await authFetch(`/api/goals/units?vendor_id=${vendorId}&year=${year}&month=${month}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const json = (await r.json()) as UnitsResponse;
            setItems(json.items || []);
            setLocked(Boolean(json.locked) || isPastMonthClient(year, month));
        } catch (e) {
            setMessage({ tone: "err", text: e instanceof Error ? e.message : "Error" });
        } finally {
            setLoading(false);
        }
    }, [vendorId, year, month]);

    useEffect(() => {
        void load();
    }, [load]);

    const updateAmount = (productType: string, saleType: string, value: string) => {
        setItems((prev) =>
            prev.map((it) => {
                if (it.product_type !== productType || it.sale_type !== saleType) return it;
                const raw = Number(value || 0);
                const safe = Number.isFinite(raw) && raw > 0 ? raw : 0;
                const next = it.goal_type === "units" ? Math.floor(safe) : Math.round(safe * 100) / 100;
                return { ...it, target_amount: next };
            }),
        );
    };

    const handleSave = async () => {
        if (!vendorId || locked || !canEdit) return;
        setSaving(true);
        setMessage(null);
        try {
            const r = await authFetch("/api/goals/units", {
                method: "POST",
                json: {
                    vendor_id: vendorId,
                    year,
                    month,
                    items: items.map((it) => ({
                        product_type: it.product_type,
                        sale_type: it.sale_type,
                        target_amount: it.target_amount,
                    })),
                },
            });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(err?.error || `HTTP ${r.status}`);
            }
            setMessage({ tone: "ok", text: "Metas guardadas correctamente." });
        } catch (e) {
            setMessage({ tone: "err", text: e instanceof Error ? e.message : "Error guardando" });
        } finally {
            setSaving(false);
        }
    };

    const yearOptions = useMemo(() => {
        const y = now.getFullYear();
        return [y - 1, y, y + 1];
    }, []);

    if (!canEdit) {
        return (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Solo administradores y supervisores pueden asignar metas.
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Target className="w-6 h-6" style={{ color: "#534AB7" }} />
                        Asignar metas mensuales
                    </h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Metas en unidades por vendedor y categoría (FIJO_NEW, MOVIL_REN, etc.)
                    </p>
                </div>
            </div>

            {/* Selectores */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                        Vendedor
                    </label>
                    <select
                        value={vendorId ?? ""}
                        onChange={(e) => setVendorId(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {vendors.length === 0 && <option value="">Sin vendedores</option>}
                        {vendors.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                        Mes
                    </label>
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {MONTH_OPTIONS.map((m) => (
                            <option key={m.value} value={m.value} className="capitalize">
                                {m.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                        Año
                    </label>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {locked && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100 text-sm flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Mes pasado bloqueado. Solo el mes actual y futuros se pueden editar.
                </div>
            )}

            {message && (
                <div
                    className={`rounded-2xl border p-3 text-sm flex items-center gap-2 ${
                        message.tone === "ok"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                            : "border-red-500/30 bg-red-500/10 text-red-100"
                    }`}
                >
                    {message.tone === "ok" ? (
                        <CheckCircle2 className="w-4 h-4" />
                    ) : (
                        <AlertTriangle className="w-4 h-4" />
                    )}
                    {message.text}
                </div>
            )}

            {/* Tabla */}
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Metas por categoría</h2>
                    {loading && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-slate-400">
                        <tr>
                            <th className="text-left px-4 py-2">Categoría</th>
                            <th className="text-left px-4 py-2">Tipo de meta</th>
                            <th className="text-right px-4 py-2 w-48">Meta</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {items.map((it) => {
                            const isMoney = it.goal_type === "money";
                            return (
                                <tr key={`${it.product_type}-${it.sale_type}`}>
                                    <td className="px-4 py-3 font-medium text-slate-100">{it.label}</td>
                                    <td className="px-4 py-3 text-slate-400 text-xs">
                                        {isMoney ? (
                                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-emerald-200">
                                                Dinero ($)
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-blue-200">
                                                Unidades
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            {isMoney && <span className="text-slate-400 text-sm">$</span>}
                                            <input
                                                type="number"
                                                min={0}
                                                step={isMoney ? 0.01 : 1}
                                                value={it.target_amount}
                                                disabled={locked}
                                                onChange={(e) =>
                                                    updateAmount(it.product_type, it.sale_type, e.target.value)
                                                }
                                                className="w-32 bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                            />
                                            {!isMoney && <span className="text-slate-500 text-xs">u</span>}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {items.length === 0 && !loading && (
                            <tr>
                                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                                    Sin datos
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={() => void handleSave()}
                    disabled={locked || saving || !vendorId}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 text-sm font-medium transition-colors"
                >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? "Guardando..." : "Guardar metas"}
                </button>
            </div>
        </div>
    );
}
