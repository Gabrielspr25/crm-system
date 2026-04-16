export type ClientTaskWorkflowType = "mobile" | "fixed" | "custom";

export interface ClientTaskWorkflowStep {
  id: string;
  label: string;
  is_done: boolean;
}

const LEGACY_CHECKLIST_LINE_REGEX = /(^|\n)\[(x| )\]\s+/i;

const MOBILE_STEP_LABELS = [
  "Validar documentos",
  "Confirmar lineas",
  "Preparar propuesta",
  "Enviar propuesta",
  "Confirmar aprobacion",
  "Coordinar activacion",
  "Cerrar gestion"
];

const FIXED_STEP_LABELS = [
  "Validar direccion",
  "Confirmar disponibilidad",
  "Preparar propuesta",
  "Enviar propuesta",
  "Coordinar visita",
  "Confirmar instalacion",
  "Cerrar gestion"
];

function cleanLabel(value: unknown) {
  return String(value || "").trim();
}

function createStepId(label: string, index: number) {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `${normalized || "step"}-${index + 1}`;
}

export function getClientTaskWorkflowLabel(value?: string | null) {
  if (value === "mobile") return "Movil";
  if (value === "fixed") return "Fijo";
  return "Personalizado";
}

export function buildClientTaskPresetSteps(
  workflowType: ClientTaskWorkflowType,
  previousSteps: ClientTaskWorkflowStep[] = []
) {
  const preset = workflowType === "mobile"
    ? MOBILE_STEP_LABELS
    : workflowType === "fixed"
      ? FIXED_STEP_LABELS
      : previousSteps.map((step) => step.label).filter(Boolean);

  const previousByLabel = new Map(previousSteps.map((step) => [step.label.trim().toLowerCase(), step]));

  return preset.map((label, index) => {
    const normalizedLabel = label.trim().toLowerCase();
    const previous = previousByLabel.get(normalizedLabel);
    return {
      id: previous?.id || createStepId(label, index),
      label,
      is_done: Boolean(previous?.is_done)
    };
  });
}

export function normalizeClientTaskWorkflowSteps(value: unknown): ClientTaskWorkflowStep[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index) => {
      if (typeof entry === "string") {
        const label = cleanLabel(entry);
        if (!label) return null;
        return {
          id: createStepId(label, index),
          label,
          is_done: false
        };
      }

      if (!entry || typeof entry !== "object") return null;

      const raw = entry as Partial<ClientTaskWorkflowStep> & { text?: unknown; done?: unknown };
      const label = cleanLabel(raw.label ?? raw.text);
      if (!label) return null;

      return {
        id: cleanLabel(raw.id) || createStepId(label, index),
        label,
        is_done: Boolean(raw.is_done ?? raw.done)
      };
    })
    .filter((step): step is ClientTaskWorkflowStep => Boolean(step));
}

export function parseLegacyChecklistSteps(notes?: string | null) {
  return String(notes || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      if (line.startsWith("[x] ")) {
        return { id: createStepId(line.slice(4), index), label: line.slice(4), is_done: true };
      }
      if (line.startsWith("[ ] ")) {
        return { id: createStepId(line.slice(4), index), label: line.slice(4), is_done: false };
      }
      return null;
    })
    .filter((step): step is ClientTaskWorkflowStep => Boolean(step));
}

function hasClientTaskMetadata(task: {
  client_task_workflow?: string | null;
  workflow_steps?: unknown;
  notes?: string | null;
}) {
  if (typeof task?.client_task_workflow === "string" && task.client_task_workflow.trim()) {
    return true;
  }
  if (normalizeClientTaskWorkflowSteps(task?.workflow_steps).length > 0) {
    return true;
  }
  return LEGACY_CHECKLIST_LINE_REGEX.test(String(task?.notes || ""));
}

export function getTaskKind(task: {
  task_kind?: string | null;
  client_task_workflow?: string | null;
  workflow_steps?: unknown;
  notes?: string | null;
}) {
  if (task?.task_kind === "client") return "client";
  if (task?.task_kind === "regular") return "regular";
  return hasClientTaskMetadata(task) ? "client" : "regular";
}

export function getClientTaskSteps(task: {
  workflow_steps?: unknown;
  notes?: string | null;
}) {
  const normalized = normalizeClientTaskWorkflowSteps(task.workflow_steps);
  if (normalized.length > 0) return normalized;
  return parseLegacyChecklistSteps(task.notes);
}

export function getClientTaskProgress(task: {
  workflow_steps?: unknown;
  notes?: string | null;
}) {
  const steps = getClientTaskSteps(task);
  const total = steps.length;
  const completed = steps.filter((step) => step.is_done).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { steps, total, completed, percent };
}

export function resolveClientTaskStatus(
  taskKind: string,
  workflowSteps: ClientTaskWorkflowStep[],
  fallbackStatus: "pending" | "in_progress" | "done" = "pending"
) {
  if (taskKind !== "client" || workflowSteps.length === 0) {
    return fallbackStatus;
  }

  const completed = workflowSteps.filter((step) => step.is_done).length;
  if (completed <= 0) return "pending";
  if (completed >= workflowSteps.length) return "done";
  return "in_progress";
}
