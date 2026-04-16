import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildClientTaskPresetSteps,
  ClientTaskWorkflowStep,
  ClientTaskWorkflowType,
  getClientTaskWorkflowLabel
} from "@/react-app/components/tasks/clientTaskWorkflow";

interface TaskWorkflowEditorProps {
  workflowType: ClientTaskWorkflowType;
  workflowSteps: ClientTaskWorkflowStep[];
  onWorkflowTypeChange: (workflowType: ClientTaskWorkflowType, workflowSteps: ClientTaskWorkflowStep[]) => void;
  onWorkflowStepsChange: (workflowSteps: ClientTaskWorkflowStep[]) => void;
}

export default function TaskWorkflowEditor({
  workflowType,
  workflowSteps,
  onWorkflowTypeChange,
  onWorkflowStepsChange
}: TaskWorkflowEditorProps) {
  const [newStep, setNewStep] = useState("");

  const progress = useMemo(() => {
    const total = workflowSteps.length;
    const completed = workflowSteps.filter((step) => step.is_done).length;
    return { total, completed };
  }, [workflowSteps]);

  return (
    <div className="space-y-3 rounded-xl border border-purple-500/20 bg-slate-950/40 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Flujo del cliente</label>
          <select
            value={workflowType}
            onChange={(e) => {
              const nextType = e.target.value as ClientTaskWorkflowType;
              const nextSteps = buildClientTaskPresetSteps(nextType, workflowSteps);
              onWorkflowTypeChange(nextType, nextSteps);
            }}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
          >
            <option value="mobile">{getClientTaskWorkflowLabel("mobile")}</option>
            <option value="fixed">{getClientTaskWorkflowLabel("fixed")}</option>
            <option value="custom">{getClientTaskWorkflowLabel("custom")}</option>
          </select>
        </div>
        <div className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-100">
          {progress.completed}/{progress.total || 0} pasos completados
        </div>
      </div>

      <div className="space-y-2">
        {workflowSteps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-sm text-slate-400">
            Este flujo no tiene pasos todavia.
          </div>
        ) : (
          workflowSteps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
              <input
                type="checkbox"
                checked={step.is_done}
                onChange={(e) =>
                  onWorkflowStepsChange(
                    workflowSteps.map((item) =>
                      item.id === step.id ? { ...item, is_done: e.target.checked } : item
                    )
                  )
                }
                className="h-4 w-4 rounded border-slate-600 bg-slate-800"
              />
              <input
                type="text"
                value={step.label}
                onChange={(e) =>
                  onWorkflowStepsChange(
                    workflowSteps.map((item) =>
                      item.id === step.id ? { ...item, label: e.target.value } : item
                    )
                  )
                }
                className={`flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-slate-600 focus:bg-slate-800/70 focus:outline-none ${
                  step.is_done ? "text-slate-500 line-through" : "text-white"
                }`}
              />
              <button
                type="button"
                onClick={() =>
                  onWorkflowStepsChange(workflowSteps.filter((item) => item.id !== step.id))
                }
                className="rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                title={`Eliminar paso ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2 md:flex-row">
        <input
          value={newStep}
          onChange={(e) => setNewStep(e.target.value)}
          placeholder="Agregar paso"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          onClick={() => {
            const label = newStep.trim();
            if (!label) return;
            onWorkflowStepsChange([
              ...workflowSteps,
              {
                id: `manual-${Date.now()}`,
                label,
                is_done: false
              }
            ]);
            setNewStep("");
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
        >
          <Plus className="h-4 w-4" />
          Agregar paso
        </button>
      </div>
    </div>
  );
}
