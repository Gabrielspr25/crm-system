
import { useState, useMemo, Fragment } from "react";
import { DollarSign, Search, Save, CheckCircle2, RefreshCw, ChevronDown, ChevronRight, Building2, Users, Receipt, Wallet, BarChart3, X } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

interface SubscriberReport {
  subscriber_id: string;
  phone: string;
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
}

export default function Reports() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [viewMode, setViewMode] = useState<'empresa' | 'vendedor'>('empresa');
  const effectiveView = isAdmin ? viewMode : 'vendedor';

  // Estados para edicion manual
  const reportUrl = selectedMonth
    ? `/api/subscriber-reports?month=${selectedMonth}`
    : "/api/subscriber-reports";

  const [editingVendorComm, setEditingVendorComm] = useState<Record<string, string>>({});
  const [editingCompanyEarn, setEditingCompanyEarn] = useState<Record<string, string>>({});
  const [editingPaidAmount, setEditingPaidAmount] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});

  const { data: reportRows, loading: loadingProspects, refetch: refetchProspects } = useApi<SubscriberReport[]>(reportUrl);
  const { data: vendors } = useApi<any[]>("/api/vendors");

  // Estado para sync PYMES
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<any[] | null>(null);
  const [tangoDetail, setTangoDetail] = useState<any[] | null>(null);
  const [detailMonthFilter, setDetailMonthFilter] = useState<string>('');
  const [loadingComparison, setLoadingComparison] = useState(false);

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

  const handleSyncPymes = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await authFetch('/api/subscriber-reports/sync-pymes', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setSyncResult({ ...data.stats, report: data.report });
        await refetchProspects();
        // Auto-show the comparison report after sync
        try {
          const resp = await authFetch('/api/subscriber-reports/comparison');
          const compData = await resp.json();
          setComparisonData(compData.comparison || []);
          setTangoDetail(compData.detail || []);
          setShowComparison(true);
        } catch (_) { /* ignore comparison load error */ }
      } else {
        alert('Error al sincronizar: ' + (data.error || 'desconocido'));
      }
    } catch (err: any) {
      alert('Error de conexión al sincronizar: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!reportRows) return [];

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
        ban_number: row.ban_number,
        monthly_value: row.monthly_value ?? null,
        company_earnings: row.company_earnings ?? null,
        vendor_commission: row.vendor_commission ?? null,
        paid_amount: row.paid_amount ?? null,
        report_month: row.report_month
      }));
  }, [reportRows, selectedVendor, searchTerm]);

  const groupedClients = useMemo(() => {
    const map = new Map();
    for (const row of filteredRows) {
      const key = row.client_id || row.client;
      if (!map.has(key)) {
        map.set(key, {
          client_id: row.client_id,
          client: row.client,
          vendor_name: row.vendor_name,
          subscribers: [],
          totalEarnings: 0,
          totalCommission: 0,
          totalPaid: 0
        });
      }
      const g = map.get(key);
      g.subscribers.push(row);
      g.totalEarnings += Number(row.company_earnings || 0);
      g.totalCommission += Number(row.vendor_commission || 0);
      g.totalPaid += Number(row.paid_amount || 0);
    }
    return Array.from(map.values()).sort((a, b) => a.client.localeCompare(b.client));
  }, [filteredRows]);

  // Accordion state: expanded client keys
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const toggleClient = (key: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const expandAll = () => setExpandedClients(new Set(groupedClients.map(g => g.client_id || g.client)));
  const collapseAll = () => setExpandedClients(new Set());

  const [saveSuccess, setSaveSuccess] = useState<Record<string, boolean>>({});

  const handleSave = async (rowId: string) => {
    setSavingStatus(prev => ({ ...prev, [rowId]: true }));
    setSaveSuccess(prev => ({ ...prev, [rowId]: false }));

    try {
      const original = reportRows?.find(r => r.subscriber_id === rowId);
      if (!original) return;

      const reportMonth = original.report_month
        ? new Date(original.report_month).toISOString().slice(0, 7)
        : selectedMonth;

      const newVendorComm = editingVendorComm[rowId] !== undefined
        ? (editingVendorComm[rowId] === "" ? null : parseFloat(editingVendorComm[rowId]))
        : original.vendor_commission;

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
        throw new Error("Error en respuesta del servidor");
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
      alert("Error al guardar cambios. Verifique la consola.");
    } finally {
      setSavingStatus(prev => ({ ...prev, [rowId]: false }));
    }
  };

  const totals = useMemo(() => {
    return filteredRows.reduce((acc, row) => {
      const earn = editingCompanyEarn[row.id] !== undefined ? (parseFloat(editingCompanyEarn[row.id]) || 0) : (row.company_earnings || 0);
      const comm = editingVendorComm[row.id] !== undefined ? (parseFloat(editingVendorComm[row.id]) || 0) : (row.vendor_commission || 0);
      const paid = editingPaidAmount[row.id] !== undefined ? (parseFloat(editingPaidAmount[row.id]) || 0) : (row.paid_amount || 0);
      return {
        company_earnings: acc.company_earnings + earn,
        vendor_commission: acc.vendor_commission + comm,
        paid_amount: acc.paid_amount + paid
      };
    }, { company_earnings: 0, vendor_commission: 0, paid_amount: 0 });
  }, [filteredRows, editingCompanyEarn, editingVendorComm, editingPaidAmount]);

  // Resumen para vista vendedor
  const vendorTotals = useMemo(() => {
    const totalComm = totals.vendor_commission;
    const retention = parseFloat((totalComm * 0.10).toFixed(2));
    const net = parseFloat((totalComm - retention).toFixed(2));
    const paid = totals.paid_amount;
    const pending = parseFloat((net - paid).toFixed(2));
    return { totalComm, retention, net, paid, pending };
  }, [totals]);

  if (loadingProspects) return <div className="p-10 text-white">Cargando reportes...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-500" />
            Reporte de Comisiones 2.0
          </h1>
          <p className="text-slate-400 mt-1">
            {effectiveView === 'empresa' ? 'Vista empresa: Ganancia, comisión y pagos por suscriptor' : 'Vista vendedor: Comisiones, retención y neto'}
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
            onClick={handleSyncPymes}
            disabled={syncing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              syncing
                ? 'bg-purple-900/40 text-purple-300 cursor-wait'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/30 hover:shadow-purple-800/40'
            }`}
            title="Sincroniza comisionclaro de ventas PYMES desde Tango Legacy"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sync PYMES Legacy'}
          </button>
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
        </div>
      </div>

      {/* Sync Result Banner */}
      {syncResult && (
        <div className={`${syncResult.totals_match ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'} border p-4 rounded-2xl animate-in fade-in duration-300 relative`}>
          <button onClick={() => setSyncResult(null)} className="absolute top-2 right-2 text-slate-500 hover:text-white p-1 rounded"><X className="w-4 h-4" /></button>
          <div className="flex items-center gap-3">
            <CheckCircle2 className={`w-5 h-5 ${syncResult.totals_match ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="font-bold text-white">Sincronización Tango → CRM completada</span>
            {syncResult.totals_match && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">✓ Totales coinciden</span>}
          </div>
          {/* Resumen principal */}
          {syncResult.report && (
            <div className="mt-2 text-sm font-medium text-white">{syncResult.report.resumen}</div>
          )}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-slate-500">Ventas Tango:</span> <span className="text-orange-400 font-bold">{syncResult.tango_ventas}</span></div>
            <div><span className="text-slate-500">Reports CRM:</span> <span className="text-blue-400 font-bold">{syncResult.crm_reports}</span></div>
            <div><span className="text-slate-500">Insertados:</span> <span className="text-emerald-400 font-bold">{syncResult.reports_created}</span></div>
            <div><span className="text-slate-500">Eliminados:</span> <span className="text-red-400 font-bold">{syncResult.reports_cancelled || 0}</span></div>
          </div>
          {/* Acciones realizadas */}
          {syncResult.report?.acciones?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {syncResult.report.acciones.map((a: string, i: number) => (
                <span key={i} className="bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded">{a}</span>
              ))}
            </div>
          )}
          {/* Creaciones */}
          {(syncResult.clients_created > 0 || syncResult.bans_created > 0 || syncResult.subscribers_created > 0) && (
            <div className="mt-2 flex gap-4 text-xs">
              {syncResult.clients_created > 0 && <span className="text-purple-400">+{syncResult.clients_created} clientes creados</span>}
              {syncResult.bans_created > 0 && <span className="text-blue-400">+{syncResult.bans_created} BANs creados</span>}
              {syncResult.subscribers_created > 0 && <span className="text-cyan-400">+{syncResult.subscribers_created} suscriptores creados</span>}
            </div>
          )}
          {syncResult.errors > 0 && <div className="mt-1 text-xs text-red-400">⚠ {syncResult.errors} error(es) durante el sync</div>}
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
            <p className="text-red-500 text-xs font-bold uppercase tracking-wider">Retención 10%</p>
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
            {vendors?.map(v => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
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

      {/* Main Accordion Table */}
      <div className="space-y-2">
        {/* Expand/Collapse All */}
        <div className="flex items-center justify-between px-1">
          <div className="text-xs text-slate-500">
            <span className="font-bold text-white">{groupedClients.length}</span> clientes · <span className="font-bold text-white">{filteredRows.length}</span> ventas
            {effectiveView === 'empresa' && <> · <span className="font-bold text-emerald-400">{groupedClients.filter(g => g.totalEarnings > 0 && (g.totalEarnings - g.totalPaid) <= 0).length}</span> pagados</>}
          </div>
          <div className="flex gap-2">
            <button onClick={expandAll} className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-800">Expandir todo</button>
            <button onClick={collapseAll} className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-800">Colapsar todo</button>
          </div>
        </div>

        {groupedClients.map(group => {
          const key = group.client_id || group.client;
          const isExpanded = expandedClients.has(key);
          const clientBalance = effectiveView === 'empresa'
            ? (group.totalEarnings - group.totalPaid)
            : (group.totalCommission - group.totalPaid);
          const isPagado = effectiveView === 'empresa'
            ? (group.totalEarnings > 0 && clientBalance <= 0)
            : (group.totalCommission > 0 && clientBalance <= 0);

          return (
            <div key={key} className={`border rounded-2xl overflow-hidden transition-all ${isPagado ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-slate-900/50 border-slate-800'}`}>
              {/* Accordion Header */}
              <button
                onClick={() => toggleClient(key)}
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-800/40 transition-colors cursor-pointer group"
              >
                <div className="flex-shrink-0 text-slate-400 group-hover:text-white transition-colors">
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${isPagado ? 'bg-emerald-500/20' : 'bg-emerald-500/10'}`}>
                  {isPagado ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Building2 className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm truncate">{group.client}</span>
                    {isPagado && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold uppercase">Pagado</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{group.vendor_name}</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Users className="w-3 h-3" /> {group.subscribers.length} ventas
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0">
                  {effectiveView === 'empresa' && (
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Empresa</div>
                      <div className="text-sm font-black text-emerald-400">${group.totalEarnings.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</div>
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Comisión</div>
                    <div className="text-sm font-black text-blue-400">${group.totalCommission.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Pagado</div>
                    <div className="text-sm font-black text-amber-400">${group.totalPaid.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</div>
                  </div>
                  {effectiveView === 'empresa' && (
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Balance</div>
                      <div className={`text-sm font-black ${clientBalance <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ${clientBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                </div>
              </button>

              {/* Accordion Body */}
              {isExpanded && (
                <div className="border-t border-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead>
                        <tr className="bg-slate-800/30">
                          <th className="px-5 py-2 text-[10px] font-bold text-slate-500 uppercase w-[120px]">BAN</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase w-[140px]">Teléfono</th>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase text-right w-[100px]">Mensualidad</th>
                          {effectiveView === 'empresa' && <th className="px-4 py-2 text-[10px] font-black text-emerald-500 uppercase text-center bg-emerald-500/5 border-l border-slate-800 w-[140px]">Ganancia ($)</th>}
                          <th className="px-4 py-2 text-[10px] font-black text-blue-500 uppercase text-center bg-blue-500/5 border-l border-slate-800 w-[140px]">Comisión ($)</th>
                          <th className="px-4 py-2 text-[10px] font-black text-amber-500 uppercase text-center bg-amber-500/5 border-l border-slate-800 w-[140px]">Pagado ($)</th>
                          {isAdmin && <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase text-center w-[60px]"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {group.subscribers.map(row => {
                          const isEditing = editingVendorComm[row.id] !== undefined
                            || editingCompanyEarn[row.id] !== undefined
                            || editingPaidAmount[row.id] !== undefined;
                          const hasSavedValues = (row.vendor_commission || 0) > 0
                            || row.company_earnings !== null
                            || row.paid_amount !== null;

                          return (
                            <tr key={row.id} className="hover:bg-slate-800/20 transition-colors">
                              <td className="px-5 py-2.5 text-xs text-slate-300 font-mono">{row.ban_number || '-'}</td>
                              <td className="px-3 py-2.5 text-xs text-slate-300 font-mono">{row.phone || '-'}</td>
                              <td className="px-3 py-2.5 text-right text-xs text-slate-300 font-mono">
                                {row.monthly_value != null ? `$${Number(row.monthly_value).toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '-'}
                              </td>
                              {effectiveView === 'empresa' && (
                                <td className="px-4 py-2.5 bg-emerald-500/5 border-l border-slate-800 text-center">
                                  <input type="number" step="0.01"
                                    className={`w-full max-w-[110px] bg-slate-800 border text-center font-bold text-emerald-400 text-xs px-2 py-1 outline-none transition-all rounded ${editingCompanyEarn[row.id] !== undefined ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-700 hover:border-emerald-500/50'}`}
                                    value={editingCompanyEarn[row.id] !== undefined ? editingCompanyEarn[row.id] : (row.company_earnings ?? '')}
                                    onChange={(e) => setEditingCompanyEarn(prev => ({ ...prev, [row.id]: e.target.value }))}
                                  />
                                </td>
                              )}
                              <td className="px-4 py-2.5 bg-blue-500/5 border-l border-slate-800 text-center">
                                {isAdmin ? (
                                  <input type="number" step="0.01"
                                    className={`w-full max-w-[110px] bg-slate-800 border text-center font-bold text-blue-400 text-xs px-2 py-1 outline-none transition-all rounded ${editingVendorComm[row.id] !== undefined ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-700 hover:border-blue-500/50'}`}
                                    value={editingVendorComm[row.id] !== undefined ? editingVendorComm[row.id] : (row.vendor_commission ?? '')}
                                    onChange={(e) => setEditingVendorComm(prev => ({ ...prev, [row.id]: e.target.value }))}
                                  />
                                ) : (
                                  <span className="font-bold text-blue-400 text-xs">{row.vendor_commission != null ? `$${Number(row.vendor_commission).toFixed(2)}` : '-'}</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 bg-amber-500/5 border-l border-slate-800 text-center">
                                {isAdmin ? (
                                  <input type="number" step="0.01"
                                    className={`w-full max-w-[110px] bg-slate-800 border text-center font-bold text-amber-400 text-xs px-2 py-1 outline-none transition-all rounded ${editingPaidAmount[row.id] !== undefined ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-700 hover:border-amber-500/50'}`}
                                    value={editingPaidAmount[row.id] !== undefined ? editingPaidAmount[row.id] : (row.paid_amount ?? '')}
                                    onChange={(e) => setEditingPaidAmount(prev => ({ ...prev, [row.id]: e.target.value }))}
                                  />
                                ) : (
                                  <span className="font-bold text-amber-400 text-xs">{row.paid_amount != null ? `$${Number(row.paid_amount).toFixed(2)}` : '-'}</span>
                                )}
                              </td>
                              {isAdmin && (
                                <td className="px-3 py-2.5 text-center">
                                  <button
                                    onClick={() => handleSave(row.id)}
                                    disabled={savingStatus[row.id] || saveSuccess[row.id]}
                                    className={`p-1.5 rounded-lg transition-all ${saveSuccess[row.id]
                                      ? 'bg-green-600 text-white'
                                      : isEditing
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40'
                                        : hasSavedValues
                                          ? 'bg-slate-700 text-emerald-400 opacity-60 hover:opacity-100'
                                          : 'bg-slate-800 text-slate-500 opacity-30 hover:opacity-100 hover:bg-slate-700'
                                    }`}
                                    title={isEditing ? "Guardar cambios" : "Re-guardar"}
                                  >
                                    {savingStatus[row.id] ? (
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                                    ) : saveSuccess[row.id] ? (
                                      <CheckCircle2 size={14} className="text-white" />
                                    ) : isEditing ? (
                                      <Save size={14} />
                                    ) : (
                                      <CheckCircle2 size={14} />
                                    )}
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
              <span className="flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> Retención 10% Hacienda</span>
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
