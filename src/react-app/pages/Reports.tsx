
import { useState, useMemo, Fragment, useEffect, useCallback } from "react";
import { DollarSign, Search, Save, CheckCircle2, RefreshCw, ChevronDown, ChevronRight, Building2, Users, Receipt, Wallet, BarChart3, X, AlertTriangle } from "lucide-react";
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

function getDefaultReportsMonth(): string {
  const now = new Date();
  const lastClosedMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = lastClosedMonth.getFullYear();
  const month = String(lastClosedMonth.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getPreviousMonth(value: string): string | null {
  const [yearRaw, monthRaw] = String(value || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function Reports() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(getDefaultReportsMonth);
  const [viewMode, setViewMode] = useState<'empresa' | 'vendedor'>('empresa');
  const effectiveView = isAdmin ? viewMode : 'vendedor';
  const [autoAdjustedMonth, setAutoAdjustedMonth] = useState(false);

  // Estados para edicion manual
  const [editingVendorComm, setEditingVendorComm] = useState<Record<string, string>>({});
  const [editingCompanyEarn, setEditingCompanyEarn] = useState<Record<string, string>>({});
  const [editingPaidAmount, setEditingPaidAmount] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    if (autoAdjustedMonth) return;
    if (selectedMonth !== new Date().toISOString().slice(0, 7)) return;
    if (!Array.isArray(reportRows)) return;
    if (reportRows.length > 1) return;

    const fallbackMonth = getPreviousMonth(selectedMonth);
    if (!fallbackMonth) return;

    setAutoAdjustedMonth(true);
    setSelectedMonth(fallbackMonth);
  }, [autoAdjustedMonth, reportRows, selectedMonth]);

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
    try {
      const resp = await authFetch('/api/tango/sync', { method: 'POST' });
      const data = await resp.json();
      if (data.success) {
        setSyncResult({ stats: data.stats, alerts: data.alerts || [] });
        refetchProspects();
      } else {
        alert('Error en sync: ' + (data.error || 'desconocido'));
        if (data.stats) setSyncResult({ stats: data.stats, alerts: data.alerts || [] });
      }
    } catch (err: any) {
      alert('Error de red: ' + err.message);
    } finally {
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
        vendor_name: row.vendor_name || 'Desconocido',
        phone: row.phone,
        line_type: row.line_type || null,
        line_kind: row.line_kind || null,
        sale_type: row.sale_type || null,
        account_type: row.account_type || null,
        ban_number: row.ban_number,
        activation_date: row.activation_date,
        monthly_value: row.monthly_value ?? null,
        company_earnings: row.company_earnings ?? null,
        vendor_commission: row.vendor_commission ?? null,
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
        ? new Date(original.report_month).toISOString().slice(0, 7)
        : selectedMonth;

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
        ? new Date(original.report_month).toISOString().slice(0, 7)
        : selectedMonth;
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
        ? new Date(original.report_month).toISOString().slice(0, 7)
        : selectedMonth;
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
        ? new Date(original.report_month).toISOString().slice(0, 7)
        : selectedMonth;
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

  // Resumen para vista vendedor
  const vendorTotals = useMemo(() => {
    const totalComm = filteredRows.reduce((acc, row) => {
      const comm = safeMoneyNumber(getEffectiveVendorCommission(row));
      return acc + comm;
    }, 0);
    const retentionBase = filteredRows.reduce((acc, row) => {
      const comm = safeMoneyNumber(getEffectiveVendorCommission(row));
      return acc + (row.withholding_applies !== false ? comm : 0);
    }, 0);
    const retention = parseFloat((retentionBase * 0.10).toFixed(2));
    const net = parseFloat((totalComm - retention).toFixed(2));
    const paid = safeMoneyNumber(totals.paid_amount);
    const pending = parseFloat((net - paid).toFixed(2));
    return { totalComm, retention, net, paid, pending };
  }, [totals, filteredRows, editingVendorComm]);

  const retentionPanel = useMemo(() => {
    const byVendor = new Map<string, { vendor: string; totalComm: number; retention: number; net: number; paid: number; pending: number }>();
    for (const row of filteredRows) {
      const vendorName = row.vendor_name || 'Desconocido';
      const comm = safeMoneyNumber(getEffectiveVendorCommission(row));
      const paid = editingPaidAmount[row.id] !== undefined
        ? safeMoneyNumber(parseFloat(editingPaidAmount[row.id]))
        : safeMoneyNumber(row.paid_amount);
      const retention = row.withholding_applies !== false ? parseFloat((comm * 0.10).toFixed(2)) : 0;
      const net = parseFloat((comm - retention).toFixed(2));
      const current = byVendor.get(vendorName) || { vendor: vendorName, totalComm: 0, retention: 0, net: 0, paid: 0, pending: 0 };
      current.totalComm += comm;
      current.retention += retention;
      current.net += net;
      current.paid += paid;
      byVendor.set(vendorName, current);
    }
    const rows = Array.from(byVendor.values())
      .map((r) => ({
        ...r,
        retention: parseFloat(r.retention.toFixed(2)),
        net: parseFloat(r.net.toFixed(2)),
        pending: parseFloat((r.net - r.paid).toFixed(2))
      }))
      .sort((a, b) => b.retention - a.retention);

    const totalComm = rows.reduce((acc, r) => acc + r.totalComm, 0);
    const retention = rows.reduce((acc, r) => acc + r.retention, 0);
    const net = rows.reduce((acc, r) => acc + r.net, 0);
    const paid = rows.reduce((acc, r) => acc + r.paid, 0);
    const pending = parseFloat((net - paid).toFixed(2));
    return { rows, totalComm, retention, net, paid, pending };
  }, [filteredRows, editingPaidAmount, getEffectiveVendorCommission]);

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
            <p className="text-[10px] text-slate-500 mt-0.5">{groupedClients.length} clientes</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
            <p className="text-emerald-500 text-xs font-bold uppercase tracking-wider">Ganancia Empresa</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              ${totals.company_earnings.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
            <p className="text-blue-500 text-xs font-bold uppercase tracking-wider">Comisión Vendedores</p>
            <p className="text-2xl font-black text-blue-400 mt-1">
              ${totals.vendor_commission.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
            <p className="text-amber-500 text-xs font-bold uppercase tracking-wider">Pagado</p>
            <p className="text-2xl font-black text-amber-400 mt-1">
              ${totals.paid_amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className={`p-4 rounded-2xl border ${(totals.company_earnings - totals.paid_amount) <= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${(totals.company_earnings - totals.paid_amount) <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>Balance Pendiente</p>
            <p className={`text-2xl font-black mt-1 ${(totals.company_earnings - totals.paid_amount) <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${(totals.company_earnings - totals.paid_amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Ventas</p>
            <p className="text-2xl font-black text-white mt-1">{filteredRows.length}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{groupedClients.length} clientes</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
            <p className="text-blue-500 text-xs font-bold uppercase tracking-wider">Total Comisiones</p>
            <p className="text-2xl font-black text-blue-400 mt-1">
              ${vendorTotals.totalComm.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
            <p className="text-red-500 text-xs font-bold uppercase tracking-wider">Retención Aplicada 10%</p>
            <p className="text-2xl font-black text-red-400 mt-1">
              -${vendorTotals.retention.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-2xl">
            <p className="text-cyan-500 text-xs font-bold uppercase tracking-wider">Neto a Cobrar</p>
            <p className="text-2xl font-black text-cyan-400 mt-1">
              ${vendorTotals.net.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
            <p className="text-amber-500 text-xs font-bold uppercase tracking-wider">Pagado</p>
            <p className="text-2xl font-black text-amber-400 mt-1">
              ${vendorTotals.paid.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Panel Total de Retenciones</h3>
            <span className="text-xs text-slate-400">Regla actual: 10% por caso marcado como retiene</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
              <p className="text-[10px] uppercase font-bold text-blue-400">Comisiones</p>
              <p className="text-lg font-black text-blue-300">${retentionPanel.totalComm.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
              <p className="text-[10px] uppercase font-bold text-red-400">Retención</p>
              <p className="text-lg font-black text-red-300">-${retentionPanel.retention.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-cyan-500/10 border border-cyan-500/20 p-3 rounded-xl">
              <p className="text-[10px] uppercase font-bold text-cyan-400">Neto</p>
              <p className="text-lg font-black text-cyan-300">${retentionPanel.net.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
              <p className="text-[10px] uppercase font-bold text-amber-400">Pagado</p>
              <p className="text-lg font-black text-amber-300">${retentionPanel.paid.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-slate-700/60 border border-slate-600 p-3 rounded-xl">
              <p className="text-[10px] uppercase font-bold text-slate-300">Pendiente</p>
              <p className="text-lg font-black text-white">${retentionPanel.pending.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          {retentionPanel.rows.length > 0 && (
            <div className="overflow-x-auto border border-slate-700 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-900/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-400 uppercase">Vendedor</th>
                    <th className="px-3 py-2 text-right text-blue-400 uppercase">Comisión</th>
                    <th className="px-3 py-2 text-right text-red-400 uppercase">Retención</th>
                    <th className="px-3 py-2 text-right text-cyan-400 uppercase">Neto</th>
                    <th className="px-3 py-2 text-right text-amber-400 uppercase">Pagado</th>
                    <th className="px-3 py-2 text-right text-slate-300 uppercase">Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {retentionPanel.rows.map((r) => (
                    <tr key={r.vendor} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2 text-white font-semibold">{r.vendor}</td>
                      <td className="px-3 py-2 text-right text-blue-300 font-mono">${r.totalComm.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-right text-red-300 font-mono">-${r.retention.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-right text-cyan-300 font-mono">${r.net.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-right text-amber-300 font-mono">${r.paid.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-right text-white font-mono">${r.pending.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
                    {/* Client Row */}
                    <tr className="hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => toggleClient(key)}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-200">{group.client}</div>
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
                      {/* Comisión($) */}
                      <td className="px-2 py-2 text-center whitespace-nowrap bg-blue-500/5">
                        <span className="text-xs font-bold text-blue-400">
                          {group.totalCommission > 0 ? `$${group.totalCommission.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : <span className="text-gray-600">0</span>}
                        </span>
                      </td>
                      {/* Ventas count */}
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <span className="px-2 py-1 bg-orange-500/20 text-orange-300 rounded text-xs font-bold">
                          {group.subscribers.length} ventas
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
                          {/* Empresa($) editable */}
                          {isAdmin && (
                            <td className="px-2 py-2 text-center bg-emerald-500/5">
                              <input type="number" step="0.01"
                                className={`w-20 bg-gray-800 border text-center font-bold text-emerald-400 text-xs px-1 py-1 outline-none transition-all rounded ${editingCompanyEarn[row.id] !== undefined ? 'border-emerald-500 ring-1 ring-emerald-500/20' : 'border-gray-700'}`}
                                value={editingCompanyEarn[row.id] !== undefined ? editingCompanyEarn[row.id] : (row.company_earnings ?? '')}
                                onChange={(e) => setEditingCompanyEarn(prev => ({ ...prev, [row.id]: e.target.value }))}
                                disabled={Boolean(row.is_paid)}
                              />
                            </td>
                          )}
                          {/* Comisión($) editable */}
                          <td className="px-2 py-2 text-center bg-blue-500/5">
                            {isAdmin ? (
                              <input type="number" step="0.01"
                                className={`w-20 bg-gray-800 border text-center font-bold text-blue-400 text-xs px-1 py-1 outline-none transition-all rounded ${editingVendorComm[row.id] !== undefined ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-gray-700'}`}
                                value={getVendorCommissionInputValue(row)}
                                onChange={(e) => setEditingVendorComm(prev => ({ ...prev, [row.id]: e.target.value }))}
                                title={row.salesperson_commission_percentage ? `Auto ${row.salesperson_commission_percentage}% de Empresa($)` : 'Comision editable'}
                                disabled={Boolean(row.is_paid)}
                              />
                            ) : (
                              <span className="text-xs font-bold text-blue-400">{`$${getEffectiveVendorCommission(row).toFixed(2)}`}</span>
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
              <span className="font-black text-blue-400 text-lg">${vendorTotals.totalComm.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center py-1 text-red-400">
              <span className="flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> Retención aplicada 10%</span>
              <span className="font-bold">-${vendorTotals.retention.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="border-t border-slate-600 pt-2 flex justify-between items-center">
              <span className="font-bold text-cyan-400 text-lg">Neto a Cobrar</span>
              <span className="font-black text-cyan-400 text-lg">${vendorTotals.net.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center py-1 mt-2">
              <span className="text-amber-400">Pagado</span>
              <span className="font-bold text-amber-400">${vendorTotals.paid.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
            </div>
            {vendorTotals.pending > 0 && (
              <div className="flex justify-between items-center py-2 bg-amber-500/10 rounded-lg px-3 mt-1">
                <span className="text-amber-300 font-semibold">Pendiente por Cobrar</span>
                <span className="font-black text-amber-300">${vendorTotals.pending.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
