import { useState, useMemo, useEffect } from "react";
import { DollarSign, FileText, Search, Save, History, X } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { getCurrentUser } from "@/react-app/utils/auth";

interface FollowUpProspect {
  id: number;
  company_name: string;
  client_id: number | null;
  vendor_id: number | null;
  fijo_ren: number;
  fijo_new: number;
  movil_nueva: number;
  movil_renovacion: number;
  claro_tv: number;
  cloud: number;
  mpls: number;
  total_amount: number;
  is_completed: boolean;
  vendor_name?: string;
  client_name?: string;
  client_business_name?: string;
}

interface Subscriber {
  id: number;
  phone: string;
  ban_id: number;
  service_type: string | null;
  monthly_value: number | null;
  client_id?: number;
}

interface BAN {
  id: number;
  ban_number: string;
  client_id: number;
}

interface Product {
  id: number;
  name: string;
  base_price: number;
  commission_percentage: number;
}

interface Goal {
  id: number;
  vendor_id: number | null;
  product_id: number | null;
  product_name: string | null;
  target_amount: number;
  current_amount: number;
  period_year: number;
  period_month: number | null;
}

interface ClientSalesRow {
  id: number;
  prospectId: number;
  client: string;
  clientId: number | null;
  vendor_id: number | null;
  vendor_name: string | null;
  fijo_ren: number;
  fijo_new: number;
  movil_nueva_manual: number;
  movil_renovacion_manual: number;
  claro_tv: number;
  cloud: number;
  mpls: number;
  commission: number; // Comisión total calculada por suscriptores
  percentage: number; // % promedio de comisión
  mobile: number; // Meta del vendedor
  notes: string;
  total: number; // commission + movil_nueva_manual + movil_renovacion_manual
}

interface PaymentRecord {
  id: string;
  date: string;
  vendor_id: number | null;
  vendor_name: string | null;
  amount: number;
  notes: string;
  clientRows: number[]; // IDs de las filas de clientes pagadas
}

export default function Reports() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<number | null>(null);
  const [movilNuevaManual, setMovilNuevaManual] = useState<Record<number, number>>({});
  const [movilRenManual, setMovilRenManual] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedRowsForPayment, setSelectedRowsForPayment] = useState<Set<number>>(new Set());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  
  const { data: prospects } = useApi<FollowUpProspect[]>("/api/follow-up-prospects");
  const { data: subscribers } = useApi<Subscriber[]>("/api/subscribers");
  const { data: bans } = useApi<BAN[]>("/api/bans");
  const { data: products } = useApi<Product[]>("/api/products");
  const { data: goals } = useApi<Goal[]>("/api/goals");
  const currentUser = getCurrentUser();
  const isVendor = currentUser?.role?.toLowerCase() === "vendedor";

  // Cargar pagos desde localStorage
  useEffect(() => {
    const savedPayments = localStorage.getItem('sales_payments');
    if (savedPayments) {
      try {
        setPayments(JSON.parse(savedPayments));
      } catch (e) {
        console.error('Error loading payments:', e);
      }
    }
  }, []);

  // Filtrar prospects por vendedor y solo los completados
  const filteredProspects = useMemo(() => {
    if (!prospects) return [];
    // Solo mostrar prospects completados (ventas realizadas)
    let filtered = prospects.filter(p => p.is_completed === true);
    
    // Si es vendedor, solo mostrar sus propios prospects
    if (isVendor && currentUser?.salespersonId) {
      filtered = filtered.filter(p => {
        const vendorId = p.vendor_id;
        if (typeof vendorId === 'number' && typeof currentUser.salespersonId === 'number') {
          return vendorId === currentUser.salespersonId;
        }
        return String(vendorId) === String(currentUser.salespersonId);
      });
    } else if (selectedVendor) {
      filtered = filtered.filter(p => p.vendor_id === selectedVendor);
    }
    
    return filtered;
  }, [prospects, isVendor, currentUser, selectedVendor]);

  // Crear filas de ventas (una por cliente)
  const salesRows = useMemo(() => {
    if (!filteredProspects || !products || !subscribers || !bans) return [];
    
    const rows: ClientSalesRow[] = [];
    
    // Crear mapa de ban_id -> client_id
    const banToClientMap = new Map<number, number>();
    bans.forEach(ban => {
      banToClientMap.set(ban.id, ban.client_id);
    });
    
    filteredProspects.forEach((prospect) => {
      const clientName = prospect.client_business_name || prospect.client_name || prospect.company_name;
      const clientId = prospect.client_id;
      
      // Obtener suscriptores del cliente: buscar bans del cliente y luego suscriptores de esos bans
      const clientBans = clientId ? bans.filter(b => b.client_id === clientId) : [];
      const clientBanIds = clientBans.map(b => b.id);
      const clientSubscribers = subscribers.filter(s => clientBanIds.includes(s.ban_id));
      
      // Calcular comisión total por suscriptores
      let totalCommission = 0;
      let totalPercentage = 0;
      let commissionCount = 0;
      
      clientSubscribers.forEach(subscriber => {
        if (subscriber.service_type && subscriber.monthly_value) {
          // Buscar producto por service_type
          const product = products.find(p => 
            p.name.toLowerCase().includes(subscriber.service_type!.toLowerCase()) ||
            subscriber.service_type!.toLowerCase().includes(p.name.toLowerCase())
          );
          
          if (product && product.commission_percentage) {
            const commission = (subscriber.monthly_value * product.commission_percentage) / 100;
            totalCommission += commission;
            totalPercentage += product.commission_percentage;
            commissionCount++;
          }
        }
      });
      
      const avgPercentage = commissionCount > 0 ? totalPercentage / commissionCount : 0;
      
      // Buscar meta del vendedor (usar la primera meta encontrada como referencia)
      const vendorGoal = goals?.find(g => 
        g.vendor_id === prospect.vendor_id &&
        g.period_year === new Date().getFullYear() &&
        (g.period_month === new Date().getMonth() + 1 || g.period_month === null)
      );
      
      const mobile = vendorGoal?.target_amount || 0;
      
      const rowId = prospect.id;
      const movilNueva = movilNuevaManual[rowId] || 0;
      const movilRen = movilRenManual[rowId] || 0;
      const rowNotes = notes[rowId] || "";
      
      const total = totalCommission + movilNueva + movilRen;
      
      rows.push({
        id: rowId,
        prospectId: prospect.id,
        client: clientName,
        clientId: clientId,
        vendor_id: prospect.vendor_id,
        vendor_name: prospect.vendor_name || null,
        fijo_ren: prospect.fijo_ren || 0,
        fijo_new: prospect.fijo_new || 0,
        movil_nueva_manual: movilNueva,
        movil_renovacion_manual: movilRen,
        claro_tv: prospect.claro_tv || 0,
        cloud: prospect.cloud || 0,
        mpls: prospect.mpls || 0,
        commission: totalCommission,
        percentage: avgPercentage,
        mobile,
        notes: rowNotes,
        total
      });
    });
    
    return rows;
  }, [filteredProspects, products, subscribers, goals, movilNuevaManual, movilRenManual, notes]);

  // Filtrar por búsqueda
  const filteredRows = useMemo(() => {
    if (!searchTerm) return salesRows;
    const term = searchTerm.toLowerCase();
    return salesRows.filter(row => 
      row.client.toLowerCase().includes(term) ||
      row.vendor_name?.toLowerCase().includes(term)
    );
  }, [salesRows, searchTerm]);

  // Totales
  const totals = useMemo(() => {
    return filteredRows.reduce((acc, row) => ({
      commission: acc.commission + row.commission,
      movilNueva: acc.movilNueva + row.movil_nueva_manual,
      movilRen: acc.movilRen + row.movil_renovacion_manual,
      total: acc.total + row.total
    }), { commission: 0, movilNueva: 0, movilRen: 0, total: 0 });
  }, [filteredRows]);

  const handleMovilNuevaChange = (rowId: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setMovilNuevaManual(prev => ({
      ...prev,
      [rowId]: numValue
    }));
  };

  const handleMovilRenChange = (rowId: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setMovilRenManual(prev => ({
      ...prev,
      [rowId]: numValue
    }));
  };

  const handleNotesChange = (rowId: number, value: string) => {
    setNotes(prev => ({
      ...prev,
      [rowId]: value
    }));
  };

  const handleRowSelect = (rowId: number) => {
    setSelectedRowsForPayment(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const handleRegisterPayment = () => {
    if (selectedRowsForPayment.size === 0) {
      alert('Selecciona al menos una fila para registrar el pago');
      return;
    }

    const selectedRows = filteredRows.filter(r => selectedRowsForPayment.has(r.id));
    const totalAmount = selectedRows.reduce((sum, r) => sum + r.total, 0);
    const suggestedAmount = parseFloat(paymentAmount) || totalAmount;

    const payment: PaymentRecord = {
      id: `payment-${Date.now()}`,
      date: new Date().toISOString(),
      vendor_id: selectedRows[0]?.vendor_id || null,
      vendor_name: selectedRows[0]?.vendor_name || null,
      amount: suggestedAmount,
      notes: paymentNotes,
      clientRows: Array.from(selectedRowsForPayment)
    };

    const newPayments = [...payments, payment];
    setPayments(newPayments);
    localStorage.setItem('sales_payments', JSON.stringify(newPayments));
    
    setShowPaymentModal(false);
    setSelectedRowsForPayment(new Set());
    setPaymentAmount("");
    setPaymentNotes("");
    alert('Pago registrado correctamente');
  };

  // Obtener lista única de vendedores
  const vendors = useMemo(() => {
    const vendorMap = new Map<number, string>();
    filteredProspects?.forEach(p => {
      if (p.vendor_id && p.vendor_name) {
        vendorMap.set(p.vendor_id, p.vendor_name);
      }
    });
    return Array.from(vendorMap.entries()).map(([id, name]) => ({ id, name }));
  }, [filteredProspects]);

  // Filas pagadas
  const paidRows = useMemo(() => {
    const paid = new Set<number>();
    payments.forEach(payment => {
      payment.clientRows.forEach(rowId => paid.add(rowId));
    });
    return paid;
  }, [payments]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
      <div>
          <h1 className="text-3xl font-bold text-white">Reporte de Ventas por Vendedor</h1>
          <p className="text-gray-400 mt-1">Cálculo de comisiones por suscriptor y pagos a vendedores</p>
      </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPaymentHistory(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2"
          >
            <History className="w-5 h-5" />
            Historial de Pagos
          </button>
          {selectedRowsForPayment.size > 0 && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              Registrar Pago ({selectedRowsForPayment.size})
            </button>
          )}
              </div>
            </div>

      {/* Filtros */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por cliente o vendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
              </div>
            </div>
        
        {!isVendor && (
          <div className="min-w-[200px]">
            <select
              value={selectedVendor || ""}
              onChange={(e) => setSelectedVendor(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos los vendedores</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabla de Reporte */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider w-8">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRowsForPayment(new Set(filteredRows.map(r => r.id)));
                      } else {
                        setSelectedRowsForPayment(new Set());
                      }
                    }}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Vendedor</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">FIJO REN</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">FIJO NEW</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">MÓVIL NUEVA</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">MÓVIL RENO</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">CLAROTV</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">CLOUD</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">MPLS</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">Comisión</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">%</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">Móvil (Meta)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Notas</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-8 text-center text-gray-400">
                    <FileText className="mx-auto h-12 w-12 text-gray-600 mb-2" />
                    <p>No hay ventas registradas</p>
                  </td>
                </tr>
              ) : (
                <>
                  {filteredRows.map((row) => {
                    const isPaid = paidRows.has(row.id);
                    return (
                      <tr 
                        key={row.id} 
                        className={`hover:bg-gray-700/50 transition-colors ${isPaid ? 'opacity-50 bg-green-900/20' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRowsForPayment.has(row.id)}
                            onChange={() => handleRowSelect(row.id)}
                            disabled={isPaid}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-white">{row.client}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{row.vendor_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-300">{row.fijo_ren}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-300">{row.fijo_new}</td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            value={row.movil_nueva_manual || ""}
                            onChange={(e) => handleMovilNuevaChange(row.id, e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            disabled={isPaid}
                            className="w-24 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            value={row.movil_renovacion_manual || ""}
                            onChange={(e) => handleMovilRenChange(row.id, e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            disabled={isPaid}
                            className="w-24 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-300">{row.claro_tv}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-300">{row.cloud}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-300">{row.mpls}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-300">
                          ${row.commission.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-300">
                          {row.percentage.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-300">
                          {row.mobile.toLocaleString('es-ES')}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) => handleNotesChange(row.id, e.target.value)}
                            placeholder="Notas..."
                            disabled={isPaid}
                            className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-green-400">
                          ${row.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Fila de Totales */}
                  <tr className="bg-gray-900 border-t-2 border-gray-600 font-bold">
                    <td colSpan={3} className="px-4 py-3 text-sm text-white">TOTALES</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      {filteredRows.reduce((sum, r) => sum + r.fijo_ren, 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      {filteredRows.reduce((sum, r) => sum + r.fijo_new, 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      ${totals.movilNueva.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      ${totals.movilRen.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      {filteredRows.reduce((sum, r) => sum + r.claro_tv, 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      {filteredRows.reduce((sum, r) => sum + r.cloud, 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      {filteredRows.reduce((sum, r) => sum + r.mpls, 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      ${totals.commission.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">-</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">-</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">-</td>
                    <td className="px-4 py-3 text-sm text-right text-green-400">
                      ${totals.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
                </div>
              </div>

      {/* Resumen */}
      {filteredRows.length > 0 && (
        <div className="bg-gradient-to-r from-green-900/40 to-blue-900/40 border border-green-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Resumen de Pagos</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-300">Total Comisiones</p>
              <p className="text-2xl font-bold text-white">
                ${totals.commission.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-300">Móvil Nueva</p>
              <p className="text-2xl font-bold text-white">
                ${totals.movilNueva.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-300">Móvil Renovación</p>
              <p className="text-2xl font-bold text-white">
                ${totals.movilRen.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-300">Total a Pagar</p>
              <p className="text-2xl font-bold text-green-400">
                ${totals.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Registro de Pago */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white">Registrar Pago</h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount("");
                  setPaymentNotes("");
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Monto a Pagar
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={filteredRows
                    .filter(r => selectedRowsForPayment.has(r.id))
                    .reduce((sum, r) => sum + r.total, 0)
                    .toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  step="0.01"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notas del Pago
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notas adicionales sobre el pago..."
                />
                </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentAmount("");
                    setPaymentNotes("");
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegisterPayment}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg"
                >
                  Registrar Pago
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Historial de Pagos */}
      {showPaymentHistory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white">Historial de Pagos</h3>
              <button
                onClick={() => setShowPaymentHistory(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              {payments.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No hay pagos registrados</p>
              ) : (
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div key={payment.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-white font-semibold">{payment.vendor_name || 'Sin vendedor'}</p>
                          <p className="text-sm text-gray-400">
                            {new Date(payment.date).toLocaleString('es-ES')}
                          </p>
                        </div>
                        <p className="text-xl font-bold text-green-400">
                          ${payment.amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      {payment.notes && (
                        <p className="text-sm text-gray-300 mt-2">{payment.notes}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {payment.clientRows.length} cliente(s) pagado(s)
                      </p>
      </div>
                  ))}
          </div>
              )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
