import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { authFetch } from "@/react-app/utils/auth";
import { getClientTaskProgress, resolveClientTaskStatus } from "@/react-app/components/tasks/clientTaskWorkflow";

interface ClientTaskStepsInlineProps {
  task: any;
  onTaskUpdated?: (task: any) => void;
  compact?: boolean;
}

export default function ClientTaskStepsInline({
  task,
  onTaskUpdated,
  compact = false
}: ClientTaskStepsInlineProps) {
  const [savingStepId, setSavingStepId] = useState<string | null>(null);
  const progress = useMemo(() => getClientTaskProgress(task), [task]);

  if (progress.total === 0) {
    return (
      <div className="text-xs text-slate-400">
        Sin pasos definidos
      </div>
    );
  }

  const toggleStep = async (stepId: string) => {
    const nextSteps = progress.steps.map((step) =>
      step.id === stepId ? { ...step, is_done: !step.is_done } : step
    );

    setSavingStepId(stepId);
    try {
      const response = await authFetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        json: {
          workflow_steps: nextSteps,
          status: resolveClientTaskStatus("client", nextSteps, task.status)
        }
      });

      if (!response.ok) {
        throw new Error("No se pudo actualizar el paso");
      }

      const updated = await response.json();
      onTaskUpdated?.(updated);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo actualizar el paso");
    } finally {
      setSavingStepId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-purple-200">
          {progress.completed}/{progress.total} pasos
        </div>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-purple-500" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>

      <div className={`space-y-1 ${compact ? "max-w-xs" : ""}`}>
        {progress.steps.map((step) => (
          <label key={step.id} className="flex items-start gap-2 text-xs text-slate-200">
            <span className="mt-0.5 flex h-4 w-4 items-center justify-center">
              {savingStepId === step.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
              ) : (
                <input
                  type="checkbox"
                  checked={step.is_done}
                  onChange={() => void toggleStep(step.id)}
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900"
                />
              )}
            </span>
            <span className={step.is_done ? "text-slate-500 line-through" : ""}>{step.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
