import { useMemo, useRef, useState } from "react";
import {
  Upload,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";

// ─── Tipos ──────────────────────────────────────────────────────────────────

type ValidationState = "ok" | "invalid" | "missing";

interface BackendRow {
  phone: string | null;
  status: string | null;
  campaign: string | null;
  validations: {
    phone: ValidationState;
    status: ValidationState;
    campaign: ValidationState;
  };
  duplicate: boolean;
  canImport: boolean;
}

interface BackendResponse {
  rawText: string;
  rows: BackendRow[];
}

interface EditableRow {
  id: string;
  phone: string;
  status: string;
  campaign: string;
  validations: {
    phone: ValidationState;
    status: ValidationState;
    campaign: ValidationState;
  };
  duplicate: boolean;
  canImport: boolean;
}

// ─── Validación cliente (replica de ocrValidationService.js) ────────────────

const VALID_STATUSES = new Set([
  "Active",
  "Inactive",
  "Suspended",
  "Pending",
  "Cancelled",
  "Disconnected",
]);

function validatePhone(phone: string): ValidationState {
  if (!phone || !phone.trim()) return "missing";
  if (!/^\d{10}$/.test(phone.trim())) return "invalid";
  return "ok";
}

function validateStatus(status: string): ValidationState {
  if (!status || !status.trim()) return "missing";
  if (!VALID_STATUSES.has(status.trim())) return "invalid";
  return "ok";
}

function validateCampaign(campaign: string): ValidationState {
  if (!campaign || !campaign.trim()) return "missing";
  if (!/^[A-Z0-9]{4,16}$/.test(campaign.trim())) return "invalid";
  return "ok";
}

function recomputeValidations(rows: EditableRow[]): EditableRow[] {
  const phoneCounts = new Map<string, number>();
  for (const r of rows) {
    const p = (r.phone || "").trim();
    if (!p) continue;
    phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1);
  }

  return rows.map((r) => {
    const validations = {
      phone: validatePhone(r.phone),
      status: validateStatus(r.status),
      campaign: validateCampaign(r.campaign),
    };
    const duplicate = r.phone ? (phoneCounts.get(r.phone.trim()) || 0) > 1 : false;
    const canImport =
      validations.phone === "ok" &&
      validations.status === "ok" &&
      validations.campaign === "ok" &&
      !duplicate;
    return { ...r, validations, duplicate, canImport };
  });
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

function StatePill({ state }: { state: ValidationState }) {
  const map: Record<ValidationState, string> = {
    ok: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    invalid: "bg-red-500/20 text-red-300 border-red-500/40",
    missing: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  };
  const label: Record<ValidationState, string> = {
    ok: "ok",
    invalid: "inválido",
    missing: "vacío",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${map[state]}`}>
      {label[state]}
    </span>
  );
}

function CellInput({
  value,
  onChange,
  state,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  state: ValidationState;
  placeholder?: string;
}) {
  const border =
    state === "ok"
      ? "border-slate-700 focus:border-slate-500"
      : "border-red-500/60 focus:border-red-400";
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-slate-900/60 ${border} rounded-md px-2 py-1 text-sm text-slate-100 placeholder-slate-500 outline-none transition`}
    />
  );
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function OcrImportPreview() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const [rawOpen, setRawOpen] = useState(false);
  const [rows, setRows] = useState<EditableRow[]>([]);

  const totals = useMemo(() => {
    const total = rows.length;
    const importables = rows.filter((r) => r.canImport).length;
    const conErrores = total - importables;
    return { total, importables, conErrores };
  }, [rows]);

  function pickFile(f: File | null) {
    setFile(f);
    setError(null);
  }

  async function handleUpload() {
    if (!file) {
      setError("Selecciona una imagen primero.");
      return;
    }
    setLoading(true);
    setError(null);
    setRows([]);
    setRawText("");

    try {
      const fd = new FormData();
      fd.append("image", file);

      const res = await authFetch("/api/ocr/preview", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200) || "sin detalle"}`);
      }

      const data = (await res.json()) as BackendResponse;
      setRawText(data.rawText || "");

      const editable: EditableRow[] = (data.rows || []).map((r, i) => ({
        id: `${Date.now()}-${i}`,
        phone: r.phone ?? "",
        status: r.status ?? "",
        campaign: r.campaign ?? "",
        validations: r.validations,
        duplicate: r.duplicate,
        canImport: r.canImport,
      }));
      setRows(editable);
    } catch (e: any) {
      setError(e?.message || "Error procesando la imagen.");
    } finally {
      setLoading(false);
    }
  }

  function updateCell(id: string, field: "phone" | "status" | "campaign", value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function revalidateLocal() {
    setRows((prev) => recomputeValidations(prev));
  }

  function resetAll() {
    setFile(null);
    setRawText("");
    setRows([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">OCR Import Preview</h1>
            <p className="text-sm text-slate-400">
              Fase 2 — Sube un screenshot, revisa el texto extraído y edita antes de importar.
              No se guarda nada en la base de datos.
            </p>
          </div>
          <button
            onClick={resetAll}
            className="text-sm text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-md px-3 py-1.5"
          >
            Limpiar
          </button>
        </header>

        {/* Upload */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="block text-sm text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-slate-800 file:text-slate-100 hover:file:bg-slate-700"
            />
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {loading ? "Procesando OCR…" : "Procesar imagen"}
            </button>
            {file && !loading && (
              <span className="text-xs text-slate-400 truncate">
                {file.name} ({Math.round(file.size / 1024)} KB)
              </span>
            )}
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-md p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* Raw text colapsable */}
        {rawText && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/60">
            <button
              onClick={() => setRawOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium hover:bg-slate-900/80"
            >
              <span>Texto crudo (rawText)</span>
              {rawOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {rawOpen && (
              <pre className="px-5 pb-5 text-xs text-slate-300 whitespace-pre-wrap break-words">
                {rawText}
              </pre>
            )}
          </section>
        )}

        {/* Tabla editable */}
        {rows.length > 0 && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <div className="text-sm text-slate-300">
                {totals.total} filas — <span className="text-emerald-400">{totals.importables} ok</span>{" "}
                / <span className="text-red-400">{totals.conErrores} con errores</span>
              </div>
              <button
                onClick={revalidateLocal}
                className="inline-flex items-center gap-2 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Validar nuevamente
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="text-left px-4 py-2">Teléfono</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Campaña</th>
                    <th className="text-left px-4 py-2">Validación</th>
                    <th className="text-left px-4 py-2">Duplicado</th>
                    <th className="text-left px-4 py-2">canImport</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const rowBg = r.canImport
                      ? "bg-transparent"
                      : "bg-red-500/5 border-l-2 border-red-500/40";
                    return (
                      <tr key={r.id} className={`border-t border-slate-800 ${rowBg}`}>
                        <td className="px-4 py-2 align-top w-44">
                          <CellInput
                            value={r.phone}
                            state={r.validations.phone}
                            onChange={(v) => updateCell(r.id, "phone", v)}
                            placeholder="10 dígitos"
                          />
                        </td>
                        <td className="px-4 py-2 align-top w-40">
                          <CellInput
                            value={r.status}
                            state={r.validations.status}
                            onChange={(v) => updateCell(r.id, "status", v)}
                            placeholder="Active / Inactive…"
                          />
                        </td>
                        <td className="px-4 py-2 align-top w-44">
                          <CellInput
                            value={r.campaign}
                            state={r.validations.campaign}
                            onChange={(v) => updateCell(r.id, "campaign", v)}
                            placeholder="BREDSF3"
                          />
                        </td>
                        <td className="px-4 py-2 align-top">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-xs text-slate-500">tel</span>
                            <StatePill state={r.validations.phone} />
                            <span className="text-xs text-slate-500 ml-2">st</span>
                            <StatePill state={r.validations.status} />
                            <span className="text-xs text-slate-500 ml-2">camp</span>
                            <StatePill state={r.validations.campaign} />
                          </div>
                        </td>
                        <td className="px-4 py-2 align-top">
                          {r.duplicate ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                              duplicado
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">no</span>
                          )}
                        </td>
                        <td className="px-4 py-2 align-top">
                          {r.canImport ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                              <Check className="w-4 h-4" /> sí
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-400 text-xs">
                              <X className="w-4 h-4" /> no
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 text-xs text-slate-500 border-t border-slate-800">
              Edita los campos arriba y presiona <strong>Validar nuevamente</strong> para recalcular el estado en pantalla.
              La importación todavía no está habilitada en esta fase.
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
