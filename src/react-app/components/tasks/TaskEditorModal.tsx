import { Loader2, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import TaskWorkflowEditor from "@/react-app/components/tasks/TaskWorkflowEditor";
import {
  ClientTaskWorkflowStep,
  ClientTaskWorkflowType,
  getTaskKind,
  resolveClientTaskStatus
} from "@/react-app/components/tasks/clientTaskWorkflow";

type TaskStatus = "pending" | "in_progress" | "done";
type TaskPriority = "low" | "normal" | "high";
type ColumnType = "text" | "date" | "number" | "select" | "checkbox";

interface TaskColumn {
  id: number;
  column_key: string;
  label: string;
  data_type: ColumnType;
  options: string[];
}

interface TaskAssignee {
  user_id: string;
  display_name: string;
  role: string;
}

interface ClientSearchResult {
  id: string | number;
  name: string;
  business_name?: string | null;
}

interface TaskFormValue {
  title: string;
  due_date?: string | null;
  follow_up_date?: string | null;
  follow_up_time?: string | null;
  client_id?: string | number | null;
  client_name?: string | null;
  assigned_user_id?: string | null;
  notes?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  custom_fields: Record<string, string | number | boolean | null>;
  task_kind?: "regular" | "client";
  client_task_workflow?: ClientTaskWorkflowType | null;
  workflow_steps?: ClientTaskWorkflowStep[];
}

interface TaskEditorModalProps {
  heading: string;
  submitLabel: string;
  saving: boolean;
  value: TaskFormValue;
  columns: TaskColumn[];
  assignees: TaskAssignee[];
  canAssignTasks: boolean;
  clientOptions: ClientSearchResult[];
  clientSearchLoading: boolean;
  onSearchClients: (value: string) => void | Promise<void>;
  onChange: (nextValue: TaskFormValue) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  lockedClient?: { id: string | number; name: string } | null;
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

function NotesChecklistEditor({ notes, onChange }: { notes: string; onChange: (value: string) => void }) {
  const [mode, setMode] = useState<"text" | "checklist">("checklist");
  const lines = (notes || "").split("\n");

  if (mode === "text") {
    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          <button type="button" onClick={() => setMode("checklist")} className="text-xs font-medium text-blue-400 hover:text-blue-300">
            Modo checklist
          </button>
        </div>
        <textarea
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button type="button" onClick={() => setMode("text")} className="text-xs font-medium text-slate-400 hover:text-white">
          Modo texto
        </button>
      </div>
      <div className="space-y-1.5 rounded-xl border border-slate-700 bg-slate-800 p-3">
        {lines
          .map((text, idx) => ({ text, idx }))
          .filter((item) => item.text.trim() !== "")
          .map(({ text, idx }) => {
            const checked = text.startsWith("[x] ");
            const hasPrefix = checked || text.startsWith("[ ] ");
            const actualText = hasPrefix ? text.slice(4) : text;

            return (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const nextLines = [...lines];
                    nextLines[idx] = `${e.target.checked ? "[x]" : "[ ]"} ${actualText}`;
                    onChange(nextLines.join("\n"));
                  }}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                />
                <input
                  type="text"
                  value={actualText}
                  onChange={(e) => {
                    const nextLines = [...lines];
                    nextLines[idx] = `${hasPrefix ? text.slice(0, 4) : "[ ] "} ${e.target.value}`.replace("[ ]  ", "[ ] ");
                    onChange(nextLines.join("\n"));
                  }}
                  className={`flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-slate-600 focus:bg-slate-700/40 focus:outline-none ${
                    checked ? "text-slate-500 line-through" : "text-slate-200"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextLines = [...lines];
                    nextLines.splice(idx, 1);
                    onChange(nextLines.join("\n"));
                  }}
                  className="rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        <button
          type="button"
          onClick={() => onChange(`${notes ? `${notes}\n` : ""}[ ] `)}
          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar item
        </button>
      </div>
    </div>
  );
}

export default function TaskEditorModal({
  heading,
  submitLabel,
  saving,
  value,
  columns,
  assignees,
  canAssignTasks,
  clientOptions,
  clientSearchLoading,
  onSearchClients,
  onChange,
  onClose,
  onSubmit,
  lockedClient = null
}: TaskEditorModalProps) {
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const taskKind = lockedClient ? "client" : getTaskKind(value);
  const workflowSteps = Array.isArray(value.workflow_steps) ? value.workflow_steps : [];
  const computedStatus = useMemo(
    () => resolveClientTaskStatus(taskKind, workflowSteps, value.status),
    [taskKind, workflowSteps, value.status]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-6xl rounded-2xl border border-slate-700 bg-slate-900 p-5" style={{ maxHeight: "95vh", overflowY: "auto" }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{heading}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-300 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Titulo de la tarea *</label>
            <input
              value={value.title}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
              placeholder="Descripcion breve de la tarea"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </div>

          {!lockedClient ? (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Tipo de tarea</label>
              <select
                value={taskKind}
                onChange={(e) => {
                  const nextKind = e.target.value as "regular" | "client";
                  onChange({
                    ...value,
                    task_kind: nextKind,
                    client_id: nextKind === "client" ? value.client_id ?? null : null,
                    client_name: nextKind === "client" ? value.client_name ?? "" : "",
                    client_task_workflow: nextKind === "client" ? value.client_task_workflow || "mobile" : null,
                    workflow_steps: nextKind === "client" ? value.workflow_steps || [] : [],
                    status: nextKind === "client" ? resolveClientTaskStatus("client", value.workflow_steps || [], "pending") : value.status
                  });
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                <option value="regular">Personal</option>
                <option value="client">Cliente</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Tipo de tarea</label>
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-sm font-medium text-purple-100">Cliente</div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Prioridad</label>
            <select
              value={value.priority}
              onChange={(e) => onChange({ ...value, priority: e.target.value as TaskPriority })}
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
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha limite</label>
            <input
              type="date"
              value={value.due_date || ""}
              onChange={(e) => onChange({ ...value, due_date: e.target.value || null })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha seguimiento</label>
            <input
              type="date"
              value={value.follow_up_date || ""}
              onChange={(e) => onChange({ ...value, follow_up_date: e.target.value || null })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Hora seguimiento</label>
            <input
              type="time"
              value={value.follow_up_time || ""}
              onChange={(e) => onChange({ ...value, follow_up_time: e.target.value || null })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </div>

          {taskKind === "client" ? (
            lockedClient ? (
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Cliente</label>
                <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">{lockedClient.name}</div>
              </div>
            ) : (
              <div className="relative md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Cliente</label>
                <input
                  value={value.client_name || ""}
                  onChange={(e) => {
                    const term = e.target.value;
                    const matched = clientOptions.find(
                      (client) => client.name.trim().toLowerCase() === term.trim().toLowerCase()
                    );
                    onChange({
                      ...value,
                      client_name: term,
                      client_id: matched ? matched.id : null
                    });
                    setClientSearchOpen(true);
                    void onSearchClients(term);
                  }}
                  onFocus={() => {
                    setClientSearchOpen(true);
                    void onSearchClients(value.client_name || "");
                  }}
                  onBlur={() => window.setTimeout(() => setClientSearchOpen(false), 120)}
                  placeholder="Buscar cliente..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                />
                {clientSearchLoading ? <Loader2 className="absolute right-3 top-9 h-4 w-4 animate-spin text-slate-400" /> : null}
                {clientSearchOpen && clientOptions.length > 0 ? (
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                    {clientOptions.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onChange({
                            ...value,
                            client_name: client.name,
                            client_id: client.id
                          });
                          setClientSearchOpen(false);
                        }}
                        className="block w-full border-b border-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                      >
                        <div className="font-medium">{client.name}</div>
                        {client.business_name ? <div className="text-xs text-slate-400">{client.business_name}</div> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          ) : null}

          {canAssignTasks ? (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Asignar a</label>
              <select
                value={value.assigned_user_id || ""}
                onChange={(e) => onChange({ ...value, assigned_user_id: e.target.value || null })}
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

          {taskKind === "client" ? (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</label>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-100">
                {STATUS_OPTIONS.find((option) => option.value === computedStatus)?.label || computedStatus}
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</label>
              <select
                value={value.status}
                onChange={(e) => onChange({ ...value, status: e.target.value as TaskStatus })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {taskKind === "client" ? (
          <div className="mt-4">
            <TaskWorkflowEditor
              workflowType={(value.client_task_workflow || "mobile") as ClientTaskWorkflowType}
              workflowSteps={workflowSteps}
              onWorkflowTypeChange={(workflowType, workflowStepsNext) =>
                onChange({
                  ...value,
                  client_task_workflow: workflowType,
                  workflow_steps: workflowStepsNext,
                  status: resolveClientTaskStatus("client", workflowStepsNext, value.status)
                })
              }
              onWorkflowStepsChange={(workflowStepsNext) =>
                onChange({
                  ...value,
                  workflow_steps: workflowStepsNext,
                  status: resolveClientTaskStatus("client", workflowStepsNext, value.status)
                })
              }
            />
          </div>
        ) : null}

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</label>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  notes: `${value.notes || ""}${value.notes ? "\n\n" : ""}[${new Date().toLocaleDateString("es-ES")} ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}]: `
                })
              }
              className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              + Auto fecha
            </button>
          </div>
          <NotesChecklistEditor notes={value.notes || ""} onChange={(nextNotes) => onChange({ ...value, notes: nextNotes })} />
        </div>

        {columns.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            {columns.map((column) => (
              <div key={column.id}>
                {column.data_type === "checkbox" ? (
                  <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={Boolean(value.custom_fields[column.column_key])}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          custom_fields: {
                            ...value.custom_fields,
                            [column.column_key]: e.target.checked
                          }
                        })
                      }
                    />
                    {column.label}
                  </label>
                ) : column.data_type === "select" ? (
                  <select
                    value={String(value.custom_fields[column.column_key] ?? "")}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        custom_fields: {
                          ...value.custom_fields,
                          [column.column_key]: e.target.value
                        }
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  >
                    <option value="">{column.label}</option>
                    {column.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={column.data_type === "date" ? "date" : column.data_type === "number" ? "number" : "text"}
                    value={String(value.custom_fields[column.column_key] ?? "")}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        custom_fields: {
                          ...value.custom_fields,
                          [column.column_key]: e.target.value
                        }
                      })
                    }
                    placeholder={column.label}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  />
                )}
              </div>
            ))}
          </div>
        ) : null}

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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
