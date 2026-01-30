
import { useState, useMemo, Fragment } from "react";
import { DollarSign, Search, Save, CheckCircle2 } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

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
          subscribers: []
        });
      }
      map.get(key).subscribers.push(row);
    }
    return Array.from(map.values()).sort((a, b) => a.client.localeCompare(b.client));
  }, [filteredRows]);

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

  if (loadingProspects) return <div className="p-10 text-white">Cargando reportes...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-500" />
            Reporte de Comisiones 2.0
          </h1>
          <p className="text-slate-400 mt-1">Gestion manual total: Edita ganancia, comision y pagos por suscriptor.</p>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Ganancia Empresa Total</p>
          <p className="text-2xl font-black text-white mt-1">
            ${totals.company_earnings.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
          <p className="text-emerald-500 text-xs font-bold uppercase tracking-wider">Comision Vendedores</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            ${totals.vendor_commission.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
          <p className="text-blue-500 text-xs font-bold uppercase tracking-wider">Utilidad Neta</p>
          <p className="text-2xl font-black text-blue-400 mt-1">
            ${(totals.company_earnings - totals.vendor_commission).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
          <p className="text-amber-500 text-xs font-bold uppercase tracking-wider">Pagado Total</p>
          <p className="text-2xl font-black text-amber-400 mt-1">
            ${totals.paid_amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

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
          <select
            value={selectedVendor || ""}
            onChange={(e) => setSelectedVendor(e.target.value ? String(e.target.value) : null)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-w-[150px]"
          >
            <option value="">Todos</option>
            {vendors?.map(v => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
          </select>
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

      {/* Main Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1300px]">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-700">
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase sticky left-0 bg-slate-900 z-10 w-56">Cliente</th>
                <th className="px-2 py-4 text-[10px] font-bold text-slate-200 uppercase text-left border-b border-slate-700 w-[110px]">BAN</th>
                <th className="px-2 py-4 text-[10px] font-bold text-slate-200 uppercase text-left border-b border-slate-700 w-[140px]">Telefono</th>
                <th className="px-2 py-4 text-[10px] font-bold text-slate-200 uppercase text-right border-b border-slate-700 w-[120px]">Mensualidad</th>
                <th className="px-4 py-4 text-[10px] font-black text-emerald-500 uppercase text-center bg-emerald-500/5 border-l border-slate-800 w-[160px] min-w-[160px]">Ganancia Empresa ($)</th>
                <th className="px-4 py-4 text-[10px] font-black text-blue-500 uppercase text-center bg-blue-500/5 border-l border-slate-800 w-[160px] min-w-[160px]">Comision Vendedor ($)</th>
                <th className="px-4 py-4 text-[10px] font-black text-amber-500 uppercase text-center bg-amber-500/5 border-l border-slate-800 w-[160px] min-w-[160px]">Pagado ($)</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-right w-[80px]">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {groupedClients.map(group => (
                <Fragment key={group.client_id || group.client}>
                  <tr className="bg-slate-800/40">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="text-slate-100 font-bold truncate">{group.client}</div>
                        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">{group.vendor_name}</div>
                        <div className="ml-3 text-xs text-slate-400">Suscriptores ({group.subscribers.length})</div>
                      </div>
                    </td>
                  </tr>
                  {group.subscribers.map(row => {
                    const isEditing = editingVendorComm[row.id] !== undefined
                      || editingCompanyEarn[row.id] !== undefined
                      || editingPaidAmount[row.id] !== undefined;

                    const hasSavedValues = (row.vendor_commission || 0) > 0
                      || row.company_earnings !== null
                      || row.paid_amount !== null;

                    return (
                      <tr key={row.id} className="hover:bg-slate-800/20 transition-colors group">
                        <td className="px-4 py-3 text-slate-200 text-xs">&nbsp;</td>
                        <td className="px-2 py-3 text-left text-xs text-slate-200 font-mono font-medium">{row.ban_number || '-'}</td>
                        <td className="px-2 py-3 text-left text-xs text-slate-200 font-mono font-medium">{row.phone || '-'}</td>
                        <td className="px-2 py-3 text-right text-xs text-slate-200 font-mono font-medium">
                          {row.monthly_value !== null && row.monthly_value !== undefined
                            ? `$${Number(row.monthly_value).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </td>

                        <td className="px-4 py-3 bg-emerald-500/5 border-l border-slate-800 text-center">
                          <input
                            type="number"
                            step="0.01"
                            className={`w-full max-w-[120px] bg-slate-800 border text-center font-bold text-emerald-400 px-2 py-1 outline-none transition-all rounded ${editingCompanyEarn[row.id] !== undefined ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-700 hover:border-emerald-500/50'}`}
                            value={editingCompanyEarn[row.id] !== undefined ? editingCompanyEarn[row.id] : (row.company_earnings ?? '')}
                            onChange={(e) => setEditingCompanyEarn(prev => ({ ...prev, [row.id]: e.target.value }))}
                            title="Editar ganancia de la empresa"
                          />
                        </td>

                        <td className="px-4 py-3 bg-blue-500/5 border-l border-slate-800 text-center">
                          <input
                            type="number"
                            step="0.01"
                            className={`w-full max-w-[120px] bg-slate-800 border text-center font-bold text-blue-400 px-2 py-1 outline-none transition-all rounded ${editingVendorComm[row.id] !== undefined ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-700 hover:border-blue-500/50'}`}
                            value={editingVendorComm[row.id] !== undefined ? editingVendorComm[row.id] : (row.vendor_commission ?? '')}
                            onChange={(e) => setEditingVendorComm(prev => ({ ...prev, [row.id]: e.target.value }))}
                            title="Editar comision del vendedor"
                          />
                        </td>

                        <td className="px-4 py-3 bg-amber-500/5 border-l border-slate-800 text-center">
                          <input
                            type="number"
                            step="0.01"
                            className={`w-full max-w-[120px] bg-slate-800 border text-center font-bold text-amber-400 px-2 py-1 outline-none transition-all rounded ${editingPaidAmount[row.id] !== undefined ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-700 hover:border-amber-500/50'}`}
                            value={editingPaidAmount[row.id] !== undefined ? editingPaidAmount[row.id] : (row.paid_amount ?? '')}
                            onChange={(e) => setEditingPaidAmount(prev => ({ ...prev, [row.id]: e.target.value }))}
                            title="Registrar pago del mes"
                          />
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleSave(row.id)}
                            disabled={savingStatus[row.id] || saveSuccess[row.id]}
                            className={`p-2 rounded-lg transition-all flex items-center justify-center ml-auto min-w-[40px] ${saveSuccess[row.id]
                                ? 'bg-green-600 text-white shadow-lg shadow-green-900/40'
                                : isEditing
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40'
                                  : hasSavedValues
                                    ? 'bg-slate-700 text-emerald-400 opacity-80 hover:opacity-100'
                                    : 'bg-slate-800 text-slate-500 opacity-40 hover:opacity-100 hover:bg-slate-700 hover:text-white'
                              }`}
                            title={isEditing ? "Guardar cambios" : "Guardada (click para re-guardar)"}
                          >
                            {savingStatus[row.id] ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                            ) : saveSuccess[row.id] ? (
                              <span className="text-xs font-bold animate-pulse">ok</span>
                            ) : isEditing ? (
                              <Save size={16} />
                            ) : (
                              <CheckCircle2 size={16} />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
