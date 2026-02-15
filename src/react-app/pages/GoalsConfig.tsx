import { useState, useMemo, useEffect } from "react";
import { Calendar, Save, Target } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";

interface Vendor {
  id: number;
  name: string;
  salesperson_id: string;
}

interface Product {
  id: string;
  name: string;
  category_name?: string;
}

interface ProductGoal {
  product_id: string;
  target_amount: number;
}

export default function GoalsConfig() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [goals, setGoals] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const { data: vendors } = useApi<Vendor[]>("/api/vendors");
  const { data: products } = useApi<Product[]>("/api/products");

  // Generar opciones de meses
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  }, []);

  // Cargar metas cuando cambia el mes
  useEffect(() => {
    if (!vendors || !selectedMonth) return;
    
    const loadGoals = async () => {
      const [year, month] = selectedMonth.split('-').map(Number);
      
      try {
        const response = await authFetch(`/api/goals/by-period?year=${year}&month=${month}`);
        if (response.ok) {
          const data = await response.json();
          const newGoals: Record<string, Record<string, string>> = {};
          
          data.forEach((goal: any) => {
            const vendorKey = `${goal.vendor_id}`;
            if (!newGoals[vendorKey]) newGoals[vendorKey] = {};
            newGoals[vendorKey][goal.product_id] = String(goal.target_amount || '');
          });
          
          setGoals(newGoals);
        }
      } catch (error) {
        console.error('Error loading goals:', error);
      }
    };

    loadGoals();
  }, [vendors, selectedMonth]);

  const handleGoalChange = (vendorId: number, productId: string, value: string) => {
    setGoals(prev => ({
      ...prev,
      [vendorId]: {
        ...(prev[vendorId] || {}),
        [productId]: value
      }
    }));
  };

  const handleSave = async (vendorId: number) => {
    setSaving(prev => ({ ...prev, [vendorId]: true }));

    try {
      const vendorGoals = goals[vendorId] || {};
      const [year, month] = selectedMonth.split('-').map(Number);

      // Guardar todas las metas del vendedor
      const saves = Object.entries(vendorGoals).map(async ([productId, value]) => {
        const targetAmount = value === '' ? 0 : parseFloat(value);
        if (isNaN(targetAmount)) return;

        return authFetch('/api/goals/save', {
          method: 'POST',
          json: {
            vendor_id: vendorId,
            product_id: productId,
            period_year: year,
            period_month: month,
            target_amount: targetAmount
          }
        });
      });

      await Promise.all(saves);

      // Recargar datos
      const reloadResponse = await authFetch(`/api/goals/by-period?year=${year}&month=${month}`);
      if (reloadResponse.ok) {
        const data = await reloadResponse.json();
        const newGoals: Record<string, Record<string, string>> = {};
        
        data.forEach((goal: any) => {
          const vendorKey = `${goal.vendor_id}`;
          if (!newGoals[vendorKey]) newGoals[vendorKey] = {};
          newGoals[vendorKey][goal.product_id] = String(goal.target_amount || '');
        });
        
        setGoals(newGoals);
      }

    } catch (error) {
      console.error('Error saving goals:', error);
      alert('Error al guardar las metas');
    } finally {
      setSaving(prev => ({ ...prev, [vendorId]: false }));
    }
  };

  const getVendorTotal = (vendorId: number) => {
    const vendorGoals = goals[vendorId] || {};
    return Object.values(vendorGoals).reduce((sum, val) => {
      const num = parseFloat(val);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Target className="w-8 h-8 text-emerald-500" />
            Configurar Metas
          </h1>
          <p className="text-slate-400 mt-1">
            Asigna metas mensuales por vendedor y producto
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Vendor Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {vendors?.map((vendor) => {
          const total = getVendorTotal(vendor.id);
          
          return (
            <div
              key={vendor.id}
              className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden"
            >
              {/* Vendor Header */}
              <div className="bg-gradient-to-r from-emerald-600/20 to-blue-600/20 border-b border-slate-700 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-lg">
                      {vendor.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {vendor.name}
                      </h2>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">
                      Total Meta
                    </p>
                    <p className="text-2xl font-black text-emerald-400">
                      ${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Products List */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {products?.map((product) => {
                    const value = goals[vendor.id]?.[product.id] || '';

                    return (
                      <div
                        key={product.id}
                        className="flex flex-col gap-2 bg-slate-900/50 rounded-lg p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-white font-semibold truncate text-sm">
                            {product.name}
                          </p>
                          {product.category_name && (
                            <p className="text-xs text-slate-500">
                              {product.category_name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-sm">$</span>
                          <input
                            type="number"
                            value={value}
                            onChange={(e) => handleGoalChange(vendor.id, product.id, e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            className="flex-1 bg-slate-800 border border-slate-600 text-white rounded px-3 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Botón Guardar Todo */}
                <button
                  onClick={() => handleSave(vendor.id)}
                  disabled={saving[vendor.id]}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {saving[vendor.id] ? 'Guardando...' : 'Guardar Metas'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
