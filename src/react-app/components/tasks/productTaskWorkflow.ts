export interface ProductWorkflowStep {
  id: string;
  label: string;
  is_done: boolean;
}

export interface ProductTaskTemplate {
  id: number;
  product_key: string;
  product_name: string;
  steps: ProductWorkflowStep[];
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ClientProductWorkflowItem {
  id: number;
  client_id: string | null;
  client_name: string | null;
  salesperson_id?: string | null;
  salesperson_name?: string | null;
  assigned_user_id: string | null;
  assigned_username?: string | null;
  assigned_name?: string | null;
  product_key: string;
  product_name: string;
  source_type?: string | null;
  source_ref?: string | null;
  source_label?: string | null;
  subscriber_id?: string | null;
  ban_number?: string | null;
  phone?: string | null;
  line_type?: string | null;
  sale_type?: string | null;
  monthly_value?: number | null;
  notes?: string | null;
  workflow_steps: ProductWorkflowStep[];
  status: "pending" | "in_progress" | "done";
  created_at?: string | null;
  updated_at?: string | null;
}

function normalizeLabel(value: unknown) {
  return String(value || "").trim();
}

export function slugifyProductKey(value: string) {
  return normalizeLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

export function normalizeProductWorkflowSteps(value: unknown): ProductWorkflowStep[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index) => {
      if (typeof entry === "string") {
        const label = normalizeLabel(entry);
        if (!label) return null;
        return {
          id: `step-${index + 1}`,
          label,
          is_done: false
        };
      }

      if (!entry || typeof entry !== "object") return null;

      const raw = entry as Partial<ProductWorkflowStep> & { text?: unknown; done?: unknown };
      const label = normalizeLabel(raw.label ?? raw.text);
      if (!label) return null;

      return {
        id: normalizeLabel(raw.id) || `step-${index + 1}`,
        label,
        is_done: Boolean(raw.is_done ?? raw.done)
      };
    })
    .filter((step): step is ProductWorkflowStep => Boolean(step));
}

export function getWorkflowProgress(workflow: { workflow_steps?: unknown }) {
  const steps = normalizeProductWorkflowSteps(workflow.workflow_steps);
  const total = steps.length;
  const completed = steps.filter((step) => step.is_done).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { steps, total, completed, percent };
}

export function resolveWorkflowStatus(
  workflow: { workflow_steps?: unknown; status?: "pending" | "in_progress" | "done" | null }
) {
  const progress = getWorkflowProgress(workflow);
  if (progress.total === 0) {
    return workflow.status || "pending";
  }
  if (progress.completed <= 0) return "pending";
  if (progress.completed >= progress.total) return "done";
  return "in_progress";
}

export function cloneTemplateSteps(template?: { steps?: unknown }) {
  return normalizeProductWorkflowSteps(template?.steps).map((step) => ({
    ...step,
    is_done: false
  }));
}

export function buildEmptyWorkflowStep(label = ""): ProductWorkflowStep {
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    is_done: false
  };
}

export function formatCurrency(value?: number | null) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("es-PR", { style: "currency", currency: "USD" }).format(
    Number.isFinite(numeric) ? numeric : 0
  );
}
