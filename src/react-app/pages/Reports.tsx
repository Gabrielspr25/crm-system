
import { useState, useMemo, Fragment, useEffect, useCallback } from "react";
import { DollarSign, Search, Save, CheckCircle2, RefreshCw, ChevronDown, ChevronRight, Building2, Users, Receipt, Wallet, BarChart3, X, AlertTriangle, Loader2 } from "lucide-react";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

interface SubscriberReport {
  subscriber_id: string;
  phone: string;
  line_type?: string | null;
  line_kind?: 'movil' | 'fijo' | null;
  sale_type?: string | null;
  salesperson_commission_percentage?: number | null;
  suggested_vendor_commission?: number | null;
  effective_vendor_commission?: number | null;
  monthly_value: number | null;
  activation_date: string;
  report_month: string;
  ban_number: string;
  account_type?: string;
  client_id: string;
  client_name?: string;
  client_business_name?: string;
  vendor_id?: string | null;
  vendor_name?: string;
  company_earnings?: number | null;
  vendor_commission?: number | null;
  portability_bonus?: number | null;
  paid_amount?: number | null;
  paid_date?: string | null;
  is_paid?: boolean;
  paid_at?: string | null;
  is_audited?: boolean;
  audited_at?: string | null;
  withholding_applies?: boolean;
  products?: {
    prospect_id: number;
    fijo_ren: number; fijo_new: number; movil_nueva: number; movil_renovacion: number;
    claro_tv: number; cloud: number; mpls: number;
    completed_date: string | null; notes: string | null;
  } | null;
}

function formatSaleTypeLabel(accountType?: string | null, lineType?: string | null, saleType?: string | null, lineKind?: string | null): string {
  const exact = String(saleType || '').trim().toUpperCase();
  if (exact === 'FIJO_REN') return 'Fijo REN';
  if (exact === 'FIJO_NEW') return 'Fijo NEW';
  if (exact === 'MOVIL_RENOVACION') return 'Móvil REN';
  if (exact === 'MOVIL_NUEVA') return 'Móvil NEW';

  const line = String(lineType || '').trim().toUpperCase();
  const isRen = line === 'REN';

  // line_kind manda: viene de Tango ventatipoid y refleja el tipo real de la
  // línea independiente del account_type del BAN (CONVERGENTE no implica móvil).
  const kind = String(lineKind || '').trim().toLowerCase();
  if (kind === 'fijo') return isRen ? 'Fijo REN' : 'Fijo NEW';
  if (kind === 'movil') return isRen ? 'Móvil REN' : 'Móvil NEW';

  // Fallback heurístico (subscribers viejos sin line_kind clasificado)
  const account = String(accountType || '').trim().toUpperCase().replace(/^CONVERGENTE$/, 'MOVIL');
  if (account === 'FIJO' || account === 'FIXED') {
    return isRen ? 'Fijo REN' : 'Fijo NEW';
  }
  if (account === 'PYMES' || account === 'UPDATE' || account === 'MOVIL' || account === 'MÓVIL' || account === 'MOBILE') {
    return isRen ? 'Móvil REN' : 'Móvil NEW';
  }
  if (line === 'REN') return 'REN';
  if (line === 'NEW') return 'NEW';
  return 'Sin tipo';
}

function resolveLineProducts(rows: SubscriberReport[]) {
  const counts = {
    fijo_ren: 0,
    fijo_new: 0,
    movil_nueva: 0,
    movil_renovacion: 0,
  };

  rows.forEach((row) => {
    const saleType = String(row.sale_type || '').trim().toUpperCase();
    if (saleType === 'FIJO_REN') {
      counts.fijo_ren += 1;
      return;
    }
    if (saleType === 'FIJO_NEW') {
      counts.fijo_new += 1;
      return;
    }
    if (saleType === 'MOVIL_RENOVACION') {
      counts.movil_renovacion += 1;
      return;
    }
    if (saleType === 'MOVIL_NUEVA') {
      counts.movil_nueva += 1;
      return;
    }

    const lineType = String(row.line_type || '').trim().toUpperCase();
    const isRen = lineType === 'REN';

    // line_kind manda: tipo real de la línea desde Tango.
    const kind = String(row.line_kind || '').trim().toLowerCase();
    if (kind === 'fijo') {
      if (isRen) counts.fijo_ren += 1; else counts.fijo_new += 1;
      return;
    }
    if (kind === 'movil') {
      if (isRen) counts.movil_renovacion += 1; else counts.movil_nueva += 1;
      return;
    }

    // Fallback heurístico (sin line_kind clasificado todavía)
    const account = String(row.account_type || '').trim().toUpperCase().replace(/^CONVERGENTE$/, 'MOVIL');
    const phone = String(row.phone || '').trim().toUpperCase();
    const isFijo = account === 'FIJO' || account === 'FIXED' || phone.startsWith('FIJO-');
    const isMovil = account === 'PYMES' || account === 'UPDATE' || account === 'MOVIL' || account === 'MÃ“VIL' || account === 'MOBILE';

    if (isFijo) {
      if (isRen) counts.fijo_ren += 1;
      else counts.fijo_new += 1;
    } else if (isMovil) {
      if (isRen) counts.movil_renovacion += 1;
      else counts.movil_nueva += 1;
    }
  });

  return counts;
}

function roundMoney(value?: number | null): number | null {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function safeMoneyNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Formatter defensivo: nunca rompe aunque venga undefined/null/NaN.
// Usar en lugar de `valor.toLocaleString(...)` directo en cualquier render
// que sirva a un usuario. Devuelve siempre string con 2 decimales.
function fmtMoney(value: unknown): string {
  return safeMoneyNumber(value).toLocaleString('es-ES', { minimumFractionDigits: 2 });
}

function calculateSuggestedVendorCommission(companyEarnings?: number | null, commissionPercentage?: number | null): number | null {
  const earnings = Number(companyEarnings);
  const percentage = Number(commissionPercentage);
  if (!Number.isFinite(earnings) || earnings <= 0) return null;
  if (!Number.isFinite(percentage) || percentage <= 0) return null;
  return roundMoney((earnings * percentage) / 100);
}

function normalizeClientGroupKey(name?: string | null): string {
  return String(name || "Sin nombre")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// Celda editable para comisión vendedor con state local (no depende de
// editingVendorComm global, así no hay re-renders del padre que reseteen el input).
function EditableCommissionCell({
  rowId,
  initialValue,
  onSave,
}: {
  rowId: string;
  initialValue: number;
  onSave: (rowId: string, newValue: number) => Promise<void> | void;
}) {
  const [value, setValue] = useState<string>(String(initialValue ?? ''));
  const [originalValue, setOriginalValue] = useState<number>(initialValue);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedFlash, setSavedFlash] = useState<boolean>(false);

  // Si el valor inicial cambia desde afuera (ej. tras refetch) y no hay edición
  // pendiente, sincronizar.
  useEffect(() => {
    if (!saving && Number(value) === originalValue) {
      setValue(String(initialValue ?? ''));
      setOriginalValue(initialValue);
    }
    // Solo cuando cambia initialValue desde el padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  const isDirty = value !== String(originalValue ?? '') && value !== '';

  const doSave = async () => {
    if (!isDirty) return;
    const parsed = parseFloat(value.replace(',', '.'));
    if (!Number.isFinite(parsed)) return;
    setSaving(true);
    try {
      await onSave(rowId, parsed);
      setOriginalValue(parsed);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <span className="text-blue-400 text-xs">$</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          const raw = e.target.value.replace(',', '.');
          if (raw === '' || /^\d*\.?\d*$/.test(raw)) setValue(raw);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } }}
        className={`w-20 bg-slate-900 border text-blue-200 font-mono text-xs px-2 py-1 rounded outline-none ${
          isDirty ? 'border-amber-400 ring-1 ring-amber-400/40' :
          savedFlash ? 'border-emerald-400 ring-1 ring-emerald-400/40' :
          'border-slate-700 hover:border-blue-400/50 focus:border-blue-400'
        }`}
        title="Editar comisión vendedor (Enter o botón Guardar)"
      />
      <button
        type="button"
        onClick={doSave}
        disabled={saving || !isDirty}
        title={isDirty ? 'Guardar comisión' : 'Sin cambios'}
        className="w-6 h-6 rounded flex items-center justify-center bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
      </button>
    </div>
  );
}

function getDefaultReportsMonth(): string {
  // Mes en curso (no mes anterior). Si hoy es 2026-04-30, devuelve "2026-04".
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export default function Reports() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(getDefaultReportsMonth);
  const [viewMode, setViewMode] = useState<'empresa' | 'vendedor'>('empresa');
  const effectiveView = isAdmin ? viewMode : 'vendedor';

  // Estados para edicion manual
  const [editingVendorComm, setEditingVendorComm] = useState<Record<string, string>>({});
  const [editingCompanyEarn, setEditingCompanyEarn] = useState<Record<string, string>>({});
  const [editingPaidAmount, setEditingPaidAmount] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});

  // Filtros del acordeón "Informe de ventas"
  const [informeTipoFilter, setInformeTipoFilter] = useState<string>("");
  const [informeSearch, setInformeSearch] = useState<string>("");

  // Cargar datos directamente con useEffect (sin useApi para evitar problemas de memoización)
  const [reportRows, setReportRows] = useState<SubscriberReport[] | null>(null);
  const [loadingProspects, setLoadingProspects] = useState(false);

  const fetchReports = useCallback(async (month: string) => {
    setLoadingProspects(true);
    try {
      const url = month ? `/api/subscriber-reports?month=${month}` : '/api/subscriber-reports';
      console.log('[Reports] Fetching:', url);
      const resp = await authFetch(url);
      if (resp.ok) {
        const data = await resp.json();
        console.log('[Reports] Got', data.length, 'rows for month', month);
        setReportRows(data);
      } else {
        console.error('[Reports] Error:', resp.status);
        setReportRows([]);
      }
    } catch (err) {
      console.error('[Reports] Fetch error:', err);
      setReportRows([]);
    } finally {
      setLoadingProspects(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(selectedMonth);
  }, [selectedMonth, fetchReports]);

  const refetchProspects = useCallback(() => fetchReports(selectedMonth), [selectedMonth, fetchReports]);

  useEffect(() => {
    const handleRefresh = () => {
      void refetchProspects();
    };
    window.addEventListener("modal-refresh", handleRefresh);
    window.addEventListener("refreshReports", handleRefresh);
    return () => {
      window.removeEventListener("modal-refresh", handleRefresh);
      window.removeEventListener("refreshReports", handleRefresh);
    };
  }, [refetchProspects]);

  // Derivar vendedores únicos de los datos del reporte (vendor_id es UUID de salespeople)
  const reportVendors = useMemo(() => {
    if (!reportRows) return [];
    const map = new Map<string, string>();
    for (const row of reportRows) {
      if (row.vendor_id && row.vendor_name) {
        map.set(String(row.vendor_id), row.vendor_name);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [reportRows]);

  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<any[] | null>(null);
  const [tangoDetail, setTangoDetail] = useState<any[] | null>(null);
  const [detailMonthFilter, setDetailMonthFilter] = useState<string>('');
  const [loadingComparison, setLoadingComparison] = useState(false);

  // ── Sync Tango → CRM ──
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ stats: any; alerts: { level: string; ban: string; msg: string }[] } | null>(null);

  const handleSyncTango = async () => {
    if (syncing) return;
    if (!confirm('¿Sincronizar ventas de Tango → CRM?\nTango es la fuente de verdad.')) return;
    setSyncing(true);
    setSyncResult(null);
    // El sync puede procesar miles de filas y tardar >1 min. Usamos fetch directo
    // con AbortController y timeout amplio. authFetch redirigía a login ante
    // cualquier TypeError, lo que rompía la UX cuando el endpoint tardaba.
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 240_000);
    try {
      const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('crm_token') : null) || '';
      const apiBase = (import.meta.env.VITE_API_BASE_URL && String(import.meta.env.VITE_API_BASE_URL).trim()) || window.location.origin;
      const resp = await fetch(`${apiBase}/api/tango/sync`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setSyncResult({ stats: data.stats, alerts: data.alerts || [] });
        refetchProspects();
      } else {
        alert('Error en sync: ' + (data.error || `HTTP ${resp.status}`));
        if (data.stats) setSyncResult({ stats: data.stats, alerts: data.alerts || [] });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        alert('La sincronización tardó demasiado (>4 min) y fue cancelada. Reintentá en unos minutos.');
      } else {
        alert('Error de red: ' + (err?.message || 'desconocido'));
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSyncing(false);
    }
  };

  const handleShowComparison = async () => {
    if (showComparison) { setShowComparison(false); return; }
    setLoadingComparison(true);
    try {
      const resp = await authFetch('/api/subscriber-reports/comparison');
      const data = await resp.json();
      setComparisonData(data.comparison || []);
      setTangoDetail(data.detail || []);
      setShowComparison(true);
    } catch (err: any) {
      alert('Error cargando comparación: ' + err.message);
    } finally {
      setLoadingComparison(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!reportRows) return [];
    console.log('[Reports] filteredRows: selectedVendor=', selectedVendor, '| searchTerm=', searchTerm, '| reportRows.length=', reportRows.length);
    if (reportRows.length > 0) {
      console.log('[Reports] Sample row vendor_id:', reportRows[0].vendor_id, '| vendor_name:', reportRows[0].vendor_name, '| report_month:', reportRows[0].report_month);
    }

    return reportRows
      .filter((row) => {
        const matchesVendor = !selectedVendor || String(row.vendor_id || "") === selectedVendor;
        const clientName = (row.client_business_name || row.client_name || '').toLowerCase();
        const term = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm
          || clientName.includes(term)
          || (row.phone || '').includes(searchTerm)
          || (row.ban_number || '').includes(searchTerm);
        return matchesVendor && matchesSearch;
      })
      .map((row) => ({
        id: row.subscriber_id,
        subscriber_id: row.subscriber_id,
        client_id: row.client_id,
        client: row.client_business_name || row.client_name || 'Sin nombre',
        client_name: row.client_name || null,
        client_business_name: row.client_business_name || null,
        vendor_name: row.vendor_name || 'Desconocido',
        phone: row.phone,
        line_type: row.line_type || null,
        line_kind: row.line_kind || null,
        sale_type: row.sale_type || null,
        account_type: row.account_type || null,
        ban_number: row.ban_number,
        activation_date: row.activation_date,
        plan: (row as any).plan ?? null,
        monthly_value: row.monthly_value ?? null,
        company_earnings: row.company_earnings ?? null,
        vendor_commission: row.vendor_commission ?? null,
        portability_bonus: row.portability_bonus ?? 0,
        suggested_vendor_commission: row.suggested_vendor_commission ?? null,
        effective_vendor_commission: row.effective_vendor_commission ?? null,
        salesperson_commission_percentage: row.salesperson_commission_percentage ?? null,
        paid_amount: row.paid_amount ?? null,
        paid_date: row.paid_date ?? null,
        is_paid: Boolean(row.is_paid),
        paid_at: row.paid_at ?? null,
        is_audited: Boolean(row.is_audited),
        audited_at: row.audited_at ?? null,
        withholding_applies: row.withholding_applies !== false,
        report_month: row.report_month,
        products: row.products || null
      }));
  }, [reportRows, selectedVendor, searchTerm]);

  const groupedClients = useMemo(() => {
    const map = new Map();
    for (const row of filteredRows) {
      const key = effectiveView === 'empresa'
        ? normalizeClientGroupKey(row.client)
        : String(row.client_id || row.client || row.id);
      if (!map.has(key)) {
        map.set(key, {
          group_key: key,
          client_id: row.client_id,
          client: row.client,
          vendor_name: row.vendor_name,
          vendor_names: new Set([row.vendor_name || 'Desconocido']),
          subscribers: [],
          totalEarnings: 0,
          totalCommission: 0,
          totalPaid: 0,
          totalMensualidad: 0,
          latestCaseDate: null as string | null,
          products: row.products || null,
          lineProducts: {
            fijo_ren: 0,
            fijo_new: 0,
            movil_nueva: 0,
            movil_renovacion: 0,
            claro_tv: 0,
            cloud: 0,
            mpls: 0,
            completed_date: null,
            notes: null,
            prospect_id: 0
          }
        });
      }
      const g = map.get(key);
      if (row.client_id && g.client_id && row.client_id !== g.client_id) {
        g.client_id = null;
      }
      g.vendor_names.add(row.vendor_name || 'Desconocido');
      g.vendor_name = Array.from(g.vendor_names).filter(Boolean).sort().join(' / ');
      g.subscribers.push(row);
      g.totalEarnings += Number(row.company_earnings || 0);
      g.totalCommission += Number(row.vendor_commission || 0);
      g.totalPaid += Number(row.paid_amount || 0);
      g.totalMensualidad += Number(row.monthly_value || 0);
      const rowDate = row.report_month || row.activation_date || null;
      if (rowDate && (!g.latestCaseDate || new Date(rowDate) > new Date(g.latestCaseDate))) {
        g.latestCaseDate = rowDate;
      }
      if (!g.products && row.products) g.products = row.products;
      if (g.products && row.products && g.products.prospect_id !== row.products.prospect_id) {
        g.products = null;
      }

      // Conteo de productos por línea: line_kind manda. Fallback heurístico para
      // subscribers sin line_kind clasificado todavía.
      const lineType = String(row.line_type || '').trim().toUpperCase();
      const isRen = lineType === 'REN';
      const kind = String(row.line_kind || '').trim().toLowerCase();
      if (kind === 'fijo') {
        if (isRen) g.lineProducts.fijo_ren += 1; else g.lineProducts.fijo_new += 1;
      } else if (kind === 'movil') {
        if (isRen) g.lineProducts.movil_renovacion += 1; else g.lineProducts.movil_nueva += 1;
      } else {
        const account = String(row.account_type || '').trim().toUpperCase().replace(/^CONVERGENTE$/, 'MOVIL');
        const phone = String(row.phone || '').trim().toUpperCase();
        const isFijo = account === 'FIJO' || account === 'FIXED' || phone.startsWith('FIJO-');
        const isMovil = account === 'PYMES' || account === 'UPDATE' || account === 'MOVIL' || account === 'MÓVIL' || account === 'MOBILE';
        if (isFijo) {
          if (isRen) g.lineProducts.fijo_ren += 1;
          else g.lineProducts.fijo_new += 1;
        } else if (isMovil) {
          if (isRen) g.lineProducts.movil_renovacion += 1;
          else g.lineProducts.movil_nueva += 1;
        }
      }
    }
    return Array.from(map.values())
      .map((g: any) => {
        const resolvedLineProducts = resolveLineProducts(g.subscribers || []);
        return {
          ...g,
          vendor_name: Array.from(g.vendor_names || []).filter(Boolean).sort().join(' / ') || 'Desconocido',
          lineProducts: resolvedLineProducts,
        // Siempre mostrar conteo real de líneas vendidas; conservar campos manuales si existen.
        products: g.products
          ? {
              ...g.products,
              fijo_ren: resolvedLineProducts.fijo_ren,
              fijo_new: resolvedLineProducts.fijo_new,
              movil_nueva: resolvedLineProducts.movil_nueva,
              movil_renovacion: resolvedLineProducts.movil_renovacion,
            }
          : resolvedLineProducts
        };
      })
      .sort((a: any, b: any) => {
        const ad = a.latestCaseDate ? new Date(a.latestCaseDate).getTime() : 0;
        const bd = b.latestCaseDate ? new Date(b.latestCaseDate).getTime() : 0;
        return bd - ad;
      });
  }, [effectiveView, filteredRows]);

  // Accordion state: expanded client keys
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  // Alerta: reportes sin vendedor
  const noVendorRows = useMemo(() => {
    if (!reportRows) return [];
    return reportRows.filter(r => !r.vendor_id || !r.vendor_name);
  }, [reportRows]);
  const toggleClient = (key: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const expandAll = () => setExpandedClients(new Set(groupedClients.map(g => g.group_key || g.client_id || g.client)));
  const collapseAll = () => setExpandedClients(new Set());

  const [saveSuccess, setSaveSuccess] = useState<Record<string, boolean>>({});
  const [rowActionBusy, setRowActionBusy] = useState<Record<string, boolean>>({});
  
  // Product editing state (per client_id)
  const [editingProducts, setEditingProducts] = useState<Record<string, Record<string, string>>>({});
  const [savingProducts, setSavingProducts] = useState<Record<string, boolean>>({});
  const [productSaveSuccess, setProductSaveSuccess] = useState<Record<string, boolean>>({});

  const handleProductChange = (clientKey: string, field: string, value: string) => {
    setEditingProducts(prev => ({
      ...prev,
      [clientKey]: { ...(prev[clientKey] || {}), [field]: value }
    }));
  };

  const handleSaveProducts = async (clientKey: string, prospectId: number, currentProducts: any) => {
    setSavingProducts(prev => ({ ...prev, [clientKey]: true }));
    try {
      const edits = editingProducts[clientKey] || {};
      const body: any = {
        fijo_ren: edits.fijo_ren !== undefined ? parseInt(edits.fijo_ren) || 0 : currentProducts.fijo_ren,
        fijo_new: edits.fijo_new !== undefined ? parseInt(edits.fijo_new) || 0 : currentProducts.fijo_new,
        movil_nueva: edits.movil_nueva !== undefined ? parseInt(edits.movil_nueva) || 0 : currentProducts.movil_nueva,
        movil_renovacion: edits.movil_renovacion !== undefined ? parseInt(edits.movil_renovacion) || 0 : currentProducts.movil_renovacion,
        claro_tv: edits.claro_tv !== undefined ? parseInt(edits.claro_tv) || 0 : currentProducts.claro_tv,
        cloud: edits.cloud !== undefined ? parseInt(edits.cloud) || 0 : currentProducts.cloud,
        mpls: edits.mpls !== undefined ? parseInt(edits.mpls) || 0 : currentProducts.mpls,
      };
      const resp = await authFetch(`/api/follow-up-prospects/${prospectId}`, { method: 'PUT', json: body });
      if (!resp.ok) throw new Error('Error saving products');
      setProductSaveSuccess(prev => ({ ...prev, [clientKey]: true }));
      setEditingProducts(prev => { const n = { ...prev }; delete n[clientKey]; return n; });
      await refetchProspects();
      setTimeout(() => setProductSaveSuccess(prev => ({ ...prev, [clientKey]: false })), 2000);
    } catch (err) {
      console.error('Error saving products:', err);
      alert('Error al guardar productos');
    } finally {
      setSavingProducts(prev => ({ ...prev, [clientKey]: false }));
    }
  };

  const readApiError = async (response: Response, fallback: string) => {
    try {
      const data = await response.json();
      if (data?.error) return String(data.error);
      if (data?.message) return String(data.message);
    } catch {
      // ignore parse errors and use fallback
    }
    return `${fallback} (HTTP ${response.status})`;
  };

  const handleSave = async (rowId: string) => {
    setSavingStatus(prev => ({ ...prev, [rowId]: true }));
    setSaveSuccess(prev => ({ ...prev, [rowId]: false }));

    try {
      const original = reportRows?.find(r => r.subscriber_id === rowId);
      if (!original) return;

      const reportMonth = original.report_month
        ? new Date(original.report_month).toISOString().slice(0, 10)
        : `${selectedMonth}-01`;

      const effectiveCompanyEarn = editingCompanyEarn[rowId] !== undefined
        ? (editingCompanyEarn[rowId] === "" ? null : parseFloat(editingCompanyEarn[rowId]))
        : original.company_earnings;
      const suggestedVendorComm = calculateSuggestedVendorCommission(
        typeof effectiveCompanyEarn === 'number' && !isNaN(effectiveCompanyEarn) ? effectiveCompanyEarn : null,
        original.salesperson_commission_percentage ?? null
      );

      const newVendorComm = editingVendorComm[rowId] !== undefined
        ? (editingVendorComm[rowId] === "" ? null : parseFloat(editingVendorComm[rowId]))
        : ((original.vendor_commission != null && Number(original.vendor_commission) > 0)
            ? original.vendor_commission
            : suggestedVendorComm);

      const newCompanyEarn = editingCompanyEarn[rowId] !== undefined
        ? (editingCompanyEarn[rowId] === "" ? null : parseFloat(editingCompanyEarn[rowId]))
        : original.company_earnings;

      const newPaidAmount = editingPaidAmount[rowId] !== undefined
        ? (editingPaidAmount[rowId] === "" ? null : parseFloat(editingPaidAmount[rowId]))
        : original.paid_amount;

      console.log(`[Reports] Saving subscriber ${rowId}:`, { newVendorComm, newCompanyEarn, newPaidAmount });

      const response = await authFetch(`/api/subscriber-reports/${rowId}` , {
        method: 'PUT',
        json: {
          report_month: reportMonth,
          vendor_commission: (typeof newVendorComm === 'number' && isNaN(newVendorComm)) ? null : newVendorComm,
          company_earnings: (typeof newCompanyEarn === 'number' && isNaN(newCompanyEarn)) ? null : newCompanyEarn,
          paid_amount: (typeof newPaidAmount === 'number' && isNaN(newPaidAmount)) ? null : newPaidAmount
        }
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Error en respuesta del servidor"));
      }

      // exito visual
      setSaveSuccess(prev => ({ ...prev, [rowId]: true }));

      // Limpiar estados de edicion para esta fila
      setEditingVendorComm(prev => { const n = { ...prev }; delete n[rowId]; return n; });
      setEditingCompanyEarn(prev => { const n = { ...prev }; delete n[rowId]; return n; });
      setEditingPaidAmount(prev => { const n = { ...prev }; delete n[rowId]; return n; });

      // Recargar datos
      await refetchProspects();

      // Quitar mensaje de exito despues de 2s
      setTimeout(() => {
        setSaveSuccess(prev => ({ ...prev, [rowId]: false }));
      }, 2000);

    } catch (error) {
      console.error("Error saving:", error);
      alert(error instanceof Error ? error.message : "Error al guardar cambios. Verifique la consola.");
    } finally {
      setSavingStatus(prev => ({ ...prev, [rowId]: false }));
    }
  };

  const handleMarkPaid = async (rowId: string) => {
    const original = reportRows?.find(r => r.subscriber_id === rowId);
    if (!original) return;
    setRowActionBusy(prev => ({ ...prev, [rowId]: true }));
    try {
      const reportMonth = original.report_month
        ? new Date(original.report_month).toISOString().slice(0, 10)
        : `${selectedMonth}-01`;
      const currentCompanyEarn = editingCompanyEarn[rowId] !== undefined
        ? (editingCompanyEarn[rowId] === '' ? null : parseFloat(editingCompanyEarn[rowId]))
        : original.company_earnings;
      const currentVendorCommission = editingVendorComm[rowId] !== undefined
        ? (editingVendorComm[rowId] === '' ? null : parseFloat(editingVendorComm[rowId]))
        : (
            original.vendor_commission
            ?? calculateSuggestedVendorCommission(currentCompanyEarn, original.salesperson_commission_percentage)
          );
      const vendorCommission = Number(
        currentVendorCommission
        ?? original.effective_vendor_commission
        ?? calculateSuggestedVendorCommission(currentCompanyEarn, original.salesperson_commission_percentage)
        ?? 0
      );
      const paidAmount = vendorCommission > 0 ? vendorCommission : Number(original.paid_amount || 0);
      const resp = await authFetch(`/api/subscriber-reports/${rowId}`, {
        method: 'PUT',
        json: {
          report_month: reportMonth,
          vendor_commission: currentVendorCommission,
          company_earnings: currentCompanyEarn,
          paid_amount: paidAmount,
          paid_date: new Date().toISOString(),
          is_paid: true
        }
      });
      if (!resp.ok) throw new Error(await readApiError(resp, 'No se pudo marcar como pagado'));
      await refetchProspects();
    } catch (err) {
      console.error('Error mark paid:', err);
      alert(err instanceof Error ? err.message : 'Error al marcar pagado');
    } finally {
      setRowActionBusy(prev => ({ ...prev, [rowId]: false }));
    }
  };

  const handleToggleAudited = async (rowId: string, currentAudited: boolean) => {
    const original = reportRows?.find(r => r.subscriber_id === rowId);
    if (!original) return;
    setRowActionBusy(prev => ({ ...prev, [rowId]: true }));
    try {
      const reportMonth = original.report_month
        ? new Date(original.report_month).toISOString().slice(0, 10)
        : `${selectedMonth}-01`;
      const currentCompanyEarn = editingCompanyEarn[rowId] !== undefined
        ? (editingCompanyEarn[rowId] === '' ? null : parseFloat(editingCompanyEarn[rowId]))
        : original.company_earnings;
      const currentVendorCommission = editingVendorComm[rowId] !== undefined
        ? (editingVendorComm[rowId] === '' ? null : parseFloat(editingVendorComm[rowId]))
        : (
            original.vendor_commission
            ?? calculateSuggestedVendorCommission(currentCompanyEarn, original.salesperson_commission_percentage)
          );
      const currentPaidAmount = editingPaidAmount[rowId] !== undefined
        ? (editingPaidAmount[rowId] === '' ? null : parseFloat(editingPaidAmount[rowId]))
        : original.paid_amount;
      const resp = await authFetch(`/api/subscriber-reports/${rowId}`, {
        method: 'PUT',
        json: {
          report_month: reportMonth,
          vendor_commission: currentVendorCommission,
          company_earnings: currentCompanyEarn,
          paid_amount: currentPaidAmount,
          paid_date: original.paid_date,
          is_audited: !currentAudited
        }
      });
      if (!resp.ok) throw new Error(await readApiError(resp, 'No se pudo actualizar auditado'));
      await refetchProspects();
    } catch (err) {
      console.error('Error toggle audited:', err);
      alert(err instanceof Error ? err.message : 'Error al actualizar auditado');
    } finally {
      setRowActionBusy(prev => ({ ...prev, [rowId]: false }));
    }
  };

  const handleToggleWithholding = async (rowId: string, currentApplies: boolean) => {
    const original = filteredRows.find(r => r.id === rowId);
    if (!original) return;
    setRowActionBusy(prev => ({ ...prev, [rowId]: true }));
    try {
      const reportMonth = original.report_month
        ? new Date(original.report_month).toISOString().slice(0, 10)
        : `${selectedMonth}-01`;
      const currentCompanyEarn = editingCompanyEarn[rowId] !== undefined
        ? (editingCompanyEarn[rowId] === '' ? null : parseFloat(editingCompanyEarn[rowId]))
        : original.company_earnings;
      const currentVendorCommission = editingVendorComm[rowId] !== undefined
        ? (editingVendorComm[rowId] === '' ? null : parseFloat(editingVendorComm[rowId]))
        : (
            original.vendor_commission
            ?? calculateSuggestedVendorCommission(currentCompanyEarn, original.salesperson_commission_percentage)
          );
      const currentPaidAmount = editingPaidAmount[rowId] !== undefined
        ? (editingPaidAmount[rowId] === '' ? null : parseFloat(editingPaidAmount[rowId]))
        : original.paid_amount;

      const resp = await authFetch(`/api/subscriber-reports/${rowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_month: reportMonth,
          vendor_commission: currentVendorCommission,
          company_earnings: currentCompanyEarn,
          paid_amount: currentPaidAmount,
          paid_date: original.paid_date,
          withholding_applies: !currentApplies
        })
      });
      if (!resp.ok) throw new Error(await readApiError(resp, 'No se pudo actualizar retención'));
      await refetchProspects();
    } catch (err) {
      console.error('Error toggle withholding:', err);
      alert(err instanceof Error ? err.message : 'Error al actualizar retención');
    } finally {
      setRowActionBusy(prev => ({ ...prev, [rowId]: false }));
    }
  };

  const getCurrentCompanyEarnings = useCallback((row: {
    id: string;
    company_earnings?: number | null;
  }) => {
    if (editingCompanyEarn[row.id] !== undefined) {
      const rawValue = editingCompanyEarn[row.id];
      if (rawValue === '') return null;
      const parsed = parseFloat(rawValue);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return row.company_earnings ?? null;
  }, [editingCompanyEarn]);

  const getEffectiveVendorCommission = useCallback((row: {
    id: string;
    vendor_commission?: number | null;
    company_earnings?: number | null;
    salesperson_commission_percentage?: number | null;
    suggested_vendor_commission?: number | null;
    effective_vendor_commission?: number | null;
  }) => {
    if (editingVendorComm[row.id] !== undefined) {
      const parsed = parseFloat(editingVendorComm[row.id]);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (row.vendor_commission != null && Number(row.vendor_commission) > 0) {
      return Number(row.vendor_commission);
    }
    const currentCompanyEarn = getCurrentCompanyEarnings(row);
    return Number(
      row.effective_vendor_commission
      ?? calculateSuggestedVendorCommission(currentCompanyEarn, row.salesperson_commission_percentage)
      ?? row.suggested_vendor_commission
      ?? 0
    );
  }, [editingVendorComm, getCurrentCompanyEarnings]);

  const getVendorCommissionInputValue = useCallback((row: {
    id: string;
    vendor_commission?: number | null;
    company_earnings?: number | null;
    salesperson_commission_percentage?: number | null;
    suggested_vendor_commission?: number | null;
    effective_vendor_commission?: number | null;
  }) => {
    if (editingVendorComm[row.id] !== undefined) {
      return editingVendorComm[row.id];
    }
    const currentCompanyEarn = getCurrentCompanyEarnings(row);
    const effectiveValue = row.vendor_commission != null && Number(row.vendor_commission) > 0
      ? Number(row.vendor_commission)
      : (
          row.effective_vendor_commission
          ?? calculateSuggestedVendorCommission(currentCompanyEarn, row.salesperson_commission_percentage)
          ?? row.suggested_vendor_commission
        );
    return effectiveValue != null ? String(effectiveValue) : '';
  }, [editingVendorComm, getCurrentCompanyEarnings]);

  const totals = useMemo(() => {
    return filteredRows.reduce((acc, row) => {
      const earn = editingCompanyEarn[row.id] !== undefined
        ? safeMoneyNumber(parseFloat(editingCompanyEarn[row.id]))
        : safeMoneyNumber(row.company_earnings);
      const comm = safeMoneyNumber(getEffectiveVendorCommission(row));
      const paid = editingPaidAmount[row.id] !== undefined
        ? safeMoneyNumber(parseFloat(editingPaidAmount[row.id]))
        : safeMoneyNumber(row.paid_amount);
      return {
        company_earnings: acc.company_earnings + earn,
        vendor_commission: acc.vendor_commission + comm,
        paid_amount: acc.paid_amount + paid
      };
    }, { company_earnings: 0, vendor_commission: 0, paid_amount: 0 });
  }, [filteredRows, editingCompanyEarn, editingPaidAmount, getEffectiveVendorCommission]);

  // Conteo por tipo para la tarjeta Total Ventas (compacto)
  const salesByType = useMemo(() => resolveLineProducts(filteredRows as unknown as SubscriberReport[]), [filteredRows]);

  // Resumen para vista vendedor — sin retención (regla 10% retirada por pedido del usuario)
  const vendorTotals = useMemo(() => {
    return {
      totalComm: totals.vendor_commission,
      paid: totals.paid_amount,
      pending: parseFloat((totals.vendor_commission - totals.paid_amount).toFixed(2)),
    };
  }, [totals]);

  // ── Informe de ventas: filas filtradas + resumen por tipo + detalle ──
  const informeFilteredRows = useMemo(() => {
    return filteredRows.filter((row) => {
      const tipo = formatSaleTypeLabel(row.account_type, row.line_type, row.sale_type, row.line_kind);
      if (informeTipoFilter && tipo !== informeTipoFilter) return false;
      if (informeSearch.trim()) {
        const q = informeSearch.trim().toLowerCase();
        const haystack = [
          row.client_name, row.client_business_name, row.ban_number, row.phone, row.vendor_name, row.plan
        ].filter(Boolean).map((x) => String(x).toLowerCase()).join(' ');
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [filteredRows, informeTipoFilter, informeSearch]);

  const informeResumen = useMemo(() => {
    type Row = {
      tipo: string;
      ventas: number;
      clientes: Set<string>;
      ganancia: number;
      comision: number;
      pagado: number;
      mensualidad: number;
      vendorMap: Map<string, number>; // vendedor → ganancia
    };
    const map = new Map<string, Row>();
    for (const r of informeFilteredRows) {
      const tipo = formatSaleTypeLabel(r.account_type, r.line_type, r.sale_type, r.line_kind);
      const earn = safeMoneyNumber(editingCompanyEarn[r.subscriber_id] !== undefined ? parseFloat(editingCompanyEarn[r.subscriber_id]) : r.company_earnings);
      const comm = safeMoneyNumber(getEffectiveVendorCommission({
        id: r.subscriber_id,
        vendor_commission: r.vendor_commission,
        company_earnings: r.company_earnings,
        salesperson_commission_percentage: r.salesperson_commission_percentage,
        suggested_vendor_commission: r.suggested_vendor_commission,
        effective_vendor_commission: r.effective_vendor_commission,
      }));
      const paid = safeMoneyNumber(editingPaidAmount[r.subscriber_id] !== undefined ? parseFloat(editingPaidAmount[r.subscriber_id]) : r.paid_amount);
      const monthly = safeMoneyNumber(r.monthly_value);
      const vendorName = r.vendor_name || 'Sin vendedor';
      const cur = map.get(tipo) || {
        tipo, ventas: 0, clientes: new Set<string>(),
        ganancia: 0, comision: 0, pagado: 0, mensualidad: 0,
        vendorMap: new Map<string, number>(),
      };
      cur.ventas += 1;
      if (r.client_id) cur.clientes.add(String(r.client_id));
      cur.ganancia += earn;
      cur.comision += comm;
      cur.pagado += paid;
      cur.mensualidad += monthly;
      cur.vendorMap.set(vendorName, (cur.vendorMap.get(vendorName) || 0) + earn);
      map.set(tipo, cur);
    }

    const totalGanancia = Array.from(map.values()).reduce((acc, r) => acc + r.ganancia, 0);

    return Array.from(map.values())
      .map((r) => {
        // Top vendedor del tipo (por ganancia)
        let topVendor = '-';
        let topVendorEarn = 0;
        for (const [name, earn] of r.vendorMap) {
          if (earn > topVendorEarn) { topVendor = name; topVendorEarn = earn; }
        }
        return {
          tipo: r.tipo,
          ventas: r.ventas,
          clientes: r.clientes.size,
          mensualidad: r.mensualidad,
          ganancia: r.ganancia,
          ticketPromedio: r.ventas > 0 ? r.ganancia / r.ventas : 0,
          comision: r.comision,
          pagado: r.pagado,
          balance: r.ganancia - r.pagado,
          pctTotal: totalGanancia > 0 ? (r.ganancia / totalGanancia) * 100 : 0,
          topVendor,
          topVendorEarn,
        };
      })
      .sort((a, b) => b.ganancia - a.ganancia);
  }, [informeFilteredRows, editingCompanyEarn, editingPaidAmount, getEffectiveVendorCommission]);

  // Totales del resumen para fila TOTAL al pie de tabla
  const informeResumenTotales = useMemo(() => {
    return informeResumen.reduce((acc, r) => ({
      ventas: acc.ventas + r.ventas,
      mensualidad: acc.mensualidad + r.mensualidad,
      ganancia: acc.ganancia + r.ganancia,
      comision: acc.comision + r.comision,
      pagado: acc.pagado + r.pagado,
      balance: acc.balance + r.balance,
    }), { ventas: 0, mensualidad: 0, ganancia: 0, comision: 0, pagado: 0, balance: 0 });
  }, [informeResumen]);

  // Clientes únicos cross-tipo (no se puede sumar la columna de clientes — un mismo cliente puede aparecer en 2 tipos)
  const informeClientesUnicos = useMemo(() => {
    const set = new Set<string>();
    for (const r of informeFilteredRows) {
      if (r.client_id) set.add(String(r.client_id));
    }
    return set.size;
  }, [informeFilteredRows]);

  const informeDetalle = useMemo(() => {
    return informeFilteredRows.map((r) => {
      const earn = safeMoneyNumber(editingCompanyEarn[r.subscriber_id] !== undefined ? parseFloat(editingCompanyEarn[r.subscriber_id]) : r.company_earnings);
      const comm = safeMoneyNumber(getEffectiveVendorCommission({
        id: r.subscriber_id,
        vendor_commission: r.vendor_commission,
        company_earnings: r.company_earnings,
        salesperson_commission_percentage: r.salesperson_commission_percentage,
        suggested_vendor_commission: r.suggested_vendor_commission,
        effective_vendor_commission: r.effective_vendor_commission,
      }));
      const paid = safeMoneyNumber(editingPaidAmount[r.subscriber_id] !== undefined ? parseFloat(editingPaidAmount[r.subscriber_id]) : r.paid_amount);
      return {
        id: r.subscriber_id,
        fecha: r.activation_date ? String(r.activation_date).slice(0, 10) : (r.report_month ? String(r.report_month).slice(0, 10) : '-'),
        cliente: r.client_name || r.client_business_name || '-',
        ban: r.ban_number || '-',
        phone: r.phone || '-',
        vendedor: r.vendor_name || '-',
        tipo: formatSaleTypeLabel(r.account_type, r.line_type, r.sale_type, r.line_kind),
        plan: r.plan || '-',
        ganancia: earn,
        comision: comm,
        pagado: paid,
        balance: earn - paid,
        bono_portabilidad: safeMoneyNumber(r.portability_bonus),
        is_audited: Boolean(r.is_audited),
        audited_at: r.audited_at || null,
        report_month: r.report_month,
        company_earnings: r.company_earnings,
        vendor_commission: r.vendor_commission,
        paid_amount: r.paid_amount,
        paid_date: r.paid_date,
      };
    }).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [informeFilteredRows, editingCompanyEarn, editingPaidAmount, getEffectiveVendorCommission]);

  const tableColSpan = isAdmin ? 14 : 13;

  if (loadingProspects) return <div className="p-10 text-white">Cargando reportes...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-500" />
            Comisiones y Ventas
          </h1>
          <p className="text-slate-400 mt-1">
            {effectiveView === 'empresa' ? 'Productos negociados, ganancia empresa, comisión vendedor y pagos' : 'Comisiones, retención y neto por vendedor'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
              <button
                onClick={() => setViewMode('empresa')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  effectiveView === 'empresa'
                    ? 'bg-emerald-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Empresa
              </button>
              <button
                onClick={() => setViewMode('vendedor')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  effectiveView === 'vendedor'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Vendedor
              </button>
            </div>
          )}
          {isAdmin && (
          <button
            onClick={handleShowComparison}
            disabled={loadingComparison}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              showComparison
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/30'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
            title="Comparar ventas Tango PYMES vs CRM por mes"
          >
            {showComparison ? <X className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
            {loadingComparison ? 'Cargando...' : showComparison ? 'Cerrar Informe' : 'Informe Tango vs CRM'}
          </button>
          )}
          {isAdmin && (
          <button
            onClick={handleSyncTango}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all bg-purple-700 hover:bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title="Sincronizar ventas Tango → CRM"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sync Tango'}
          </button>
          )}
        </div>
      </div>

      {/* Resultado del Sync Tango → CRM */}
      {effectiveView === 'empresa' && syncResult && (
        <div className="bg-slate-800/70 border border-purple-500/40 p-5 rounded-2xl animate-in fade-in duration-300 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-purple-400" />
              <span className="font-bold text-purple-200 text-lg">Sync Tango → CRM completado</span>
            </div>
            <button onClick={() => setSyncResult(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          {/* Stats row */}
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="bg-purple-900/40 text-purple-200 px-3 py-1.5 rounded-lg border border-purple-500/20 font-bold">
              Tango: {syncResult.stats.tango_ventas} ventas
            </span>
            {syncResult.stats.clients_created > 0 && <span className="bg-green-900/40 text-green-200 px-3 py-1.5 rounded-lg border border-green-500/20">+{syncResult.stats.clients_created} clientes</span>}
            {syncResult.stats.bans_created > 0 && <span className="bg-green-900/40 text-green-200 px-3 py-1.5 rounded-lg border border-green-500/20">+{syncResult.stats.bans_created} BANs</span>}
            {syncResult.stats.subscribers_created > 0 && <span className="bg-green-900/40 text-green-200 px-3 py-1.5 rounded-lg border border-green-500/20">+{syncResult.stats.subscribers_created} subscribers</span>}
            {syncResult.stats.subscribers_updated > 0 && <span className="bg-yellow-900/40 text-yellow-200 px-3 py-1.5 rounded-lg border border-yellow-500/20">↻ {syncResult.stats.subscribers_updated} actualizados</span>}
            <span className="bg-blue-900/40 text-blue-200 px-3 py-1.5 rounded-lg border border-blue-500/20">📊 {syncResult.stats.reports_upserted} reportes</span>
            {syncResult.stats.errors > 0 && <span className="bg-red-900/40 text-red-200 px-3 py-1.5 rounded-lg border border-red-500/20 font-bold">❌ {syncResult.stats.errors} errores</span>}
          </div>
          {syncResult.alerts.length > 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3 text-xs text-slate-300">
              El detalle del sync esta oculto en esta vista. Abre <span className="font-semibold text-white">Informe Tango vs CRM</span> para ver las lineas afectadas.
            </div>
          )}
        </div>
      )}

      {/* Alerta: Reportes sin vendedor */}
      {noVendorRows.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="font-bold text-red-300">⚠ {noVendorRows.length} reporte{noVendorRows.length > 1 ? 's' : ''} sin vendedor asignado</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {noVendorRows.slice(0, 10).map((r, i) => (
              <span key={i} className="bg-red-900/30 text-red-200 px-2 py-1 rounded border border-red-500/20">
                {r.client_business_name || r.client_name || 'Sin nombre'} — {r.phone || r.ban_number || '?'}
              </span>
            ))}
            {noVendorRows.length > 10 && <span className="text-red-400 font-bold">+{noVendorRows.length - 10} más</span>}
          </div>
        </div>
      )}

      {/* Informe Comparativo Tango vs CRM */}
      {showComparison && comparisonData && (
        <div className="bg-slate-800/50 border border-cyan-500/30 rounded-2xl overflow-hidden animate-in fade-in duration-300">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">Informe Tango PYMES vs CRM por Mes</h2>
            </div>
            <button onClick={() => setShowComparison(false)} className="text-slate-400 hover:text-white p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/50">
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 uppercase">Mes</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-purple-400 uppercase" colSpan={2}>Tango PYMES</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-emerald-400 uppercase" colSpan={3}>CRM</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">Estado</th>
                </tr>
                <tr className="bg-slate-900/30 border-t border-slate-800">
                  <th className="px-5 py-2 text-left text-[10px] text-slate-500 uppercase"></th>
                  <th className="px-4 py-2 text-right text-[10px] text-purple-400 uppercase">Ventas</th>
                  <th className="px-4 py-2 text-right text-[10px] text-purple-400 uppercase">Empresa $</th>
                  <th className="px-4 py-2 text-right text-[10px] text-emerald-400 uppercase">Ventas</th>
                  <th className="px-4 py-2 text-right text-[10px] text-emerald-400 uppercase">Empresa $</th>
                  <th className="px-4 py-2 text-right text-[10px] text-blue-400 uppercase">Comisión $</th>
                  <th className="px-4 py-2 text-center text-[10px] text-slate-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {comparisonData.map((row: any) => {
                  const monthLabel = new Date(row.month + '-15').toLocaleDateString('es-ES', { year: 'numeric', month: 'short' });
                  const ventasMatch = row.tango.ventas === row.crm.ventas;
                  const empresaMatch = Math.abs(row.tango.empresa - row.crm.empresa) < 0.02;
                  return (
                    <tr key={row.month} className="hover:bg-slate-800/30">
                      <td className="px-5 py-3 font-bold text-white capitalize">{monthLabel}</td>
                      <td className="px-4 py-3 text-right font-bold text-purple-300">{row.tango.ventas}</td>
                      <td className="px-4 py-3 text-right font-mono text-purple-300">${Number(row.tango.empresa).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                      <td className={`px-4 py-3 text-right font-bold ${ventasMatch ? 'text-emerald-400' : 'text-red-400'}`}>{row.crm.ventas}</td>
                      <td className={`px-4 py-3 text-right font-mono ${empresaMatch ? 'text-emerald-400' : 'text-red-400'}`}>${Number(row.crm.empresa).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-400">${Number(row.crm.comision).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-center">
                        {ventasMatch && empresaMatch ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">✓ OK</span>
                        ) : (
                          <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">
                            {!ventasMatch ? `Δ ${row.tango.ventas - row.crm.ventas} ventas` : 'Δ $'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-600 bg-slate-900/50">
                  <td className="px-5 py-3 font-bold text-white">TOTAL</td>
                  <td className="px-4 py-3 text-right font-black text-purple-300">{comparisonData.reduce((s: number, r: any) => s + r.tango.ventas, 0)}</td>
                  <td className="px-4 py-3 text-right font-black text-purple-300">${comparisonData.reduce((s: number, r: any) => s + r.tango.empresa, 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-400">{comparisonData.reduce((s: number, r: any) => s + r.crm.ventas, 0)}</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-400">${comparisonData.reduce((s: number, r: any) => s + r.crm.empresa, 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right font-black text-blue-400">${comparisonData.reduce((s: number, r: any) => s + r.crm.comision, 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {syncResult?.alerts?.length > 0 && (
            <div className="border-t border-slate-700">
              <div className="px-6 py-4 bg-slate-900/40 border-b border-slate-700 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-purple-300">Detalle del ultimo Sync Tango a CRM</h3>
                  <span className="text-xs text-slate-400">{syncResult.alerts.length} linea{syncResult.alerts.length === 1 ? '' : 's'}</span>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-2">
                  {syncResult.alerts
                    .filter(a => a.level === 'warn' && (a.msg.includes('actualizado') || a.msg.includes('vinculado') || a.msg.includes('creado')))
                    .map((a, i) => (
                      <div key={`cmp-w${i}`} className="flex items-start gap-2 text-xs bg-yellow-900/20 border border-yellow-500/20 rounded px-3 py-1.5">
                        <span className="text-yellow-400 font-bold shrink-0">🟡</span>
                        {a.ban && <span className="text-yellow-300 font-mono shrink-0">[{a.ban}]</span>}
                        <span className="text-yellow-200">{a.msg}</span>
                      </div>
                    ))}
                  {syncResult.alerts
                    .filter(a => a.level === 'info')
                    .map((a, i) => (
                      <div key={`cmp-i${i}`} className="flex items-start gap-2 text-xs bg-green-900/20 border border-green-500/20 rounded px-3 py-1.5">
                        <span className="text-green-400 font-bold shrink-0">🟢</span>
                        {a.ban && <span className="text-green-300 font-mono shrink-0">[{a.ban}]</span>}
                        <span className="text-green-200">{a.msg}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Detalle Tango PYMES - cada venta */}
          {tangoDetail && tangoDetail.length > 0 ? (
            <div className="border-t border-slate-700">
              <div className="px-6 py-3 bg-slate-900/40 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-bold text-orange-400">📋 Detalle Ventas Tango PYMES ({(() => {
                  const filtered = detailMonthFilter ? tangoDetail.filter((v: any) => v.fecha && v.fecha.slice(0,7) === detailMonthFilter) : tangoDetail;
                  return filtered.length;
                })()})</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={detailMonthFilter}
                    onChange={e => setDetailMonthFilter(e.target.value)}
                    className="bg-slate-800 border border-slate-600 text-white text-xs rounded px-2 py-1 [color-scheme:dark]"
                  >
                    <option value="">Todos los meses</option>
                    {[...new Set(tangoDetail.map((v: any) => v.fecha ? v.fecha.slice(0,7) : ''))].filter(Boolean).sort().map((m: string) => (
                      <option key={m} value={m}>{new Date(m + '-15').toLocaleDateString('es-ES', {year:'numeric',month:'short'})}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-900">
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">#</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Fecha</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Cliente</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">BAN</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Línea</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Tipo</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-400 uppercase">Com. Empresa</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-400 uppercase">Com. Vendedor</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Vendedor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {(() => {
                      const filtered = detailMonthFilter 
                        ? tangoDetail.filter((v: any) => v.fecha && v.fecha.slice(0,7) === detailMonthFilter)
                        : tangoDetail;
                      const TIPO_LABELS: Record<number, string> = { 138: 'Update REN', 139: 'Update NEW', 140: 'Fijo REN', 141: 'Fijo NEW' };
                      return filtered.map((v: any, i: number) => {
                        const isNew = v.ventatipoid === 139 || v.ventatipoid === 141;
                        const fecha = v.fecha ? new Date(v.fecha).toLocaleDateString('es-PR', {year:'numeric',month:'short',day:'numeric'}) : '-';
                        return (
                          <tr key={v.ventaid} className={`hover:bg-slate-800/40 ${isNew ? 'bg-green-900/5' : ''}`}>
                            <td className="px-3 py-2 text-slate-500 font-mono">{i+1}</td>
                            <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{fecha}</td>
                            <td className="px-3 py-2 text-white font-medium truncate max-w-[200px]">{v.cliente}</td>
                            <td className="px-3 py-2 text-slate-300 font-mono">{v.ban || '-'}</td>
                            <td className="px-3 py-2 text-slate-300 font-mono">{v.linea || '-'}</td>
                            <td className={`px-3 py-2 font-medium ${isNew ? 'text-green-400' : 'text-slate-300'}`}>{TIPO_LABELS[v.ventatipoid] || v.tipo}</td>
                            <td className="px-3 py-2 text-right text-purple-300 font-mono">${Number(v.comision_empresa || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-blue-300 font-mono">${Number(v.comision_vendedor || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-slate-400 truncate max-w-[120px]">{v.vendedor || '-'}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-600 bg-slate-900/50">
                      <td colSpan={6} className="px-3 py-2 font-bold text-white text-right">TOTAL</td>
                      <td className="px-3 py-2 text-right font-black text-purple-300">
                        ${(() => {
                          const filtered = detailMonthFilter 
                            ? tangoDetail.filter((v: any) => v.fecha && v.fecha.slice(0,7) === detailMonthFilter)
                            : tangoDetail;
                          return filtered.reduce((s: number, v: any) => s + Number(v.comision_empresa || 0), 0).toLocaleString('es-ES', {minimumFractionDigits:2});
                        })()}
                      </td>
                      <td className="px-3 py-2 text-right font-black text-blue-300">
                        ${(() => {
                          const filtered = detailMonthFilter 
                            ? tangoDetail.filter((v: any) => v.fecha && v.fecha.slice(0,7) === detailMonthFilter)
                            : tangoDetail;
                          return filtered.reduce((s: number, v: any) => s + Number(v.comision_vendedor || 0), 0).toLocaleString('es-ES', {minimumFractionDigits:2});
                        })()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-700 px-6 py-4 text-center text-slate-500 text-sm">
              No se encontró detalle de ventas Tango. Presiona "Sync PYMES Legacy" y luego abre el informe de nuevo.
            </div>
          )}
        </div>
      )}

      {/* Summary Chips */}
      {effectiveView === 'empresa' ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Ventas</p>
            <p className="text-2xl font-black text-white mt-1">{filteredRows.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">{groupedClients.length} clientes</p>
            {(salesByType.movil_renovacion + salesByType.movil_nueva + salesByType.fijo_ren + salesByType.fijo_new) > 0 && (
              <div className="text-sm text-slate-300 mt-2 leading-snug space-y-1">
                {(salesByType.movil_renovacion > 0 || salesByType.movil_nueva > 0) && (
                  <div>
                    {salesByType.movil_renovacion > 0 && <span>M-REN <span className="font-black text-white">{salesByType.movil_renovacion}</span></span>}
                    {salesByType.movil_renovacion > 0 && salesByType.movil_nueva > 0 && <span className="text-slate-600 mx-1.5">·</span>}
                    {salesByType.movil_nueva > 0 && <span>M-NEW <span className="font-black text-white">{salesByType.movil_nueva}</span></span>}
                  </div>
                )}
                {(salesByType.fijo_ren > 0 || salesByType.fijo_new > 0) && (
                  <div>
                    {salesByType.fijo_ren > 0 && <span>F-REN <span className="font-black text-white">{salesByType.fijo_ren}</span></span>}
                    {salesByType.fijo_ren > 0 && salesByType.fijo_new > 0 && <span className="text-slate-600 mx-1.5">·</span>}
                    {salesByType.fijo_new > 0 && <span>F-NEW <span className="font-black text-white">{salesByType.fijo_new}</span></span>}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
            <p className="text-emerald-500 text-xs font-bold uppercase tracking-wider">Ganancia Empresa</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              ${fmtMoney(totals.company_earnings)}
            </p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
            <p className="text-blue-500 text-xs font-bold uppercase tracking-wider">Comisión Vendedores</p>
            <p className="text-2xl font-black text-blue-400 mt-1">
              ${fmtMoney(totals.vendor_commission)}
            </p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
            <p className="text-amber-500 text-xs font-bold uppercase tracking-wider">Pagado</p>
            <p className="text-2xl font-black text-amber-400 mt-1">
              ${fmtMoney(totals.paid_amount)}
            </p>
          </div>
          <div className={`p-4 rounded-2xl border ${(safeMoneyNumber(totals.company_earnings) - safeMoneyNumber(totals.paid_amount)) <= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${(safeMoneyNumber(totals.company_earnings) - safeMoneyNumber(totals.paid_amount)) <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>Balance Pendiente</p>
            <p className={`text-2xl font-black mt-1 ${(safeMoneyNumber(totals.company_earnings) - safeMoneyNumber(totals.paid_amount)) <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${fmtMoney(safeMoneyNumber(totals.company_earnings) - safeMoneyNumber(totals.paid_amount))}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Ventas</p>
            <p className="text-2xl font-black text-white mt-1">{filteredRows.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">{groupedClients.length} clientes</p>
            {(salesByType.movil_renovacion + salesByType.movil_nueva + salesByType.fijo_ren + salesByType.fijo_new) > 0 && (
              <div className="text-sm text-slate-300 mt-2 leading-snug space-y-1">
                {(salesByType.movil_renovacion > 0 || salesByType.movil_nueva > 0) && (
                  <div>
                    {salesByType.movil_renovacion > 0 && <span>M-REN <span className="font-black text-white">{salesByType.movil_renovacion}</span></span>}
                    {salesByType.movil_renovacion > 0 && salesByType.movil_nueva > 0 && <span className="text-slate-600 mx-1.5">·</span>}
                    {salesByType.movil_nueva > 0 && <span>M-NEW <span className="font-black text-white">{salesByType.movil_nueva}</span></span>}
                  </div>
                )}
                {(salesByType.fijo_ren > 0 || salesByType.fijo_new > 0) && (
                  <div>
                    {salesByType.fijo_ren > 0 && <span>F-REN <span className="font-black text-white">{salesByType.fijo_ren}</span></span>}
                    {salesByType.fijo_ren > 0 && salesByType.fijo_new > 0 && <span className="text-slate-600 mx-1.5">·</span>}
                    {salesByType.fijo_new > 0 && <span>F-NEW <span className="font-black text-white">{salesByType.fijo_new}</span></span>}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
            <p className="text-blue-500 text-xs font-bold uppercase tracking-wider">Comisión Vendedor</p>
            <p className="text-2xl font-black text-blue-400 mt-1">
              ${fmtMoney(totals.vendor_commission)}
            </p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
            <p className="text-amber-500 text-xs font-bold uppercase tracking-wider">Pagado</p>
            <p className="text-2xl font-black text-amber-400 mt-1">
              ${fmtMoney(totals.paid_amount)}
            </p>
          </div>
          <div className={`p-4 rounded-2xl border ${(safeMoneyNumber(totals.vendor_commission) - safeMoneyNumber(totals.paid_amount)) <= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${(safeMoneyNumber(totals.vendor_commission) - safeMoneyNumber(totals.paid_amount)) <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>Balance Pendiente</p>
            <p className={`text-2xl font-black mt-1 ${(safeMoneyNumber(totals.vendor_commission) - safeMoneyNumber(totals.paid_amount)) <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${fmtMoney(safeMoneyNumber(totals.vendor_commission) - safeMoneyNumber(totals.paid_amount))}
            </p>
          </div>
        </div>
      )}

      {/* Informe de ventas — acordeón con resumen por tipo + detalle */}
      {isAdmin && (
        <details className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden group">
          <summary className="cursor-pointer p-5 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              Informe de ventas
            </h3>
            <ChevronDown className="w-5 h-5 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-slate-700 p-5 space-y-5">
            {/* Filtros internos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de venta</label>
                <select
                  value={informeTipoFilter}
                  onChange={(e) => setInformeTipoFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Todos los tipos</option>
                  <option value="Móvil REN">Móvil REN</option>
                  <option value="Móvil NEW">Móvil NEW</option>
                  <option value="Fijo REN">Fijo REN</option>
                  <option value="Fijo NEW">Fijo NEW</option>
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Buscar (cliente / BAN / teléfono)</label>
                <input
                  type="text"
                  value={informeSearch}
                  onChange={(e) => setInformeSearch(e.target.value)}
                  placeholder="Filtrar dentro del informe..."
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Resumen por tipo de venta */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Resumen por tipo</p>
              <div className="overflow-x-auto border border-slate-700 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900/70 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left">Tipo venta</th>
                      <th className="px-3 py-2 text-right">Ventas</th>
                      <th className="px-3 py-2 text-right">Clientes</th>
                      <th className="px-3 py-2 text-right">Mensualidad</th>
                      <th className="px-3 py-2 text-right text-emerald-400">Ganancia</th>
                      <th className="px-3 py-2 text-right">% del total</th>
                      <th className="px-3 py-2 text-right">Ticket prom.</th>
                      <th className="px-3 py-2 text-right text-blue-400">Comisión</th>
                      <th className="px-3 py-2 text-right text-amber-400">Pagado</th>
                      <th className="px-3 py-2 text-right text-red-400">Balance</th>
                      <th className="px-3 py-2 text-left">Top vendedor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {informeResumen.map((r) => (
                      <tr key={r.tipo} className="hover:bg-slate-800/40">
                        <td className="px-3 py-2 text-white font-semibold">{r.tipo}</td>
                        <td className="px-3 py-2 text-right text-slate-200 font-mono">{r.ventas}</td>
                        <td className="px-3 py-2 text-right text-slate-300 font-mono">{r.clientes}</td>
                        <td className="px-3 py-2 text-right text-slate-300 font-mono">${r.mensualidad.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-emerald-300 font-mono">${r.ganancia.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-slate-400 font-mono">{r.pctTotal.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right text-slate-300 font-mono">${r.ticketPromedio.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-blue-300 font-mono">${r.comision.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-amber-300 font-mono">${r.pagado.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-red-300 font-mono">${r.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-left text-slate-300 truncate max-w-[140px]" title={`${r.topVendor}: $${r.topVendorEarn.toFixed(2)}`}>{r.topVendor}</td>
                      </tr>
                    ))}
                    {informeResumen.length === 0 && (
                      <tr><td colSpan={11} className="px-3 py-4 text-center text-slate-500">Sin ventas en el período/filtro.</td></tr>
                    )}
                  </tbody>
                  {informeResumen.length > 0 && (
                    <tfoot className="bg-slate-900/80 border-t-2 border-slate-600 font-bold">
                      <tr>
                        <td className="px-3 py-2 text-white uppercase">TOTAL</td>
                        <td className="px-3 py-2 text-right text-white font-mono">{informeResumenTotales.ventas}</td>
                        <td className="px-3 py-2 text-right text-white font-mono">{informeClientesUnicos}</td>
                        <td className="px-3 py-2 text-right text-white font-mono">${informeResumenTotales.mensualidad.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-emerald-300 font-mono">${informeResumenTotales.ganancia.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-slate-400 font-mono">100.0%</td>
                        <td className="px-3 py-2 text-right text-slate-300 font-mono">${(informeResumenTotales.ventas > 0 ? informeResumenTotales.ganancia / informeResumenTotales.ventas : 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-blue-300 font-mono">${informeResumenTotales.comision.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-amber-300 font-mono">${informeResumenTotales.pagado.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-red-300 font-mono">${informeResumenTotales.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Detalle de ventas */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Detalle ({informeDetalle.length} ventas)</p>
              <div className="overflow-x-auto border border-slate-700 rounded-xl max-h-[480px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900/70 text-slate-400 uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-center" title="Marcar como auditada">✓</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-left">BAN</th>
                      <th className="px-3 py-2 text-left">Teléfono</th>
                      <th className="px-3 py-2 text-left">Vendedor</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-left">Plan</th>
                      <th className="px-3 py-2 text-right text-emerald-400">Ganancia</th>
                      <th className="px-3 py-2 text-right text-blue-400">Comisión</th>
                      <th className="px-3 py-2 text-right text-cyan-400" title="Bono pagado por Claro por portabilidad">Bono Port.</th>
                      <th className="px-3 py-2 text-right text-amber-400">Pagado</th>
                      <th className="px-3 py-2 text-right text-red-400">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {informeDetalle.map((r) => {
                      const hasBono = r.bono_portabilidad > 0;
                      // Colores de fila por prioridad:
                      // - auditada + portabilidad → fondo dorado + borde izquierdo cyan
                      // - solo auditada → fondo dorado/emerald
                      // - solo portabilidad → fondo cyan suave
                      const rowClass = r.is_audited && hasBono
                        ? 'bg-amber-500/10 border-l-4 border-cyan-400'
                        : r.is_audited
                          ? 'bg-amber-500/10'
                          : hasBono
                            ? 'bg-cyan-500/5'
                            : '';
                      return (
                      <tr key={r.id} className={`hover:bg-slate-800/40 transition-colors ${rowClass}`}>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleAudited(r.id, r.is_audited)}
                            disabled={Boolean(rowActionBusy[r.id])}
                            title={r.is_audited ? `Auditada${r.audited_at ? ' · ' + new Date(r.audited_at).toLocaleString('es-PR') : ''} (click para desmarcar)` : 'Marcar como auditada'}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                              r.is_audited
                                ? 'bg-amber-500/30 border border-amber-400 text-amber-100 hover:bg-amber-500/50'
                                : 'bg-slate-800 border border-slate-600 text-slate-500 hover:border-amber-400/50 hover:text-amber-300'
                            } disabled:opacity-50 disabled:cursor-wait`}
                          >
                            {r.is_audited ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs">○</span>}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-slate-400 font-mono">{r.fecha}</td>
                        <td className="px-3 py-2 text-white">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{r.cliente}</span>
                            {hasBono && (
                              <span className="text-[9px] uppercase font-bold tracking-wider bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 rounded-full px-1.5 py-0.5" title={`Bono portabilidad: $${r.bono_portabilidad.toFixed(2)}`}>
                                Portabilidad
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-300 font-mono">{r.ban}</td>
                        <td className="px-3 py-2 text-slate-300 font-mono">{r.phone}</td>
                        <td className="px-3 py-2 text-slate-300">{r.vendedor}</td>
                        <td className="px-3 py-2 text-slate-200">{r.tipo}</td>
                        <td className="px-3 py-2 text-slate-400 font-mono">{r.plan}</td>
                        <td className="px-3 py-2 text-right text-emerald-300 font-mono">${r.ganancia.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-2 py-1 text-right">
                          <EditableCommissionCell
                            rowId={r.id}
                            initialValue={r.comision}
                            onSave={async (rowId, newValue) => {
                              const original = filteredRows.find(x => x.id === rowId);
                              if (!original) return;
                              const reportMonth = original.report_month
                                ? new Date(original.report_month).toISOString().slice(0, 10)
                                : `${selectedMonth}-01`;
                              const resp = await authFetch(`/api/subscriber-reports/${rowId}`, {
                                method: 'PUT',
                                json: {
                                  report_month: reportMonth,
                                  vendor_commission: newValue,
                                  company_earnings: original.company_earnings,
                                  paid_amount: original.paid_amount,
                                  paid_date: original.paid_date,
                                },
                              });
                              if (!resp.ok) throw new Error('No se pudo guardar la comisión');
                              await refetchProspects();
                            }}
                          />
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${hasBono ? 'text-cyan-300 font-bold' : 'text-slate-600'}`}>
                          {hasBono ? `$${r.bono_portabilidad.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-amber-300 font-mono">${r.pagado.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-red-300 font-mono">${r.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                      </tr>
                      );
                    })}
                    {informeDetalle.length === 0 && (
                      <tr><td colSpan={13} className="px-3 py-4 text-center text-slate-500">Sin ventas en el período/filtro.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </details>
      )}

      {/* Filters */}
      <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-2xl flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 ml-1">MES</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 ml-1">VENDEDOR</label>
          {isAdmin ? (
          <select
            value={selectedVendor || ""}
            onChange={(e) => setSelectedVendor(e.target.value ? String(e.target.value) : null)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-w-[150px]"
          >
            <option value="">Todos</option>
            {reportVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          ) : (
          <div className="bg-slate-800 border border-slate-700 text-emerald-400 rounded-xl px-3 py-2 font-bold text-sm">
            {currentUser?.salespersonName || 'Mi Reporte'}
          </div>
          )}
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-bold text-slate-500 ml-1">BUSCAR CLIENTE</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Nombre, BAN o telefono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Flat Table */}
      <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="text-sm text-slate-400">
            <span className="font-bold text-white">{groupedClients.length}</span> clientes · <span className="font-bold text-white">{filteredRows.length}</span> ventas
            {effectiveView === 'empresa' && <> · <span className="font-bold text-emerald-400">{groupedClients.filter(g => g.totalEarnings > 0 && (g.totalEarnings - g.totalPaid) <= 0).length}</span> pagados</>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">Empresa</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">Vendedor</th>
                <th className="px-1 py-2 text-center text-[10px] font-medium text-gray-400 uppercase">Fijo Ren</th>
                <th className="px-1 py-2 text-center text-[10px] font-medium text-gray-400 uppercase">Fijo New</th>
                <th className="px-1 py-2 text-center text-[10px] font-medium text-gray-400 uppercase">Móvil New</th>
                <th className="px-1 py-2 text-center text-[10px] font-medium text-gray-400 uppercase">Móvil Ren</th>
                <th className="px-1 py-2 text-center text-[10px] font-medium text-gray-400 uppercase">ClaroTV</th>
                <th className="px-1 py-2 text-center text-[10px] font-medium text-gray-400 uppercase">Cloud</th>
                <th className="px-1 py-2 text-center text-[10px] font-medium text-gray-400 uppercase">MPLS</th>
                <th className="px-2 py-2 text-center text-[10px] font-medium text-purple-400 uppercase">Completado</th>
                <th className="px-2 py-2 text-center text-[10px] font-medium text-gray-400 uppercase">Mensualidad</th>
                {isAdmin && (
                  <th className="px-2 py-2 text-center text-[10px] font-medium text-emerald-400 uppercase bg-emerald-500/5">Empresa($)</th>
                )}
                <th className="px-2 py-2 text-center text-[10px] font-medium text-blue-400 uppercase bg-blue-500/5">Comisión($)</th>
                <th className="px-2 py-2 text-center text-[10px] font-medium text-amber-400 uppercase">Ventas</th>
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-800">
              {groupedClients.map(group => {
                const key = group.group_key || group.client_id || group.client;
                const isExpanded = expandedClients.has(key);
                const prods = group.products;

                return (
                  <Fragment key={key}>
                    {/* Client Row — clickable to expand/edit individual sales */}
                    <tr
                      className={`hover:bg-gray-800 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-800/40' : ''}`}
                      onClick={() => toggleClient(key)}
                      title={isExpanded ? 'Click para colapsar' : 'Click para ver y editar las ventas individuales'}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          }
                          <div>
                            <div className="text-sm font-bold text-gray-200">{group.client}</div>
                            {!isExpanded && isAdmin && (
                              <div className="text-[10px] text-emerald-500/70 font-semibold">▸ click para editar</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-sm font-bold text-blue-400">{group.vendor_name}</span>
                      </td>
                      {/* Product fields - editable for admin */}
                      {['fijo_ren', 'fijo_new', 'movil_nueva', 'movil_renovacion', 'claro_tv', 'cloud', 'mpls'].map(field => {
                        const val = editingProducts[key]?.[field] !== undefined 
                          ? editingProducts[key][field] 
                          : (prods ? (prods as any)[field] || 0 : 0);
                        const numVal = parseFloat(String(val)) || 0;
                        const hasValue = numVal > 0;
                        return (
                          <td key={field} className={`px-1 py-2 text-center ${hasValue ? 'border border-green-500 bg-green-900/20' : ''}`}>
                            {isAdmin && !!prods?.prospect_id ? (
                              <input
                                type="number" min="0"
                                className="w-14 bg-gray-800 border border-gray-700 rounded text-center text-xs font-bold text-gray-300 px-1 py-1 outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={val}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleProductChange(key, field, e.target.value)}
                              />
                            ) : (
                              <span className="text-xs text-gray-300">{numVal.toFixed(2)}</span>
                            )}
                          </td>
                        );
                      })}
                      {/* Completado */}
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <span className="text-xs text-purple-300">
                          {prods?.completed_date
                            ? new Date(prods.completed_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '-'}
                        </span>
                      </td>
                      {/* Mensualidad */}
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <span className="text-xs text-gray-300">
                          {group.totalMensualidad > 0 ? `$${group.totalMensualidad.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '-'}
                        </span>
                      </td>
                      {/* Empresa($) */}
                      {isAdmin && (
                        <td className="px-2 py-2 text-center whitespace-nowrap bg-emerald-500/5">
                          <span className="text-xs font-bold text-emerald-400">
                            {group.totalEarnings > 0 ? `$${group.totalEarnings.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : <span className="text-gray-600">0</span>}
                          </span>
                        </td>
                      )}
                      {/* Comisión($) — total agregado del cliente. Para EDITAR, expandir. */}
                      <td className="px-2 py-2 text-center whitespace-nowrap bg-blue-500/5 group/comm">
                        <div className="flex flex-col items-center gap-0">
                          <span className="text-xs font-bold text-blue-400">
                            {group.totalCommission > 0 ? `$${group.totalCommission.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : <span className="text-gray-600">0</span>}
                          </span>
                          {!isExpanded && isAdmin && group.subscribers.length > 0 && (
                            <span className="text-[9px] text-blue-300/60 group-hover/comm:text-blue-300 transition-colors">↓ editar</span>
                          )}
                        </div>
                      </td>
                      {/* Ventas count */}
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${isExpanded ? 'bg-emerald-500/20 text-emerald-300' : 'bg-orange-500/20 text-orange-300'}`}>
                          {group.subscribers.length} ventas {!isExpanded && '▶'}
                        </span>
                      </td>
                    </tr>

                    {/* Save products button row - only if editing */}
                    {isAdmin && !!prods?.prospect_id && editingProducts[key] && (
                      <tr className="bg-gray-800/50">
                        <td colSpan={tableColSpan} className="px-3 py-1 text-right">
                          <button
                            onClick={() => handleSaveProducts(key, prods.prospect_id, prods)}
                            disabled={savingProducts[key]}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                              productSaveSuccess[key]
                                ? 'bg-green-600 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            {savingProducts[key] ? 'Guardando...' : productSaveSuccess[key] ? '✓ Guardado' : 'Guardar Productos'}
                          </button>
                        </td>
                      </tr>
                    )}

                    {/* Expanded subscriber rows */}
                    {isExpanded && group.subscribers.map(row => {
                      const isEditing = editingVendorComm[row.id] !== undefined
                        || editingCompanyEarn[row.id] !== undefined
                        || editingPaidAmount[row.id] !== undefined;

                      return (
                        <tr key={row.id} className="bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                          <td colSpan={2} className="px-6 py-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400 font-mono">BAN: {row.ban_number || '-'}</span>
                              {(row.phone || '').includes('SIN-TEL') || (row.phone || '').includes('LINEA-') || !row.phone
                                ? <span className="text-xs text-red-400 font-bold font-mono">⚠ SIN TELÉFONO</span>
                                : <span className="text-xs text-slate-300 font-mono">{row.phone}</span>
                              }
                              <span className="text-[10px] font-semibold uppercase rounded px-2 py-0.5 bg-cyan-950/70 text-cyan-300 border border-cyan-700/60">
                                {formatSaleTypeLabel(row.account_type, row.line_type, row.sale_type, row.line_kind)}
                              </span>
                            </div>
                          </td>
                          <td colSpan={7}></td>
                          <td className="px-2 py-2 text-center">
                            <span className="text-xs text-slate-500">—</span>
                          </td>
                          {/* Mensualidad per subscriber */}
                          <td className="px-2 py-2 text-center">
                            <span className="text-xs font-bold text-white">
                              {row.monthly_value != null ? `$${Number(row.monthly_value).toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '-'}
                            </span>
                          </td>
                          {/* Empresa($) editable (admin) / solo lectura (vendedor) */}
                          <td
                            className="px-2 py-2 text-center bg-emerald-500/10 cursor-text"
                            onClick={(e) => {
                              if (!isAdmin) return;
                              const inp = (e.currentTarget as HTMLElement).querySelector('input');
                              inp?.focus();
                              inp?.select();
                            }}
                          >
                            {isAdmin ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                className={`w-full max-w-[110px] bg-slate-950 border-2 text-center font-bold text-emerald-300 text-sm px-2 py-1.5 outline-none transition-all rounded shadow-inner ${editingCompanyEarn[row.id] !== undefined ? 'border-emerald-400 ring-2 ring-emerald-400/40' : 'border-emerald-700/60 hover:border-emerald-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40'}`}
                                value={editingCompanyEarn[row.id] !== undefined ? editingCompanyEarn[row.id] : String(row.company_earnings ?? '')}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(',', '.');
                                  if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                                    setEditingCompanyEarn(prev => ({ ...prev, [row.id]: raw }));
                                  }
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(row.id); } }}
                                title="Click para editar · Enter para guardar"
                              />
                            ) : (
                              <span className="text-xs font-bold text-emerald-400">${safeMoneyNumber(row.company_earnings).toFixed(2)}</span>
                            )}
                          </td>
                          {/* Comisión($) editable (admin) / solo lectura (vendedor) */}
                          <td
                            className="px-2 py-2 text-center bg-blue-500/10 cursor-text"
                            onClick={(e) => {
                              if (!isAdmin) return;
                              const inp = (e.currentTarget as HTMLElement).querySelector('input');
                              inp?.focus();
                              inp?.select();
                            }}
                          >
                            {isAdmin ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                className={`w-full max-w-[110px] bg-slate-950 border-2 text-center font-bold text-blue-300 text-sm px-2 py-1.5 outline-none transition-all rounded shadow-inner ${editingVendorComm[row.id] !== undefined ? 'border-blue-400 ring-2 ring-blue-400/40' : 'border-blue-700/60 hover:border-blue-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/40'}`}
                                value={getVendorCommissionInputValue(row)}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(',', '.');
                                  if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                                    setEditingVendorComm(prev => ({ ...prev, [row.id]: raw }));
                                  }
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(row.id); } }}
                                title={row.is_paid ? 'Pagado · no editable' : (row.salesperson_commission_percentage ? `Auto ${row.salesperson_commission_percentage}% de Empresa($) · Enter para guardar` : 'Editar comisión (Enter para guardar)')}
                              />
                            ) : (
                              <span className="text-xs font-bold text-blue-400">${safeMoneyNumber(getEffectiveVendorCommission(row)).toFixed(2)}</span>
                            )}
                          </td>
                          {/* Save button */}
                          <td className="px-2 py-2 text-center">
                            {isAdmin && (
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => handleSave(row.id)}
                                  disabled={savingStatus[row.id] || saveSuccess[row.id] || rowActionBusy[row.id] || Boolean(row.is_paid)}
                                  className={`p-1 rounded transition-all ${saveSuccess[row.id]
                                    ? 'bg-green-600 text-white'
                                    : isEditing
                                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                      : 'bg-slate-800 text-slate-500 opacity-30 hover:opacity-100'
                                  }`}
                                  title={isEditing ? "Guardar" : "Re-guardar"}
                                >
                                  {savingStatus[row.id] ? (
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full" />
                                  ) : saveSuccess[row.id] ? (
                                    <CheckCircle2 size={12} />
                                  ) : (
                                    <Save size={12} />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleMarkPaid(row.id)}
                                  disabled={rowActionBusy[row.id] || Boolean(row.is_paid)}
                                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                    row.is_paid
                                      ? 'bg-amber-700/60 text-amber-100 cursor-default'
                                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                                  }`}
                                  title={row.is_paid ? 'Ya pagado' : 'Marcar pagado'}
                                >
                                  {row.is_paid ? 'Pagado' : 'Pagar'}
                                </button>
                                <button
                                  onClick={() => handleToggleAudited(row.id, Boolean(row.is_audited))}
                                  disabled={rowActionBusy[row.id]}
                                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                    row.is_audited
                                      ? 'bg-cyan-700/70 text-cyan-100'
                                      : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                                  }`}
                                  title={row.is_audited ? 'Caso auditado' : 'Marcar auditado'}
                                >
                                  {row.is_audited ? 'Auditado' : 'Auditar'}
                                </button>
                                <button
                                  onClick={() => handleToggleWithholding(row.id, row.withholding_applies !== false)}
                                  disabled={rowActionBusy[row.id]}
                                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                    row.withholding_applies !== false
                                      ? 'bg-red-700/70 text-red-100'
                                      : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                                  }`}
                                  title={row.withholding_applies !== false ? 'Retención 10% activa' : 'Retención 10% desactivada'}
                                >
                                  {row.withholding_applies !== false ? 'Retiene' : 'Sin Ret.'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen Vendedor Footer */}
      {effectiveView === 'vendedor' && filteredRows.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Resumen de Comisiones
          </h3>
          <div className="space-y-2 max-w-md">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-300 font-medium">Total Comisiones</span>
              <span className="font-black text-blue-400 text-lg">${fmtMoney(vendorTotals?.totalComm)}</span>
            </div>
            <div className="flex justify-between items-center py-1 mt-2">
              <span className="text-amber-400">Pagado</span>
              <span className="font-bold text-amber-400">${fmtMoney(vendorTotals?.paid)}</span>
            </div>
            {safeMoneyNumber(vendorTotals?.pending) > 0 && (
              <div className="flex justify-between items-center py-2 bg-amber-500/10 rounded-lg px-3 mt-1">
                <span className="text-amber-300 font-semibold">Balance Pendiente</span>
                <span className="font-black text-amber-300">${fmtMoney(vendorTotals?.pending)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
