import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  Clock,
  DollarSign,
  Eye,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";

type ProductType = "money" | "quantity";

type Sov2Product = {
  product_key: ProductKey;
  label: string;
  type: ProductType;
};

type ProductKey =
  | "fijo_ren"
  | "fijo_new"
  | "movil_ren"
  | "movil_new"
  | "claro_tv"
  | "cloud"
  | "mpls";

type Sov2Step = {
  id: string;
  name: string;
  step_order?: number;
  status?: string;
  due_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
};

type Sov2ProductCell = {
  product_key: ProductKey;
  label: string;
  type: ProductType;
  line_id: string | null;
  money_value: number;
  quantity_value: number;
  current_step: Sov2Step | null;
  steps?: Sov2Step[];
  notes: string | null;
  ban_count?: number;
  subscriber_count?: number;
};

type Sov2Opportunity = {
  id: string;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  client_source?: string | null;
  client_pending_validation?: boolean;
  ban_count?: number;
  subscriber_count?: number;
  vendor_id: string | null;
  vendor_name: string;
  status: string;
  priority: string;
  blocked: boolean;
  products: Record<ProductKey, Sov2ProductCell>;
  total_lines: number;
  total_money: number;
  notes_summary: {
    count: number;
    last_note: string | null;
  };
  updated_at: string | null;
};

type Sov2Note = {
  id: string;
  opportunity_id: string;
  product_key: ProductKey | null;
  step_id: string | null;
  step_name: string | null;
  note: string;
  created_by_user_id: string | null;
  created_by_username: string | null;
  created_at: string;
};

type MetricCard = {
  label: string;
  value: string;
  sub: string;
  sub2?: string;
  progress?: number;
};

type Sov2Metrics = {
  period: {
    year: number;
    month: number;
  };
  scope: {
    salesperson_id: string | null;
  };
  meta_money: number;
  meta_quantity: number;
  real_sold_money: number;
  real_sold_quantity: number;
  projection_money: number;
  projection_quantity: number;
  remaining_business_days: number;
};

type ProductTemplateStep = {
  id: string;
  label: string;
  is_active?: boolean;
};

type ProductTemplate = {
  id: number;
  product_key: ProductKey;
  product_name: string;
  steps: ProductTemplateStep[];
  is_active: boolean;
};

type VendorOption = {
  id: string;
  name: string;
};

type NewOpportunityDraft = {
  client_name: string;
  phone: string;
  salesperson_id: string;
  product_key: ProductKey;
  value: string;
  quantity: string;
  note: string;
};

type StepFilters = Partial<Record<ProductKey, string[]>>;
type StepModalContext = {
  opportunityId: string;
  productKey: ProductKey;
} | null;

type NoteTabKey = ProductKey | "general";

type NoteTab = {
  key: NoteTabKey;
  label: string;
  productKey: ProductKey | null;
};

const PRODUCT_ORDER: ProductKey[] = [
  "fijo_ren",
  "fijo_new",
  "movil_ren",
  "movil_new",
  "claro_tv",
  "cloud",
  "mpls",
];

const NOTE_TABS: NoteTab[] = [
  { key: "general", label: "General", productKey: null },
  { key: "fijo_ren", label: "Fijo Ren", productKey: "fijo_ren" },
  { key: "fijo_new", label: "Fijo New", productKey: "fijo_new" },
  { key: "movil_ren", label: "Movil Ren", productKey: "movil_ren" },
  { key: "movil_new", label: "Movil New", productKey: "movil_new" },
  { key: "claro_tv", label: "Claro TV", productKey: "claro_tv" },
  { key: "cloud", label: "Cloud", productKey: "cloud" },
  { key: "mpls", label: "MPLS", productKey: "mpls" },
];

const MONEY_PRODUCTS = new Set<ProductKey>(["fijo_ren", "fijo_new", "mpls"]);
const QUANTITY_PRODUCTS = new Set<ProductKey>(["movil_ren", "movil_new", "claro_tv", "cloud"]);

const PRODUCT_ACCENTS: Record<ProductKey, { border: string; soft: string; text: string; ring: string }> = {
  fijo_ren: { border: "border-cyan-500/45", soft: "bg-cyan-500/10", text: "text-cyan-100", ring: "focus:border-cyan-400" },
  fijo_new: { border: "border-blue-500/45", soft: "bg-blue-500/10", text: "text-blue-100", ring: "focus:border-blue-400" },
  movil_ren: { border: "border-emerald-500/45", soft: "bg-emerald-500/10", text: "text-emerald-100", ring: "focus:border-emerald-400" },
  movil_new: { border: "border-violet-500/45", soft: "bg-violet-500/10", text: "text-violet-100", ring: "focus:border-violet-400" },
  claro_tv: { border: "border-amber-500/45", soft: "bg-amber-500/10", text: "text-amber-100", ring: "focus:border-amber-400" },
  cloud: { border: "border-sky-500/45", soft: "bg-sky-500/10", text: "text-sky-100", ring: "focus:border-sky-400" },
  mpls: { border: "border-rose-500/45", soft: "bg-rose-500/10", text: "text-rose-100", ring: "focus:border-rose-400" },
};

const moneyFormatter = new Intl.NumberFormat("es-PR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-PR", {
  maximumFractionDigits: 0,
});

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();

const formatMoney = (value: number) => moneyFormatter.format(Number(value || 0));

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-PR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

function mergeStepOptions(opportunitySteps: Sov2Step[] = [], templateSteps: Sov2Step[] = []) {
  const byName = new Map<string, Sov2Step>();
  [...opportunitySteps, ...templateSteps].forEach((step) => {
    const key = normalize(step.name) || step.id;
    if (!byName.has(key)) byName.set(key, step);
  });
  return Array.from(byName.values()).sort((left, right) => {
    const orderDiff = (left.step_order ?? 999) - (right.step_order ?? 999);
    return orderDiff || left.name.localeCompare(right.name, "es");
  });
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "No se pudo completar la solicitud.");
  }
  return payload as T;
}

function MetricCardView({ card }: { card: MetricCard }) {
  const label = normalize(card.label);
  const tone = label.includes("$") || label.includes("dinero") || label.includes("total $")
    ? "money"
    : label.includes("falta")
      ? "warning"
      : label.includes("diario")
        ? "daily"
        : label.includes("lineas") || label.includes("cantidad")
          ? "quantity"
          : "primary";

  const directTone = {
    primary: "border-violet-400/40 bg-gradient-to-br from-violet-950/70 via-slate-950 to-slate-950 shadow-[0_0_28px_rgba(139,92,246,0.16)]",
    quantity: "border-cyan-400/40 bg-gradient-to-br from-cyan-950/70 via-slate-950 to-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.14)]",
    money: "border-emerald-400/40 bg-gradient-to-br from-emerald-950/70 via-slate-950 to-slate-950 shadow-[0_0_28px_rgba(16,185,129,0.14)]",
    warning: "border-amber-400/40 bg-gradient-to-br from-amber-950/70 via-slate-950 to-slate-950 shadow-[0_0_28px_rgba(245,158,11,0.16)]",
    daily: "border-blue-400/40 bg-gradient-to-br from-blue-950/70 via-slate-950 to-slate-950 shadow-[0_0_28px_rgba(59,130,246,0.14)]",
  }[tone];

  const valueTone = {
    primary: "text-violet-100",
    quantity: "text-cyan-100",
    money: "text-emerald-100",
    warning: "text-amber-100",
    daily: "text-blue-100",
  }[tone];
  return (
    <div className={`sov2-kpi sov2-kpi-${tone} flex min-h-[88px] items-center rounded-xl border px-3 py-3 ${directTone}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-200">{card.label}</div>
        <div className={`mt-1 break-words text-[26px] font-bold leading-none ${valueTone}`}>{card.value}</div>
        <div className="mt-1 text-[11px] leading-4 text-slate-300">{card.sub}</div>
        {card.sub2 && <div className="mt-0.5 text-[10px] leading-4 text-slate-400">{card.sub2}</div>}
        {typeof card.progress === "number" && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800/80">
            <div
              className="h-full rounded-full bg-current opacity-80"
              style={{ width: `${Math.max(0, Math.min(100, card.progress))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ProductStepFilter({
  product,
  options,
  selected,
  onChange,
}: {
  product: Sov2Product;
  options: Sov2Step[];
  selected: string[];
  onChange: (productKey: ProductKey, values: string[]) => void;
}) {
  const uniqueOptions = Array.from(new Map(options.map((step) => [step.name, step])).values());
  const toggle = (name: string) => {
    const next = selected.includes(name)
      ? selected.filter((item) => item !== name)
      : [...selected, name];
    onChange(product.product_key, next);
  };

  return (
    <details className="relative">
      <summary className={classNames(
        "flex h-8 cursor-pointer list-none items-center justify-between gap-2 rounded-md border px-2 text-[11px] font-semibold outline-none transition",
        selected.length > 0
          ? "border-sky-500/50 bg-sky-500/15 text-sky-100"
          : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
      )}>
        <span className="truncate">{product.label}</span>
        <span className="text-slate-500">{selected.length || ""}</span>
      </summary>
      <div className="absolute left-0 z-50 mt-1 w-56 rounded-lg border border-slate-800 bg-slate-950 p-2 text-left shadow-xl">
        {uniqueOptions.length === 0 ? (
          <div className="px-2 py-2 text-xs text-slate-500">Sin pasos creados</div>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {uniqueOptions.map((step) => (
              <label key={step.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-900">
                <input
                  type="checkbox"
                  checked={selected.includes(step.name)}
                  onChange={() => toggle(step.name)}
                  className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-sky-500"
                />
                <span className="truncate">{step.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function ProductHeaderFilter({
  product,
  options,
  selected,
  onChange,
}: {
  product: Sov2Product;
  options: Sov2Step[];
  selected: string[];
  onChange: (productKey: ProductKey, values: string[]) => void;
}) {
  return (
    <div className="min-w-28">
      <ProductStepFilter
        product={product}
        options={options}
        selected={selected}
        onChange={onChange}
      />
    </div>
  );
}

function ProductValueInput({
  opportunity,
  productKey,
  product,
  saving,
  stepSaving,
  onSave,
  onOpenSteps,
}: {
  opportunity: Sov2Opportunity;
  productKey: ProductKey;
  product: Sov2ProductCell;
  saving: boolean;
  stepSaving: boolean;
  onSave: (opportunity: Sov2Opportunity, productKey: ProductKey, value: number) => void;
  onOpenSteps: (opportunityId: string, productKey: ProductKey) => void;
}) {
  const isMoney = MONEY_PRODUCTS.has(productKey);
  const value = isMoney ? product.money_value : product.quantity_value;
  const accent = PRODUCT_ACCENTS[productKey];
  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          data-testid={`sov2-value-${productKey}-${opportunity.id}`}
          type="number"
          min="0"
          step={isMoney ? "1" : "1"}
          defaultValue={Number(value || 0)}
          disabled={saving}
          onBlur={(event) => onSave(opportunity, productKey, Number(event.currentTarget.value || 0))}
          className={classNames(
            "h-8 w-24 rounded-md border bg-slate-950 px-2 text-right text-xs text-slate-100 outline-none transition disabled:cursor-wait disabled:text-slate-500",
            accent.border,
            accent.ring
          )}
        />
        {saving && <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-sky-300" />}
      </div>
      <button
        type="button"
        data-testid={`sov2-open-product-steps-${productKey}-${opportunity.id}`}
        disabled={stepSaving}
        onClick={() => onOpenSteps(opportunity.id, productKey)}
        className={classNames(
          "flex h-7 w-28 items-center justify-between gap-1 rounded-md border px-2 text-[11px] transition hover:bg-slate-800/80 disabled:cursor-wait",
          accent.border,
          accent.soft,
          product.current_step ? accent.text : "text-slate-300"
        )}
      >
        <span className="max-w-20 truncate">{product.current_step?.name || "Marcar paso"}</span>
        {stepSaving ? <Loader2 className="h-3 w-3 animate-spin text-sky-300" /> : <span className="text-slate-500">...</span>}
      </button>
      <div className="text-[10px] text-slate-500">
        {numberFormatter.format(product.subscriber_count || 0)} subs
      </div>
    </div>
  );
}

function ProductStepsModal({
  opportunity,
  product,
  productKey,
  steps,
  saving,
  onStepSave,
  onClose,
}: {
  opportunity: Sov2Opportunity;
  product: Sov2ProductCell;
  productKey: ProductKey;
  steps: Sov2Step[];
  saving: boolean;
  onStepSave: (opportunity: Sov2Opportunity, productKey: ProductKey, stepId: string) => void;
  onClose: () => void;
}) {
  const accent = PRODUCT_ACCENTS[productKey];
  const productLabel = product.label || productKey;
  const options = mergeStepOptions(product.steps || [], steps);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
      <div
        data-testid="sov2-product-steps-modal"
        className={classNames("flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-slate-950 shadow-2xl", accent.border)}
      >
        <div className={classNames("flex items-center justify-between border-b border-slate-800 px-4 py-3", accent.soft)}>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-100">{productLabel} - {opportunity.client_name}</div>
            <div className="truncate text-xs text-slate-500">
              {numberFormatter.format(product.subscriber_count || 0)} subs Â· paso actual: {product.current_step?.name || "Sin paso"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500"
            aria-label="Cerrar pasos"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {options.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
              Sin pasos configurados para {productLabel}. Se crean en Configurar pasos.
            </div>
          ) : (
            <div className="space-y-2">
              {options.map((step, index) => {
                const isCurrent = product.current_step?.name === step.name || product.current_step?.id === step.id;
                return (
                  <button
                    key={`${step.id}-${step.name}`}
                    type="button"
                    disabled={saving}
                    onClick={() => onStepSave(opportunity, productKey, step.id)}
                    className={classNames(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition disabled:cursor-wait",
                      isCurrent
                        ? `${accent.border} ${accent.soft} ${accent.text}`
                        : "border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600"
                    )}
                  >
                    <span className={classNames(
                      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      isCurrent ? `${accent.border} ${accent.soft}` : "border-slate-700 bg-slate-950 text-slate-400"
                    )}>
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{step.name}</span>
                      <span className="block text-xs text-slate-500">{isCurrent ? "Marcado para este cliente/producto" : "Marcar este paso"}</span>
                    </span>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> : (
                      <input
                        type="checkbox"
                        readOnly
                        checked={isCurrent}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-500"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewOpportunityModal({
  products,
  vendors,
  saving,
  error,
  onSubmit,
  onClose,
}: {
  products: Sov2Product[];
  vendors: VendorOption[];
  saving: boolean;
  error: string | null;
  onSubmit: (draft: NewOpportunityDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<NewOpportunityDraft>({
    client_name: "",
    phone: "",
    salesperson_id: vendors[0]?.id || "",
    product_key: products[0]?.product_key || "fijo_new",
    value: "",
    quantity: "2",
    note: "",
  });

  const updateDraft = (patch: Partial<NewOpportunityDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const selectedProduct = products.find((product) => product.product_key === draft.product_key);
  const isMoney = MONEY_PRODUCTS.has(draft.product_key);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-emerald-500/30 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-base font-semibold text-white">Cliente nuevo con oportunidad</div>
            <div className="text-xs text-slate-500">Se crea como provisional y pendiente de completar.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500"
            aria-label="Cerrar cliente nuevo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre cliente</span>
              <input
                value={draft.client_name}
                onChange={(event) => updateDraft({ client_name: event.currentTarget.value })}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                placeholder="Nombre comercial"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Telefono</span>
              <input
                value={draft.phone}
                onChange={(event) => updateDraft({ phone: event.currentTarget.value })}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                placeholder="Opcional"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vendedor</span>
              <select
                value={draft.salesperson_id}
                onChange={(event) => updateDraft({ salesperson_id: event.currentTarget.value })}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
              >
                <option value="">Sin asignar</option>
                {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Producto</span>
              <select
                value={draft.product_key}
                onChange={(event) => {
                  const nextProductKey = event.currentTarget.value as ProductKey;
                  updateDraft({
                    product_key: nextProductKey,
                    quantity: MONEY_PRODUCTS.has(nextProductKey) ? "2" : "1",
                  });
                }}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
              >
                {products.map((product) => <option key={product.product_key} value={product.product_key}>{product.label}</option>)}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{isMoney ? "Valor estimado" : "Cantidad"}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={draft.value}
                onChange={(event) => updateDraft({ value: event.currentTarget.value })}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                placeholder={isMoney ? "0" : "1"}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cantidad a sumar</span>
              <input
                type="number"
                min="1"
                step="1"
                value={draft.quantity}
                onChange={(event) => updateDraft({ quantity: event.currentTarget.value })}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
              />
            </label>

            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nota inicial</span>
              <textarea
                value={draft.note}
                onChange={(event) => updateDraft({ note: event.currentTarget.value })}
                rows={3}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
                placeholder={`Contexto para ${selectedProduct?.label || "la oportunidad"}`}
              />
            </label>
          </div>

          <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
            Se crea cliente provisional sin BAN. Luego se completa desde ficha del cliente.
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !draft.client_name.trim()}
            onClick={() => onSubmit(draft)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crear oportunidad
          </button>
        </div>
      </div>
    </div>
  );
}

const templateStepId = (productKey: ProductKey, label: string, index: number) => {
  const base = normalize(label).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `paso_${index + 1}`;
  return `${productKey}_${base}_${index + 1}`;
};

function normalizeTemplateSteps(value: unknown, productKey: ProductKey): ProductTemplateStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (typeof entry === "string") {
        const label = entry.trim();
        return label ? { id: templateStepId(productKey, label, index), label, is_active: true } : null;
      }
      const record = entry as { id?: unknown; label?: unknown; name?: unknown; title?: unknown; is_active?: unknown };
      const label = String(record.label || record.name || record.title || "").trim();
      if (!label) return null;
      return {
        id: String(record.id || templateStepId(productKey, label, index)),
        label,
        is_active: record.is_active !== false,
      };
    })
    .filter(Boolean) as ProductTemplateStep[];
}

function StepConfigModal({
  products,
  onSaved,
  onClose,
}: {
  products: Sov2Product[];
  onSaved: (productKey: ProductKey) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<ProductTemplate[]>([]);
  const [selectedProductKey, setSelectedProductKey] = useState<ProductKey>(products[0]?.product_key || "fijo_ren");
  const [draftSteps, setDraftSteps] = useState<ProductTemplateStep[]>([]);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const selectedProduct = products.find((product) => product.product_key === selectedProductKey) || products[0];
  const selectedTemplate = templates.find((template) => template.product_key === selectedProductKey) || null;

  const loadTemplates = useCallback(async () => {
    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const response = await authFetch("/api/task-product-templates?include_inactive=1");
      const payload = await readJson<ProductTemplate[]>(response);
      setTemplates((Array.isArray(payload) ? payload : []).map((template) => ({
        ...template,
        product_key: template.product_key as ProductKey,
        steps: normalizeTemplateSteps(template.steps, template.product_key as ProductKey),
      })));
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : "No se pudieron cargar los pasos.");
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (templateLoading) return;
    setDraftSteps(normalizeTemplateSteps(selectedTemplate?.steps || [], selectedProductKey));
  }, [selectedProductKey, selectedTemplate, templateLoading]);

  const updateStep = (index: number, patch: Partial<ProductTemplateStep>) => {
    setDraftSteps((current) => current.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step)));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    setDraftSteps((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const addStep = () => {
    setDraftSteps((current) => [
      ...current,
      { id: templateStepId(selectedProductKey, "Nuevo paso", current.length), label: "Nuevo paso", is_active: true },
    ]);
  };

  const removeStep = (index: number) => {
    setDraftSteps((current) => current.filter((_, stepIndex) => stepIndex !== index));
  };

  const saveTemplate = async () => {
    if (!selectedProduct) return;
    const cleanSteps = draftSteps
      .map((step, index) => ({
        id: step.id || templateStepId(selectedProductKey, step.label, index),
        label: step.label.trim(),
        is_active: step.is_active !== false,
      }))
      .filter((step) => step.label);

    if (cleanSteps.length === 0) {
      setTemplateError("Agrega al menos un paso.");
      return;
    }

    setSavingTemplate(true);
    setTemplateError(null);
    try {
      const payload = {
        product_key: selectedProduct.product_key,
        product_name: selectedProduct.label,
        steps: cleanSteps,
        is_active: true,
      };
      const response = selectedTemplate
        ? await authFetch(`/api/task-product-templates/${selectedTemplate.id}`, { method: "PUT", json: payload })
        : await authFetch("/api/task-product-templates", { method: "POST", json: payload });
      const saved = await readJson<ProductTemplate>(response);
      setTemplates((current) => {
        const mapped = {
          ...saved,
          product_key: saved.product_key as ProductKey,
          steps: normalizeTemplateSteps(saved.steps, saved.product_key as ProductKey),
        };
        const exists = current.some((template) => template.id === mapped.id);
        return exists
          ? current.map((template) => (template.id === mapped.id ? mapped : template))
          : [...current, mapped];
      });
      onSaved(selectedProduct.product_key);
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : "No se pudieron guardar los pasos.");
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-sky-500/30 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-base font-semibold text-white">Configurar pasos SOV2</div>
            <div className="text-xs text-slate-500">Fuente oficial: crm_product_task_templates. No modifica avances existentes.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500"
            aria-label="Cerrar configuracion de pasos"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[220px_1fr]">
          <aside className="border-b border-slate-800 p-3 lg:border-b-0 lg:border-r">
            <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Producto</div>
            <div className="space-y-1">
              {products.map((product) => (
                <button
                  key={product.product_key}
                  type="button"
                  onClick={() => setSelectedProductKey(product.product_key)}
                  className={classNames(
                    "w-full rounded-md border px-3 py-2 text-left text-sm transition",
                    selectedProductKey === product.product_key
                      ? "border-sky-500 bg-sky-500/15 text-sky-100"
                      : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
                  )}
                >
                  {product.label}
                </button>
              ))}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto p-4">
            {templateError && (
              <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {templateError}
              </div>
            )}
            {templateLoading ? (
              <div className="py-10 text-center text-sm text-slate-400">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Cargando pasos...
              </div>
            ) : (
              <div className="space-y-3">
                {draftSteps.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
                    Sin pasos configurados para {selectedProduct?.label}.
                  </div>
                )}
                {draftSteps.map((step, index) => (
                  <div key={`${step.id}-${index}`} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-3 lg:grid-cols-[36px_1fr_auto] lg:items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-xs font-semibold text-slate-300">
                      {index + 1}
                    </div>
                    <input
                      value={step.label}
                      onChange={(event) => updateStep(index, { label: event.currentTarget.value })}
                      className="h-9 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={step.is_active !== false}
                          onChange={(event) => updateStep(index, { is_active: event.currentTarget.checked })}
                          className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-sky-500"
                        />
                        Activo
                      </label>
                      <button type="button" onClick={() => moveStep(index, -1)} className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-slate-300 hover:border-slate-500" title="Subir">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => moveStep(index, 1)} className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-slate-300 hover:border-slate-500" title="Bajar">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => removeStep(index)} className="h-9 rounded-md border border-red-500/30 bg-red-500/10 px-2 text-red-200 hover:bg-red-500/20" title="Eliminar paso">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex justify-between gap-3 border-t border-slate-800 p-3">
          <button
            type="button"
            onClick={addStep}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            <Plus className="h-4 w-4" />
            Crear paso
          </button>
          <button
            type="button"
            disabled={savingTemplate || templateLoading}
            onClick={() => void saveTemplate()}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-sky-500/50 bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-wait"
          >
            {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Guardar configuracion
          </button>
        </div>
      </div>
    </div>
  );
}

function NotesModal({
  opportunity,
  notes,
  activeTab,
  draft,
  loading,
  saving,
  error,
  onTabChange,
  onDraftChange,
  onSubmit,
  onClose,
}: {
  opportunity: Sov2Opportunity;
  notes: Sov2Note[];
  activeTab: NoteTabKey;
  draft: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onTabChange: (tab: NoteTabKey) => void;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const selectedTab = NOTE_TABS.find((tab) => tab.key === activeTab) || NOTE_TABS[0];
  const visibleNotes = notes.filter((note) => (
    selectedTab.productKey ? note.product_key === selectedTab.productKey : !note.product_key
  ));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-100">Notas - {opportunity.client_name}</div>
            <div className="truncate text-xs text-slate-500">{opportunity.vendor_name || "Sin asignar"}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-slate-700"
            aria-label="Cerrar notas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-3 py-2">
          {NOTE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              data-testid={`sov2-notes-tab-${tab.key}`}
              onClick={() => onTabChange(tab.key)}
              className={classNames(
                "h-8 shrink-0 rounded-md border px-3 text-xs font-semibold transition",
                activeTab === tab.key
                  ? "border-sky-500 bg-sky-500/15 text-sky-100"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Cargando notas...
            </div>
          ) : visibleNotes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
              Sin notas en {selectedTab.label}.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleNotes.map((note) => (
                <article key={note.id} data-testid="sov2-note-item" className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] uppercase text-slate-500">
                    <span className="font-semibold text-slate-300">{note.created_by_username || "Sistema"}</span>
                    <span>{formatDateTime(note.created_at)}</span>
                    {note.step_name && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">{note.step_name}</span>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-5 text-slate-100">{note.note}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 p-3">
          {error && <div className="mb-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              data-testid="sov2-note-input"
              value={draft}
              onChange={(event) => onDraftChange(event.currentTarget.value)}
              rows={3}
              placeholder={`Agregar nota en ${selectedTab.label}`}
              className="min-h-20 flex-1 resize-none rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-500"
            />
            <button
              data-testid="sov2-note-submit"
              type="button"
              disabled={saving || !draft.trim()}
              onClick={onSubmit}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-sky-500/50 bg-sky-500/15 px-4 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-500 sm:h-auto"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SeguimientoOperativo() {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Sov2Opportunity[]>([]);
  const [products, setProducts] = useState<Sov2Product[]>([]);
  const [salespeople, setSalespeople] = useState<VendorOption[]>([]);
  const [stepsByProduct, setStepsByProduct] = useState<Partial<Record<ProductKey, Sov2Step[]>>>({});
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [stepFilters, setStepFilters] = useState<StepFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [metrics, setMetrics] = useState<Sov2Metrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [notesModalOpportunity, setNotesModalOpportunity] = useState<Sov2Opportunity | null>(null);
  const [notes, setNotes] = useState<Sov2Note[]>([]);
  const [notesActiveTab, setNotesActiveTab] = useState<NoteTabKey>("general");
  const [noteDraft, setNoteDraft] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [stepModalContext, setStepModalContext] = useState<StepModalContext>(null);
  const [stepConfigOpen, setStepConfigOpen] = useState(false);
  const [newOpportunityOpen, setNewOpportunityOpen] = useState(false);
  const [newOpportunitySaving, setNewOpportunitySaving] = useState(false);
  const [newOpportunityError, setNewOpportunityError] = useState<string | null>(null);
  const [importClientOpen, setImportClientOpen] = useState(false);
  const [importQuery, setImportQuery] = useState("");
  const [importResults, setImportResults] = useState<Array<{ id: string; name: string; business_name: string | null; phone: string | null; salesperson_name: string | null }>>([]);
  const [importSearching, setImportSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [closeConfirmId, setCloseConfirmId] = useState<string | null>(null);
  const [closeConfirming, setCloseConfirming] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    const response = await authFetch("/api/sov2/products");
    const payload = await readJson<Sov2Product[]>(response);
    setProducts(Array.isArray(payload) ? payload : []);
  }, []);

  const loadSalespeople = useCallback(async () => {
    try {
      const response = await authFetch("/api/salespeople");
      const payload = await readJson<Array<{ id: string; name: string }>>(response);
      setSalespeople((Array.isArray(payload) ? payload : [])
        .filter((item) => item.id && item.name)
        .map((item) => ({ id: String(item.id), name: item.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "es")));
    } catch {
      setSalespeople([]);
    }
  }, []);

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/api/sov2/opportunities");
      const payload = await readJson<Sov2Opportunity[]>(response);
      setOpportunities(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar SOV2.");
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMetrics = useCallback(async (selectedVendorId = "") => {
    setMetricsLoading(true);
    try {
      const suffix = selectedVendorId ? `?vendedor_id=${encodeURIComponent(selectedVendorId)}` : "";
      const response = await authFetch(`/api/sov2/metrics${suffix}`);
      const payload = await readJson<Sov2Metrics>(response);
      setMetrics(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las metricas SOV2.");
      setMetrics(null);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadProducts(), loadSalespeople(), loadOpportunities(), loadMetrics()]).catch((err) => {
      setError(err instanceof Error ? err.message : "No se pudo cargar SOV2.");
      setLoading(false);
    });
  }, [loadMetrics, loadOpportunities, loadProducts, loadSalespeople]);

  useEffect(() => {
    void loadMetrics(vendorFilter);
  }, [loadMetrics, vendorFilter]);

  const productList = useMemo(() => {
    const byKey = new Map(products.map((product) => [product.product_key, product]));
    return PRODUCT_ORDER.map((key) => byKey.get(key)).filter(Boolean) as Sov2Product[];
  }, [products]);

  useEffect(() => {
    const missing = productList
      .map((product) => product.product_key)
      .filter((productKey) => !stepsByProduct[productKey]);

    if (missing.length === 0) return;

    void Promise.all(
      missing.map(async (productKey) => {
        try {
          const response = await authFetch(`/api/sov2/products/${productKey}/steps`);
          const payload = await readJson<Sov2Step[]>(response);
          return [productKey, Array.isArray(payload) ? payload : []] as const;
        } catch {
          return [productKey, []] as const;
        }
      })
    ).then((entries) => {
      setStepsByProduct((current) => {
        const next = { ...current };
        entries.forEach(([productKey, steps]) => {
          next[productKey] = steps;
        });
        return next;
      });
    });
  }, [productList, stepsByProduct]);

  const vendorOptions = useMemo<VendorOption[]>(() => {
    const values = new Map<string, VendorOption>();
    salespeople.forEach((salesperson) => {
      if (salesperson.id && salesperson.name) values.set(salesperson.id, salesperson);
    });
    opportunities.forEach((opportunity) => {
      const key = opportunity.vendor_id || normalize(opportunity.vendor_name);
      if (key && opportunity.vendor_name) values.set(key, { id: opportunity.vendor_id || key, name: opportunity.vendor_name });
    });
    return Array.from(values.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [opportunities, salespeople]);

  const filtered = useMemo(() => {
    const query = normalize(search);
    const selectedProduct = productFilter as ProductKey;

    return opportunities.filter((opportunity) => {
      if (vendorFilter && opportunity.vendor_id !== vendorFilter && normalize(opportunity.vendor_name) !== vendorFilter) return false;

      if (query) {
        const haystack = [
          opportunity.client_name,
          opportunity.client_phone,
          opportunity.vendor_name,
          opportunity.status,
          opportunity.priority,
          opportunity.notes_summary?.last_note,
        ].map(normalize).join(" ");
        if (!haystack.includes(query)) return false;
      }

      if (selectedProduct) {
        const product = opportunity.products?.[selectedProduct];
        const hasValue = MONEY_PRODUCTS.has(selectedProduct)
          ? Number(product?.money_value || 0) > 0
          : Number(product?.quantity_value || 0) > 0;
        const hasStep = Boolean(product?.current_step?.id);
        if (!hasValue && !hasStep) return false;
      }

      for (const [productKey, selectedSteps] of Object.entries(stepFilters) as Array<[ProductKey, string[]]>) {
        if (!selectedSteps.length) continue;
        const product = opportunity.products?.[productKey];
        if (!product?.current_step?.name || !selectedSteps.includes(product.current_step.name)) return false;
      }

      return true;
    });
  }, [opportunities, productFilter, search, stepFilters, vendorFilter]);

  const tableTotals = useMemo(() => {
    const productTotals = Object.fromEntries(
      PRODUCT_ORDER.map((productKey) => [productKey, 0])
    ) as Record<ProductKey, number>;

    let totalLines = 0;
    let totalMoney = 0;

    filtered.forEach((opportunity) => {
      PRODUCT_ORDER.forEach((productKey) => {
        const product = opportunity.products?.[productKey];
        productTotals[productKey] += MONEY_PRODUCTS.has(productKey)
          ? Number(product?.money_value || 0)
          : Number(product?.quantity_value || 0);
      });
      totalLines += Number(opportunity.total_lines || 0);
      totalMoney += Number(opportunity.total_money || 0);
    });

    return { productTotals, totalLines, totalMoney };
  }, [filtered]);

  const metricCards = useMemo<MetricCard[]>(() => {
    const metaMoney = Number(metrics?.meta_money || 0);
    const metaQuantity = Number(metrics?.meta_quantity || 0);
    const realSoldMoney = Number(metrics?.real_sold_money || 0);
    const realSoldQuantity = Number(metrics?.real_sold_quantity || 0);
    const projectionMoney = Number(metrics?.projection_money || 0);
    const projectionQuantity = Number(metrics?.projection_quantity || 0);
    const remainingDays = Math.max(1, Number(metrics?.remaining_business_days || 1));
    const faltaMoney = Math.max(0, metaMoney - realSoldMoney);
    const faltaQuantity = Math.max(0, metaQuantity - realSoldQuantity);
    const dailyMoney = faltaMoney / remainingDays;
    const dailyQuantity = faltaQuantity / remainingDays;
    const moneyProgress = metaMoney > 0 ? (realSoldMoney / metaMoney) * 100 : 0;
    const quantityProgress = metaQuantity > 0 ? (realSoldQuantity / metaQuantity) * 100 : 0;
    const visibleProgress = opportunities.length > 0 ? (filtered.length / opportunities.length) * 100 : 0;

    return [
      { label: "Clientes visibles", value: numberFormatter.format(filtered.length), sub: `${numberFormatter.format(opportunities.length)} cargados`, progress: visibleProgress },
      { label: "Total líneas", value: metricsLoading ? "..." : numberFormatter.format(realSoldQuantity), sub: "Vendido real en Comisiones", sub2: metricsLoading ? undefined : `${formatMoney(realSoldMoney)} en dinero`, progress: null },
      { label: "Total $", value: metricsLoading ? "..." : formatMoney(realSoldMoney), sub: `${Math.round(moneyProgress)}% de meta dinero`, sub2: metricsLoading ? undefined : `${numberFormatter.format(realSoldQuantity)} líneas vendidas`, progress: moneyProgress },
      { label: "Proyección $", value: metricsLoading ? "..." : formatMoney(projectionMoney), sub: "Oportunidades abiertas SOV2", sub2: metricsLoading ? undefined : `${numberFormatter.format(projectionQuantity)} líneas en seguimiento`, progress: null },
      { label: "Proyección líneas", value: metricsLoading ? "..." : numberFormatter.format(projectionQuantity), sub: "Líneas abiertas SOV2", sub2: metricsLoading ? undefined : `${formatMoney(projectionMoney)} en seguimiento`, progress: null },
      { label: "Meta Dinero", value: metricsLoading ? "..." : formatMoney(metaMoney), sub: "MPLS + Fijo Ren + Fijo New", sub2: metricsLoading ? undefined : `Meta cantidad: ${numberFormatter.format(metaQuantity)} líneas`, progress: 100 },
      { label: "Falta Dinero", value: metricsLoading ? "..." : formatMoney(faltaMoney), sub: `${remainingDays} días hábiles restantes`, sub2: metricsLoading ? undefined : `Falta cantidad: ${numberFormatter.format(faltaQuantity)} líneas`, progress: metaMoney > 0 ? (faltaMoney / metaMoney) * 100 : 0 },
      { label: "Diario Dinero", value: metricsLoading ? "..." : formatMoney(dailyMoney), sub: "Ritmo requerido por día", sub2: metricsLoading ? undefined : `Diario cantidad: ${numberFormatter.format(Math.ceil(dailyQuantity))} líneas`, progress: remainingDays > 0 ? 100 / remainingDays : 0 },
      { label: "Cantidad vendida", value: metricsLoading ? "..." : numberFormatter.format(realSoldQuantity), sub: `${Math.round(quantityProgress)}% de meta cantidad`, sub2: metricsLoading ? undefined : `${formatMoney(realSoldMoney)} en dinero`, progress: quantityProgress },
      { label: "Meta Cantidad", value: metricsLoading ? "..." : numberFormatter.format(metaQuantity), sub: "Movil + TV + Cloud", sub2: metricsLoading ? undefined : `Meta dinero: ${formatMoney(metaMoney)}`, progress: 100 },
      { label: "Falta Cantidad", value: metricsLoading ? "..." : numberFormatter.format(faltaQuantity), sub: `${remainingDays} días hábiles restantes`, sub2: metricsLoading ? undefined : `Falta dinero: ${formatMoney(faltaMoney)}`, progress: metaQuantity > 0 ? (faltaQuantity / metaQuantity) * 100 : 0 },
      { label: "Diario Cantidad", value: metricsLoading ? "..." : numberFormatter.format(Math.ceil(dailyQuantity)), sub: "Ritmo requerido por día", sub2: metricsLoading ? undefined : `Diario dinero: ${formatMoney(dailyMoney)}`, progress: remainingDays > 0 ? 100 / remainingDays : 0 },
    ];
  }, [filtered, metrics, metricsLoading, opportunities.length]);

  const setSavingKey = (key: string, value: boolean) => {
    setSaving((current) => ({ ...current, [key]: value }));
  };

  const stepsModalOpportunity = useMemo(() => (
    stepModalContext ? opportunities.find((item) => item.id === stepModalContext.opportunityId) || null : null
  ), [opportunities, stepModalContext]);

  const stepsModalProduct = stepModalContext && stepsModalOpportunity
    ? stepsModalOpportunity.products?.[stepModalContext.productKey] || null
    : null;

  const refreshOne = async (id: string) => {
    const response = await authFetch(`/api/sov2/opportunities/${id}`);
    const updated = await readJson<Sov2Opportunity>(response);
    setOpportunities((current) => current.map((item) => (item.id === id ? updated : item)));
    setNotesModalOpportunity((current) => (current?.id === id ? updated : current));
  };

  const loadNotes = async (opportunityId: string) => {
    setNotesLoading(true);
    setNotesError(null);
    try {
      const response = await authFetch(`/api/sov2/opportunities/${opportunityId}/notes`);
      const payload = await readJson<Sov2Note[]>(response);
      setNotes(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : "No se pudieron cargar las notas.");
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  const openNotesModal = (opportunity: Sov2Opportunity, tab: NoteTabKey = "general") => {
    setNotesModalOpportunity(opportunity);
    setNotesActiveTab(tab);
    setNoteDraft("");
    setNotes([]);
    void loadNotes(opportunity.id);
  };

  const closeNotesModal = () => {
    setNotesModalOpportunity(null);
    setNotes([]);
    setNoteDraft("");
    setNotesError(null);
  };

  const handleCreateNote = async () => {
    if (!notesModalOpportunity) return;
    const text = noteDraft.trim();
    if (!text) return;

    const selectedTab = NOTE_TABS.find((tab) => tab.key === notesActiveTab) || NOTE_TABS[0];
    setNoteSaving(true);
    setNotesError(null);
    try {
      const response = await authFetch(`/api/sov2/opportunities/${notesModalOpportunity.id}/notes`, {
        method: "POST",
        json: {
          product_key: selectedTab.productKey,
          note: text,
        },
      });
      const created = await readJson<Sov2Note>(response);
      setNotes((current) => [...current, created]);
      setNoteDraft("");
      await refreshOne(notesModalOpportunity.id);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : "No se pudo guardar la nota.");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleValueSave = async (opportunity: Sov2Opportunity, productKey: ProductKey, value: number) => {
    const product = opportunity.products?.[productKey];

    const current = MONEY_PRODUCTS.has(productKey) ? Number(product.money_value || 0) : Number(product.quantity_value || 0);
    if (Number(value || 0) === current) return;

    const key = `${opportunity.id}:${productKey}:value`;
    setSavingKey(key, true);
    try {
      const payload = MONEY_PRODUCTS.has(productKey) ? { money_value: value } : { quantity_value: value };
      const url = product?.line_id
        ? `/api/sov2/opportunities/${opportunity.id}/lines/${product.line_id}`
        : `/api/sov2/opportunities/${opportunity.id}/products/${productKey}`;
      const response = await authFetch(url, {
        method: "PATCH",
        json: payload,
      });
      const updated = await readJson<Sov2Opportunity>(response);
      setOpportunities((currentItems) => currentItems.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar producto.");
      await refreshOne(opportunity.id).catch(() => null);
    } finally {
      setSavingKey(key, false);
    }
  };

  const handleStepSave = async (opportunity: Sov2Opportunity, productKey: ProductKey, stepId: string) => {
    const currentStep = opportunity.products?.[productKey]?.current_step;
    if (!stepId || stepId === currentStep?.id) return;

    const key = `${opportunity.id}:${productKey}:step`;
    setSavingKey(key, true);
    try {
      const response = await authFetch(`/api/sov2/opportunities/${opportunity.id}`, {
        method: "PATCH",
        json: { product_key: productKey, step_id: stepId },
      });
      const updated = await readJson<Sov2Opportunity>(response);
      setOpportunities((currentItems) => currentItems.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar paso.");
      await refreshOne(opportunity.id).catch(() => null);
    } finally {
      setSavingKey(key, false);
    }
  };

  const handleCreateNewOpportunity = async (draft: NewOpportunityDraft) => {
    const clientName = draft.client_name.trim();
    if (!clientName) {
      setNewOpportunityError("Nombre del cliente requerido.");
      return;
    }

    setNewOpportunitySaving(true);
    setNewOpportunityError(null);
    try {
      const response = await authFetch("/api/sov2/opportunities", {
        method: "POST",
        json: {
          client_name: clientName,
          phone: draft.phone.trim() || null,
          salesperson_id: draft.salesperson_id || null,
          product_key: draft.product_key,
          value: draft.value ? Number(draft.value) : 0,
          quantity: draft.quantity ? Number(draft.quantity) : undefined,
          note: draft.note.trim() || null,
        },
      });
      const created = await readJson<Sov2Opportunity>(response);
      setOpportunities((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSearch(clientName);
      setProductFilter(draft.product_key);
      setNewOpportunityOpen(false);
    } catch (err) {
      setNewOpportunityError(err instanceof Error ? err.message : "No se pudo crear la oportunidad.");
    } finally {
      setNewOpportunitySaving(false);
    }
  };

  const handleImportSearch = useCallback(async (q: string) => {
    setImportQuery(q);
    if (!q.trim()) { setImportResults([]); return; }
    setImportSearching(true);
    try {
      const res = await authFetch(`/api/clients/search?q=${encodeURIComponent(q)}`);
      const data = await readJson<Array<{ id: string; name: string; business_name: string | null; phone: string | null; salesperson_name: string | null }>>(res);
      setImportResults(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch { setImportResults([]); }
    finally { setImportSearching(false); }
  }, []);

  const handleImportClient = async (clientId: string) => {
    setImportingId(clientId);
    setImportError(null);
    try {
      const res = await authFetch("/api/sov2/opportunities/from-client", {
        method: "POST",
        json: { client_id: clientId, product_key: "fijo_new" },
      });
      const created = await readJson<Sov2Opportunity>(res);
      setOpportunities((cur) => [created, ...cur.filter((o) => o.id !== created.id)]);
      setImportClientOpen(false);
      setImportQuery("");
      setImportResults([]);
      setSearch(created.client_name);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "No se pudo importar el cliente.");
    } finally {
      setImportingId(null);
    }
  };

  const handleCloseOpportunity = async (opportunityId: string) => {
    setCloseConfirming(true);
    setCloseError(null);
    try {
      await authFetch(`/api/sov2/opportunities/${opportunityId}/close`, { method: "POST" });
      setOpportunities((current) => current.filter((o) => o.id !== opportunityId));
      setCloseConfirmId(null);
    } catch (err) {
      setCloseError(err instanceof Error ? err.message : "No se pudo cerrar la oportunidad.");
    } finally {
      setCloseConfirming(false);
    }
  };

  const handleStepFilterChange = (productKey: ProductKey, values: string[]) => {
    setStepFilters((current) => ({ ...current, [productKey]: values }));
  };

  const reloadProductSteps = async (productKey: ProductKey) => {
    try {
      const response = await authFetch(`/api/sov2/products/${productKey}/steps`);
      const payload = await readJson<Sov2Step[]>(response);
      setStepsByProduct((current) => ({
        ...current,
        [productKey]: Array.isArray(payload) ? payload : [],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron refrescar los pasos.");
    }
  };

  return (
    <div className="vp-polished sov2-exec relative min-h-screen overflow-hidden bg-slate-950 px-3 py-4 text-slate-100 sm:px-5 sm:py-5 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="sov2-orb sov2-orb-a" />
        <div className="sov2-orb sov2-orb-b" />
        <div className="sov2-grid-overlay" />
      </div>

      <div className="relative mx-auto max-w-[1500px]">
      <div className="mb-5 rounded-[1.35rem] border border-indigo-400/20 bg-gradient-to-r from-slate-950 via-indigo-950/30 to-slate-950 px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.35),0_0_50px_rgba(79,70,229,0.12)] sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-indigo-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
            Experiencia comercial enfocada en cierre
          </div>
          <div className="flex items-center gap-3">
            <div className="sov2-title-icon flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-300/25 bg-indigo-500/15 text-indigo-200 shadow-[0_0_28px_rgba(99,102,241,0.24)]">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-300">Asana + CRM Comercial</div>
              <h1 className="text-2xl font-semibold tracking-normal text-white sm:text-[2rem]">Asana Seg.</h1>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
            Una vista limpia, directa y profesional para que el vendedor entienda rápido qué trabajar, qué empujar y dónde está el dinero.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1">VISTA CON FOCO</span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1">METAS VISIBLES</span>
            <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1">ACCIONES RAPIDAS</span>
          </div>
        </div>
        <span style={{ display: "none" }}>ÁPIDASÃPIDAS</span>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
          <button
            type="button"
            onClick={() => {
              setNewOpportunityError(null);
              setNewOpportunityOpen(true);
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
          >
            <Plus className="h-4 w-4" />
            Cliente nuevo
          </button>
          <button
            type="button"
            onClick={() => { setImportError(null); setImportQuery(""); setImportResults([]); setImportClientOpen(true); }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/25"
          >
            <Search className="h-4 w-4" />
            Importar cliente
          </button>
          <button
            type="button"
            onClick={() => setStepConfigOpen(true)}
            className="vp-action inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition"
          >
            <Settings className="h-4 w-4" />
            Configurar pasos
          </button>
          <button
            type="button"
            onClick={() => void loadOpportunities()}
            className="sov2-secondary-action inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>
        </div>
      </div>

      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-9">
        {metricCards.map((card) => <MetricCardView key={card.label} card={card} />)}
      </section>

       <section className="vp-surface sov2-filterbar mb-4 grid gap-3 rounded-[1.15rem] border border-sky-400/20 bg-gradient-to-r from-slate-950 via-slate-900/90 to-slate-950 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.22)] lg:grid-cols-[7rem_12rem_minmax(0,1fr)_auto] lg:items-center">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400 lg:w-28">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
        </div>
        <select
          value={vendorFilter}
          onChange={(event) => setVendorFilter(event.currentTarget.value)}
          className="h-10 w-full rounded-xl border border-emerald-400/30 bg-slate-950 px-3 text-sm font-medium text-slate-100 outline-none focus:border-emerald-300"
        >
          <option value="">Todos vendedores</option>
          {vendorOptions.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
        </select>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Buscar cliente, vendedor, notas..."
            className="h-10 w-full rounded-xl border border-sky-400/30 bg-slate-950 pl-8 pr-3 text-sm text-slate-100 outline-none focus:border-sky-300"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setVendorFilter("");
            setProductFilter("");
            setStepFilters({});
          }}
          className="h-10 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 text-sm font-semibold text-amber-100 transition hover:border-amber-300"
        >
          Limpiar filtros
        </button>
      </section>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="vp-surface sov2-table-shell overflow-hidden rounded-[1.35rem] border border-slate-700/80 bg-slate-950 shadow-[0_22px_80px_rgba(0,0,0,0.38)]">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-400">
          <span>
          {loading ? "Cargando SOV2..." : `${filtered.length} de ${opportunities.length} oportunidades visibles`}
          </span>
          <span className="hidden rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 sm:inline-flex">
            Vista comercial
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="sov2-table min-w-[1380px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="sticky left-0 z-20 w-56 border-b border-r border-slate-800 bg-slate-900 px-3 py-4 text-sky-200">Cliente</th>
                <th className="w-36 border-b border-r border-slate-800 px-3 py-4 text-sky-200">Vendedor</th>
                {PRODUCT_ORDER.map((productKey) => {
                  const product = productList.find((item) => item.product_key === productKey);
                  if (!product) return null;
                  return (
                    <th key={productKey} className={classNames("w-32 border-b border-r px-2 py-2", PRODUCT_ACCENTS[productKey].border, PRODUCT_ACCENTS[productKey].soft)}>
                      <ProductHeaderFilter
                        product={product}
                        options={stepsByProduct[productKey] || []}
                        selected={stepFilters[productKey] || []}
                        onChange={handleStepFilterChange}
                      />
                    </th>
                  );
                })}
                <th className="w-28 border-b border-r border-slate-800 px-3 py-4 text-cyan-200">Total Lineas</th>
                <th className="w-28 border-b border-r border-slate-800 px-3 py-4 text-emerald-200">Total $</th>
                <th className="w-44 border-b border-r border-slate-800 px-3 py-4 text-violet-200">Notas</th>
                <th className="sticky right-0 z-20 w-28 border-b border-l border-slate-800 bg-slate-900 px-3 py-4 text-blue-200">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Cargando oportunidades...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-slate-500">Sin oportunidades para los filtros actuales.</td>
                </tr>
              )}
              {!loading && filtered.map((opportunity) => (
                <tr
                  key={opportunity.id}
                  data-testid="sov2-row"
                  className={classNames(
                    "sov2-data-row hover:bg-slate-900/40",
                    opportunity.client_pending_validation && "bg-amber-500/5"
                  )}
                >
                  <td className="sticky left-0 z-10 border-r border-slate-800 bg-slate-950 px-3 py-2">
                    <div className="max-w-52 truncate text-sm font-semibold text-slate-100">{opportunity.client_name}</div>
                    {opportunity.client_pending_validation && (
                      <div className="mt-1 inline-flex rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-100">
                        Cliente nuevo
                      </div>
                    )}
                    <div className="truncate text-xs font-medium text-slate-300">
                      {opportunity.client_phone || "Sin número registrado"}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {numberFormatter.format(opportunity.ban_count || 0)} BAN · {numberFormatter.format(opportunity.subscriber_count || 0)} subs
                    </div>
                  </td>
                  <td className="border-r border-slate-800 px-3 py-2 text-sm text-slate-200">
                    <span className="sov2-vendor-pill inline-flex rounded-full border px-2 py-1 text-[12px] font-semibold">
                      {opportunity.vendor_name || "Sin asignar"}
                    </span>
                  </td>
                  {PRODUCT_ORDER.map((productKey) => {
                    const product = opportunity.products?.[productKey];
                    if (!product) return null;
                    return (
                      <td key={`${opportunity.id}-${productKey}`} className={classNames("border-r px-2 py-2", PRODUCT_ACCENTS[productKey].border)}>
                        <ProductValueInput
                          opportunity={opportunity}
                          productKey={productKey}
                          product={product}
                          saving={Boolean(saving[`${opportunity.id}:${productKey}:value`])}
                          stepSaving={Boolean(saving[`${opportunity.id}:${productKey}:step`])}
                          onSave={handleValueSave}
                          onOpenSteps={(opportunityId, selectedProductKey) => setStepModalContext({ opportunityId, productKey: selectedProductKey })}
                        />
                      </td>
                    );
                  })}
                  <td className="border-r border-slate-800 px-3 py-2 text-right text-sm font-bold text-cyan-200">{numberFormatter.format(opportunity.total_lines || 0)}</td>
                  <td className="border-r border-slate-800 px-3 py-2 text-right text-sm font-bold text-emerald-200">{formatMoney(opportunity.total_money || 0)}</td>
                  <td className="border-r border-slate-800 px-3 py-2">
                    <button
                      type="button"
                      data-testid={`sov2-notes-open-${opportunity.id}`}
                      onClick={() => openNotesModal(opportunity)}
                      className="sov2-notes-button inline-flex max-w-40 items-center gap-1.5 truncate rounded-md border px-2 py-1 text-xs transition"
                      title={opportunity.notes_summary?.last_note || "Sin notas"}
                    >
                      <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
                      {opportunity.notes_summary?.count ? `${opportunity.notes_summary.count} notas` : "Sin notas"}
                    </button>
                  </td>
                  <td className="sticky right-0 z-10 border-l border-slate-800 bg-slate-950 px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/clientes?openClient=${opportunity.client_id}`)}
                        className="sov2-client-button inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold"
                        title="Abrir ficha del cliente"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCloseError(null); setCloseConfirmId(opportunity.id); }}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/20"
                        title="Cerrar seguimiento y devolver al pool"
                      >
                        <Users className="h-3 w-3" />
                        Al pool
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot className="sticky bottom-0 z-20 bg-slate-900 text-xs">
                <tr className="border-t border-sky-500/40 shadow-[0_-10px_24px_rgba(0,0,0,0.24)]">
                  <td className="sticky left-0 z-30 border-r border-slate-700 bg-slate-900 px-3 py-3">
                    <div className="text-sm font-bold uppercase tracking-wide text-sky-100">Totales</div>
                    <div className="text-[11px] text-slate-400">{numberFormatter.format(filtered.length)} clientes</div>
                  </td>
                  <td className="border-r border-slate-700 bg-slate-900 px-3 py-3 text-slate-400">-</td>
                  {PRODUCT_ORDER.map((productKey) => {
                    const product = productList.find((item) => item.product_key === productKey);
                    if (!product) return null;
                    const value = tableTotals.productTotals[productKey] || 0;
                    return (
                      <td key={`total-${productKey}`} className={classNames("border-r bg-slate-900 px-2 py-3 text-right text-sm font-black", PRODUCT_ACCENTS[productKey].border, MONEY_PRODUCTS.has(productKey) ? "text-emerald-200" : "text-cyan-200")}>
                        {MONEY_PRODUCTS.has(productKey) ? formatMoney(value) : numberFormatter.format(value)}
                      </td>
                    );
                  })}
                  <td className="border-r border-slate-700 bg-slate-900 px-3 py-3 text-right text-sm font-black text-cyan-200">
                    {numberFormatter.format(tableTotals.totalLines)}
                  </td>
                  <td className="border-r border-slate-700 bg-slate-900 px-3 py-3 text-right text-sm font-black text-emerald-200">
                    {formatMoney(tableTotals.totalMoney)}
                  </td>
                  <td className="border-r border-slate-700 bg-slate-900 px-3 py-3 text-slate-400">-</td>
                  <td className="sticky right-0 z-30 border-l border-slate-700 bg-slate-900 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                    Total
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
      </div>
      {newOpportunityOpen && (
        <NewOpportunityModal
          products={productList}
          vendors={vendorOptions}
          saving={newOpportunitySaving}
          error={newOpportunityError}
          onSubmit={handleCreateNewOpportunity}
          onClose={() => {
            if (!newOpportunitySaving) setNewOpportunityOpen(false);
          }}
        />
      )}
      {importClientOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) { setImportClientOpen(false); } }}>
          <div className="w-full max-w-lg rounded-2xl border border-sky-400/20 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-400">Flow 3</div>
                <h2 className="text-lg font-semibold text-white">Importar cliente existente</h2>
              </div>
              <button type="button" onClick={() => setImportClientOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar por nombre, empresa o teléfono..."
                  value={importQuery}
                  onChange={(e) => handleImportSearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-500"
                />
                {importSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-sky-400" />}
              </div>
              {importError && <p className="mt-2 text-xs text-red-400">{importError}</p>}
              <div className="mt-3 max-h-72 overflow-y-auto space-y-1">
                {importResults.length === 0 && importQuery.trim() && !importSearching && (
                  <p className="py-6 text-center text-sm text-slate-500">No se encontraron clientes.</p>
                )}
                {importResults.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 transition hover:border-slate-700">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{c.business_name || c.name}</div>
                      {c.business_name && c.name && <div className="truncate text-[11px] text-slate-400">{c.name}</div>}
                      {c.phone && <div className="text-[11px] text-slate-500">{c.phone}</div>}
                      {c.salesperson_name && <div className="text-[11px] text-slate-500">{c.salesperson_name}</div>}
                    </div>
                    <button
                      type="button"
                      disabled={importingId === c.id}
                      onClick={() => handleImportClient(c.id)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/25 disabled:opacity-50"
                    >
                      {importingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Importar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {notesModalOpportunity && (
        <NotesModal
          opportunity={notesModalOpportunity}
          notes={notes}
          activeTab={notesActiveTab}
          draft={noteDraft}
          loading={notesLoading}
          saving={noteSaving}
          error={notesError}
          onTabChange={setNotesActiveTab}
          onDraftChange={setNoteDraft}
          onSubmit={() => void handleCreateNote()}
          onClose={closeNotesModal}
        />
      )}
      {stepConfigOpen && (
        <StepConfigModal
          products={productList}
          onSaved={(productKey) => void reloadProductSteps(productKey)}
          onClose={() => setStepConfigOpen(false)}
        />
      )}
      {stepModalContext && stepsModalOpportunity && stepsModalProduct && (
        <ProductStepsModal
          opportunity={stepsModalOpportunity}
          product={stepsModalProduct}
          productKey={stepModalContext.productKey}
          steps={stepsByProduct[stepModalContext.productKey] || []}
          saving={Boolean(saving[`${stepModalContext.opportunityId}:${stepModalContext.productKey}:step`])}
          onStepSave={handleStepSave}
          onClose={() => setStepModalContext(null)}
        />
      )}
      {closeConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-sm rounded-xl border border-red-500/40 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-2 text-base font-semibold text-white">¿Devolver al pool?</div>
            <p className="mb-4 text-sm text-slate-300">
              Se cierra el seguimiento y el cliente queda sin vendedor asignado. Esta acción no se puede deshacer.
            </p>
            {closeError && <p className="mb-3 text-xs text-red-400">{closeError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={closeConfirming}
                onClick={() => { setCloseConfirmId(null); setCloseError(null); }}
                className="h-9 rounded-md border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-wait"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={closeConfirming}
                onClick={() => void handleCloseOpportunity(closeConfirmId)}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-red-500/50 bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-wait disabled:opacity-60"
              >
                {closeConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
