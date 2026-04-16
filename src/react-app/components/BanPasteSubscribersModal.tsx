import { useState } from "react";
import { AlertTriangle, ClipboardPaste, Loader2 } from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";
import { extractSubscriberTextFromImage } from "@/react-app/utils/subscriberImageExtractor";

type SyncStats = {
  total_lines?: number;
  valid_rows?: number;
  invalid_lines?: number;
  conflicts_other_ban?: number;
  inserted?: number;
  updated?: number;
  canceled?: number;
  deleted?: number;
  unchanged?: number;
  set_active?: number;
  set_cancelled?: number;
};

type SyncResponse = {
  ok: boolean;
  dry_run: boolean;
  stats?: SyncStats;
  rows?: unknown[];
  warnings?: string[];
  error?: string;
};

type Props = {
  isOpen: boolean;
  banId: string | number | null;
  banNumber: string | number | null;
  onClose: () => void;
  onSuccess: (result: SyncResponse) => Promise<void> | void;
};

// Parse HTML clipboard data — reads ALL rows including browser-highlighted (blue) ones
// that get dropped from text/plain when copying a table selection
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
    // No table, fall back to stripping tags
    const plain = doc.body?.textContent ?? "";
    return plain.trim();
  } catch {
    return "";
  }
}

export default function BanPasteSubscribersModal({
  isOpen,
  banId,
  banNumber,
  onClose,
  onSuccess
}: Props) {
  const [text, setText] = useState("");
  const [ocrRawText, setOcrRawText] = useState("");
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<SyncResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const appendExtractedText = async (file: File) => {
    setLoading(true);
    setError("");
    try {
      const extracted = await extractSubscriberTextFromImage(file);
      const newText = extracted.text?.trim() || "";
      setOcrRawText(extracted.rawText?.trim() || "");
      setOcrWarnings(Array.isArray(extracted.warnings) ? extracted.warnings : []);
      if (!newText) {
        setError("No se detectaron suscriptores en la imagen.");
        return;
      }
      setText((prev) => (prev.trim() ? `${prev}\n${newText}` : newText));
    } catch (e: any) {
      setError(e.message || "Error al procesar la imagen.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const runSync = async (dryRun: boolean) => {
    if (!text.trim()) {
      setError("Debes pegar texto o extraer desde imagen.");
      return;
    }
    if (!dryRun && !preview) {
      setError("Primero ejecuta Previsualizar.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/subscribers/paste-sync", {
        method: "POST",
        json: {
          ban_id: banId,
          ban_number: banNumber,
          clipboard_text: text,
          dry_run: dryRun
        }
      });
      const data = (await res.json()) as SyncResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || "Error procesando sync.");
        return;
      }
      setPreview(data);
      if (!dryRun) {
        await onSuccess(data);
        setText("");
        onClose();
      }
    } catch (e) {
      console.error(e);
      setError("No se pudo conectar con el backend.");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">
            Sync Suscriptores BAN {banNumber ?? "-"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:border-slate-500"
          >
            Cerrar
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <input
            type="file"
            id="ocr-upload"
            className="hidden"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await appendExtractedText(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => document.getElementById("ocr-upload")?.click()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-600 bg-indigo-950/40 px-3 py-2 text-sm text-indigo-100 hover:bg-indigo-900/40 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "📷 Escanear Imagen (OCR)"}
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                // Try clipboard.read() first — reads all formats including text/html
                // text/html preserves ALL table rows including browser-highlighted ones
                let inserted = false;
                try {
                  const items = await (navigator.clipboard as any).read();
                  for (const item of items) {
                    if (item.types.includes("text/html")) {
                      const blob = await item.getType("text/html");
                      const html = await blob.text();
                      const extracted = extractTableFromHtml(html);
                      if (extracted.trim()) {
                        setText((prev) => (prev.trim() ? `${prev}\n${extracted}` : extracted));
                        inserted = true;
                        break;
                      }
                    }
                  }
                } catch {
                  // clipboard.read() not available or denied — fall through to readText
                }
                if (!inserted) {
                  const clip = await navigator.clipboard.readText();
                  if (clip.trim()) {
                    setText((prev) => (prev.trim() ? `${prev}\n${clip}` : clip));
                  }
                }
              } catch (e) {
                console.error(e);
                setError("No se pudo leer el portapapeles.");
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 hover:border-slate-500"
          >
            <ClipboardPaste className="h-4 w-4" />
            Pegar portapapeles
          </button>

          <button
            type="button"
            onClick={() => {
              setText("");
              setOcrRawText("");
              setOcrWarnings([]);
              setPreview(null);
              setError("");
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-red-900/30 bg-red-950/20 px-3 py-2 text-sm text-red-200 hover:bg-red-900/30 transition-colors"
          >
            🔄 Limpiar / Refrescar
          </button>

          {text.trim() && (
            <div className="ml-auto flex items-center gap-2 rounded-full bg-blue-900/30 px-3 py-1 text-[11px] font-bold text-blue-300 border border-blue-800/50">
              {text.trim().split("\n").length} DETECTADOS
            </div>
          )}
        </div>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
            setError("");
          }}
          onPaste={async (e) => {
            const clipboardData = e.clipboardData;
            if (!clipboardData) return;

            // Check for image first
            for (let i = 0; i < clipboardData.items.length; i++) {
              const item = clipboardData.items[i];
              if (item.type.indexOf("image") !== -1) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) await appendExtractedText(file);
                return;
              }
            }

            // Read HTML clipboard — preserves highlighted/selected rows that text/plain drops
            const htmlData = clipboardData.getData("text/html");
            if (htmlData && htmlData.trim()) {
              const extracted = extractTableFromHtml(htmlData);
              if (extracted && extracted.trim()) {
                e.preventDefault();
                setText((prev) => (prev.trim() ? `${prev}\n${extracted}` : extracted));
                setPreview(null);
                setError("");
                return;
              }
            }
            // Fall through to default textarea text paste
          }}
          rows={12}
          className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-blue-500"
          placeholder="Pega aquí el texto, usa el botón de OCR o presiona Ctrl+V para pegar una imagen directamente..."
        />

        {(ocrWarnings.length > 0 || ocrRawText) && (
          <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">OCR bruto</h3>
            {ocrWarnings.length > 0 && (
              <ul className="mb-3 list-disc space-y-1 pl-5 text-xs text-amber-300">
                {ocrWarnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            )}
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-900 p-3 text-[11px] text-slate-300">
              {ocrRawText || "Sin raw_text devuelto por el backend."}
            </pre>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {preview?.stats && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-6">
            <Stat label="Validas" value={preview.stats.valid_rows ?? 0} />
            <Stat label="Invalidas" value={preview.stats.invalid_lines ?? 0} />
            <Stat label="Conflictos" value={preview.stats.conflicts_other_ban ?? 0} />
            <Stat label="Insertadas" value={preview.stats.inserted ?? 0} />
            <Stat label="Actualizadas" value={preview.stats.updated ?? 0} />
            <Stat label="Eliminadas" value={preview.stats.deleted ?? 0} />
          </div>
        )}

        {preview?.warnings && preview.warnings.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-yellow-900/60 bg-yellow-950/40 p-3 text-sm text-yellow-300">
            {preview.warnings.map((w, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runSync(true)}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Previsualizar"}
          </button>
          <button
            type="button"
            onClick={() => void runSync(false)}
            disabled={loading || !preview || (preview?.stats?.invalid_lines ?? 0) > 0 || (preview?.stats?.conflicts_other_ban ?? 0) > 0}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirmar sync
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-base font-bold text-slate-100">{value}</p>
    </div>
  );
}
