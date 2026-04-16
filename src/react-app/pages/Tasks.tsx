import { CheckCircle2, ClipboardList, Download, GripVertical, Loader2, Pencil, Plus, Trash2, Upload, UserCircle2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useLocation, useNavigate } from "react-router";
import PersonalTaskModal, { type PersonalTaskFormValue } from "@/react-app/components/tasks/PersonalTaskModal";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

const OPEN_CLIENT_INTENT_KEY = "crm_open_client_task_intent";

interface TaskAssignee {
  user_id: string;
  display_name: string;
  role: string;
}

interface PersonalTaskItem {
  id: number;
  owner_user_id: string;
  assigned_user_id: string | null;
  assigned_username?: string | null;
  assigned_name?: string | null;
  title: string;
  due_date?: string | null;
  follow_up_date?: string | null;
  follow_up_time?: string | null;
  notes?: string | null;
  status: "pending" | "in_progress" | "done";
  priority: "low" | "normal" | "high";
  task_kind?: "regular" | "client";
  created_at?: string | null;
  updated_at?: string | null;
}

interface DealTaskBoardItem {
  id: number;
  deal_id: number;
  step_name: string;
  step_order: number;
  status: "pending" | "in_progress" | "done";
  assigned_to: string | null;
  assigned_name?: string | null;
  client_id: string | null;
  client_name: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
  product_type: string;
  sale_type: string;
  source_label?: string | null;
  ban_number?: string | null;
  phone?: string | null;
  total_steps: number;
  completed_steps: number;
  created_at?: string | null;
  updated_at?: string | null;
  deal_created_at?: string | null;
}

interface DealBoardRow extends DealTaskBoardItem {
  pending_steps: number;
}

interface LegacyWorkflowStep {
  id?: string | null;
  label?: string | null;
  is_done?: boolean | null;
}

interface LegacyClientWorkflowItem {
  id: number;
  client_id: string | null;
  client_name: string | null;
  salesperson_name?: string | null;
  assigned_user_id?: string | null;
  assigned_username?: string | null;
  assigned_name?: string | null;
  product_key?: string | null;
  product_name?: string | null;
  source_label?: string | null;
  ban_number?: string | null;
  phone?: string | null;
  line_type?: string | null;
  sale_type?: string | null;
  workflow_steps?: LegacyWorkflowStep[] | null;
  status: "pending" | "in_progress" | "done";
  created_at?: string | null;
  updated_at?: string | null;
}

type TasksTab = "clientes" | "personales";
type PersonalStatusFilter = "all" | "pending" | "in_progress" | "done";

async function requestJson<T>(url: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...rest } = init;
  const response = await authFetch(url, json !== undefined ? { ...rest, json } : rest);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Error de red" }));
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function buildDefaultTask(currentUserId: string | null): PersonalTaskFormValue {
  return {
    title: "",
    due_date: "",
    follow_up_date: "",
    follow_up_time: "",
    assigned_user_id: currentUserId,
    notes: "",
    status: "pending",
    priority: "normal"
  };
}

function priorityLabel(priority: PersonalTaskItem["priority"]) {
  if (priority === "high") return "Alta";
  if (priority === "low") return "Baja";
  return "Normal";
}

function formatSaleType(value: string) {
  if (value === "REN") return "Renovacion";
  if (value === "NEW") return "Nueva";
  return value || "-";
}

function dealTaskPriority(task: DealTaskBoardItem) {
  if (task.status === "in_progress") return 0;
  if (task.status === "pending") return 1;
  return 2;
}

function getLegacyWorkflowProgress(steps: LegacyWorkflowStep[] | null | undefined) {
  const normalized = Array.isArray(steps) ? steps : [];
  const total = normalized.length;
  const completed = normalized.filter((step) => Boolean(step?.is_done)).length;
  const nextIndex = normalized.findIndex((step) => !step?.is_done);
  const currentStep = normalized[nextIndex >= 0 ? nextIndex : Math.max(total - 1, 0)] || null;

  return {
    total,
    completed,
    currentLabel: String(currentStep?.label || "Sin pasos"),
    currentOrder: nextIndex >= 0 ? nextIndex + 1 : total > 0 ? total : 1
  };
}

function statusLabel(status: PersonalTaskItem["status"]) {
  if (status === "done") return "Completada";
  if (status === "in_progress") return "En progreso";
  return "Pendiente";
}

function statusClasses(status: PersonalTaskItem["status"]) {
  if (status === "done") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "in_progress") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-slate-600 bg-slate-800 text-slate-200";
}

function priorityClasses(priority: PersonalTaskItem["priority"]) {
  if (priority === "high") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (priority === "low") return "border-slate-600 bg-slate-800 text-slate-300";
  return "border-blue-500/30 bg-blue-500/10 text-blue-200";
}

export default function TasksPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useMemo(() => getCurrentUser(), []);
  const currentUserId = String(currentUser?.userId || "").trim() || null;
  const role = String(currentUser?.role || "").toLowerCase();
  const canAssignTasks = role === "admin" || role === "supervisor";
  const hasExplicitTabParam = useMemo(() => new URLSearchParams(location.search).has("tab"), [location.search]);

  const queryTab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("tab") === "personales" ? "personales" : "clientes";
  }, [location.search]);

  const [activeTab, setActiveTab] = useState<TasksTab>(queryTab);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [deletingPersonalId, setDeletingPersonalId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [personalStatusFilter, setPersonalStatusFilter] = useState<PersonalStatusFilter>("all");
  const [dealTasks, setDealTasks] = useState<DealTaskBoardItem[]>([]);
  const [personalTasks, setPersonalTasks] = useState<PersonalTaskItem[]>([]);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<PersonalTaskItem | null>(null);
  const [draft, setDraft] = useState<PersonalTaskFormValue>(buildDefaultTask(currentUserId));
  const [importingTasks, setImportingTasks] = useState(false);
  const [orderedTaskIds, setOrderedTaskIds] = useState<number[]>([]);
  const dragId = useRef<number | null>(null);
  const dragOverId = useRef<number | null>(null);
  const [dragActiveId, setDragActiveId] = useState<number | null>(null);

  useEffect(() => {
    setActiveTab(queryTab);
  }, [queryTab]);

  const syncLocationTab = useCallback((tab: TasksTab) => {
    const params = new URLSearchParams(location.search);
    params.set("tab", tab);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const loadClientWorkflows = useCallback(async () => {
    setLoadingClients(true);
    try {
      const [dealTaskResult, legacyResult] = await Promise.allSettled([
        requestJson<DealTaskBoardItem[]>("/api/deal-tasks?pending_only=1"),
        requestJson<LegacyClientWorkflowItem[]>("/api/client-product-workflows?pending_only=1")
      ]);

      const nextRows: DealTaskBoardItem[] = [];

      if (dealTaskResult.status === "fulfilled") {
        nextRows.push(...dealTaskResult.value);
      } else {
        console.error("Error cargando tareas pendientes por venta:", dealTaskResult.reason);
      }

      if (legacyResult.status === "fulfilled") {
        nextRows.push(
          ...legacyResult.value.map((workflow) => {
            const progress = getLegacyWorkflowProgress(workflow.workflow_steps);
            return {
              id: workflow.id,
              deal_id: -Math.abs(Number(workflow.id)),
              step_name: progress.currentLabel,
              step_order: progress.currentOrder,
              status: workflow.status,
              assigned_to: workflow.assigned_user_id || null,
              assigned_name: workflow.assigned_name || workflow.assigned_username || null,
              client_id: workflow.client_id || null,
              client_name: workflow.client_name || null,
              seller_id: null,
              seller_name: workflow.salesperson_name || null,
              product_type: workflow.product_name || workflow.product_key || "Producto",
              sale_type: String(workflow.sale_type || workflow.line_type || "").trim().toUpperCase(),
              source_label: workflow.source_label || null,
              ban_number: workflow.ban_number || null,
              phone: workflow.phone || null,
              total_steps: progress.total,
              completed_steps: progress.completed,
              created_at: workflow.created_at || null,
              updated_at: workflow.updated_at || null,
              deal_created_at: workflow.created_at || null
            };
          })
        );
      } else {
        console.error("Error cargando workflows legacy:", legacyResult.reason);
      }

      setDealTasks(nextRows);
    } catch (error) {
      console.error("Error cargando bandeja de clientes:", error);
      setDealTasks([]);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  const loadPersonalTasks = useCallback(async () => {
    setLoadingPersonal(true);
    try {
      const [taskRows, assigneeRows] = await Promise.all([
        requestJson<PersonalTaskItem[]>("/api/tasks"),
        requestJson<TaskAssignee[]>("/api/tasks/assignees")
      ]);
      setPersonalTasks(taskRows.filter((task) => task.task_kind !== "client"));
      setAssignees(assigneeRows);
      setDraft((prev) => ({ ...prev, assigned_user_id: prev.assigned_user_id || currentUserId }));
    } catch (error) {
      console.error("Error cargando tareas personales:", error);
      setPersonalTasks([]);
      setAssignees([]);
    } finally {
      setLoadingPersonal(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void Promise.all([loadClientWorkflows(), loadPersonalTasks()]);
  }, [loadClientWorkflows, loadPersonalTasks]);

  // Sync order when tasks load (new tasks go to end, deleted tasks removed)
  useEffect(() => {
    setOrderedTaskIds((prev) => {
      const ids = personalTasks.map((t) => t.id);
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [personalTasks]);

  const clientRows = useMemo<DealBoardRow[]>(() => {
    const byDealId = new Map<number, DealBoardRow>();

    dealTasks.forEach((task) => {
      const existing = byDealId.get(task.deal_id);
      const pendingSteps = Math.max(task.total_steps - task.completed_steps, 0);

      if (!existing) {
        byDealId.set(task.deal_id, { ...task, pending_steps: pendingSteps });
        return;
      }

      const existingPriority = dealTaskPriority(existing);
      const nextPriority = dealTaskPriority(task);
      const shouldReplace = nextPriority < existingPriority
        || (nextPriority === existingPriority && task.step_order < existing.step_order)
        || (!existing.updated_at && Boolean(task.updated_at));

      if (shouldReplace) {
        byDealId.set(task.deal_id, { ...task, pending_steps: pendingSteps });
      } else if (pendingSteps > existing.pending_steps) {
        byDealId.set(task.deal_id, { ...existing, pending_steps });
      }
    });

    return Array.from(byDealId.values()).sort((left, right) => {
      const priorityDiff = dealTaskPriority(left) - dealTaskPriority(right);
      if (priorityDiff !== 0) return priorityDiff;
      const leftUpdated = left.updated_at ? new Date(left.updated_at).getTime() : 0;
      const rightUpdated = right.updated_at ? new Date(right.updated_at).getTime() : 0;
      return rightUpdated - leftUpdated;
    });
  }, [dealTasks]);

  const filteredClientWorkflows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return clientRows.filter((workflow) => {
      if (!term) return true;
      return [
        workflow.client_name,
        workflow.product_type,
        workflow.sale_type,
        workflow.step_name,
        workflow.source_label,
        workflow.ban_number,
        workflow.phone,
        workflow.assigned_name,
        workflow.seller_name
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [clientRows, searchTerm]);

  const filteredPersonalTasks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return personalTasks.filter((task) => {
      if (personalStatusFilter !== "all" && task.status !== personalStatusFilter) {
        return false;
      }
      if (!term) return true;
      return [task.title, task.notes, task.assigned_name, task.assigned_username]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [personalStatusFilter, personalTasks, searchTerm]);

  const clientStats = useMemo(() => ({
    total: clientRows.length,
    pending: clientRows.filter((workflow) => workflow.status === "pending").length,
    inProgress: clientRows.filter((workflow) => workflow.status === "in_progress").length
  }), [clientRows]);

  const personalStats = useMemo(() => ({
    total: personalTasks.length,
    pending: personalTasks.filter((task) => task.status === "pending").length,
    inProgress: personalTasks.filter((task) => task.status === "in_progress").length,
    done: personalTasks.filter((task) => task.status === "done").length
  }), [personalTasks]);

  useEffect(() => {
    if (loadingClients || loadingPersonal || hasExplicitTabParam) {
      return;
    }

    if (activeTab === "clientes" && clientStats.total === 0 && personalStats.total > 0) {
      setActiveTab("personales");
      syncLocationTab("personales");
    }
  }, [
    activeTab,
    clientStats.total,
    hasExplicitTabParam,
    loadingClients,
    loadingPersonal,
    personalStats.total,
    syncLocationTab
  ]);

  const openClientProfile = useCallback((workflow: DealBoardRow) => {
    if (!workflow.client_id) return;
    try {
      window.sessionStorage.setItem(
        OPEN_CLIENT_INTENT_KEY,
        JSON.stringify({ clientId: workflow.client_id, tab: "pasos" })
      );
    } catch {
      // Ignore session storage failures.
    }
    navigate(`/clientes?openClient=${encodeURIComponent(String(workflow.client_id))}&tab=pasos`);
  }, [navigate]);

  const handleCreatePersonalTask = useCallback(async () => {
    if (!draft.title.trim()) {
      window.alert("El titulo es obligatorio.");
      return;
    }

    setSavingPersonal(true);
    try {
      const created = await requestJson<PersonalTaskItem>("/api/tasks", {
        method: "POST",
        json: {
          ...draft,
          title: draft.title.trim(),
          notes: draft.notes?.trim() || null,
          task_kind: "regular",
          client_id: null,
          client_name: null
        }
      });
      setPersonalTasks((prev) => [created, ...prev]);
      setDraft(buildDefaultTask(currentUserId));
      setShowCreateModal(false);
      setActiveTab("personales");
      syncLocationTab("personales");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo crear la tarea");
    } finally {
      setSavingPersonal(false);
    }
  }, [currentUserId, draft, syncLocationTab]);

  const handleSavePersonalTask = useCallback(async () => {
    if (!editingTask) return;
    if (!editingTask.title.trim()) {
      window.alert("El titulo es obligatorio.");
      return;
    }

    setSavingPersonal(true);
    try {
      const updated = await requestJson<PersonalTaskItem>(`/api/tasks/${editingTask.id}`, {
        method: "PUT",
        json: {
          title: editingTask.title.trim(),
          due_date: editingTask.due_date || null,
          follow_up_date: editingTask.follow_up_date || null,
          follow_up_time: editingTask.follow_up_time || null,
          assigned_user_id: editingTask.assigned_user_id || null,
          notes: editingTask.notes?.trim() || null,
          status: editingTask.status,
          priority: editingTask.priority,
          task_kind: "regular",
          client_id: null,
          client_name: null
        }
      });
      setPersonalTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
      setEditingTask(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo guardar la tarea");
    } finally {
      setSavingPersonal(false);
    }
  }, [editingTask]);

  const handleDeletePersonalTask = useCallback(async (taskId: number) => {
    if (!window.confirm("Esta seguro de eliminar esta tarea personal?")) {
      return;
    }
    setDeletingPersonalId(taskId);
    try {
      await requestJson(`/api/tasks/${taskId}`, { method: "DELETE" });
      setPersonalTasks((prev) => prev.filter((task) => task.id !== taskId));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo eliminar la tarea");
    } finally {
      setDeletingPersonalId(null);
    }
  }, []);

  const handleQuickStatus = useCallback(async (task: PersonalTaskItem, status: PersonalTaskItem["status"]) => {
    try {
      const updated = await requestJson<PersonalTaskItem>(`/api/tasks/${task.id}`, {
        method: "PUT",
        json: { status, task_kind: "regular" }
      });
      setPersonalTasks((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo actualizar la tarea");
    }
  }, []);

  const handleExport = useCallback(() => {
    const rows = personalTasks.map((t) => ({
      titulo: t.title,
      prioridad: t.priority,
      estado: t.status,
      fecha_limite: t.due_date ?? "",
      fecha_seguimiento: t.follow_up_date ?? "",
      hora_seguimiento: t.follow_up_time ?? "",
      asignado_a: t.assigned_username ?? t.assigned_name ?? "",
      cliente: "",
      notas: t.notes ?? "",
    }));
    const header = Object.keys(rows[0] ?? {}).join(",");
    const csv = [
      header,
      ...rows.map((r) =>
        Object.values(r)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tareas-personales-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [personalTasks]);

  const handleImport = useCallback(async (file: File) => {
    setImportingTasks(true);
    try {
      const STATUS_MAP: Record<string, string> = {
        pending: "pending", pendiente: "pending",
        in_progress: "in_progress", "en progreso": "in_progress",
        done: "done", completado: "done", listo: "done",
      };
      const PRIORITY_MAP: Record<string, string> = {
        low: "low", baja: "low", normal: "normal", high: "high", alta: "high",
      };

      // Parse file → rows of {header: value} objects using SheetJS (handles Excel + CSV)
      let rows: Record<string, string>[] = [];

      const isCsv = /\.(csv|tsv|txt)$/i.test(file.name);
      let raw: Record<string, unknown>[];
      if (isCsv) {
        const text = await file.text();
        const wb = XLSX.read(text, { type: "string", raw: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      }

      if (!raw.length) { window.alert("El archivo está vacío o no tiene datos."); return; }

      rows = raw.map((r) => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(r)) {
          out[String(k).trim().toLowerCase()] = String(v ?? "").trim();
        }
        return out;
      });

      const get = (row: Record<string, string>, ...keys: string[]) => {
        for (const k of keys) if (row[k]) return row[k];
        return "";
      };

      let imported = 0;
      let errors = 0;
      for (const row of rows) {
        const title = get(row, "titulo", "title", "tarea", "nombre", "task");
        if (!title) continue;
        const status = STATUS_MAP[get(row, "estado", "status").toLowerCase()] ?? "pending";
        const priority = PRIORITY_MAP[get(row, "prioridad", "priority").toLowerCase()] ?? "normal";
        const due_date = get(row, "fecha_limite", "due_date", "vence", "vencimiento", "fecha") || null;
        const follow_up_date = get(row, "fecha_seguimiento", "follow_up_date", "seguimiento", "followup") || null;
        const follow_up_time = get(row, "hora_seguimiento", "follow_up_time", "hora", "hora_seguimiento", "time") || null;
        const notes = get(row, "notas", "notes", "descripcion", "description", "nota") || null;
        try {
          const created = await requestJson<PersonalTaskItem>("/api/tasks", {
            method: "POST",
            json: { title, status, priority, due_date, follow_up_date, follow_up_time, notes, task_kind: "regular", assigned_user_id: currentUserId },
          });
          setPersonalTasks((prev) => [created, ...prev]);
          imported++;
        } catch { errors++; }
      }
      window.alert(`Importación completada: ${imported} tareas importadas${errors ? `, ${errors} errores` : ""}.`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error al importar el archivo.");
    } finally {
      setImportingTasks(false);
    }
  }, [currentUserId]);

  const handleDragStart = useCallback((id: number) => {
    dragId.current = id;
    setDragActiveId(id);
  }, []);

  const handleDragEnter = useCallback((id: number) => {
    dragOverId.current = id;
  }, []);

  const handleDragEnd = useCallback(() => {
    const from = dragId.current;
    const to = dragOverId.current;
    if (from !== null && to !== null && from !== to) {
      setOrderedTaskIds((prev) => {
        const next = [...prev];
        const fromIdx = next.indexOf(from);
        const toIdx = next.indexOf(to);
        if (fromIdx === -1 || toIdx === -1) return prev;
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, from);
        return next;
      });
    }
    dragId.current = null;
    dragOverId.current = null;
    setDragActiveId(null);
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-200">
              Modulo de tareas
            </div>
            <h1 className="text-3xl font-semibold text-white">Tareas</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-300">
              Pendientes trae los pasos faltantes de clientes. Tareas personales es independiente: solo depende de lo que creas, editas o eliminas aqui.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true);
                setEditingTask(null);
                setDraft(buildDefaultTask(currentUserId));
                setActiveTab("personales");
                syncLocationTab("personales");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              <Plus className="h-4 w-4" />
              Nueva tarea personal
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={personalTasks.length === 0}
              title="Exportar tareas personales a CSV"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Exportar
            </button>

            <label
              title="Importar tareas desde CSV"
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 ${importingTasks ? "opacity-50 pointer-events-none" : ""}`}
            >
              {importingTasks ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.ods"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await handleImport(file);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void Promise.all([loadClientWorkflows(), loadPersonalTasks()])}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
            >
              Refrescar
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("clientes");
              syncLocationTab("clientes");
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              activeTab === "clientes" ? "bg-violet-600 text-white" : "border border-slate-700 bg-slate-800 text-slate-200"
            }`}
          >
            Pendientes ({clientStats.total})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("personales");
              syncLocationTab("personales");
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              activeTab === "personales" ? "bg-blue-600 text-white" : "border border-slate-700 bg-slate-800 text-slate-200"
            }`}
          >
            Tareas personales ({personalStats.total})
          </button>
        </div>

        {!loadingClients && !loadingPersonal ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("clientes");
                syncLocationTab("clientes");
              }}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                activeTab === "clientes"
                  ? "border-violet-500/40 bg-violet-500/10"
                  : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-violet-200">Pendientes</div>
              <div className="mt-2 text-2xl font-semibold text-white">{clientStats.total}</div>
              <div className="mt-1 text-xs text-slate-400">
                {clientStats.pending} pendientes, {clientStats.inProgress} en proceso
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("personales");
                syncLocationTab("personales");
              }}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                activeTab === "personales"
                  ? "border-blue-500/40 bg-blue-500/10"
                  : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Personales</div>
              <div className="mt-2 text-2xl font-semibold text-white">{personalStats.total}</div>
              <div className="mt-1 text-xs text-slate-400">
                {personalStats.pending} pendientes, {personalStats.inProgress} en proceso, {personalStats.done} completadas
              </div>
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={activeTab === "clientes" ? "Buscar cliente, producto, vendedor o paso..." : "Buscar tarea personal..."}
            className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-white lg:max-w-md"
          />

          {activeTab === "personales" ? (
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: `Todas (${personalStats.total})` },
                { value: "pending", label: `Pendientes (${personalStats.pending})` },
                { value: "in_progress", label: `En proceso (${personalStats.inProgress})` },
                { value: "done", label: `Completadas (${personalStats.done})` }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPersonalStatusFilter(option.value as PersonalStatusFilter)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    personalStatusFilter === option.value
                      ? "bg-blue-600 text-white"
                      : "border border-slate-700 bg-slate-800 text-slate-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-slate-200">
                Pendientes: {clientStats.pending}
              </span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">
                En proceso: {clientStats.inProgress}
              </span>
            </div>
          )}
        </div>
      </div>

      {activeTab === "clientes" ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl">
          {loadingClients ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
                Cargando pasos pendientes...
            </div>
          ) : filteredClientWorkflows.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-300">No hay pasos pendientes de clientes.</p>
              {personalStats.total > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("personales");
                    syncLocationTab("personales");
                  }}
                  className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-200 hover:bg-blue-500/20"
                >
                  Ver tareas personales ({personalStats.total})
                </button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-3">Cliente</th>
                    <th className="px-3 py-3">Vendedor</th>
                    <th className="px-3 py-3">Producto</th>
                    <th className="px-3 py-3">Fuente</th>
                    <th className="px-3 py-3">Progreso</th>
                    <th className="px-3 py-3">Paso actual</th>
                    <th className="px-3 py-3">Asignado</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Actualizado</th>
                    <th className="px-3 py-3 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClientWorkflows.map((workflow) => {
                    const progressTotal = Math.max(workflow.total_steps, 0);
                    const progressCompleted = Math.max(workflow.completed_steps, 0);
                    const progressPercent = progressTotal > 0 ? Math.round((progressCompleted / progressTotal) * 100) : 0;
                    return (
                      <tr key={workflow.deal_id} className="border-b border-slate-900/80 text-slate-200">
                        <td className="px-3 py-3">
                          <div className="font-medium text-white">{workflow.client_name || "Cliente"}</div>
                          {workflow.ban_number || workflow.phone ? (
                            <div className="text-xs text-slate-500">
                              {[workflow.ban_number ? `BAN ${workflow.ban_number}` : null, workflow.phone].filter(Boolean).join(" • ")}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">{workflow.seller_name || "-"}</td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{workflow.product_type}</div>
                          <div className="text-xs text-slate-500">{formatSaleType(String(workflow.sale_type || "").trim().toUpperCase())}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-300">{workflow.source_label || "Sin vinculo"}</td>
                        <td className="px-3 py-3">
                          <div className="text-xs text-slate-300">{progressCompleted}/{progressTotal} pasos</div>
                          <div className="mt-1 h-2 w-36 overflow-hidden rounded-full bg-slate-800">
                            <div className="h-full rounded-full bg-violet-500" style={{ width: `${progressPercent}%` }} />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-100">{workflow.step_order}. {workflow.step_name}</div>
                          <div className="text-xs text-slate-500">{workflow.pending_steps} pasos pendientes</div>
                        </td>
                        <td className="px-3 py-3">{workflow.assigned_name || workflow.assigned_to || "Sin asignar"}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            workflow.status === "in_progress"
                              ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                              : "border border-slate-600 bg-slate-800 text-slate-200"
                          }`}>
                            {workflow.status === "in_progress" ? "En proceso" : "Pendiente"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-400">
                          {workflow.updated_at ? new Date(workflow.updated_at).toLocaleString() : "-"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openClientProfile(workflow)}
                            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                          >
                            Abrir cliente
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {loadingPersonal ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center text-sm text-slate-400 shadow-2xl">
              <div className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando tareas personales...
              </div>
            </div>
          ) : filteredPersonalTasks.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl">
              <UserCircle2 className="mx-auto mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-300">No hay tareas personales para este filtro.</p>
              {clientStats.total > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("clientes");
                    syncLocationTab("clientes");
                  }}
                  className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/20"
                >
                  Ver clientes pendientes ({clientStats.total})
                </button>
              ) : null}
            </div>
          ) : (() => {
            const canDrag = personalStatusFilter === "all" && !searchTerm.trim();
            const sorted = canDrag
              ? [...filteredPersonalTasks].sort(
                  (a, b) => orderedTaskIds.indexOf(a.id) - orderedTaskIds.indexOf(b.id)
                )
              : filteredPersonalTasks;
            return (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400 bg-slate-800/60">
                        <th className="w-8 px-2 py-3" />
                        <th className="w-8 px-2 py-3 text-center">#</th>
                        <th className="px-3 py-3">Tarea</th>
                        <th className="px-3 py-3 w-28">Estado</th>
                        <th className="px-3 py-3 w-24">Prioridad</th>
                        <th className="px-3 py-3 w-28">Vence</th>
                        <th className="px-3 py-3 w-36">Seguimiento</th>
                        <th className="px-3 py-3 w-48 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((task, idx) => {
                        const isDragging = dragActiveId === task.id;
                        return (
                          <tr
                            key={task.id}
                            draggable={canDrag}
                            onDragStart={() => handleDragStart(task.id)}
                            onDragEnter={() => handleDragEnter(task.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnd={handleDragEnd}
                            className={`border-b border-slate-800/80 transition-colors
                              ${isDragging ? "opacity-40 bg-blue-500/10" : "hover:bg-slate-800/40"}
                              ${task.status === "done" ? "opacity-60" : ""}
                            `}
                          >
                            {/* Drag handle */}
                            <td className="px-2 py-3 text-slate-600">
                              {canDrag && (
                                <GripVertical className="h-4 w-4 cursor-grab active:cursor-grabbing mx-auto" />
                              )}
                            </td>
                            {/* Row number */}
                            <td className="px-2 py-3 text-center text-slate-500 font-mono text-xs font-semibold">
                              {idx + 1}
                            </td>
                            {/* Title + notes */}
                            <td className="px-3 py-3">
                              <div className={`font-medium ${task.status === "done" ? "line-through text-slate-500" : "text-white"}`}>
                                {task.title}
                              </div>
                              {task.notes && (
                                <div className="text-xs text-slate-500 mt-0.5 truncate max-w-xs" title={task.notes}>
                                  {task.notes}
                                </div>
                              )}
                              {task.assigned_name || task.assigned_username ? (
                                <div className="text-xs text-slate-500 mt-0.5">
                                  → {task.assigned_name || task.assigned_username}
                                </div>
                              ) : null}
                            </td>
                            {/* Status */}
                            <td className="px-3 py-3">
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(task.status)}`}>
                                {statusLabel(task.status)}
                              </span>
                            </td>
                            {/* Priority */}
                            <td className="px-3 py-3">
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityClasses(task.priority)}`}>
                                {priorityLabel(task.priority)}
                              </span>
                            </td>
                            {/* Due date */}
                            <td className="px-3 py-3 text-xs text-slate-400">
                              {task.due_date ? new Date(task.due_date).toLocaleDateString("es-PR", { day: "2-digit", month: "short" }) : "—"}
                            </td>
                            {/* Follow-up */}
                            <td className="px-3 py-3 text-xs text-slate-400">
                              {task.follow_up_date
                                ? `${new Date(task.follow_up_date).toLocaleDateString("es-PR", { day: "2-digit", month: "short" })}${task.follow_up_time ? ` ${task.follow_up_time}` : ""}`
                                : "—"}
                            </td>
                            {/* Actions */}
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-2">
                                {task.status !== "done" ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleQuickStatus(task, "done")}
                                    title="Marcar completada"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30 transition-colors"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void handleQuickStatus(task, "pending")}
                                    title="Reabrir"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                                  >
                                    ↩
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setEditingTask(task)}
                                  title="Editar"
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/15 px-3 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/30 transition-colors"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={deletingPersonalId === task.id}
                                  onClick={() => void handleDeletePersonalTask(task.id)}
                                  title="Eliminar"
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                                >
                                  {deletingPersonalId === task.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Trash2 className="h-4 w-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!canDrag && (
                  <p className="px-4 py-2 text-[11px] text-slate-600 border-t border-slate-800">
                    Reordenar con drag disponible cuando no hay filtros activos.
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {showCreateModal ? (
        <PersonalTaskModal
          heading="Nueva tarea personal"
          submitLabel="Crear tarea"
          saving={savingPersonal}
          canAssignTasks={canAssignTasks}
          assignees={assignees}
          value={draft}
          onChange={setDraft}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreatePersonalTask}
        />
      ) : null}

      {editingTask ? (
        <PersonalTaskModal
          heading="Editar tarea personal"
          submitLabel="Guardar cambios"
          saving={savingPersonal}
          canAssignTasks={canAssignTasks}
          assignees={assignees}
          value={{
            title: editingTask.title,
            due_date: editingTask.due_date || "",
            follow_up_date: editingTask.follow_up_date || "",
            follow_up_time: editingTask.follow_up_time || "",
            assigned_user_id: editingTask.assigned_user_id || "",
            notes: editingTask.notes || "",
            status: editingTask.status,
            priority: editingTask.priority
          }}
          onChange={(nextValue) => setEditingTask((prev) => (prev ? { ...prev, ...nextValue } : prev))}
          onClose={() => setEditingTask(null)}
          onSubmit={handleSavePersonalTask}
        />
      ) : null}
    </div>
  );
}
