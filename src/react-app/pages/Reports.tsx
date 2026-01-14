import { useState, useMemo, useEffect } from "react";
import { DollarSign, FileText, Search, Save, History, X } from "lucide-react";
import { useApi } from "../hooks/useApi";

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
  completed_date: string | null;
  created_at: string;
  vendor_name?: string;
  client_name?: string;
  client_business_name?: string;
}

interface Product {
  id: string;
  name: string;
  base_price: number;
  commission_percentage: number;
}

interface CommissionTier {
  id: string;
  product_id: string;
  range_min: number;
  range_max: number | null;
  commission_amount: number;
}

interface Vendor {
  id: number;
  name: string;
  commission_percentage: number;
}

interface ClientSalesRow {
  id: number;
  prospectId: number;
  client: string;
  clientId: number | null;
  vendor_id: number | null;
  vendor_name: string | null;
  vendor_commission_pct: number;
  fijo_ren: number;
  fijo_new: number;
  movil_nueva_manual: number;
  movil_renovacion_manual: number;
  claro_tv: number;
  cloud: number;
  mpls: number;
  company_earnings: number; // Ganancia de la empresa
  vendor_commission: number; // Comisión del vendedor
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
  // Inicializar con mes corriente (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [movilNuevaManual, setMovilNuevaManual] = useState<Record<number, number>>({});
  const [movilRenManual, setMovilRenManual] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedRowsForPayment, setSelectedRowsForPayment] = useState<Set<number>>(new Set());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  
  const { data: prospects } = useApi<FollowUpProspect[]>("/api/completed-prospects");
  const { data: products } = useApi<Product[]>("/api/products");
  const { data: tiers } = useApi<CommissionTier[]>("/api/products/tiers");
  const { data: vendors } = useApi<Vendor[]>("/api/vendors");

  console.log('🔍 REPORTS - prospects:', prospects?.length || 0, 'productos:', products?.length || 0, 'tiers:', tiers?.length || 0);

  // Helper: Calcular comisión empresa basada en tiers o porcentaje
  const calculateCompanyEarnings = (productName: string, amount: number): number => {
    if (amount <= 0) return 0;
    
    const product = products?.find(p => p.name.toLowerCase() === productName.toLowerCase());
    if (!product) return 0;

    // Productos con tiers: Movil New y Movil Ren
    if (productName.toLowerCase().includes('movil')) {
      const productTiers = tiers?.filter(t => t.product_id === product.id) || [];
      if (productTiers.length > 0) {
        // Buscar tier apropiado
        const tier = productTiers.find(t => {
          if (t.range_max === null) return amount >= t.range_min;
          return amount >= t.range_min && amount <= t.range_max;
        });
        return tier ? tier.commission_amount : 0;
      }
    }

    // Productos sin tiers: usar porcentaje
    // Fijo Ren: 50%, Fijo New/Claro TV/Cloud: 100%
    const commPercent = typeof product.commission_percentage === 'string' 
      ? parseFloat(product.commission_percentage) 
      : (product.commission_percentage || 0);
    return (amount * commPercent) / 100;
  };

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

  // Filtrar prospects (ya vienen solo completados del endpoint)
  const filteredProspects = useMemo(() => {
    if (!prospects) return [];
    let filtered = prospects; // Ya vienen completados del endpoint /api/completed-prospects
    
    // TODOS VEN TODO - Sin filtros por vendedor
    if (selectedVendor) {
      filtered = filtered.filter(p => p.vendor_id === selectedVendor);
    }
    
    // Filtrar por mes
    if (selectedMonth) {
      filtered = filtered.filter(p => {
        const date = p.completed_date || p.created_at;
        if (!date) return false;
        const prospectMonth = new Date(date).toISOString().slice(0, 7); // YYYY-MM
        return prospectMonth === selectedMonth;
      });
    }
    
    return filtered;
  }, [prospects, selectedVendor, selectedMonth]);

  // Crear filas de ventas (una por cliente)
  const salesRows = useMemo(() => {
    if (!filteredProspects || !products || !vendors) return [];
    
    const rows: ClientSalesRow[] = [];
    
    filteredProspects.forEach((prospect) => {
      const clientName = prospect.client_business_name || prospect.client_name || prospect.company_name;
      const clientId = prospect.client_id;
      
      // Obtener % de comisión del vendedor
      const vendor = vendors.find(v => v.id === prospect.vendor_id);
      const vendorCommissionPct = vendor?.commission_percentage || 50;
      
      // Valores de productos
      const fijoRenValue = Number(prospect.fijo_ren) || 0;
      const fijoNewValue = Number(prospect.fijo_new) || 0;
      const movilNuevaValue = Number(prospect.movil_nueva) || 0;
      const movilRenValue = Number(prospect.movil_renovacion) || 0;
      const claroTvValue = Number(prospect.claro_tv) || 0;
      const cloudValue = Number(prospect.cloud) || 0;
      const mplsValue = Number(prospect.mpls) || 0;
      
      // Calcular ganancia empresa para cada producto
      const earnings = {
        fijo_ren: calculateCompanyEarnings('Fijo Ren', fijoRenValue),
        fijo_new: calculateCompanyEarnings('Fijo New', fijoNewValue),
        movil_nueva: calculateCompanyEarnings('Movil New', movilNuevaValue),
        movil_ren: calculateCompanyEarnings('Movil Ren', movilRenValue),
        claro_tv: calculateCompanyEarnings('Claro TV', claroTvValue),
        cloud: calculateCompanyEarnings('Cloud', cloudValue),
        mpls: calculateCompanyEarnings('MPLS', mplsValue)
      };
      
      // Total ganancia empresa
      const totalCompanyEarnings = Object.values(earnings).reduce((sum, val) => sum + val, 0);
      
      // Comisión vendedor = ganancia empresa × % vendedor
      const totalVendorCommission = (totalCompanyEarnings * vendorCommissionPct) / 100;
      
      const rowId = prospect.id;
      const rowNotes = notes[rowId] || "";
      
      rows.push({
        id: rowId,
        prospectId: prospect.id,
        client: clientName,
        clientId: clientId,
        vendor_id: prospect.vendor_id,
        vendor_name: prospect.vendor_name || null,
        vendor_commission_pct: vendorCommissionPct,
        fijo_ren: fijoRenValue,
        fijo_new: fijoNewValue,
        movil_nueva_manual: movilNuevaValue,
        movil_renovacion_manual: movilRenValue,
        claro_tv: claroTvValue,
        cloud: cloudValue,
        mpls: mplsValue,
        company_earnings: totalCompanyEarnings,
        vendor_commission: totalVendorCommission,
        percentage: vendorCommissionPct,
        mobile: 0,
        notes: rowNotes,
        total: fijoRenValue + fijoNewValue + movilNuevaValue + movilRenValue + claroTvValue + cloudValue + mplsValue
      });
    });
    
    return rows;
  }, [filteredProspects, products, vendors, tiers, notes, calculateCompanyEarnings]);

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
      company_earnings: acc.company_earnings + row.company_earnings,
      vendor_commission: acc.vendor_commission + row.vendor_commission,
      total: acc.total + row.total
    }), { company_earnings: 0, vendor_commission: 0, total: 0 });
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

  // Obtener lista única de vendedores para filtro
  const vendorOptions = useMemo(() => {
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
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-400" />
            Reportes de Ventas
          </h1>
          <p className="text-gray-400 mt-1">Seguimiento de ventas completadas y comisiones</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPaymentHistory(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <History className="w-5 h-5" />
            Historial de Pagos
          </button>
          {selectedRowsForPayment.size > 0 && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Save className="w-5 h-5" />
              Registrar Pago ({selectedRowsForPayment.size})
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Ventas Totales</p>
              <p className="text-3xl font-bold text-white mt-2">{filteredRows.length}</p>
            </div>
            <FileText className="w-12 h-12 text-blue-200 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Comisión Total</p>
              <p className="text-3xl font-bold text-white mt-2">
                ${totals.commission.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-green-200 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Total General</p>
              <p className="text-3xl font-bold text-white mt-2">
                ${totals.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-purple-200 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Seleccionadas</p>
              <p className="text-3xl font-bold text-white mt-2">{selectedRowsForPayment.size}</p>
            </div>
            <FileText className="w-12 h-12 text-orange-200 opacity-50" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium text-gray-300 mb-2">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cliente o vendedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
          
          <div className="min-w-[180px]">
            <label className="block text-sm font-medium text-gray-300 mb-2">Mes</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Todos los meses</option>
              <option value="2026-01">Enero 2026</option>
              <option value="2026-02">Febrero 2026</option>
              <option value="2026-03">Marzo 2026</option>
              <option value="2026-04">Abril 2026</option>
              <option value="2026-05">Mayo 2026</option>
              <option value="2026-06">Junio 2026</option>
              <option value="2026-07">Julio 2026</option>
              <option value="2026-08">Agosto 2026</option>
              <option value="2026-09">Septiembre 2026</option>
              <option value="2026-10">Octubre 2026</option>
              <option value="2026-11">Noviembre 2026</option>
              <option value="2026-12">Diciembre 2026</option>
              <option value="2025-01">Enero 2025</option>
              <option value="2025-02">Febrero 2025</option>
              <option value="2025-03">Marzo 2025</option>
              <option value="2025-04">Abril 2025</option>
              <option value="2025-05">Mayo 2025</option>
              <option value="2025-06">Junio 2025</option>
              <option value="2025-07">Julio 2025</option>
              <option value="2025-08">Agosto 2025</option>
              <option value="2025-09">Septiembre 2025</option>
              <option value="2025-10">Octubre 2025</option>
              <option value="2025-11">Noviembre 2025</option>
              <option value="2025-12">Diciembre 2025</option>
              <option value="2024-01">Enero 2024</option>
              <option value="2024-02">Febrero 2024</option>
              <option value="2024-03">Marzo 2024</option>
              <option value="2024-04">Abril 2024</option>
              <option value="2024-05">Mayo 2024</option>
              <option value="2024-06">Junio 2024</option>
              <option value="2024-07">Julio 2024</option>
              <option value="2024-08">Agosto 2024</option>
              <option value="2024-09">Septiembre 2024</option>
              <option value="2024-10">Octubre 2024</option>
              <option value="2024-11">Noviembre 2024</option>
              <option value="2024-12">Diciembre 2024</option>
            </select>
          </div>
        
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-gray-300 mb-2">Vendedor</label>
            <select
              value={selectedVendor || ""}
              onChange={(e) => setSelectedVendor(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Todos</option>
              {vendorOptions.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Reporte */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden max-w-full">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px]">
            <thead className="bg-gray-900 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider w-8 whitespace-nowrap">
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">Vendedor</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">FIJO REN</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">FIJO NEW</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">MÓVIL NUEVA</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">MÓVIL RENO</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">CLAROTV</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">CLOUD</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">MPLS</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-green-400 uppercase tracking-wider whitespace-nowrap">Ganancia Empresa</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-blue-400 uppercase tracking-wider whitespace-nowrap">Comisión Vendedor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">Notas</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">Total</th>
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
                        <td className={`px-4 py-3 text-sm text-right text-gray-300 ${(Number(row.fijo_ren) > 0 && !isPaid) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>{row.fijo_ren}</td>
                        <td className={`px-4 py-3 text-sm text-right text-gray-300 ${(Number(row.fijo_new) > 0 && !isPaid) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>{row.fijo_new}</td>
                        <td className={`px-4 py-3 text-sm text-right text-gray-300 ${(Number(row.movil_nueva_manual) > 0 && !isPaid) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>{row.movil_nueva_manual}</td>
                        <td className={`px-4 py-3 text-sm text-right text-gray-300 ${(Number(row.movil_renovacion_manual) > 0 && !isPaid) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>{row.movil_renovacion_manual}</td>
                        <td className={`px-4 py-3 text-sm text-right text-gray-300 ${(Number(row.claro_tv) > 0 && !isPaid) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>{row.claro_tv}</td>
                        <td className={`px-4 py-3 text-sm text-right text-gray-300 ${(Number(row.cloud) > 0 && !isPaid) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>{row.cloud}</td>
                        <td className={`px-4 py-3 text-sm text-right text-gray-300 ${(Number(row.mpls) > 0 && !isPaid) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>{row.mpls}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-green-400">
                          ${row.company_earnings.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-blue-400">
                          ${row.vendor_commission.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-xs text-gray-500 ml-1">({row.vendor_commission_pct}%)</span>
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
                      {filteredRows.reduce((sum, r) => sum + (Number(r.fijo_ren) || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      {filteredRows.reduce((sum, r) => sum + (Number(r.fijo_new) || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      {filteredRows.reduce((sum, r) => sum + (Number(r.movil_nueva_manual) || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      {filteredRows.reduce((sum, r) => sum + (Number(r.movil_renovacion_manual) || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      {filteredRows.reduce((sum, r) => sum + (Number(r.claro_tv) || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      {filteredRows.reduce((sum, r) => sum + (Number(r.cloud) || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      {filteredRows.reduce((sum, r) => sum + (Number(r.mpls) || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-green-400">
                      ${totals.company_earnings.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-blue-400">
                      ${totals.vendor_commission.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">-</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-300">Total Comisiones</p>
              <p className="text-2xl font-bold text-white">
                ${totals.commission.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-300">Total a Pagar</p>
              <p className="text-2xl font-bold text-green-400">
                ${totals.commission.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
