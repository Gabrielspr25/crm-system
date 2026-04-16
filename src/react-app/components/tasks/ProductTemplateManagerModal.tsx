import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  buildEmptyWorkflowStep,
  normalizeProductWorkflowSteps,
  ProductTaskTemplate,
  ProductWorkflowStep
} from "@/react-app/components/tasks/productTaskWorkflow";

interface ProductTemplateManagerModalProps {
  templates: ProductTaskTemplate[];
  saving: boolean;
  deletingId: number | null;
  onClose: () => void;
  onCreate: (payload: { product_name: string; steps: ProductWorkflowStep[] }) => Promise<void> | void;
  onUpdate: (templateId: number, payload: { product_name: string; steps: ProductWorkflowStep[]; is_active: boolean }) => Promise<void> | void;
  onDelete: (templateId: number) => Promise<void> | void;
}

function StepListEditor({
  steps,
  onChange
}: {
  steps: ProductWorkflowStep[];
  onChange: (nextValue: ProductWorkflowStep[]) => void;
}) {
  const handleStepChange = (stepId: string, value: string) => {
    onChange(steps.map((step) => (step.id === stepId ? { ...step, label: value } : step)));
  };

  const removeStep = (stepId: string) => {
    onChange(steps.filter((step) => step.id !== stepId));
  };

  const addStep = () => {
    onChange([...steps, buildEmptyWorkflowStep("")]);
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center gap-2">
          <div className="w-6 text-right text-xs text-slate-500">{index + 1}.</div>
          <input
            value={step.label}
            onChange={(event) => handleStepChange(step.id, event.target.value)}
            placeholder="Nombre del paso"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => removeStep(step.id)}
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-200"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addStep}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-200"
      >
        <Plus className="h-4 w-4" />
        Agregar paso
      </button>
    </div>
  );
}

export default function ProductTemplateManagerModal({
  templates,
  saving,
  deletingId,
  onClose,
  onCreate,
  onUpdate,
  onDelete
}: ProductTemplateManagerModalProps) {
  const [createName, setCreateName] = useState("");
  const [createSteps, setCreateSteps] = useState<ProductWorkflowStep[]>([buildEmptyWorkflowStep("")]);
  const [editingTemplates, setEditingTemplates] = useState<Record<number, { product_name: string; steps: ProductWorkflowStep[]; is_active: boolean }>>({});

  useEffect(() => {
    const nextState: Record<number, { product_name: string; steps: ProductWorkflowStep[]; is_active: boolean }> = {};
    templates.forEach((template) => {
      nextState[template.id] = {
        product_name: template.product_name,
        steps: normalizeProductWorkflowSteps(template.steps),
        is_active: template.is_active
      };
    });
    setEditingTemplates(nextState);
  }, [templates]);

  const handleCreate = async () => {
    const productName = createName.trim();
    const steps = normalizeProductWorkflowSteps(createSteps).filter((step) => step.label.trim());
    if (!productName) {
      window.alert("El nombre del producto es obligatorio.");
      return;
    }
    if (steps.length === 0) {
      window.alert("Debes agregar al menos un paso.");
      return;
    }
    await onCreate({ product_name: productName, steps });
    setCreateName("");
    setCreateSteps([buildEmptyWorkflowStep("")]);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" style={{ maxHeight: "92vh", overflowY: "auto" }}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Productos y pasos</h2>
            <p className="text-sm text-slate-400">Configura la plantilla global de pasos por producto.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Pencil className="h-4 w-4 text-blue-300" />
            <h3 className="text-sm font-semibold text-white">Nuevo producto</h3>
          </div>
          <div className="space-y-3">
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="Ej: MOVIL RENOVACION, CLOUD, CLARO TV"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            />
            <StepListEditor steps={createSteps} onChange={setCreateSteps} />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear producto
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {templates.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-6 text-sm text-slate-400">
              No hay productos configurados todavia.
            </div>
          ) : (
            templates.map((template) => {
              const draft = editingTemplates[template.id];
              if (!draft) return null;
              return (
                <div key={template.id} className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <input
                      value={draft.product_name}
                      onChange={(event) => setEditingTemplates((prev) => ({
                        ...prev,
                        [template.id]: { ...prev[template.id], product_name: event.target.value }
                      }))}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={draft.is_active}
                        onChange={(event) => setEditingTemplates((prev) => ({
                          ...prev,
                          [template.id]: { ...prev[template.id], is_active: event.target.checked }
                        }))}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                      />
                      Activo
                    </label>
                  </div>

                  <StepListEditor
                    steps={draft.steps}
                    onChange={(nextSteps) => setEditingTemplates((prev) => ({
                      ...prev,
                      [template.id]: { ...prev[template.id], steps: nextSteps }
                    }))}
                  />

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void onDelete(template.id)}
                      disabled={deletingId === template.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 disabled:opacity-60"
                    >
                      {deletingId === template.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => void onUpdate(template.id, {
                        product_name: draft.product_name.trim(),
                        steps: normalizeProductWorkflowSteps(draft.steps).filter((step) => step.label.trim()),
                        is_active: draft.is_active
                      })}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Guardar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
