import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CheckSquare, Columns3, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, X, ExternalLink } from "lucide-react";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";
import { Link } from "react-router-dom";

type TaskStatus = "pending" | "in_progress" | "done";
type TaskTab = "all" | "pending" | "in_progress" | "follow_up" | "done";
type TaskPriority = "low" | "normal" | "high";
type ColumnType = "text" | "date" | "number" | "select" | "checkbox";

interface TaskColumn {
  id: number;
  column_key: string;
  label: string;
  data_type: ColumnType;
  options: string[];
  sort_order: number;
}

interface TaskItem {
  id: number;
  owner_user_id: string;
  assigned_user_id: string | null;
  assigned_username?: string | null;
  assigned_name?: string | null;
  title: string;
  due_date: string | null;
  follow_up_date: string | null;
  follow_up_time: string | null;
  client_id: string | number | null;
  client_name: string | null;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  custom_fields: Record<string, string | number | boolean | null>;
}

interface TaskDraft {
  title: string;
  due_date: string;
  follow_up_date: string;
  follow_up_time: string;
  client_id: string | number | null;
  client_name: string;
  assigned_user_id: string | null;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  custom_fields: Record<string, string | number | boolean | null>;
}

interface ClientSearchResult {
  id: string | number;
  name: string;
  business_name?: string | null;
}

interface TaskAssignee {
  user_id: string;
  username: string;
  display_name: string;
  role: string;
}

interface ColumnDraft {
  label: string;
  data_type: ColumnType;
  options_text: string;
}

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En progreso" },
  { value: "done", label: "Completada" }
];

const TASK_TABS: Array<{ value: TaskTab; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "in_progress", label: "En proceso" },
  { value: "follow_up", label: "Seguimiento" },
  { value: "done", label: "Completadas" }
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" }
];

const COLUMN_TYPES: Array<{ value: ColumnType; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "date", label: "Fecha" },
  { value: "number", label: "Numero" },
  { value: "select", label: "Lista" },
  { value: "checkbox", label: "Si/No" }
];

function defaultByType(type: ColumnType): string | number | boolean | null {
  return type === "checkbox" ? false : "";
}

function defaultsForColumns(columns: TaskColumn[]) {
  return columns.reduce<Record<string, string | number | boolean | null>>((acc, col) => {
    acc[col.column_key] = defaultByType(col.data_type);
    return acc;
  }, {});
}

function hasTaskFollowUp(task: Pick<TaskItem, "follow_up_date" | "follow_up_time">) {
  return Boolean(task.follow_up_date || task.follow_up_time);
}

function getTaskTab(task: TaskItem): Exclude<TaskTab, "all"> {
  if (task.status === "done") {
    return hasTaskFollowUp(task) ? "follow_up" : "done";
  }
  return task.status;
}

function getTaskStatusLabel(task: TaskItem) {
  if (task.status === "done" && hasTaskFollowUp(task)) {
    return "Seguimiento";
  }
  return STATUS_OPTIONS.find((option) => option.value === task.status)?.label || task.status;
}

function formatFollowUp(task: Pick<TaskItem, "follow_up_date" | "follow_up_time">) {
  const date = task.follow_up_date || "";
  const time = task.follow_up_time || "";
  if (date && time) return `${date} ${time}`;
  return date || time || "-";
}

function getTaskAlarmSignature(task: Pick<TaskItem, "id" | "follow_up_date" | "follow_up_time">) {
  return `${task.id}|${task.follow_up_date || ""}|${task.follow_up_time || ""}`;
}

function getTaskAlarmAckStorageKey(taskId: number) {
  return `tasks_alarm_ack_${taskId}`;
}

function toTaskDayNumber(value?: string | null) {
  if (!value) return null;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
}

function getTaskFollowUpTimestamp(task: Pick<TaskItem, "follow_up_date" | "follow_up_time">) {
  if (!task.follow_up_date || !task.follow_up_time) return null;
  const [year, month, day] = task.follow_up_date.split("-").map(Number);
  const [hours, minutes] = task.follow_up_time.split(":").map(Number);
  if ([year, month, day, hours, minutes].some((value) => Number.isNaN(value))) {
    return null;
  }
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

function getTaskAlarm(task: TaskItem) {
  const today = new Date();
  const todayNumber = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const followUpTimestamp = getTaskFollowUpTimestamp(task);
  const hasFollowUp = hasTaskFollowUp(task);
  const referenceDate = hasFollowUp ? task.follow_up_date : task.due_date;
  const referenceNumber = toTaskDayNumber(referenceDate);

  if (!referenceDate || referenceNumber === null) {
    return { label: "-", tone: "text-slate-500 border-slate-700 bg-slate-800/60" };
  }

  if (followUpTimestamp !== null && followUpTimestamp <= Date.now()) {
    return {
      label: "En alarma",
      tone: "text-red-100 border-red-400/40 bg-red-500/20"
    };
  }

  if (referenceNumber < todayNumber) {
    return {
      label: hasFollowUp ? "Seguimiento atrasado" : "Atrasada",
      tone: "text-red-200 border-red-500/30 bg-red-500/10"
    };
  }

  if (referenceNumber === todayNumber) {
    return {
      label: hasFollowUp ? "Seguimiento hoy" : "Hoy",
      tone: "text-amber-200 border-amber-500/30 bg-amber-500/10"
    };
  }

  return {
    label: hasFollowUp ? "Seguimiento proximo" : "Proxima",
    tone: "text-emerald-200 border-emerald-500/30 bg-emerald-500/10"
  };
}

async function requestJson<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const response = await authFetch(url, json !== undefined ? { ...rest, json } : rest);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Error de red" }));
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function NotesChecklistEditor({ notes, onChange }: { notes: string; onChange: (v: string) => void }) {
  const [mode, setMode] = useState<"text" | "checklist">("checklist");
  const lines = (notes || "").split("\n");

  if (mode === "text") {
    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          <button type="button" onClick={() => setMode("checklist")} className="text-xs text-blue-400 font-medium hover:text-blue-300 transition-colors">Modo Checklist</button>
        </div>
        <textarea
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe notas aquí... Cada línea puede ser un ítem del checklist."
          rows={8}
          style={{ resize: "vertical", minHeight: "200px", maxHeight: "60vh" }}
          className="w-full rounded-xl border-2 border-blue-500/40 bg-slate-800/90 px-4 py-3 text-sm text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button type="button" onClick={() => setMode("text")} className="text-xs text-slate-400 font-medium hover:text-white transition-colors">Modo Texto</button>
      </div>
      <div className="space-y-1.5 bg-slate-800/90 p-3 rounded-xl border-2 border-blue-500/40 min-h-[200px] max-h-[60vh] overflow-y-auto">
        {lines.map((text, idx) => ({ text, idx })).filter(item => item.text.trim() !== "").map(({ text: l, idx: i }) => {
          const isChecked = l.startsWith("[x] ");
          const isEmptyCheck = l.startsWith("[ ] ");
          const hasPrefix = isChecked || isEmptyCheck;
          const actualText = hasPrefix ? l.slice(4) : l;
          const checked = isChecked;

          return (
            <div key={i} className="flex gap-2 items-center group">
              <input 
                type="checkbox" 
                checked={checked} 
                onChange={(e) => {
                  const newLines = [...lines];
                  newLines[i] = (e.target.checked ? "[x] " : "[ ] ") + actualText;
                  onChange(newLines.join("\n"));
                }} 
                className="w-4 h-4 shrink-0 rounded border-slate-600 bg-slate-900 cursor-pointer" 
              />
              <input 
                type="text" 
                value={actualText} 
                onChange={(e) => {
                  const newLines = [...lines];
                  newLines[i] = (hasPrefix ? l.slice(0, 4) : "[ ] ") + e.target.value;
                  onChange(newLines.join("\n"));
                }} 
                className={`flex-1 bg-transparent border-none text-sm focus:outline-none focus:bg-slate-700/50 rounded px-1.5 py-1 transition-colors ${checked ? "text-slate-500 line-through" : "text-slate-200"}`} 
              />
              <button 
                type="button" 
                onClick={() => {
                  const newLines = [...lines];
                  newLines.splice(i, 1);
                  onChange(newLines.join("\n"));
                }} 
                className="text-slate-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all shrink-0 p-1"
                title="Eliminar fila"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
        {(!lines.length || lines[lines.length - 1] !== '') && (
          <button 
             type="button" 
             onClick={() => {
               const newLines = [...lines];
               if (newLines.length > 0 && newLines[0] !== "" && !newLines[newLines.length - 1].startsWith("[ ] ") && !newLines[newLines.length - 1].startsWith("[x] ")) {
                 onChange((notes ? notes + "\n" : "") + "[ ] ");
               } else {
                 onChange((notes ? notes + "\n" : "") + "[ ] ");
               }
             }} 
             className="text-xs text-blue-400 mt-2 px-1 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Agregar ítem
          </button>
        )}
      </div>
    </div>
  );
}

export default function TasksPage() {
  const authUser = useMemo(() => getCurrentUser(), []);
  const currentUserId = useMemo(() => String(authUser?.userId || "").trim(), [authUser?.userId]);
  const userRole = useMemo(() => String(authUser?.role || "").toLowerCase(), [authUser?.role]);
  const canAssignTasks = userRole === "admin" || userRole === "supervisor";

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TaskTab>("all");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [columnBusy, setColumnBusy] = useState(false);
  const [showColumnForm, setShowColumnForm] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [quickTaskId, setQuickTaskId] = useState<number | null>(null);
  const [clientOptions, setClientOptions] = useState<ClientSearchResult[]>([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [columnDraft, setColumnDraft] = useState<ColumnDraft>({ label: "", data_type: "text", options_text: "" });
  const [alarmNow, setAlarmNow] = useState(() => Date.now());
  const [activeAlarmTaskId, setActiveAlarmTaskId] = useState<number | null>(null);
  const [alarmRescheduleDate, setAlarmRescheduleDate] = useState("");
  const [alarmRescheduleTime, setAlarmRescheduleTime] = useState("");
  const [alarmSaving, setAlarmSaving] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>({
    title: "",
    due_date: "",
    follow_up_date: "",
    follow_up_time: "",
    client_id: null,
    client_name: "",
    assigned_user_id: currentUserId || null,
    notes: "",
    status: "pending",
    priority: "normal",
    custom_fields: {}
  });

  const assigneeMap = useMemo(() => {
    const map = new Map<string, TaskAssignee>();
    assignees.forEach((assignee) => map.set(assignee.user_id, assignee));
    return map;
  }, [assignees]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [taskRows, columnRows, assigneeRows] = await Promise.all([
        requestJson<TaskItem[]>("/api/tasks"),
        requestJson<TaskColumn[]>("/api/tasks/columns"),
        requestJson<TaskAssignee[]>("/api/tasks/assignees")
      ]);

      const sortedColumns = [...columnRows].sort((a, b) => a.sort_order - b.sort_order);
      const defaults = defaultsForColumns(sortedColumns);
      const normalizedAssignees = Array.isArray(assigneeRows) ? assigneeRows : [];
      const fallbackAssignee = normalizedAssignees[0]?.user_id || currentUserId || null;

      setColumns(sortedColumns);
      setAssignees(normalizedAssignees);
      setTasks(taskRows.map((task) => ({ ...task, custom_fields: { ...defaults, ...task.custom_fields } })));
      setDraft((prev) => ({
        ...prev,
        assigned_user_id: prev.assigned_user_id || fallbackAssignee,
        custom_fields: { ...defaults, ...prev.custom_fields }
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando tareas");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadData();
    };
    window.addEventListener("modal-refresh", handleRefresh);
    window.addEventListener("refreshTasks", handleRefresh);
    return () => {
      window.removeEventListener("modal-refresh", handleRefresh);
      window.removeEventListener("refreshTasks", handleRefresh);
    };
  }, [loadData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAlarmNow(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const defaults = defaultsForColumns(columns);
    setDraft((prev) => ({ ...prev, custom_fields: { ...defaults, ...prev.custom_fields } }));
    setTasks((prev) => prev.map((task) => ({ ...task, custom_fields: { ...defaults, ...task.custom_fields } })));
    setEditingTask((prev) => (prev ? { ...prev, custom_fields: { ...defaults, ...prev.custom_fields } } : prev));
  }, [columns]);

  const findClientByName = useCallback((value: string) => {
    const needle = value.trim().toLowerCase();
    if (!needle) return null;
    return clientOptions.find((client) => String(client.name || "").trim().toLowerCase() === needle) || null;
  }, [clientOptions]);

  const searchClients = useCallback(async (value: string) => {
    const term = value.trim();
    if (term.length < 2) {
      setClientOptions([]);
      return;
    }
    setClientSearchLoading(true);
    try {
      const rows = await requestJson<ClientSearchResult[]>(`/api/clients/search?q=${encodeURIComponent(term)}`);
      setClientOptions(Array.isArray(rows) ? rows.slice(0, 20) : []);
    } catch {
      setClientOptions([]);
    } finally {
      setClientSearchLoading(false);
    }
  }, []);

  const filteredTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (activeTab === "follow_up") {
         if (!hasTaskFollowUp(task)) return false;
      } else if (activeTab !== "all" && task.status !== activeTab) {
         return false;
      }
      if (!needle) return true;
      const text = `${task.title} ${task.client_name || ""} ${task.notes || ""} ${task.assigned_name || task.assigned_username || ""} ${Object.values(task.custom_fields || {}).join(" ")}`.toLowerCase();
      return text.includes(needle);
    });
  }, [activeTab, query, tasks]);

  const taskAlarmSummary = useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        const alarm = getTaskAlarm(task);
        if (alarm.label === "En alarma" || alarm.label === "Atrasada" || alarm.label === "Seguimiento atrasado") acc.overdue += 1;
        else if (alarm.label === "Hoy" || alarm.label === "Seguimiento hoy") acc.today += 1;
        else if (alarm.label === "Proxima" || alarm.label === "Seguimiento proximo") acc.upcoming += 1;
        return acc;
      },
      { overdue: 0, today: 0, upcoming: 0 }
    );
  }, [tasks]);

  const triggeredAlarmTasks = useMemo(() => {
    return [...tasks]
      .filter((task) => {
        const followUpTimestamp = getTaskFollowUpTimestamp(task);
        if (followUpTimestamp === null || followUpTimestamp > alarmNow) return false;
        const acknowledgedSignature = window.localStorage.getItem(getTaskAlarmAckStorageKey(task.id));
        return acknowledgedSignature !== getTaskAlarmSignature(task);
      })
      .sort((a, b) => {
        const aTime = getTaskFollowUpTimestamp(a) ?? Number.MAX_SAFE_INTEGER;
        const bTime = getTaskFollowUpTimestamp(b) ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
  }, [alarmNow, tasks]);

  const activeAlarmTask = useMemo(() => {
    if (!triggeredAlarmTasks.length) return null;
    return triggeredAlarmTasks.find((task) => task.id === activeAlarmTaskId) || triggeredAlarmTasks[0];
  }, [activeAlarmTaskId, triggeredAlarmTasks]);

  useEffect(() => {
    if (!activeAlarmTask) {
      setActiveAlarmTaskId(null);
      return;
    }
    if (activeAlarmTask.id !== activeAlarmTaskId) {
      setActiveAlarmTaskId(activeAlarmTask.id);
      setAlarmRescheduleDate(activeAlarmTask.follow_up_date || "");
      setAlarmRescheduleTime(activeAlarmTask.follow_up_time || "");
    }
  }, [activeAlarmTask, activeAlarmTaskId]);

  const createTask = useCallback(async () => {
    if (!draft.title.trim()) {
      alert("El titulo es obligatorio.");
      return;
    }
    const matchedClient = findClientByName(draft.client_name);
    const resolvedClientId = draft.client_id ?? (matchedClient ? Number(matchedClient.id) : null);
    const resolvedClientName = matchedClient ? matchedClient.name : draft.client_name.trim() || null;
    const resolvedAssigneeId = draft.assigned_user_id || currentUserId || null;

    setSaving(true);
    try {
      const created = await requestJson<TaskItem>("/api/tasks", {
        method: "POST",
        json: {
          title: draft.title.trim(),
          due_date: draft.due_date || null,
          follow_up_date: draft.follow_up_date || null,
          follow_up_time: draft.follow_up_time || null,
          client_id: resolvedClientId,
          client_name: resolvedClientName,
          assigned_user_id: resolvedAssigneeId,
          notes: draft.notes.trim() || null,
          status: draft.status,
          priority: draft.priority,
          custom_fields: draft.custom_fields
        }
      });
      const assigneeMeta = created.assigned_user_id ? assigneeMap.get(created.assigned_user_id) : null;
      setTasks((prev) => [{ ...created, assigned_name: created.assigned_name || assigneeMeta?.display_name || null }, ...prev]);
      setDraft({
        title: "",
        due_date: "",
        follow_up_date: "",
        follow_up_time: "",
        client_id: null,
        client_name: "",
        assigned_user_id: draft.assigned_user_id || currentUserId || assignees[0]?.user_id || null,
        notes: "",
        status: "pending",
        priority: "normal",
        custom_fields: defaultsForColumns(columns)
      });
      setCreateClientOpen(false);
      setShowCreateModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo crear la tarea");
    } finally {
      setSaving(false);
    }
  }, [assigneeMap, assignees, columns, currentUserId, draft, findClientByName]);

  const saveEdit = useCallback(async () => {
    if (!editingTask) return;
    const matchedClient = findClientByName(editingTask.client_name || "");
    const resolvedClientId = editingTask.client_id ?? (matchedClient ? Number(matchedClient.id) : null);
    const resolvedClientName = matchedClient ? matchedClient.name : editingTask.client_name;
    const resolvedAssigneeId = editingTask.assigned_user_id || currentUserId || null;

    setSaving(true);
    try {
      const updated = await requestJson<TaskItem>(`/api/tasks/${editingTask.id}`, {
        method: "PUT",
        json: {
          title: editingTask.title,
          due_date: editingTask.due_date,
          follow_up_date: editingTask.follow_up_date,
          follow_up_time: editingTask.follow_up_time,
          client_id: resolvedClientId,
          client_name: resolvedClientName,
          assigned_user_id: resolvedAssigneeId,
          notes: editingTask.notes,
          status: editingTask.status,
          priority: editingTask.priority,
          custom_fields: editingTask.custom_fields
        }
      });
      const assigneeMeta = updated.assigned_user_id ? assigneeMap.get(updated.assigned_user_id) : null;
      setTasks((prev) =>
        prev.map((task) =>
          task.id === updated.id
            ? { ...updated, assigned_name: updated.assigned_name || assigneeMeta?.display_name || null }
            : task
        )
      );
      setEditingTask(null);
      setEditClientOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }, [assigneeMap, currentUserId, editingTask, findClientByName]);

  const deleteTask = useCallback(async (id: number) => {
    if (!window.confirm("Eliminar tarea?")) return;
    try {
      await requestJson<{ success: boolean }>(`/api/tasks/${id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((task) => task.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }, []);

  const acknowledgeAlarm = useCallback((task: TaskItem) => {
    window.localStorage.setItem(getTaskAlarmAckStorageKey(task.id), getTaskAlarmSignature(task));
    setActiveAlarmTaskId(null);
  }, []);

  const rescheduleAlarm = useCallback(async () => {
    if (!activeAlarmTask) return;
    if (!alarmRescheduleDate || !alarmRescheduleTime) {
      alert("La fecha y la hora de seguimiento son obligatorias para reprogramar.");
      return;
    }

    setAlarmSaving(true);
    try {
      const updated = await requestJson<TaskItem>(`/api/tasks/${activeAlarmTask.id}`, {
        method: "PUT",
        json: {
          follow_up_date: alarmRescheduleDate,
          follow_up_time: alarmRescheduleTime
        }
      });
      const assigneeMeta = updated.assigned_user_id ? assigneeMap.get(updated.assigned_user_id) : null;
      window.localStorage.removeItem(getTaskAlarmAckStorageKey(updated.id));
      setTasks((prev) =>
        prev.map((task) =>
          task.id === updated.id
            ? { ...updated, assigned_name: updated.assigned_name || assigneeMeta?.display_name || null }
            : task
        )
      );
      setActiveAlarmTaskId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo cambiar la hora");
    } finally {
      setAlarmSaving(false);
    }
  }, [activeAlarmTask, alarmRescheduleDate, alarmRescheduleTime, assigneeMap]);

  const toggleTaskCompleted = useCallback(async (task: TaskItem) => {
    setQuickTaskId(task.id);
    try {
      const nextStatus: TaskStatus = task.status === "done" ? "pending" : "done";
      const updated = await requestJson<TaskItem>(`/api/tasks/${task.id}`, {
        method: "PUT",
        json: { status: nextStatus }
      });
      const assigneeMeta = updated.assigned_user_id ? assigneeMap.get(updated.assigned_user_id) : null;
      setTasks((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? { ...updated, assigned_name: updated.assigned_name || assigneeMeta?.display_name || null }
            : item
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo actualizar estado");
    } finally {
      setQuickTaskId(null);
    }
  }, [assigneeMap]);

  const createColumn = useCallback(async () => {
    if (!columnDraft.label.trim()) {
      alert("El nombre de la columna es obligatorio.");
      return;
    }
    setColumnBusy(true);
    try {
      const created = await requestJson<TaskColumn>("/api/tasks/columns", {
        method: "POST",
        json: { label: columnDraft.label.trim(), data_type: columnDraft.data_type, options: columnDraft.options_text }
      });
      setColumns((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order));
      setColumnDraft({ label: "", data_type: "text", options_text: "" });
      setShowColumnForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo crear la columna");
    } finally {
      setColumnBusy(false);
    }
  }, [columnDraft]);

  const deleteColumn = useCallback(async (column: TaskColumn) => {
    if (!window.confirm(`Eliminar columna "${column.label}"?`)) return;
    setColumnBusy(true);
    try {
      await requestJson<{ success: boolean }>(`/api/tasks/columns/${column.id}`, { method: "DELETE" });
      setColumns((prev) => prev.filter((item) => item.id !== column.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar la columna");
    } finally {
      setColumnBusy(false);
    }
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-white"><CheckSquare className="h-8 w-8 text-blue-400" />Tareas Independientes v2026-362</h1>
        <p className="mt-1 text-sm text-slate-400">Modulo independiente por usuario con fecha limite, seguimiento y columnas personalizadas.</p>
      </div>

      {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"><Plus className="h-4 w-4" />Nueva tarea</button>
            <button type="button" onClick={() => setShowColumnForm((prev) => !prev)} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-xs text-slate-200"><Columns3 className="h-4 w-4" />Columnas</button>
            <button type="button" onClick={() => void loadData()} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-xs text-slate-200"><RefreshCw className="h-4 w-4" />Refrescar</button>
          </div>
          <div className="relative md:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-sm text-white" /></div>
        </div>
        {showColumnForm && (
          <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <input value={columnDraft.label} onChange={(e) => setColumnDraft((prev) => ({ ...prev, label: e.target.value }))} placeholder="Nombre columna" className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
              <select value={columnDraft.data_type} onChange={(e) => setColumnDraft((prev) => ({ ...prev, data_type: e.target.value as ColumnType }))} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">{COLUMN_TYPES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
              <input value={columnDraft.options_text} onChange={(e) => setColumnDraft((prev) => ({ ...prev, options_text: e.target.value }))} placeholder="Opciones separadas por coma" className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white md:col-span-2" />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={columnBusy} onClick={() => void createColumn()} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">{columnBusy ? "Guardando..." : "Agregar columna"}</button>
              {columns.map((col) => <button key={col.id} type="button" onClick={() => void deleteColumn(col)} className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200"><Trash2 className="h-3 w-3" />{col.label}</button>)}
            </div>
          </div>
        )}
        <div className="mb-3 flex flex-wrap gap-2">
            {TASK_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-lg px-3 py-2 text-sm ${
                  activeTab === tab.value
                    ? "border border-blue-400/40 bg-blue-500/20 text-blue-100"
                    : "border border-slate-700 bg-slate-800 text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-red-200">Atrasadas: {taskAlarmSummary.overdue}</span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">Hoy: {taskAlarmSummary.today}</span>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">Proximas: {taskAlarmSummary.upcoming}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400"><th className="px-2 py-3">Cliente</th><th className="px-2 py-3">Tarea</th><th className="px-2 py-3">Asignado a</th><th className="px-2 py-3">Fecha limite</th><th className="px-2 py-3">Seguimiento</th><th className="px-2 py-3">Alarma</th><th className="px-2 py-3">Estado</th><th className="px-2 py-3">Prioridad</th>{columns.map((col) => <th key={col.id} className="px-2 py-3">{col.label}</th>)}<th className="px-2 py-3">Acciones</th></tr></thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr><td colSpan={9 + columns.length} className="px-2 py-8 text-center text-slate-500">No hay tareas.</td></tr>
              ) : (
                filteredTasks.map((task) => {
                  const assigneeLabel = task.assigned_name || task.assigned_username || (task.assigned_user_id ? assigneeMap.get(task.assigned_user_id)?.display_name : null) || "-";
                  const isMine = task.assigned_user_id && currentUserId && String(task.assigned_user_id) === currentUserId;
                  const alarm = getTaskAlarm(task);
                  return (
                    <tr key={task.id} className="border-b border-slate-800">
                      <td className={`px-2 py-2 ${task.status === "done" ? "text-slate-500" : "text-slate-200"}`}>
                        {(task.client_id || task.client_name) ? (
                          <Link to={`/clientes?q=${encodeURIComponent(task.client_id || task.client_name || "")}`} className="flex items-center gap-1 font-medium hover:text-blue-400 transition-colors group">
                            {task.client_name || "-"} <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        ) : (
                          <div>-</div>
                        )}
                        {task.client_id ? <div className="text-[11px] text-slate-500">ID {task.client_id}</div> : null}
                      </td>
                      <td className={`px-2 py-2 ${task.status === "done" ? "text-slate-500 line-through" : "text-white"}`}>{task.title}</td>
                      <td className={`px-2 py-2 ${task.status === "done" ? "text-slate-500" : "text-slate-200"}`}>
                        <div>{assigneeLabel}</div>
                        {isMine ? <div className="text-[11px] text-emerald-400">Yo</div> : null}
                      </td>
                      <td className={`px-2 py-2 ${task.status === "done" ? "text-slate-500" : "text-slate-200"}`}>{task.due_date || "-"}</td>
                      <td className={`px-2 py-2 ${task.status === "done" ? "text-blue-200" : "text-slate-200"}`}>{formatFollowUp(task)}</td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${alarm.tone}`}>{alarm.label}</span>
                      </td>
                      <td className="px-2 py-2 text-slate-200">{getTaskStatusLabel(task)}</td>
                      <td className="px-2 py-2 text-slate-200">{PRIORITY_OPTIONS.find((p) => p.value === task.priority)?.label || task.priority}</td>
                      {columns.map((col) => <td key={col.id} className="px-2 py-2 text-slate-200">{String(task.custom_fields?.[col.column_key] ?? "-")}</td>)}
                      <td className="px-2 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void toggleTaskCompleted(task)}
                            disabled={quickTaskId === task.id}
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${
                              task.status === "done"
                                ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                                : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                            } disabled:opacity-60`}
                          >
                            {quickTaskId === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            {task.status === "done" ? "Reabrir" : "Completar"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingTask({
                                ...task,
                                assigned_user_id: task.assigned_user_id || task.owner_user_id || currentUserId || null,
                                custom_fields: { ...task.custom_fields }
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
                          >
                            <Pencil className="h-3 w-3" />Editar
                          </button>
                          <button type="button" onClick={() => void deleteTask(task.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200"><Trash2 className="h-3 w-3" />Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CREAR TAREA */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-6xl rounded-2xl border border-slate-700 bg-slate-900 p-5" style={{ maxHeight: '95vh', overflowY: 'auto' }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Nueva tarea</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-md p-1 text-slate-300 hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Título de la tarea *</label>
                <input value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="Descripción breve de la tarea" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha límite</label>
                <input type="date" value={draft.due_date} onChange={(e) => setDraft((prev) => ({ ...prev, due_date: e.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha seguimiento</label>
                <input type="date" value={draft.follow_up_date} onChange={(e) => setDraft((prev) => ({ ...prev, follow_up_date: e.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Hora seguimiento</label>
                <input type="time" value={draft.follow_up_time} onChange={(e) => setDraft((prev) => ({ ...prev, follow_up_time: e.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
              </div>
              <div className="relative">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Cliente</label>
                <input
                  value={draft.client_name}
                  onChange={(e) => {
                    const value = e.target.value;
                    const matched = findClientByName(value);
                    setDraft((prev) => ({ ...prev, client_name: value, client_id: matched ? Number(matched.id) : null }));
                    setCreateClientOpen(true);
                    void searchClients(value);
                  }}
                  onFocus={() => { setCreateClientOpen(true); void searchClients(draft.client_name); }}
                  onBlur={() => { window.setTimeout(() => setCreateClientOpen(false), 120); }}
                  placeholder="Buscar cliente..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                />
                {clientSearchLoading && <Loader2 className="absolute right-2 top-8 h-4 w-4 animate-spin text-slate-400" />}
                {createClientOpen && (clientOptions.length > 0 || clientSearchLoading) ? (
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                    {clientOptions.map((client) => (
                      <button key={client.id} type="button" onMouseDown={(e) => { e.preventDefault(); setDraft((prev) => ({ ...prev, client_name: client.name, client_id: client.id })); setCreateClientOpen(false); }} className="block w-full border-b border-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800">
                        <div className="font-medium">{client.name}</div>
                        {client.business_name ? <div className="text-xs text-slate-400">{client.business_name}</div> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {canAssignTasks ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Asignar a</label>
                  <select value={draft.assigned_user_id || ""} onChange={(e) => setDraft((prev) => ({ ...prev, assigned_user_id: e.target.value || null }))} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
                    <option value="">Sin asignar</option>
                    {assignees.map((a) => <option key={a.user_id} value={a.user_id}>{a.display_name} ({a.role})</option>)}
                  </select>
                </div>
              ) : null}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</label>
                <select value={draft.status} onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as TaskStatus }))} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">{STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Prioridad</label>
                <select value={draft.priority} onChange={(e) => setDraft((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">{PRIORITY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</label>
                <button type="button" onClick={() => setDraft(prev => ({ ...prev, notes: prev.notes + (prev.notes ? '\n\n' : '') + `[${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}]: ` }))} className="text-xs text-blue-400 hover:text-blue-300 font-semibold bg-blue-500/10 px-2 py-1 rounded border border-blue-500/30">+ Auto Fecha</button>
              </div>
              <NotesChecklistEditor notes={draft.notes} onChange={(v) => setDraft((prev) => ({ ...prev, notes: v }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200">Cancelar</button>
              <button type="button" disabled={saving} onClick={() => void createTask()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Crear tarea</button>
            </div>
          </div>
        </div>
      )}

      {activeAlarmTask && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-red-500/30 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <AlertTriangle className="h-6 w-6 text-red-300" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Alarma de tarea</h3>
                <p className="text-sm text-slate-300">Esta pantalla queda bloqueada hasta confirmar la alarma o cambiar la hora.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Cliente</div>
                <div className="mt-1 font-semibold text-white">{activeAlarmTask.client_name || "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Asignado a</div>
                <div className="mt-1 font-semibold text-white">{activeAlarmTask.assigned_name || activeAlarmTask.assigned_username || "-"}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">Tarea</div>
                <div className="mt-1 font-semibold text-white">{activeAlarmTask.title}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Seguimiento actual</div>
                <div className="mt-1 font-semibold text-red-200">{formatFollowUp(activeAlarmTask)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Estado</div>
                <div className="mt-1 font-semibold text-white">{getTaskStatusLabel(activeAlarmTask)}</div>
              </div>
            </div>

            {activeAlarmTask.notes ? (
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-300">
                {activeAlarmTask.notes}
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                type="date"
                value={alarmRescheduleDate}
                onChange={(e) => setAlarmRescheduleDate(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              />
              <input
                type="time"
                value={alarmRescheduleTime}
                onChange={(e) => setAlarmRescheduleTime(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => acknowledgeAlarm(activeAlarmTask)}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
              >
                Confirmar alarma
              </button>
              <button
                type="button"
                onClick={() => void rescheduleAlarm()}
                disabled={alarmSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {alarmSaving ? "Guardando..." : "Cambiar hora"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-6xl rounded-2xl border border-slate-700 bg-slate-900 p-5" style={{ maxHeight: '95vh', overflowY: 'auto' }}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-semibold text-white">Editar tarea</h3><button type="button" onClick={() => setEditingTask(null)} className="rounded-md p-1 text-slate-300 hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input value={editingTask.title} onChange={(e) => setEditingTask((prev) => (prev ? { ...prev, title: e.target.value } : prev))} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
              <input type="date" value={editingTask.due_date || ""} onChange={(e) => setEditingTask((prev) => (prev ? { ...prev, due_date: e.target.value || null } : prev))} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
              <input type="date" value={editingTask.follow_up_date || ""} onChange={(e) => setEditingTask((prev) => (prev ? { ...prev, follow_up_date: e.target.value || null } : prev))} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
              <input type="time" value={editingTask.follow_up_time || ""} onChange={(e) => setEditingTask((prev) => (prev ? { ...prev, follow_up_time: e.target.value || null } : prev))} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
              <div className="relative">
                <input
                  value={editingTask.client_name || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    const matched = findClientByName(value);
                    setEditingTask((prev) =>
                      prev ? { ...prev, client_name: value, client_id: matched ? matched.id : null } : prev
                    );
                    setEditClientOpen(true);
                    void searchClients(value);
                  }}
                  onFocus={() => {
                    setEditClientOpen(true);
                    void searchClients(editingTask.client_name || "");
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setEditClientOpen(false), 120);
                  }}
                  placeholder="Cliente (BD)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                />
                {clientSearchLoading && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
                {editClientOpen && (clientOptions.length > 0 || clientSearchLoading) ? (
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                    {clientOptions.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setEditingTask((prev) =>
                            prev ? { ...prev, client_name: client.name, client_id: client.id } : prev
                          );
                          setEditClientOpen(false);
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
              {canAssignTasks ? (
                <select
                  value={editingTask.assigned_user_id || ""}
                  onChange={(e) => setEditingTask((prev) => (prev ? { ...prev, assigned_user_id: e.target.value || null } : prev))}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                >
                  <option value="">Asignar a...</option>
                  {assignees.map((assignee) => (
                    <option key={assignee.user_id} value={assignee.user_id}>
                      {assignee.display_name} ({assignee.role})
                    </option>
                  ))}
                </select>
              ) : null}
              <select value={editingTask.status} onChange={(e) => setEditingTask((prev) => (prev ? { ...prev, status: e.target.value as TaskStatus } : prev))} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">{STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              <select value={editingTask.priority} onChange={(e) => setEditingTask((prev) => (prev ? { ...prev, priority: e.target.value as TaskPriority } : prev))} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">{PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</label>
                <button type="button" onClick={() => setEditingTask(prev => prev ? ({ ...prev, notes: (prev.notes || '') + (prev.notes ? '\n\n' : '') + `[${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}]: ` }) : prev)} className="text-xs text-blue-400 hover:text-blue-300 font-semibold bg-blue-500/10 px-2 py-1 rounded border border-blue-500/30">+ Auto Fecha</button>
              </div>
              <NotesChecklistEditor notes={editingTask.notes || ""} onChange={(v) => setEditingTask((prev) => (prev ? { ...prev, notes: v } : prev))} />
            </div>
            {columns.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {columns.map((col) => (
                <div key={col.id}>
                  {col.data_type === "checkbox" ? (
                    <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(editingTask.custom_fields[col.column_key])}
                        onChange={(e) =>
                          setEditingTask((prev) =>
                            prev ? { ...prev, custom_fields: { ...prev.custom_fields, [col.column_key]: e.target.checked } } : prev
                          )
                        }
                      />
                      {col.label}
                    </label>
                  ) : col.data_type === "select" ? (
                    <select
                      value={String(editingTask.custom_fields[col.column_key] ?? "")}
                      onChange={(e) =>
                        setEditingTask((prev) =>
                          prev ? { ...prev, custom_fields: { ...prev.custom_fields, [col.column_key]: e.target.value } } : prev
                        )
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                    >
                      <option value="">{col.label}</option>
                      {col.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input
                      type={col.data_type === "date" ? "date" : col.data_type === "number" ? "number" : "text"}
                      value={String(editingTask.custom_fields[col.column_key] ?? "")}
                      onChange={(e) =>
                        setEditingTask((prev) =>
                          prev ? { ...prev, custom_fields: { ...prev.custom_fields, [col.column_key]: e.target.value } } : prev
                        )
                      }
                      placeholder={col.label}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                    />
                  )}
                </div>
              ))}
            </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingTask(null)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200">Cancelar</button>
              <button type="button" disabled={saving} onClick={() => void saveEdit()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">{saving ? "Guardando..." : "Guardar cambios"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
