import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Eye,
  Loader2,
  Save,
  Upload
} from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";
import { extractSubscriberTextFromImage } from "@/react-app/utils/subscriberImageExtractor";

type SyncPreviewRow = {
  line_no: number;
  raw_line: string;
  phone: string | null;
  status_norm: string | null;
  plan_code: string | null;
  action: string;
  warning: string | null;
};

type SyncStats = {
  total_lines: number;
  valid_rows: number;
  ignored_100_prefix: number;
  invalid_lines: number;
  duplicated_in_paste: number;
  conflicts_other_ban: number;
  inserted: number;
  updated: number;
  canceled: number;
  unchanged: number;
};

type SyncResponse = {
  ok: boolean;
  dry_run: boolean;
  stats: SyncStats;
  rows: SyncPreviewRow[];
  warnings: string[];
  error?: string;
};

function extractTableFromHtml(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const rows = doc.querySelectorAll("tr");
    if (rows.length > 0) {
      return Array.from(rows)
        .map((row) => {
          const cells = row.querySelectorAll("td, th");
          return Array.from(cells)
            .map((cell) => (cell.textContent ?? "").trim())
            .join("\t");
        })
        .filter((line) => line.trim())
        .join("\n");
    }

    return (doc.body?.textContent ?? "").trim();
  } catch {
    return "";
  }
}

const initialStats: SyncStats = {
  total_lines: 0,
  valid_rows: 0,
  ignored_100_prefix: 0,
  invalid_lines: 0,
  duplicated_in_paste: 0,
  conflicts_other_ban: 0,
  inserted: 0,
  updated: 0,
  canceled: 0,
  unchanged: 0
};

export default function SubscriberBanSync() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [banNumber, setBanNumber] = useState("");
  const [clipboardText, setClipboardText] = useState("");
  const [ocrRawText, setOcrRawText] = useState("");
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<SyncPreviewRow[]>([]);
  const [stats, setStats] = useState<SyncStats>(initialStats);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const hasBlockingIssues = useMemo(() => {
    return stats.invalid_lines > 0 || stats.conflicts_other_ban > 0;
  }, [stats.conflicts_other_ban, stats.invalid_lines]);
  const hasPreview = useMemo(() => {
    return stats.total_lines > 0 || previewRows.length > 0 || warnings.length > 0;
  }, [previewRows.length, stats.total_lines, warnings.length]);

  const resetResult = () => {
    setPreviewRows([]);
    setStats(initialStats);
    setWarnings([]);
    setError("");
  };

  const replaceImportedText = (nextText: string) => {
    setClipboardText(nextText.trim());
    resetResult();
  };

  const extractFromImage = async (file: File) => {
    setOcrLoading(true);
    setError("");
    try {
      const extracted = await extractSubscriberTextFromImage(file);
      const text = extracted.text?.trim() ?? "";
      setOcrRawText(extracted.rawText?.trim() || "");
      setOcrWarnings(Array.isArray(extracted.warnings) ? extracted.warnings : []);
      if (!text) {
        setError("No se pudo leer texto en la imagen.");
        return;
      }
      replaceImportedText(text);
    } catch (e) {
      console.error("OCR error:", e);
      setError((e as Error)?.message || "Fallo OCR. Intenta con una imagen mas clara.");
    } finally {
      setOcrLoading(false);
    }
  };

  const requestSync = async (dryRun: boolean) => {
    if (!banNumber.trim()) {
      setError("Debes indicar el BAN.");
      return;
    }
    if (!clipboardText.trim()) {
      setError("Debes pegar texto o extraer desde imagen.");
      return;
    }
    if (!dryRun && !hasPreview) {
      setError("Primero ejecuta Previsualizar.");
      return;
    }

    if (dryRun) {
      setPreviewLoading(true);
    } else {
      setSyncLoading(true);
    }
    setError("");

    try {
      const res = await authFetch("/api/subscribers/paste-sync", {
        method: "POST",
        json: {
          ban_number: banNumber.trim(),
          clipboard_text: clipboardText,
          dry_run: dryRun
        }
      });

      const data = (await res.json()) as SyncResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || "Fallo de sincronizacion.");
        return;
      }

      setPreviewRows(Array.isArray(data.rows) ? data.rows : []);
      setStats(data.stats ?? initialStats);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
    } catch (e) {
      console.error("sync error:", e);
      setError("No se pudo conectar con el backend.");
    } finally {
      setPreviewLoading(false);
      setSyncLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <h1 className="text-xl font-bold text-slate-100">Suscriptores BAN</h1>
        <p className="mt-1 text-sm text-slate-400">
          Subes imagen o pegas texto. El modulo actualiza existentes, cancela cancelados y agrega faltantes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            BAN
          </label>
          <input
            value={banNumber}
            onChange={(e) => setBanNumber(e.target.value)}
            placeholder="Ej: 811686109"
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
          />

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 hover:border-slate-500">
              <Upload className="h-4 w-4" />
              Subir imagen
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void extractFromImage(file);
                  }
                }}
              />
            </label>

            <button
              type="button"
              onClick={async () => {
                try {
                  let inserted = false;

                  try {
                    const items = await (navigator.clipboard as any).read();
                    for (const item of items) {
                      if (item.types.includes("image/png") || item.types.some((type: string) => type.startsWith("image/"))) {
                        const imageType = item.types.find((type: string) => type.startsWith("image/"));
                        if (imageType) {
                          const blob = await item.getType(imageType);
                          const file = new File([blob], `clipboard-${Date.now()}.png`, { type: blob.type || "image/png" });
                          await extractFromImage(file);
                          inserted = true;
                          break;
                        }
                      }

                      if (item.types.includes("text/html")) {
                        const blob = await item.getType("text/html");
                        const html = await blob.text();
                        const extracted = extractTableFromHtml(html);
                        if (extracted.trim()) {
                          replaceImportedText(extracted);
                          inserted = true;
                          break;
                        }
                      }
                    }
                  } catch {
                    // fall through to text/plain
                  }

                  if (!inserted) {
                    const text = await navigator.clipboard.readText();
                    if (text.trim()) {
                      replaceImportedText(text);
                      inserted = true;
                    }
                  }

                  if (!inserted) {
                    textareaRef.current?.focus();
                    setError("El navegador no entregó el portapapeles al botón. Presiona Ctrl+V dentro del cuadro.");
                  }
                } catch (e) {
                  console.error(e);
                  textareaRef.current?.focus();
                  setError("No se pudo leer el portapapeles.");
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 hover:border-slate-500"
            >
              <ClipboardPaste className="h-4 w-4" />
              Pegar portapapeles
            </button>
          </div>

          {ocrLoading && (
            <div className="text-xs text-blue-300">Procesando imagen y filtrando solo datos utiles del sistema...</div>
          )}

          <textarea
            ref={textareaRef}
            value={clipboardText}
            onChange={(e) => {
              setClipboardText(e.target.value);
              resetResult();
            }}
            onPaste={async (e) => {
              const clipboardData = e.clipboardData;
              if (!clipboardData) return;

              for (let i = 0; i < clipboardData.items.length; i += 1) {
                const item = clipboardData.items[i];
                if (item.type.indexOf("image") !== -1) {
                  e.preventDefault();
                  const file = item.getAsFile();
                  if (file) {
                    await extractFromImage(file);
                  }
                  return;
                }
              }

              const htmlData = clipboardData.getData("text/html");
              if (htmlData && htmlData.trim()) {
                const extracted = extractTableFromHtml(htmlData);
                if (extracted.trim()) {
                  e.preventDefault();
                  replaceImportedText(extracted);
                  return;
                }
              }
            }}
            rows={14}
            placeholder="Pega aqui el texto del Subscriber list..."
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-blue-500"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void requestSync(true)}
              disabled={previewLoading || syncLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Previsualizar
            </button>

            <button
              type="button"
              onClick={() => void requestSync(false)}
              disabled={previewLoading || syncLoading || hasBlockingIssues || !hasPreview}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Confirmar sync
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {(ocrWarnings.length > 0 || ocrRawText) && (
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">OCR bruto</h3>
              {ocrWarnings.length > 0 && (
                <ul className="mb-3 list-disc space-y-1 pl-5 text-xs text-amber-300">
                  {ocrWarnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              )}
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-900 p-3 text-[11px] text-slate-300">
                {ocrRawText || "Sin raw_text devuelto por el backend."}
              </pre>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Resumen</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat label="Lineas" value={stats.total_lines} />
            <Stat label="Validas" value={stats.valid_rows} />
            <Stat label="Ignoradas 100-" value={stats.ignored_100_prefix} />
            <Stat label="Invalidas" value={stats.invalid_lines} />
            <Stat label="Duplicadas paste" value={stats.duplicated_in_paste} />
            <Stat label="Conflicto otro BAN" value={stats.conflicts_other_ban} />
            <Stat label="Insertadas" value={stats.inserted} />
            <Stat label="Actualizadas" value={stats.updated} />
            <Stat label="Canceladas" value={stats.canceled} />
            <Stat label="Sin cambio" value={stats.unchanged} />
          </div>

          {hasBlockingIssues && (
            <div className="mt-4 rounded-lg border border-amber-900 bg-amber-950/40 p-3 text-xs text-amber-200">
              Corrige invalidas/conflictos antes de confirmar sync.
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Warnings</h3>
              <ul className="max-h-36 list-disc space-y-1 overflow-auto pl-5 text-xs text-slate-300">
                {warnings.map((w, idx) => (
                  <li key={`${w}-${idx}`}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Preview</h2>
        <div className="max-h-[460px] overflow-auto rounded-lg border border-slate-700">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-800 text-slate-300">
              <tr>
                <th className="px-3 py-2">Linea</th>
                <th className="px-3 py-2">Telefono</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Accion</th>
                <th className="px-3 py-2">Warning</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={`${row.line_no}-${row.raw_line}`} className="border-t border-slate-800 text-slate-200">
                  <td className="px-3 py-2">{row.line_no}</td>
                  <td className="px-3 py-2 font-mono">{row.phone ?? "-"}</td>
                  <td className="px-3 py-2">{row.status_norm ?? "-"}</td>
                  <td className="px-3 py-2">{row.plan_code ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-2 py-0.5">
                      <CheckCircle2 className="h-3 w-3" />
                      {row.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-amber-300">{row.warning ?? "-"}</td>
                </tr>
              ))}
              {previewRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    Sin datos. Ejecuta Previsualizar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-100">{value}</p>
    </div>
  );
}
