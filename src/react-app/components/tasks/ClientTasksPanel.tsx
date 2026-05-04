import { CheckCircle2, Circle, Eye, EyeOff, Loader2, RefreshCw, ZapOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "@/react-app/utils/auth";

type ColumnKey = "fijo_ren" | "fijo_new" | "movil_new" | "movil_ren" | "clarotv" | "cloud" | "mpls";

interface SubscriberLike {
  id: number | string;
  phone?: string | null;
  plan?: string | null;
  service_type?: string | null;
  status?: string | null;
  line_type?: string | null;
}

interface BanLike {
  id: number | string;
  ban_number?: string | null;
  description?: string | null;
  account_type?: string | null;
  subscribers?: SubscriberLike[] | null;
}

interface ClientTasksPanelProps {
  client: {
    id: string | number;
    name?: string | null;
    business_name?: string | null;
    vendor_id?: number | null;
    salesperson_id?: string | number | null;
    bans?: BanLike[] | null;
  };
}

interface FollowUpProspect {
  id: number;
  client_id: number | string | null;
  vendor_id: number | null;
  is_active?: boolean | null;
  completed_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  fijo_ren?: number | null;
  fijo_new?: number | null;
  movil_nueva?: number | null;
  movil_renovacion?: number | null;
  claro_tv?: number | null;
  cloud?: number | null;
  mpls?: number | null;
}

interface DealTask {
  id: number;
  step_name: string;
  step_order: number;
  status: "pending" | "in_progress" | "done";
  due_date?: string | null;
}

interface Deal {
  id: number;
  product_type: string;
  sale_type: string;
  tasks: DealTask[];
}

interface MatrixValues {
  fijo_ren: number; fijo_new: number; movil_new: number; movil_ren: number;
  clarotv: number; cloud: number; mpls: number;
}

const MATRIX_COLUMNS: Array<{ key: ColumnKey; label: string; color: string }> = [
  { key: "fijo_ren",  label: "Fijo Ren",  color: "blue" },
  { key: "fijo_new",  label: "Fijo New",  color: "blue" },
  { key: "movil_new", label: "Movil New", color: "emerald" },
  { key: "movil_ren", label: "Movil Ren", color: "emerald" },
  { key: "clarotv",   label: "ClaroTV",   color: "purple" },
  { key: "cloud",     label: "Cloud",     color: "cyan" },
  { key: "mpls",      label: "MPLS",      color: "orange" },
];

const EMPTY_MATRIX: MatrixValues = { fijo_ren: 0, fijo_new: 0, movil_new: 0, movil_ren: 0, clarotv: 0, cloud: 0, mpls: 0 };

const DEAL_LABELS: Record<string, string> = {
  FIJO_NEW: "Fijo Nueva", FIJO_REN: "Fijo Ren", MOVIL_NEW: "Móvil Nueva",
  MOVIL_REN: "Móvil Ren", CLARO_TV_NEW: "ClaroTV", CLOUD_NEW: "Cloud", MPLS_NEW: "MPLS",
};

function dealColKey(deal: Deal): ColumnKey | null {
  if (deal.product_type === "FIJO" && deal.sale_type === "REN") return "fijo_ren";
  if (deal.product_type === "FIJO" && deal.sale_type === "NEW") return "fijo_new";
  if (deal.product_type === "MOVIL" && deal.sale_type === "NEW") return "movil_new";
  if (deal.product_type === "MOVIL" && deal.sale_type === "REN") return "movil_ren";
  if (deal.product_type === "CLARO_TV") return "clarotv";
  if (deal.product_type === "CLOUD") return "cloud";
  if (deal.product_type === "MPLS") return "mpls";
  return null;
}

function dealLabel(deal: Deal) {
  return DEAL_LABELS[`${deal.product_type}_${deal.sale_type}`] || `${deal.product_type} ${deal.sale_type}`;
}

function norm(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function isSubscriberActive(s: SubscriberLike) {
  return !["cancelado", "cancelled", "inactivo", "no_renueva_ahora"].includes(String(s.status || "").trim().toLowerCase());
}

function resolveKey(sub: SubscriberLike, ban: BanLike): ColumnKey {
  const h = [ban.account_type, ban.description, sub.service_type, sub.plan]
    .map((e) => String(e || "").trim().toUpperCase()).filter(Boolean).join(" ");
  if (h.includes("MPLS")) return "mpls";
  if (h.includes("CLOUD")) return "cloud";
  if (h.includes("CLARO TV") || h.includes("CLAROTV") || (h.includes("CLARO") && h.includes("TV"))) return "clarotv";
  const at = String(ban.account_type || "").trim().toUpperCase();
  const lt = String((sub as { line_type?: string | null }).line_type || "").trim().toUpperCase();
  const isRen = lt === "REN" || lt === "RENOVACION" || lt === "RENEWAL";
  const isFijo = at.includes("FIJO") || at.includes("FIXED") || String(sub.phone || "").toUpperCase().startsWith("FIJO-");
  if (isFijo) return isRen ? "fijo_ren" : "fijo_new";
  return isRen ? "movil_ren" : "movil_new";
}

function buildDetected(bans: BanLike[]) {
  const counts = { ...EMPTY_MATRIX };
  let lines = 0, activeBans = 0;
  bans.forEach((ban) => {
    const subs = (Array.isArray(ban.subscribers) ? ban.subscribers : []).filter(isSubscriberActive);
    if (subs.length) activeBans++;
    subs.forEach((s) => { lines++; counts[resolveKey(s, ban)]++; });
  });
  return { counts, lines, activeBans };
}

function prospectToMatrix(p: FollowUpProspect | null): MatrixValues {
  if (!p) return { ...EMPTY_MATRIX };
  return { fijo_ren: norm(p.fijo_ren), fijo_new: norm(p.fijo_new), movil_new: norm(p.movil_nueva), movil_ren: norm(p.movil_renovacion), clarotv: norm(p.claro_tv), cloud: norm(p.cloud), mpls: norm(p.mpls) };
}

async function rq<T>(url: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...rest } = init;
  const r = await authFetch(url, json !== undefined ? { ...rest, json } : rest);
  if (!r.ok) { const p = await r.json().catch(() => ({ error: "Error" })); throw new Error(p?.error || `HTTP ${r.status}`); }
  return r.json() as Promise<T>;
}

function isActivePx(p: FollowUpProspect | null) {
  if (!p || p.completed_date) return false;
  if (p.is_active === null || p.is_active === undefined) return true;
  return p.is_active === true;
}

const TASK_ICON = {
  done: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
  in_progress: <Circle className="w-3.5 h-3.5 text-blue-400 fill-blue-400/30 shrink-0" />,
  pending: <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />,
};

export default function ClientTasksPanel({ client }: ClientTasksPanelProps) {
  const bans = useMemo(() => (Array.isArray(client.bans) ? client.bans : []), [client.bans]);
  const detected = useMemo(() => buildDetected(bans), [bans]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [togglingTask, setTogglingTask] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prospect, setProspect] = useState<FollowUpProspect | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [draft, setDraft] = useState<MatrixValues>({ ...detected.counts });
  const [hiddenCols, setHiddenCols] = useState<Set<ColumnKey>>(new Set());

  const draftRef = useRef(draft);
  const prospectRef = useRef(prospect);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { prospectRef.current = prospect; }, [prospect]);

  const reloadDeals = useCallback(async () => {
    const updated = await rq<Deal[]>(`/api/clients/${client.id}/deals`).catch(() => []);
    setDeals(Array.isArray(updated) ? updated : []);
  }, [client.id]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prospects, clientDeals] = await Promise.all([
        rq<FollowUpProspect[]>("/api/follow-up-prospects?include_completed=true"),
        rq<Deal[]>(`/api/clients/${client.id}/deals`).catch(() => []),
      ]);
      const mine = (Array.isArray(prospects) ? prospects : [])
        .filter((p) => String(p.client_id || "") === String(client.id))
        .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
      const cur = mine.find(isActivePx) || null;
      setProspect(cur);
      setDraft(cur ? prospectToMatrix(cur) : { ...detected.counts });
      setDeals(Array.isArray(clientDeals) ? clientDeals : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, [client.id, detected.counts]);

  useEffect(() => { void loadData(); }, [loadData]);

  const triggerSync = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const cur = draftRef.current;
      const px = prospectRef.current;
      const sellerId = String(client.salesperson_id || client.vendor_id || "").trim();
      if (!sellerId) return;
      setSyncing(true);
      setError(null);
      try {
        const payload = {
          company_name: String(client.business_name || client.name || "Cliente").trim(),
          client_id: Number(client.id),
          vendor_id: client.vendor_id ?? undefined,
          fijo_ren: norm(cur.fijo_ren), fijo_new: norm(cur.fijo_new),
          movil_nueva: norm(cur.movil_new), movil_renovacion: norm(cur.movil_ren),
          claro_tv: norm(cur.clarotv), cloud: norm(cur.cloud), mpls: norm(cur.mpls),
          is_active: true, is_completed: false,
        };
        let saved: FollowUpProspect;
        if (px?.id) {
          saved = await rq<FollowUpProspect>(`/api/follow-up-prospects/${px.id}`, { method: "PUT", json: payload });
        } else {
          saved = await rq<FollowUpProspect>("/api/follow-up-prospects", { method: "POST", json: payload });
        }
        setProspect(saved);
        prospectRef.current = saved;
        await rq(`/api/clients/${client.id}/sync`, { method: "POST", json: { seller_id: sellerId } });
        await reloadDeals();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al sincronizar");
      } finally {
        setSyncing(false);
      }
    }, 800);
  }, [client, reloadDeals]);

  const handleChange = useCallback((key: ColumnKey, raw: string) => {
    const v = Math.max(0, Number(raw) || 0);
    setDraft((prev) => { const n = { ...prev, [key]: v }; draftRef.current = n; return n; });
    triggerSync();
  }, [triggerSync]);

  const handleReset = useCallback(() => {
    const n = { ...detected.counts };
    setDraft(n);
    draftRef.current = n;
    triggerSync();
  }, [detected.counts, triggerSync]);

  const hide = useCallback((k: ColumnKey) => setHiddenCols((p) => new Set([...p, k])), []);
  const show = useCallback((k: ColumnKey) => setHiddenCols((p) => { const n = new Set(p); n.delete(k); return n; }), []);

  const handleToggle = useCallback(async (task: DealTask) => {
    const next = task.status === "done" ? "pending" : "done";
    setTogglingTask(task.id);
    try {
      await rq(`/api/deal-tasks/${task.id}`, { method: "PATCH", json: { status: next } });
      await reloadDeals();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error actualizando tarea");
    } finally {
      setTogglingTask(null);
    }
  }, [reloadDeals]);

  const handleDueDate = useCallback(async (task: DealTask, date: string) => {
    try {
      await rq(`/api/deal-tasks/${task.id}`, { method: "PATCH", json: { status: task.status, due_date: date || null } });
      await reloadDeals();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error actualizando fecha");
    }
  }, [reloadDeals]);

  const visibleCols = useMemo(() => MATRIX_COLUMNS.filter((c) => !hiddenCols.has(c.key)), [hiddenCols]);
  const hiddenColsList = useMemo(() => MATRIX_COLUMNS.filter((c) => hiddenCols.has(c.key)), [hiddenCols]);

  // Map colKey -> deal
  const dealByKey = useMemo(() => {
    const map: Partial<Record<ColumnKey, Deal>> = {};
    deals.forEach((d) => { const k = dealColKey(d); if (k) map[k] = d; });
    return map;
  }, [deals]);

  const maxSteps = useMemo(() =>
    Math.max(0, ...Object.values(dealByKey).map((d) => d?.tasks.length ?? 0)),
  [dealByKey]);

  const stepRows = useMemo(() => Array.from({ length: maxSteps }, (_, i) => i + 1), [maxSteps]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Cargando pasos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              Pasos por suscriptores activos
              {syncing && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {detected.activeBans} BANs · {detected.lines} líneas activas
              {prospect?.id && ` · Prospecto #${prospect.id}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hiddenColsList.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-500">Ocultos:</span>
              {hiddenColsList.map((c) => (
                <button key={c.key} type="button" onClick={() => show(c.key)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
                  <Eye className="w-3 h-3" />{c.label}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
            <RefreshCw className="h-3.5 w-3.5" />Usar detectado
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
      )}

      {/* Grid unificada */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/60">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col style={{ width: "2rem" }} />
            {visibleCols.map((c) => <col key={c.key} />)}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/80">
              {/* Columna # */}
              <th className="px-2 py-3 text-center text-[10px] font-semibold uppercase text-slate-500">#</th>
              {visibleCols.map((col) => {
                const deal = dealByKey[col.key];
                const done = deal?.tasks.filter((t) => t.status === "done").length ?? 0;
                const total = deal?.tasks.length ?? 0;
                const allDone = total > 0 && done === total;
                return (
                  <th key={col.key} className={`px-3 py-2 text-center border-l border-slate-700/50`}>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-xs font-bold text-${col.color}-300`}>{col.label}</span>
                      <button type="button" onClick={() => hide(col.key)} title="Ocultar"
                        className="text-slate-600 hover:text-slate-400 transition-colors">
                        <EyeOff className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500">
                        Det: <span className="text-cyan-400 font-semibold">{detected.counts[col.key]}</span>
                      </span>
                      {allDone && <span className="text-[10px] text-emerald-400 font-semibold">{done}/{total} ✓</span>}
                      {!allDone && total > 0 && <span className="text-[10px] text-slate-500">{done}/{total}</span>}
                    </div>
                    <input
                      type="number" min="0" step="1"
                      value={draft[col.key]}
                      onChange={(e) => handleChange(col.key, e.target.value)}
                      className="mt-1.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-center text-sm font-semibold text-white outline-none focus:border-violet-500"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {maxSteps === 0 ? (
              <tr>
                <td colSpan={visibleCols.length + 1} className="py-12 text-center">
                  <ZapOff className="mx-auto h-8 w-8 text-slate-700 mb-2" />
                  <p className="text-sm text-slate-500">Ingresá un valor en Seguimiento para generar los pasos.</p>
                </td>
              </tr>
            ) : (
              stepRows.map((step) => (
                <tr key={step} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-2 py-2 text-center text-[10px] text-slate-600 font-mono">{step}</td>
                  {visibleCols.map((col) => {
                    const deal = dealByKey[col.key];
                    const task = deal?.tasks.find((t) => t.step_order === step);
                    if (!task) {
                      return <td key={col.key} className="border-l border-slate-700/30 px-2 py-2" />;
                    }
                    return (
                      <td key={col.key} className="border-l border-slate-700/30 px-1 py-1">
                        <button
                          type="button"
                          disabled={togglingTask === task.id}
                          onClick={() => void handleToggle(task)}
                          className="w-full flex items-start gap-1.5 px-2 py-1.5 rounded hover:bg-slate-800/60 transition-colors text-left"
                        >
                          <span className="mt-0.5">
                            {togglingTask === task.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />
                              : TASK_ICON[task.status]}
                          </span>
                          <span className={`text-xs leading-snug ${
                            task.status === "done" ? "text-slate-600 line-through" :
                            task.status === "in_progress" ? "text-white font-medium" : "text-slate-400"
                          }`}>
                            {task.step_name}
                          </span>
                        </button>
                        <input
                          type="date"
                          value={task.due_date ?? ""}
                          onChange={(e) => void handleDueDate(task, e.target.value)}
                          className={`w-full mt-0.5 px-2 py-0.5 rounded text-[10px] bg-transparent border outline-none ${
                            task.due_date && task.status !== "done" && task.due_date < new Date().toISOString().slice(0, 10)
                              ? "border-red-500/50 text-red-400"
                              : "border-slate-700 text-slate-500"
                          } focus:border-violet-500`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
