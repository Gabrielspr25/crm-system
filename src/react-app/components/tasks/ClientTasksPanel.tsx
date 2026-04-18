import { Loader2, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/react-app/utils/auth";

type ColumnKey =
  | "fijo_ren"
  | "fijo_new"
  | "movil_new"
  | "movil_ren"
  | "clarotv"
  | "cloud"
  | "mpls";

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
  is_active?: boolean | number | null;
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

interface MatrixValues {
  fijo_ren: number;
  fijo_new: number;
  movil_new: number;
  movil_ren: number;
  clarotv: number;
  cloud: number;
  mpls: number;
}

const MATRIX_COLUMNS: Array<{
  key: ColumnKey;
  label: string;
}> = [
  { key: "fijo_ren", label: "Fijo Ren" },
  { key: "fijo_new", label: "Fijo New" },
  { key: "movil_new", label: "Movil New" },
  { key: "movil_ren", label: "Movil Ren" },
  { key: "clarotv", label: "ClaroTV" },
  { key: "cloud", label: "Cloud" },
  { key: "mpls", label: "MPLS" }
];

const EMPTY_MATRIX: MatrixValues = {
  fijo_ren: 0,
  fijo_new: 0,
  movil_new: 0,
  movil_ren: 0,
  clarotv: 0,
  cloud: 0,
  mpls: 0
};

function normalizeNumericValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMatrixValue(value: number) {
  return normalizeNumericValue(value).toFixed(2);
}

function normalizeStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isSubscriberActive(subscriber: SubscriberLike) {
  const normalized = normalizeStatus(subscriber.status);
  return !["cancelado", "cancelled", "inactivo", "no_renueva_ahora"].includes(normalized);
}

function normalizeLineType(value: unknown) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "REN" || normalized === "RENOVACION" || normalized === "RENEWAL") return "REN";
  if (normalized === "NEW" || normalized === "NUEVA") return "NEW";
  return "";
}

function resolveMatrixKey(subscriber: SubscriberLike, ban: BanLike): ColumnKey {
  const haystack = [
    ban.account_type,
    ban.description,
    subscriber.service_type,
    subscriber.plan
  ]
    .map((entry) => String(entry || "").trim().toUpperCase())
    .filter(Boolean)
    .join(" ");

  if (haystack.includes("MPLS")) return "mpls";
  if (haystack.includes("CLOUD")) return "cloud";
  if (
    haystack.includes("CLARO TV")
    || haystack.includes("CLAROTV")
    || (haystack.includes("CLARO") && haystack.includes("TV"))
  ) {
    return "clarotv";
  }

  const phone = String(subscriber.phone || "").trim().toUpperCase();
  const accountType = String(ban.account_type || "").trim().toUpperCase();
  const lineType = normalizeLineType((subscriber as { line_type?: string | null }).line_type);
  const isRen = lineType === "REN";
  const isFijo =
    accountType.includes("FIJO")
    || accountType.includes("FIXED")
    || phone.startsWith("FIJO-");

  if (isFijo) {
    return isRen ? "fijo_ren" : "fijo_new";
  }

  return isRen ? "movil_ren" : "movil_new";
}

function buildDetectedMatrix(bans: BanLike[]) {
  const counts: MatrixValues = { ...EMPTY_MATRIX };
  let activeLines = 0;
  let activeBans = 0;

  bans.forEach((ban) => {
    const subscribers = Array.isArray(ban.subscribers) ? ban.subscribers : [];
    const activeSubscribers = subscribers.filter(isSubscriberActive);
    if (activeSubscribers.length > 0) {
      activeBans += 1;
    }
    activeSubscribers.forEach((subscriber) => {
      activeLines += 1;
      counts[resolveMatrixKey(subscriber, ban)] += 1;
    });
  });

  return {
    counts,
    activeLines,
    activeBans
  };
}

function mapProspectToMatrix(prospect: FollowUpProspect | null): MatrixValues {
  if (!prospect) return { ...EMPTY_MATRIX };
  return {
    fijo_ren: normalizeNumericValue(prospect.fijo_ren),
    fijo_new: normalizeNumericValue(prospect.fijo_new),
    movil_new: normalizeNumericValue(prospect.movil_nueva),
    movil_ren: normalizeNumericValue(prospect.movil_renovacion),
    clarotv: normalizeNumericValue(prospect.claro_tv),
    cloud: normalizeNumericValue(prospect.cloud),
    mpls: normalizeNumericValue(prospect.mpls)
  };
}

async function requestJson<T>(url: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...rest } = init;
  const response = await authFetch(url, json !== undefined ? { ...rest, json } : rest);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Error de red" }));
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function prospectSortValue(prospect: FollowUpProspect) {
  return new Date(prospect.updated_at || prospect.created_at || 0).getTime();
}

function isActiveProspect(prospect: FollowUpProspect | null) {
  if (!prospect) return false;
  if (prospect.completed_date) return false;
  const raw = prospect.is_active;
  if (raw === null || raw === undefined) return true;
  if (typeof raw === "boolean") return raw;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "t";
}

export default function ClientTasksPanel({ client }: ClientTasksPanelProps) {
  const bans = useMemo(() => Array.isArray(client.bans) ? client.bans : [], [client.bans]);
  const detected = useMemo(() => buildDetectedMatrix(bans), [bans]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeProspect, setActiveProspect] = useState<FollowUpProspect | null>(null);
  const [draft, setDraft] = useState<MatrixValues>({ ...detected.counts });

  const loadProspect = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const prospects = await requestJson<FollowUpProspect[]>("/api/follow-up-prospects?include_completed=true");
      const clientProspects = (Array.isArray(prospects) ? prospects : [])
        .filter((prospect) => String(prospect.client_id || "") === String(client.id))
        .sort((a, b) => prospectSortValue(b) - prospectSortValue(a));

      const current = clientProspects.find(isActiveProspect) || null;
      setActiveProspect(current);
      setDraft(current ? mapProspectToMatrix(current) : { ...detected.counts });
    } catch (fetchError) {
      console.error("Error cargando seguimiento del cliente:", fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "No se pudo cargar el seguimiento");
      setActiveProspect(null);
      setDraft({ ...detected.counts });
    } finally {
      setLoading(false);
    }
  }, [client.id, detected.counts]);

  useEffect(() => {
    void loadProspect();
  }, [loadProspect]);

  const draftLineCount = useMemo(
    () => MATRIX_COLUMNS.reduce((acc, column) => acc + normalizeNumericValue(draft[column.key]), 0),
    [draft]
  );

  const completedLabel = activeProspect?.completed_date
    ? new Date(activeProspect.completed_date).toLocaleDateString("es-PR", { day: "2-digit", month: "short", year: "numeric" })
    : "-";

  const handleDraftChange = useCallback((key: ColumnKey, raw: string) => {
    const parsed = Number(raw);
    setDraft((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    }));
  }, []);

  const handleResetToDetected = useCallback(() => {
    setDraft({ ...detected.counts });
    setMessage("Valores editables restablecidos desde suscriptores activos.");
  }, [detected.counts]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    const payload = {
      company_name: String(client.business_name || client.name || "Cliente").trim(),
      client_id: Number(client.id),
      vendor_id: client.vendor_id ?? undefined,
      fijo_ren: normalizeNumericValue(draft.fijo_ren),
      fijo_new: normalizeNumericValue(draft.fijo_new),
      movil_nueva: normalizeNumericValue(draft.movil_new),
      movil_renovacion: normalizeNumericValue(draft.movil_ren),
      claro_tv: normalizeNumericValue(draft.clarotv),
      cloud: normalizeNumericValue(draft.cloud),
      mpls: normalizeNumericValue(draft.mpls),
      is_active: true,
      is_completed: false
    };

    try {
      let saved: FollowUpProspect;
      if (activeProspect?.id) {
        saved = await requestJson<FollowUpProspect>(`/api/follow-up-prospects/${activeProspect.id}`, {
          method: "PUT",
          json: payload
        });
      } else {
        saved = await requestJson<FollowUpProspect>("/api/follow-up-prospects", {
          method: "POST",
          json: payload
        });
      }

      setActiveProspect(saved);
      setDraft(mapProspectToMatrix(saved));
      setMessage(activeProspect?.id ? "Seguimiento actualizado." : "Seguimiento creado desde Pasos.");
    } catch (saveError) {
      console.error("Error guardando seguimiento desde Pasos:", saveError);
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el seguimiento");
    } finally {
      setSaving(false);
    }
  }, [activeProspect?.id, client.business_name, client.id, client.name, client.vendor_id, draft]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Cargando pasos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Pasos por suscriptores activos</h3>
            <p className="mt-1 text-sm text-slate-400">
              La fila <span className="text-cyan-300">Detectado</span> sale del tab BANs y Suscriptores.
              La fila <span className="text-violet-300">Seguimiento</span> es editable y se guarda en Seguimiento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleResetToDetected}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
            >
              <RefreshCw className="h-4 w-4" />
              Usar detectado
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">BANs activas</div>
            <div className="mt-1 text-2xl font-bold text-white">{detected.activeBans}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Lineas activas</div>
            <div className="mt-1 text-2xl font-bold text-cyan-300">{detected.activeLines}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Lineas en seguimiento</div>
            <div className="mt-1 text-2xl font-bold text-violet-300">{formatMatrixValue(draftLineCount)}</div>
          </div>
        </div>

        {message && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-slate-800/80">
              <tr>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fila</th>
                {MATRIX_COLUMNS.map((column) => (
                  <th key={column.key} className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                    {column.label}
                  </th>
                ))}
                <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-violet-300">Completado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr className="bg-cyan-500/5">
                <td className="px-3 py-3">
                  <div className="text-sm font-semibold text-cyan-200">Detectado</div>
                  <div className="text-xs text-slate-500">Suscriptores activos del cliente</div>
                </td>
                {MATRIX_COLUMNS.map((column) => (
                  <td key={`detected-${column.key}`} className="px-2 py-3 text-center">
                    <span className="text-sm font-semibold text-slate-100">
                      {formatMatrixValue(detected.counts[column.key])}
                    </span>
                  </td>
                ))}
                <td className="px-2 py-3 text-center text-sm text-slate-500">-</td>
              </tr>

              <tr className="bg-violet-500/5">
                <td className="px-3 py-3">
                  <div className="text-sm font-semibold text-violet-200">Seguimiento</div>
                  <div className="text-xs text-slate-500">
                    {activeProspect?.id ? `Prospecto #${activeProspect.id}` : "Aun no guardado en seguimiento"}
                  </div>
                </td>
                {MATRIX_COLUMNS.map((column) => (
                  <td key={`draft-${column.key}`} className="px-2 py-3 text-center">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft[column.key]}
                      onChange={(event) => handleDraftChange(column.key, event.target.value)}
                      className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-center text-sm font-semibold text-white outline-none focus:border-violet-500"
                    />
                  </td>
                ))}
                <td className="px-2 py-3 text-center text-sm text-violet-200">{completedLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
