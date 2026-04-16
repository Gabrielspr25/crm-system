import { Loader2, Save, X } from "lucide-react";

type TaskStatus = "pending" | "in_progress" | "done";
type TaskPriority = "low" | "normal" | "high";

interface TaskAssignee {
  user_id: string;
  display_name: string;
  role: string;
}

export interface PersonalTaskFormValue {
  title: string;
  due_date?: string | null;
  follow_up_date?: string | null;
  follow_up_time?: string | null;
  assigned_user_id?: string | null;
  notes?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
}

interface PersonalTaskModalProps {
  heading: string;
  submitLabel: string;
  saving: boolean;
  canAssignTasks: boolean;
  assignees: TaskAssignee[];
  value: PersonalTaskFormValue;
  onChange: (nextValue: PersonalTaskFormValue) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En progreso" },
  { value: "done", label: "Completada" }
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" }
];

export default function PersonalTaskModal({
  heading,
  submitLabel,
  saving,
  canAssignTasks,
  assignees,
  value,
  onChange,
  onClose,
  onSubmit
}: PersonalTaskModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{heading}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-300 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Titulo *</label>
            <input
              value={value.title}
              onChange={(event) => onChange({ ...value, title: event.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              placeholder="Descripcion breve de la tarea"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Prioridad</label>
            <select
              value={value.priority}
              onChange={(event) => onChange({ ...value, priority: event.target.value as TaskPriority })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</label>
            <select
              value={value.status}
              onChange={(event) => onChange({ ...value, status: event.target.value as TaskStatus })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha limite</label>
            <input
              type="date"
              value={value.due_date || ""}
              onChange={(event) => onChange({ ...value, due_date: event.target.value || null })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha seguimiento</label>
            <input
              type="date"
              value={value.follow_up_date || ""}
              onChange={(event) => onChange({ ...value, follow_up_date: event.target.value || null })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Hora seguimiento</label>
            <input
              type="time"
              value={value.follow_up_time || ""}
              onChange={(event) => onChange({ ...value, follow_up_time: event.target.value || null })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </div>

          {canAssignTasks ? (
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Asignado a</label>
              <select
                value={value.assigned_user_id || ""}
                onChange={(event) => onChange({ ...value, assigned_user_id: event.target.value || null })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                <option value="">Sin asignar</option>
                {assignees.map((assignee) => (
                  <option key={assignee.user_id} value={assignee.user_id}>
                    {assignee.display_name} ({assignee.role})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</label>
            <textarea
              value={value.notes || ""}
              onChange={(event) => onChange({ ...value, notes: event.target.value })}
              rows={6}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              placeholder="Notas o checklist libre"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSubmit()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
