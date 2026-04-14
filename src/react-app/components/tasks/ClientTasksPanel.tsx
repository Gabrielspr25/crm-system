import { CheckSquare, ChevronDown, Loader2, Plus, Save, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

interface ClientTasksPanelProps {
  client: {
    id: string | number;
    name?: string | null;
    business_name?: string | null;
    salesperson_id?: string | number | null;
  };
}

interface VendorOption {
  id: string;
  name: string;
  role?: string | null;
}

interface VendorApiRow {
  salesperson_id?: string | number | null;
  salesperson_name?: string | null;
  salesperson_role?: string | null;
  name?: string | null;
}

interface SalespersonApiRow {
  id?: string | number | null;
  name?: string | null;
  role?: string | null;
}

interface SourceOption {
  key: string;
  label: string;
  source_type: string | null;
  source_ref: string | null;
  source_label: string | null;
  subscriber_id: string | null;
  ban_number: string | null;
  phone: string | null;
  inferred_product_type: string;
  inferred_sale_type: string;
}

interface DealTaskItem {
  id: number;
  step_name: string;
  step_order: number;
  status: "pending" | "in_progress" | "done";
  assigned_to: string | null;
  assigned_name?: string | null;
}

interface DealItem {
  id: number;
  client_id: string;
  client_name: string | null;
  seller_id: string | null;
  seller_name: string | null;
  product_type: string;
  sale_type: string;
  source_type?: string | null;
  source_ref?: string | null;
  source_label?: string | null;
  subscriber_id?: string | null;
  ban_number?: string | null;
  phone?: string | null;
  notes?: string | null;
  created_at?: string | null;
  tasks: DealTaskItem[];
}

interface WorkflowTemplateStep {
  id?: number;
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

const MATRIX_COLUMNS = [
  { key: "fijo_ren", label: "Fijo Ren", productType: "FIJO", saleType: "REN" },
  { key: "fijo_new", label: "Fijo New", productType: "FIJO", saleType: "NEW" },
  { key: "movil_new", label: "Movil New", productType: "MOVIL", saleType: "NEW" },
  { key: "movil_ren", label: "Movil Ren", productType: "MOVIL", saleType: "REN" },
  { key: "clarotv", label: "ClaroTV", productType: "CLARO_TV", saleType: "NEW" },
  { key: "cloud", label: "Cloud", productType: "CLOUD", saleType: "NEW" },
  { key: "mpls", label: "MPLS", productType: "MPLS", saleType: "NEW" }
] as const;

const DEFAULT_TEMPLATE_STEPS: string[] = [];

type ColumnKey = (typeof MATRIX_COLUMNS)[number]["key"];

const WORKFLOW_RULES: Record<string, Record<string, boolean>> = {
  FIJO: { NEW: false, REN: true },
  MOVIL: { NEW: true, REN: true },
  CLARO_TV: { NEW: false, REN: false },
  CLOUD: { NEW: false, REN: false },
  MPLS: { NEW: false, REN: false }
};

function humanizeSaleType(value: string) {
  return value === "REN" ? "Renovacion" : "Nueva";
}

function isBlockedSeller(value: { name?: string | null; role?: string | null } | null | undefined) {
  const sellerName = String(value?.name || "").trim().toLowerCase();
  const sellerRole = String(value?.role || "").trim().toLowerCase();
  return sellerRole === "admin" || sellerName === "admin principal";
}

function isWorkflowEnabled(productType: string, saleType: string) {
  return Boolean(WORKFLOW_RULES[productType]?.[saleType]);
}

function getWorkflowRuleMessage(productType: string, saleType: string) {
  return `${productType} ${humanizeSaleType(saleType)} no genera workflow de tareas.`;
}

function inferProductType(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized.startsWith("FIJO")) return "FIJO";
  if (normalized.startsWith("MOVIL")) return "MOVIL";
  if (normalized.includes("CLARO") && normalized.includes("TV")) return "CLARO_TV";
  if (normalized.includes("CLOUD")) return "CLOUD";
  if (normalized.includes("MPLS")) return "MPLS";
  return "MOVIL";
}

function inferSaleType(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized.endsWith("_REN") || normalized.endsWith("_RENOVACION") || normalized === "REN") return "REN";
  return "NEW";
}

function getSourceIdentity(value: {
  source_type?: string | null;
  source_ref?: string | null;
  subscriber_id?: string | null;
  ban_number?: string | null;
  phone?: string | null;
  product_type?: string | null;
  sale_type?: string | null;
}) {
  return [
    String(value.source_type || "").trim(),
    String(value.source_ref || "").trim(),
    String(value.subscriber_id || "").trim(),
    String(value.ban_number || "").trim(),
    String(value.phone || "").trim(),
    String(value.product_type || "").trim().toUpperCase(),
    String(value.sale_type || "").trim().toUpperCase()
  ].join("|");
}

function getDefaultColumnState() {
  return Object.fromEntries(
    MATRIX_COLUMNS.map((column) => [column.key, isWorkflowEnabled(column.productType, column.saleType)])
  ) as Record<ColumnKey, boolean>;
}

async function requestJson<T>(url: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...rest } = init;
  const response = await authFetch(url, json !== undefined ? { ...rest, json } : rest);
  const rawText = await response.text().catch(() => "");
  let payload: unknown = null;

  if (rawText.trim()) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error || "").trim()
        : String(payload || "").trim();
    throw new Error(message || `HTTP ${response.status}`);
  }
  return payload as T;
}

async function loadClientSources(clientId: string | number): Promise<SourceOption[]> {
  try {
    const rows = await requestJson<any[]>(`/api/subscriber-reports?client_id=${encodeURIComponent(String(clientId))}`);
    return rows.map((row) => ({
      key: `report-${row.subscriber_id || row.phone || row.ban_number}`,
      label: [row.sale_type || row.line_type || "VENTA", row.ban_number ? `BAN ${row.ban_number}` : null, row.phone || null]
        .filter(Boolean)
        .join(" | "),
      source_type: "subscriber_report",
      source_ref: row.subscriber_id ? String(row.subscriber_id) : null,
      source_label: [row.client_name || null, row.phone || null].filter(Boolean).join(" | ") || null,
      subscriber_id: row.subscriber_id ? String(row.subscriber_id) : null,
      ban_number: row.ban_number || null,
      phone: row.phone || null,
      inferred_product_type: inferProductType(row.sale_type || row.line_type),
      inferred_sale_type: inferSaleType(row.sale_type)
    }));
  } catch {
    return [];
  }
}

function normalizeDealRows(rows: unknown): DealItem[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is DealItem => Boolean(row && typeof row === "object" && "id" in row));
}

function normalizeSourceRows(rows: unknown): SourceOption[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is SourceOption => Boolean(row && typeof row === "object" && "key" in row));
}

function normalizeTemplateRows(rows: unknown): WorkflowTemplate[] {
  if (!Array.isArray(rows)) return [];
  const normalizedRows = rows
    .filter((row): row is WorkflowTemplate => Boolean(row && typeof row === "object" && "id" in row))
    .map((row) => ({
      ...row,
      steps: Array.isArray(row.steps)
        ? row.steps.filter((step): step is WorkflowTemplateStep => Boolean(step && typeof step === "object" && "step_name" in step))
        : []
    }))
    .sort((left, right) => {
      const leftTime = new Date(String(left.updated_at || left.created_at || "")).getTime();
      const rightTime = new Date(String(right.updated_at || right.created_at || "")).getTime();
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return Number(right.id) - Number(left.id);
    });

  const seen = new Set<string>();
  return normalizedRows.filter((row) => {
    const key = `${row.product_type}|${row.sale_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isValidTemplateResponse(value: unknown): value is WorkflowTemplate {
  return Boolean(value && typeof value === "object" && "id" in value && (value as { id?: unknown }).id != null);
}

function normalizeEditorSteps(steps: string[]) {
  const normalized = steps.map((step) => step.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : [""];
}

export default function ClientTasksPanel({ client }: ClientTasksPanelProps) {
  const assignedSellerId = String(client.salesperson_id || "").trim();
  const currentUser = useMemo(() => getCurrentUser(), []);
  const [currentUserRole, setCurrentUserRole] = useState<string>(() =>
    String(currentUser?.role || "").toLowerCase()
  );
  const canEditTemplates = ["admin", "supervisor"].includes(currentUserRole);

  // Sync role from server in case stored user data is stale (e.g. role changed since last login)
  useEffect(() => {
    authFetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user?: { role?: string } } | null) => {
        if (data?.user?.role) {
          setCurrentUserRole(String(data.user.role).toLowerCase());
        }
      })
      .catch(() => {});
  }, []);

  const [loading, setLoading] = useState(true);
  const [savingSourceKey, setSavingSourceKey] = useState<string | null>(null);
  const [savingColumnKey, setSavingColumnKey] = useState<string | null>(null);
  const [savingTemplateKey, setSavingTemplateKey] = useState<string | null>(null);
  const [savingTemplateTaskKey, setSavingTemplateTaskKey] = useState<string | null>(null);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [assignedSeller, setAssignedSeller] = useState<VendorOption | null>(null);
  const [columnEnabled, setColumnEnabled] = useState<Record<ColumnKey, boolean>>(() => getDefaultColumnState());
  const [editorColumnKey, setEditorColumnKey] = useState<ColumnKey>(MATRIX_COLUMNS[0].key);
  const [templateDraftSteps, setTemplateDraftSteps] = useState<string[]>(DEFAULT_TEMPLATE_STEPS);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dealRows, vendorRows, salespeopleRows, sourceRows, templateRows] = await Promise.all([
        requestJson<DealItem[]>(`/api/clients/${encodeURIComponent(String(client.id))}/deals`),
        requestJson<VendorApiRow[]>("/api/vendors").catch(() => []),
        requestJson<SalespersonApiRow[]>("/api/salespeople").catch(() => []),
        loadClientSources(client.id),
        requestJson<WorkflowTemplate[]>("/api/workflow-templates").catch(() => [])
      ]);
      const normalizedDeals = normalizeDealRows(dealRows);
      const normalizedSources = normalizeSourceRows(sourceRows);
      const normalizedTemplates = normalizeTemplateRows(templateRows);

      const vendorOptions = (Array.isArray(vendorRows) ? vendorRows : [])
        .filter((row) => row?.salesperson_id)
        .map((row) => ({
          id: String(row.salesperson_id),
          name: row.salesperson_name || row.name || "Vendedor",
          role: row.salesperson_role || null
        }));

      const fallbackSalespeople = (Array.isArray(salespeopleRows) ? salespeopleRows : [])
        .filter((row) => row?.id)
        .map((row) => ({
          id: String(row.id),
          name: row.name || "Vendedor",
          role: row.role || null
        }));

      const allSalespeople = [...vendorOptions, ...fallbackSalespeople].filter(
        (row, index, array) => array.findIndex((entry) => entry.id === row.id) === index
      );

      setDeals(normalizedDeals);
      setSources(normalizedSources);
      setTemplates(normalizedTemplates);
      setAssignedSeller(
        assignedSellerId
          ? allSalespeople.find((row) => row.id === assignedSellerId) || { id: assignedSellerId, name: "Vendedor asignado", role: null }
          : null
      );
      setColumnEnabled(
        Object.fromEntries(
          MATRIX_COLUMNS.map((column) => {
            const template = normalizedTemplates.find(
              (entry) => entry.product_type === column.productType && entry.sale_type === column.saleType
            );
            return [column.key, template ? Boolean(template.is_active) : isWorkflowEnabled(column.productType, column.saleType)];
          })
        ) as Record<ColumnKey, boolean>
      );
    } catch (error) {
      console.error("Error cargando workflows del cliente:", error);
      setDeals([]);
      setSources([]);
      setTemplates([]);
      setAssignedSeller(
        assignedSellerId
          ? { id: assignedSellerId, name: "Vendedor asignado", role: null }
          : null
      );
    } finally {
      setLoading(false);
    }
  }, [assignedSellerId, client.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const hasAssignedSeller = Boolean(assignedSellerId);
  const sellerBlocked = isBlockedSeller(assignedSeller);
  const editorColumn = useMemo(
    () => MATRIX_COLUMNS.find((column) => column.key === editorColumnKey) || MATRIX_COLUMNS[0],
    [editorColumnKey]
  );

  const getTemplateForColumn = useCallback(
    (column: (typeof MATRIX_COLUMNS)[number]) =>
      templates.find((template) => template.product_type === column.productType && template.sale_type === column.saleType) || null,
    [templates]
  );

  const dealsByColumn = useMemo(() => {
    return Object.fromEntries(
      MATRIX_COLUMNS.map((column) => [
        column.key,
        deals.filter((deal) => deal.product_type === column.productType && deal.sale_type === column.saleType)
      ])
    ) as Record<(typeof MATRIX_COLUMNS)[number]["key"], DealItem[]>;
  }, [deals]);

  const sourcesByColumn = useMemo(() => {
    return Object.fromEntries(
      MATRIX_COLUMNS.map((column) => [
        column.key,
        sources.filter(
          (source) => source.inferred_product_type === column.productType && source.inferred_sale_type === column.saleType
        )
      ])
    ) as Record<(typeof MATRIX_COLUMNS)[number]["key"], SourceOption[]>;
  }, [sources]);

  const handleCreateDeal = useCallback(async (source: SourceOption) => {
    if (!assignedSellerId) {
      window.alert("Este cliente no tiene vendedor asignado. No se puede crear workflow.");
      return;
    }
    if (sellerBlocked) {
      window.alert("El vendedor asignado no puede ser admin.");
      return;
    }
    if (!isWorkflowEnabled(source.inferred_product_type, source.inferred_sale_type)) {
      window.alert(getWorkflowRuleMessage(source.inferred_product_type, source.inferred_sale_type));
      return;
    }

    const existingDeal = deals.find(
      (deal) =>
        getSourceIdentity({
          source_type: deal.source_type,
          source_ref: deal.source_ref,
          subscriber_id: deal.subscriber_id,
          ban_number: deal.ban_number,
          phone: deal.phone,
          product_type: deal.product_type,
          sale_type: deal.sale_type
        }) === getSourceIdentity({
          source_type: source.source_type,
          source_ref: source.source_ref,
          subscriber_id: source.subscriber_id,
          ban_number: source.ban_number,
          phone: source.phone,
          product_type: source.inferred_product_type,
          sale_type: source.inferred_sale_type
        })
    );

    if (existingDeal) {
      window.alert("Ese workflow ya fue creado para esta venta.");
      return;
    }

    setSavingSourceKey(source.key);
    try {
      const created = await requestJson<DealItem>("/api/deals", {
        method: "POST",
        json: {
          client_id: client.id,
          seller_id: assignedSellerId,
          product_type: source.inferred_product_type,
          sale_type: source.inferred_sale_type,
          source_type: source.source_type,
          source_ref: source.source_ref,
          source_label: source.label,
          subscriber_id: source.subscriber_id,
          ban_number: source.ban_number,
          phone: source.phone,
          notes: null
        }
      });

      setDeals((prev) => [created, ...prev]);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo crear la venta");
    } finally {
      setSavingSourceKey(null);
    }
  }, [assignedSellerId, client.id, deals, sellerBlocked]);

  useEffect(() => {
    if (!canEditTemplates) return;
    const template = templates.find(
      (entry) => entry.product_type === editorColumn.productType && entry.sale_type === editorColumn.saleType
    );
    const steps = template?.steps?.length ? template.steps.map((step) => step.step_name) : DEFAULT_TEMPLATE_STEPS;
    setTemplateDraftSteps(normalizeEditorSteps(steps));
  }, [canEditTemplates, editorColumn, templates]);

  const handleTaskToggle = useCallback(async (task: DealTaskItem, checked: boolean) => {
    try {
      await requestJson<any>(`/api/deal-tasks/${task.id}`, {
        method: "PATCH",
        json: { status: checked ? "done" : "pending" }
      });
      await loadData();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo actualizar la tarea");
    }
  }, [loadData]);

  const handleTemplateTaskToggle = useCallback(async (column: (typeof MATRIX_COLUMNS)[number], step: WorkflowTemplateStep, checked: boolean) => {
    if (!checked) {
      return;
    }
    if (!assignedSellerId) {
      window.alert("Este cliente no tiene vendedor asignado. No se puede crear workflow.");
      return;
    }
    if (sellerBlocked) {
      window.alert("El vendedor asignado no puede ser admin.");
      return;
    }

    const savingKey = `${column.key}-${step.step_order}`;
    setSavingTemplateTaskKey(savingKey);
    try {
      let targetDeal = (dealsByColumn[column.key] || [])[0] || null;
      if (!targetDeal) {
        targetDeal = await requestJson<DealItem>("/api/deals", {
          method: "POST",
          json: {
            client_id: client.id,
            seller_id: assignedSellerId,
            product_type: column.productType,
            sale_type: column.saleType,
            source_type: null,
            source_ref: null,
            source_label: `${client.business_name || client.name || "Cliente"} | ${column.label}`,
            subscriber_id: null,
            ban_number: null,
            phone: null,
            notes: null
          }
        });
      }

      const targetTask = targetDeal.tasks.find((task) => task.step_order === step.step_order);
      if (!targetTask) {
        throw new Error("No se encontro la tarea creada para esa columna.");
      }

      await requestJson(`/api/deal-tasks/${targetTask.id}`, {
        method: "PATCH",
        json: { status: "done" }
      });

      await loadData();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo marcar la tarea");
    } finally {
      setSavingTemplateTaskKey(null);
    }
  }, [assignedSellerId, client.business_name, client.id, client.name, dealsByColumn, loadData, sellerBlocked]);

  const handleColumnEnabledChange = useCallback(async (column: (typeof MATRIX_COLUMNS)[number], nextValue: boolean) => {
    const template = getTemplateForColumn(column);
    setColumnEnabled((prev) => ({ ...prev, [column.key]: nextValue }));

    setSavingColumnKey(column.key);
    try {
      if (template) {
        await requestJson<WorkflowTemplate>(`/api/workflow-templates/${template.id}`, {
          method: "PUT",
          json: { is_active: nextValue }
        });
      } else {
        await requestJson<WorkflowTemplate>("/api/workflow-templates", {
          method: "POST",
          json: {
            product_type: column.productType,
            sale_type: column.saleType,
            name: `${column.productType} ${column.saleType}`,
            is_active: nextValue,
            steps: []
          }
        });
      }
      await loadData();
    } catch (error) {
      setColumnEnabled((prev) => ({
        ...prev,
        [column.key]: template ? Boolean(template.is_active) : isWorkflowEnabled(column.productType, column.saleType)
      }));
      window.alert(error instanceof Error ? error.message : "No se pudo guardar la columna");
    } finally {
      setSavingColumnKey(null);
    }
  }, [getTemplateForColumn, loadData]);

  const handleTemplateSave = useCallback(async (column: (typeof MATRIX_COLUMNS)[number]) => {
    const steps = templateDraftSteps
      .map((step) => step.trim())
      .filter(Boolean)
      .map((step_name, index) => ({ step_name, step_order: index + 1 }));

    const template = getTemplateForColumn(column);
    setSavingTemplateKey(column.key);
    try {
      const payload = {
        product_type: column.productType,
        sale_type: column.saleType,
        name: `${column.productType} ${column.saleType}`,
        is_active: Boolean(columnEnabled[column.key]),
        steps
      };

      const saved = template
        ? await requestJson<WorkflowTemplate>(`/api/workflow-templates/${template.id}`, {
            method: "PUT",
            json: payload
          })
        : await requestJson<WorkflowTemplate>("/api/workflow-templates", {
            method: "POST",
            json: payload
          });
      if (!isValidTemplateResponse(saved)) {
        await loadData();
        return;
      }
      await loadData();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo guardar la plantilla");
    } finally {
      setSavingTemplateKey(null);
    }
  }, [columnEnabled, getTemplateForColumn, loadData, templateDraftSteps]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-slate-700 bg-slate-950/60 p-10 text-sm text-slate-400">
        Cargando tareas del cliente...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950/60">
      {canEditTemplates ? (
        <div className="border-b border-slate-800 bg-slate-900/70 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">Editor de Pasos</div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <select
              value={editorColumnKey}
              onChange={(event) => setEditorColumnKey(event.target.value as ColumnKey)}
              className="min-w-[220px] rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {MATRIX_COLUMNS.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void handleTemplateSave(editorColumn)}
              disabled={savingTemplateKey === editorColumn.key}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {savingTemplateKey === editorColumn.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </button>

            <button
              type="button"
              onClick={() => setTemplateDraftSteps((prev) => [...normalizeEditorSteps(prev), ""])}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900"
            >
              <Plus className="h-4 w-4" />
              Agregar paso
            </button>
          </div>

          <div className="space-y-3 rounded-md border border-slate-700 bg-slate-950 p-3">
            <div className="grid auto-cols-[minmax(220px,1fr)] grid-flow-col grid-rows-3 gap-2 overflow-x-auto">
              {templateDraftSteps.map((step, index) => (
                <div key={`${editorColumn.key}-${index}`} className="flex min-w-[220px] items-center gap-2 rounded-md border border-slate-800 bg-slate-900/70 px-2 py-2">
                  <span className="w-5 text-center text-xs font-semibold text-slate-500">{index + 1}</span>
                  <input
                    value={step}
                    onChange={(event) =>
                      setTemplateDraftSteps((prev) =>
                        prev.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry))
                      )
                    }
                    className="flex-1 bg-transparent text-sm text-white outline-none"
                    placeholder="Paso"
                  />
                  {templateDraftSteps.length > 1 || step.trim() ? (
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateDraftSteps((prev) => {
                          const next = prev.filter((_, entryIndex) => entryIndex !== index);
                          return normalizeEditorSteps(next);
                        })
                      }
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-sm text-slate-200">
          <thead>
            <tr className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-300">
              {MATRIX_COLUMNS.map((column) => (
                <th key={column.key} className="border border-slate-700 px-3 py-3 text-center">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <tr>
              {MATRIX_COLUMNS.map((column) => {
                const enabled = Boolean(columnEnabled[column.key]);
                return (
                  <td
                    key={column.key}
                    className="border border-slate-700 px-3 py-3 text-center"
                  >
                    <select
                      value={enabled ? "SI" : "NO"}
                      onChange={(event) => {
                        const nextValue = event.target.value === "SI";
                        void handleColumnEnabledChange(column, nextValue);
                      }}
                      disabled={savingColumnKey === column.key}
                      className={`w-full rounded-md border px-2 py-1 text-center text-sm font-semibold ${
                        enabled
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                      }`}
                    >
                      <option value="SI">SI</option>
                      <option value="NO">NO</option>
                    </select>
                  </td>
                );
              })}
            </tr>

            <tr className="align-top">
              {MATRIX_COLUMNS.map((column) => {
                const enabled = Boolean(columnEnabled[column.key]);
                const columnDeals = dealsByColumn[column.key] || [];
                const columnTemplate = getTemplateForColumn(column);
                const templateSteps = columnTemplate?.steps || [];

                return (
                  <td key={column.key} className="border border-slate-700 px-2 py-2 align-top">
                    <details className="group rounded-lg border border-slate-800 bg-slate-950/60" open={columnDeals.length > 0 || templateSteps.length > 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-slate-200">
                        <span>
                          {column.label}
                          <span className="ml-2 text-slate-400">{`${columnDeals.length} workflow(s)`}</span>
                        </span>
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      </summary>

                      <div className="space-y-2 border-t border-slate-800 px-2 py-2">
                        {!enabled ? (
                          <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-3 text-xs text-slate-500">
                            No aplica workflow.
                          </div>
                        ) : columnDeals.length > 0 ? (
                          columnDeals.map((deal) => (
                            <div key={deal.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                              <div className="mb-2 text-[11px] text-slate-400">
                                {deal.ban_number ? `BAN ${deal.ban_number}` : "Sin BAN"}{deal.phone ? ` | ${deal.phone}` : ""}
                              </div>

                              <div className="space-y-1.5">
                                {deal.tasks.map((task) => (
                                  <label key={task.id} className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-200">
                                    <input
                                      type="checkbox"
                                      checked={task.status === "done"}
                                      onChange={(event) => void handleTaskToggle(task, event.target.checked)}
                                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-slate-900"
                                    />
                                    <span className={task.status === "done" ? "line-through text-slate-500" : task.status === "in_progress" ? "text-amber-200" : ""}>
                                      {task.step_name}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : templateSteps.length > 0 ? (
                          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                            <div className="space-y-1.5">
                              {templateSteps.map((step) => (
                                <label key={`${column.key}-template-${step.step_order}`} className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={false}
                                    disabled={savingTemplateTaskKey === `${column.key}-${step.step_order}`}
                                    onChange={(event) => void handleTemplateTaskToggle(column, step, event.target.checked)}
                                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900"
                                  />
                                  <span>{step.step_name}</span>
                                  {savingTemplateTaskKey === `${column.key}-${step.step_order}` ? (
                                    <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-slate-400" />
                                  ) : null}
                                </label>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-3 text-xs text-slate-500">
                            Sin pasos configurados para esta columna.
                          </div>
                        )}
                      </div>
                    </details>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {!deals.length ? (
        <div className="border-t border-slate-800 px-4 py-8 text-center text-sm text-slate-400">
          <CheckSquare className="mx-auto mb-2 h-8 w-8 text-slate-700" />
          No hay tareas creadas para este cliente.
        </div>
      ) : null}
    </div>
  );
}
