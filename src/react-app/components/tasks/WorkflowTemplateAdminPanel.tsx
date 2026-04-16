import { Loader2, Plus, Save, X } from "lucide-react";
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

interface WorkflowTemplateStep {
  id?: number | null;
  step_name: string;
  step_order: number;
}

interface WorkflowTemplate {
  id: number;
  product_type: string;
  sale_type: string;
  name: string;
  is_active: boolean;
  steps: WorkflowTemplateStep[];
}

const MATRIX_COLUMNS: Array<{
  key: ColumnKey;
  label: string;
  productType: string;
  saleType: string;
}> = [
  { key: "fijo_ren", label: "Fijo Ren", productType: "FIJO", saleType: "REN" },
  { key: "fijo_new", label: "Fijo New", productType: "FIJO", saleType: "NEW" },
  { key: "movil_new", label: "Movil New", productType: "MOVIL", saleType: "NEW" },
  { key: "movil_ren", label: "Movil Ren", productType: "MOVIL", saleType: "REN" },
  { key: "clarotv", label: "ClaroTV", productType: "CLARO_TV", saleType: "REN" },
  { key: "cloud", label: "Cloud", productType: "CLOUD", saleType: "REN" },
  { key: "mpls", label: "MPLS", productType: "MPLS", saleType: "REN" }
];

async function requestJson<T>(url: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...rest } = init;
  const response = await authFetch(url, json !== undefined ? { ...rest, json } : rest);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Error de red" }));
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function normalizeSteps(steps: WorkflowTemplateStep[] | string[] | null | undefined) {
  const names = (Array.isArray(steps) ? steps : [])
    .map((step) => typeof step === "string" ? step : step?.step_name)
    .map((step) => String(step || "").trim())
    .filter(Boolean);
  return names.length > 0 ? names : [""];
}

export default function WorkflowTemplateAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedColumnKey, setSelectedColumnKey] = useState<ColumnKey>("fijo_ren");
  const [draftSteps, setDraftSteps] = useState<string[]>([""]);
  const [draftActive, setDraftActive] = useState(true);

  const selectedColumn = useMemo(
    () => MATRIX_COLUMNS.find((column) => column.key === selectedColumnKey) || MATRIX_COLUMNS[0],
    [selectedColumnKey]
  );

  const selectedTemplate = useMemo(
    () => templates.find(
      (template) =>
        template.product_type === selectedColumn.productType && template.sale_type === selectedColumn.saleType
    ) || null,
    [selectedColumn, templates]
  );

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await requestJson<WorkflowTemplate[]>("/api/workflow-templates");
      setTemplates(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Error cargando plantillas de pasos:", error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    setDraftSteps(normalizeSteps(selectedTemplate?.steps));
    setDraftActive(selectedTemplate ? Boolean(selectedTemplate.is_active) : true);
  }, [selectedTemplate]);

  const handleSave = useCallback(async () => {
    const steps = draftSteps
      .map((step) => step.trim())
      .filter(Boolean)
      .map((step_name, index) => ({ step_name, step_order: index + 1 }));

    if (steps.length === 0) {
      window.alert("Debes agregar al menos un paso.");
      return;
    }

    const payload = {
      product_type: selectedColumn.productType,
      sale_type: selectedColumn.saleType,
      name: `${selectedColumn.productType} ${selectedColumn.saleType}`,
      is_active: draftActive,
      steps
    };

    setSaving(true);
    try {
      if (selectedTemplate) {
        await requestJson(`/api/workflow-templates/${selectedTemplate.id}`, {
          method: "PUT",
          json: payload
        });
      } else {
        await requestJson("/api/workflow-templates", {
          method: "POST",
          json: payload
        });
      }
      await loadTemplates();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo guardar la plantilla");
    } finally {
      setSaving(false);
    }
  }, [draftActive, draftSteps, loadTemplates, selectedColumn, selectedTemplate]);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-5 shadow-lg">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Pasos de clientes</h2>
          <p className="text-sm text-slate-400">Configuracion global para lo que aparece en Clientes &gt; Pasos.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadTemplates()}
          disabled={loading}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 disabled:opacity-60"
        >
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[280px,1fr]">
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          {MATRIX_COLUMNS.map((column) => {
            const template = templates.find(
              (entry) => entry.product_type === column.productType && entry.sale_type === column.saleType
            );
            const isSelected = column.key === selectedColumnKey;
            return (
              <button
                key={column.key}
                type="button"
                onClick={() => setSelectedColumnKey(column.key)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${
                  isSelected
                    ? "border-violet-500/40 bg-violet-500/10 text-white"
                    : "border-slate-800 bg-slate-900/70 text-slate-300"
                }`}
              >
                <span className="text-sm font-medium">{column.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                  template?.is_active ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-400"
                }`}>
                  {template?.steps?.length || 0} pasos
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="text-sm font-semibold text-white">{selectedColumn.label}</div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={draftActive}
                onChange={(event) => setDraftActive(event.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900"
              />
              Activo
            </label>
          </div>

          <div className="space-y-2">
            {draftSteps.map((step, index) => (
              <div key={`${selectedColumn.key}-${index}`} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-2">
                <span className="w-6 text-center text-xs text-slate-500">{index + 1}</span>
                <input
                  value={step}
                  onChange={(event) => setDraftSteps((prev) => prev.map((entry, entryIndex) => entryIndex === index ? event.target.value : entry))}
                  placeholder="Paso"
                  className="flex-1 bg-transparent text-sm text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => setDraftSteps((prev) => {
                    const next = prev.filter((_, entryIndex) => entryIndex !== index);
                    return next.length > 0 ? next : [""];
                  })}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDraftSteps((prev) => [...prev, ""])}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-200"
            >
              <Plus className="h-4 w-4" />
              Agregar paso
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar pasos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
