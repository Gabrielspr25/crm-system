import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Search, Edit, Trash2, Target, TrendingUp, Package, Building } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

interface Goal {
  id: number;
  vendor_id: number | null;
  vendor_name: string | null;
  product_id: number | null;
  product_name: string | null;
  period_type: string;
  period_year: number;
  period_month: number | null;
  period_quarter: number | null;
  target_amount: number;
  current_amount: number;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface ProductGoal {
  id: number;
  product_id: number;
  product_name: string;
  product_description: string | null;
  period_year: number;
  period_month: number;
  total_target_amount: number;
  current_amount: number;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface Vendor {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  category_name: string | null;
}

interface MeResponse {
  userId: string | number | null;
  username: string;
  salespersonId: string | number | null;
  salespersonName: string | null;
  role: string;
}

type AggregatedMeta = {
  key: string;
  productId: number;
  productName: string;
  periodYear: number;
  periodMonth: number | null;
  periodLabel: string;
  businessTarget: number;
  businessCurrent: number;
  businessGoal: ProductGoal | null;
  vendorTarget: number;
  vendorCurrent: number;
  vendorGoals: Goal[];
  gapTarget: number;
};

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function formatPeriod(year: number, month: number | null): string {
  if (month && month >= 1 && month <= 12) {
    return `${monthNames[month - 1]} ${year}`;
  }
  return `${year}`;
}

export default function Goals() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [formMode, setFormMode] = useState<"business" | "vendor">("business");
  const [editingBusinessGoal, setEditingBusinessGoal] = useState<ProductGoal | null>(null);
  const [editingVendorGoal, setEditingVendorGoal] = useState<Goal | null>(null);
  
  // Bulk modal state
  const [bulkPeriodYear, setBulkPeriodYear] = useState(new Date().getFullYear());
  const [bulkPeriodMonth, setBulkPeriodMonth] = useState(new Date().getMonth() + 1);
  const [bulkEntries, setBulkEntries] = useState<Record<number, string>>({});
  const [bulkVendorEntries, setBulkVendorEntries] = useState<Record<string, string>>({});
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [savingBulk, setSavingBulk] = useState(false);

  const [formData, setFormData] = useState({
    vendor_id: "",
    product_id: "",
    period_type: "monthly",
    period_year: new Date().getFullYear(),
    period_month: new Date().getMonth() + 1,
    period_quarter: 1,
    target_amount: "",
    description: "",
  });

  // API calls
  const { data: me } = useApi<MeResponse>("/api/me");
  const { data: goals, loading: goalsLoading, refetch: refetchGoals } = useApi<Goal[]>("/api/goals");
  const { data: productGoals, loading: productGoalsLoading, refetch: refetchProductGoals } = useApi<ProductGoal[]>("/api/product-goals");
  const { data: vendors } = useApi<Vendor[]>("/api/vendors");
  const { data: products, loading: productsLoading, refetch: refetchProducts } = useApi<Product[]>("/api/products");

  // User info
  const currentUser = useMemo(() => getCurrentUser(), []);
  const combinedUser = useMemo(() => {
    if (me) return me;
    return currentUser;
  }, [me, currentUser]);
  
  const isVendorUser = (combinedUser?.role ?? "").toLowerCase() === "vendedor";

  // Check token on mount
  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (!token && !window.location.pathname.includes('/login')) {
      console.warn("⚠️ No hay token. Redirigiendo al login...");
      window.location.href = '/login';
    }
  }, []);

  // Listen for updates
  useEffect(() => {
    const handleProductsUpdate = () => refetchProducts();
    const handleCategoriesUpdate = () => refetchProducts();
    window.addEventListener('products-updated', handleProductsUpdate);
    window.addEventListener('categories-updated', handleCategoriesUpdate);
    return () => {
      window.removeEventListener('products-updated', handleProductsUpdate);
      window.removeEventListener('categories-updated', handleCategoriesUpdate);
    };
  }, [refetchProducts]);

  // Aggregate metas
  const aggregatedMetas: AggregatedMeta[] = useMemo(() => {
    const businessMap = new Map<string, ProductGoal>();
    (productGoals || []).forEach((goal) => {
      const key = `${goal.product_id}|${goal.period_year}|${goal.period_month}`;
      businessMap.set(key, goal);
    });

    const vendorMap = new Map<string, Goal[]>();
    (goals || []).forEach((goal) => {
      if (!goal.product_id || !goal.vendor_id) return;
      const month = goal.period_month ?? 0;
      const key = `${goal.product_id}|${goal.period_year}|${month}`;
      const list = vendorMap.get(key) || [];
      list.push(goal);
      vendorMap.set(key, list);
    });

    const keys = new Set<string>([...businessMap.keys(), ...vendorMap.keys()]);
    return Array.from(keys).map((key) => {
      const [productIdRaw, yearRaw, monthRaw] = key.split("|");
      const productId = Number(productIdRaw);
      const periodYear = Number(yearRaw);
      const periodMonth = monthRaw === "0" ? null : Number(monthRaw);

      const businessGoal = businessMap.get(key) ?? null;
      const vendorGoalsList = vendorMap.get(key) ?? [];

      const vendorTarget = vendorGoalsList.reduce((sum, goal) => sum + goal.target_amount, 0);
      const vendorCurrent = vendorGoalsList.reduce((sum, goal) => sum + goal.current_amount, 0);
      const businessTarget = businessGoal?.total_target_amount ?? vendorTarget;
      const businessCurrent = businessGoal?.current_amount ?? vendorCurrent;

      const fallbackProductName =
        businessGoal?.product_name ||
        vendorGoalsList[0]?.product_name ||
        products?.find((prod) => prod.id === productId)?.name ||
        "Producto";

      return {
        key,
        productId,
        productName: fallbackProductName,
        periodYear,
        periodMonth,
        periodLabel: formatPeriod(periodYear, periodMonth),
        businessTarget,
        businessCurrent,
        businessGoal,
        vendorTarget,
        vendorCurrent,
        vendorGoals: vendorGoalsList,
        gapTarget: businessTarget - vendorTarget,
      };
    });
  }, [goals, productGoals, products]);

  // Filter metas for vendor users
  const scopedMetas = useMemo(() => {
    if (!isVendorUser) return aggregatedMetas;
    return aggregatedMetas.filter((meta) => 
      meta.vendorGoals.some((goal) => {
        const vendorId = combinedUser?.salespersonId;
        if (vendorId != null && goal.vendor_id === vendorId) return true;
        const username = (combinedUser?.username ?? "").toLowerCase();
        const vendorName = (goal.vendor_name ?? "").toLowerCase();
        return vendorName === username;
      })
    );
  }, [aggregatedMetas, isVendorUser, combinedUser]);

  // Filter by search
  const filteredMetas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return scopedMetas;
    return scopedMetas.filter((meta) => {
      if (meta.productName.toLowerCase().includes(term)) return true;
      return meta.vendorGoals.some((goal) => goal.vendor_name?.toLowerCase().includes(term));
    });
  }, [scopedMetas, searchTerm]);

  // Totals
  const totals = useMemo(() => {
    const businessTarget = scopedMetas.reduce((sum, meta) => sum + meta.businessTarget, 0);
    const businessCurrent = scopedMetas.reduce((sum, meta) => sum + meta.businessCurrent, 0);
    const vendorTarget = scopedMetas.reduce((sum, meta) => sum + meta.vendorTarget, 0);
    const vendorCurrent = scopedMetas.reduce((sum, meta) => sum + meta.vendorCurrent, 0);
    const gapTarget = businessTarget - vendorTarget;

    return {
      businessTarget,
      businessCurrent,
      vendorTarget,
      vendorCurrent,
      gapTarget,
      businessProgress: businessTarget > 0 ? (businessCurrent / businessTarget) * 100 : 0,
      vendorCoverage: businessTarget > 0 ? (vendorTarget / businessTarget) * 100 : 0,
      vendorProgress: vendorTarget > 0 ? (vendorCurrent / vendorTarget) * 100 : 0,
    };
  }, [scopedMetas]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormData({
      vendor_id: "",
      product_id: "",
      period_type: "monthly",
      period_year: new Date().getFullYear(),
      period_month: new Date().getMonth() + 1,
      period_quarter: 1,
      target_amount: "",
      description: "",
    });
    setEditingBusinessGoal(null);
    setEditingVendorGoal(null);
  }, []);

  // Submit business goal
  const handleSubmitBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id) {
      alert("Selecciona un producto.");
      return;
    }

    try {
    const payload = {
        product_id: Number(formData.product_id),
      period_year: formData.period_year,
      period_month: formData.period_month,
        total_target_amount: Number(formData.target_amount),
      description: formData.description || null,
    };

      if (editingBusinessGoal) {
        await authFetch(`/api/product-goals/${editingBusinessGoal.id}`, {
          method: "PUT",
          json: payload,
        });
      } else {
        await authFetch("/api/product-goals", {
          method: "POST",
          json: payload,
        });
      }

      setShowModal(false);
      resetForm();
      refetchProductGoals();
    } catch (error) {
      console.error("Error guardando meta de negocio:", error);
      alert("No fue posible guardar la meta de negocio.");
    }
  };

  // Submit vendor goal
  const handleSubmitVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_id || !formData.product_id) {
      alert("Selecciona vendedor y producto.");
      return;
    }

    try {
    const payload = {
        vendor_id: Number(formData.vendor_id),
        product_id: Number(formData.product_id),
      period_type: formData.period_type,
      period_year: formData.period_year,
      period_month: formData.period_type === "monthly" ? formData.period_month : null,
      period_quarter: formData.period_type === "quarterly" ? formData.period_quarter : null,
        target_amount: Number(formData.target_amount),
      description: formData.description || null,
    };

      if (editingVendorGoal) {
        await authFetch(`/api/goals/${editingVendorGoal.id}`, {
          method: "PUT",
          json: payload,
        });
      } else {
        await authFetch("/api/goals", {
          method: "POST",
          json: payload,
        });
      }

      setShowModal(false);
      resetForm();
      refetchGoals();
    } catch (error) {
      console.error("Error guardando meta de vendedor:", error);
      alert("No fue posible guardar la meta del vendedor.");
    }
  };

  // Delete business goal
  const handleDeleteBusiness = async (goal: ProductGoal) => {
    if (!confirm(`¿Eliminar meta del producto ${goal.product_name}?`)) return;
    try {
      await authFetch(`/api/product-goals/${goal.id}`, { method: "DELETE" });
      refetchProductGoals();
    } catch (error) {
      console.error("Error eliminando meta de negocio:", error);
      alert("No fue posible eliminar la meta de negocio.");
    }
  };

  // Delete vendor goal
  const handleDeleteVendor = async (goal: Goal) => {
    if (!confirm(`¿Eliminar meta del vendedor ${goal.vendor_name}?`)) return;
    try {
      await authFetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      refetchGoals();
    } catch (error) {
      console.error("Error eliminando meta de vendedor:", error);
      alert("No fue posible eliminar la meta del vendedor.");
    }
  };

  // Bulk modal functions
  const openBulkModal = useCallback(() => {
    const now = new Date();
    setBulkPeriodYear(now.getFullYear());
    setBulkPeriodMonth(now.getMonth() + 1);
    setShowBulkModal(true);
  }, []);

  const closeBulkModal = useCallback(() => {
    setShowBulkModal(false);
    setBulkEntries({});
    setBulkVendorEntries({});
    setExpandedProducts(new Set());
  }, []);

  const initializeBulkAssignments = useCallback(() => {
    const entries: Record<number, string> = {};
    const vendorEntries: Record<string, string> = {};

    (products || []).forEach((product) => {
      const existing = (productGoals || []).find(
        (g) =>
          g.product_id === product.id &&
          g.period_year === bulkPeriodYear &&
          g.period_month === bulkPeriodMonth
      );
      entries[product.id] = existing ? existing.total_target_amount.toString() : "";

      (goals || []).forEach((goal) => {
        if (
          goal.product_id === product.id &&
          goal.period_year === bulkPeriodYear &&
          goal.period_month === bulkPeriodMonth &&
          goal.vendor_id
        ) {
          const key = `${product.id}_${goal.vendor_id}`;
          vendorEntries[key] = goal.target_amount.toString();
        }
      });
    });

    setBulkEntries(entries);
    setBulkVendorEntries(vendorEntries);
  }, [products, productGoals, goals, bulkPeriodYear, bulkPeriodMonth]);

  useEffect(() => {
    if (showBulkModal && products && vendors) {
      initializeBulkAssignments();
    }
  }, [showBulkModal, products, vendors, initializeBulkAssignments]);

  const handleBulkValueChange = useCallback((productId: number, value: string) => {
    setBulkEntries((prev) => ({ ...prev, [productId]: value }));
  }, []);

  const handleBulkVendorValueChange = useCallback((productId: number, vendorId: number, value: string) => {
    const key = `${productId}_${vendorId}`;
    setBulkVendorEntries((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleProductExpansion = useCallback((productId: number) => {
    setExpandedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  }, []);

  const handleSaveBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBulk(true);

    try {
      // Business goals
      const businessGoals = Object.entries(bulkEntries)
        .map(([productId, value]) => {
          const amount = Number((value || "").replace(/[$,\s]/g, ""));
          if (!Number.isFinite(amount) || amount <= 0) return null;
        return {
            product_id: Number(productId),
          total_target_amount: amount,
        };
      })
        .filter((g): g is { product_id: number; total_target_amount: number } => g !== null);

      if (businessGoals.length > 0) {
        await authFetch("/api/product-goals/bulk", {
        method: "POST",
        json: {
          period_type: "monthly",
          period_year: bulkPeriodYear,
          period_month: bulkPeriodMonth,
            goals: businessGoals,
        },
      });
      }

      // Vendor goals
      for (const [key, value] of Object.entries(bulkVendorEntries)) {
        const amount = Number((value || "").replace(/[$,\s]/g, ""));
        if (!Number.isFinite(amount) || amount <= 0) continue;

        const [productId, vendorId] = key.split("_").map(Number);
        const existingGoal = goals?.find(
          (g) =>
            g.vendor_id === vendorId &&
            g.product_id === productId &&
            g.period_year === bulkPeriodYear &&
            g.period_month === bulkPeriodMonth
        );

        const payload = {
          vendor_id: vendorId,
          product_id: productId,
          period_type: "monthly",
          period_year: bulkPeriodYear,
          period_month: bulkPeriodMonth,
          period_quarter: null,
          target_amount: amount,
          description: null,
        };

        if (existingGoal) {
          await authFetch(`/api/goals/${existingGoal.id}`, {
            method: "PUT",
            json: payload,
          });
        } else {
          await authFetch("/api/goals", {
            method: "POST",
            json: payload,
          });
        }
      }

      closeBulkModal();
      refetchProductGoals();
      refetchGoals();
    } catch (error) {
      console.error("Error guardando metas masivas:", error);
      alert("No fue posible guardar las metas.");
    } finally {
      setSavingBulk(false);
    }
  };

  if (goalsLoading || productGoalsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-white">Cargando metas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Target className="w-8 h-8 text-purple-400" />
            Configuración de Metas
          </h1>
          <p className="text-slate-400 mt-2">
            {isVendorUser
              ? "Visualiza y gestiona tus metas asignadas por producto y período."
              : "Configura las metas del negocio y asigna metas individuales a los vendedores por producto y período."}
          </p>
        </div>
        {!isVendorUser && (
            <button
              onClick={openBulkModal}
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            >
            <Package className="w-5 h-5 mr-2" />
            Configurar Metas
            </button>
        )}
      </div>

      {/* Summary Cards - Diseño Profesional */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Meta de Negocio */}
        {!isVendorUser && (
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Building className="w-10 h-10 text-purple-100 opacity-80" />
                <div>
                  <p className="text-sm text-purple-100 font-medium">Meta Negocio</p>
                  <h3 className="text-3xl font-bold text-white">${(totals.businessTarget / 1000).toFixed(1)}K</h3>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-purple-100">Ventas actuales</span>
                <span className="text-white font-semibold">${(totals.businessCurrent / 1000).toFixed(1)}K</span>
              </div>
              <div className="w-full bg-purple-800/40 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-white h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(totals.businessProgress, 100)}%` }}
                />
              </div>
              <div className="text-right">
                <span className="text-xs text-purple-100 font-semibold">
                  {totals.businessProgress.toFixed(1)}% completado
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Meta de Vendedores */}
        <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Target className="w-10 h-10 text-blue-100 opacity-80" />
              <div>
                <p className="text-sm text-blue-100 font-medium">
                  {isVendorUser ? "Mis Metas" : "Meta Vendedores"}
                </p>
                <h3 className="text-3xl font-bold text-white">${(totals.vendorTarget / 1000).toFixed(1)}K</h3>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-blue-100">Ventas logradas</span>
              <span className="text-white font-semibold">${(totals.vendorCurrent / 1000).toFixed(1)}K</span>
            </div>
            <div className="w-full bg-blue-800/40 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-white h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(totals.vendorProgress, 100)}%` }}
              />
            </div>
            <div className="text-right">
              <span className="text-xs text-blue-100 font-semibold">
                {totals.vendorProgress.toFixed(1)}% completado
              </span>
            </div>
          </div>
        </div>

        {/* Ventas Actuales */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-10 h-10 text-green-100 opacity-80" />
              <div>
                <p className="text-sm text-green-100 font-medium">
                  {isVendorUser ? "Mis Ventas" : "Ventas Totales"}
                </p>
                <h3 className="text-3xl font-bold text-white">
                  ${((isVendorUser ? totals.vendorCurrent : totals.businessCurrent) / 1000).toFixed(1)}K
                </h3>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-green-100">Del objetivo</span>
              <span className="text-white font-semibold">
                ${((isVendorUser ? totals.vendorTarget : totals.businessTarget) / 1000).toFixed(1)}K
              </span>
            </div>
            <div className="w-full bg-green-800/40 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-white h-2.5 rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(
                    isVendorUser ? totals.vendorProgress : totals.businessProgress,
                    100
                  )}%`
                }}
              />
            </div>
            <div className="text-right">
              <span className="text-xs text-green-100 font-semibold">
                {isVendorUser ? totals.vendorProgress.toFixed(1) : totals.businessProgress.toFixed(1)}% completado
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
        <label className="block text-sm font-medium text-gray-300 mb-2">Buscar</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Producto o vendedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </div>      {/* Table */}
      {filteredMetas.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 text-center py-20">
          <Target className="mx-auto h-16 w-16 text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-white">No hay metas configuradas</h3>
          <p className="mt-2 text-sm text-gray-400">
            {isVendorUser
              ? "No tienes metas asignadas aún."
              : "Crea una meta de negocio y luego asigna las metas individuales a los vendedores."}
          </p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-900 to-gray-800 border-b-2 border-gray-700">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-200 uppercase tracking-wider">Producto</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-200 uppercase tracking-wider">Período</th>
                      {!isVendorUser && (
                        <>
                      <th className="px-4 py-4 text-right text-xs font-bold text-purple-300 uppercase tracking-wider">Meta Negocio</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-200 uppercase tracking-wider">Ventas Actual</th>
                      <th className="px-4 py-4 text-center text-xs font-bold text-gray-200 uppercase tracking-wider">Progreso</th>
                        </>
                      )}
                  <th className="px-4 py-4 text-right text-xs font-bold text-blue-300 uppercase tracking-wider">
                    {isVendorUser ? "Mi Meta" : "Suma Vendedores"}
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-bold text-gray-200 uppercase tracking-wider">
                    {isVendorUser ? "Ventas" : "Ventas Vend."}
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-bold text-gray-200 uppercase tracking-wider">Progreso</th>
                      {!isVendorUser && (
                    <th className="px-4 py-4 text-right text-xs font-bold text-orange-300 uppercase tracking-wider">Sin Asignar</th>
                  )}
                  <th className="px-4 py-4 text-center text-xs font-bold text-gray-200 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredMetas.map((meta) => {
                  const businessProgress = meta.businessTarget > 0 ? (meta.businessCurrent / meta.businessTarget) * 100 : 0;
                  const vendorGoalsForRow = isVendorUser
                    ? meta.vendorGoals.filter((g) => {
                        const vendorId = combinedUser?.salespersonId;
                        if (vendorId != null && g.vendor_id === vendorId) return true;
                        const username = (combinedUser?.username ?? "").toLowerCase();
                        const vendorName = (g.vendor_name ?? "").toLowerCase();
                        return vendorName === username;
                      })
                    : meta.vendorGoals;
                  const vendorTargetForRow = vendorGoalsForRow.reduce((sum, g) => sum + g.target_amount, 0);
                  const vendorCurrentForRow = vendorGoalsForRow.reduce((sum, g) => sum + g.current_amount, 0);
                  const vendorProgress = vendorTargetForRow > 0 ? (vendorCurrentForRow / vendorTargetForRow) * 100 : 0;

                  return (
                    <tr key={meta.key} className="hover:bg-gray-700/30 transition-all">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Package className="w-5 h-5 text-blue-400" />
                          <span className="text-sm font-semibold text-white">{meta.productName}</span>
                          </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-300 font-medium">{meta.periodLabel}</span>
                      </td>
                      {!isVendorUser && (
                        <>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <span className="text-sm font-bold text-purple-400 font-mono">${meta.businessTarget.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <span className="text-sm text-gray-300 font-mono">${meta.businessCurrent.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3 justify-center">
                              <div className="w-24 h-2.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                  className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all"
                              style={{ width: `${Math.min(businessProgress, 100)}%` }}
                            />
                          </div>
                              <span className="text-xs text-gray-400 font-semibold">{Math.round(businessProgress)}%</span>
                          </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-bold text-blue-400 font-mono">${vendorTargetForRow.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-300 font-mono">${vendorCurrentForRow.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3 justify-center">
                          <div className="w-24 h-2.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
                              style={{ width: `${Math.min(vendorProgress, 100)}%` }}
                          />
                        </div>
                          <span className="text-xs text-gray-400 font-semibold">{Math.round(vendorProgress)}%</span>
                        </div>
                      </td>
                      {!isVendorUser && (
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <span className={`text-sm font-bold font-mono ${meta.gapTarget <= 0 ? "text-green-400" : "text-orange-400"}`}>
                            ${meta.gapTarget.toLocaleString()}
                          </span>
                        </td>
                        )}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                      {!isVendorUser && (
                            <>
                        <button
                                className="p-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:text-purple-200 transition-all"
                          onClick={() => {
                                  setEditingBusinessGoal(meta.businessGoal ?? null);
                                  setEditingVendorGoal(null);
                                  setFormMode("business");
                                  if (meta.businessGoal) {
                                    setFormData({
                                      vendor_id: "",
                                      product_id: meta.businessGoal.product_id.toString(),
                                      period_type: "monthly",
                                      period_year: meta.businessGoal.period_year,
                                      period_month: meta.businessGoal.period_month,
                                      period_quarter: 1,
                                      target_amount: meta.businessGoal.total_target_amount.toString(),
                                      description: meta.businessGoal.description || "",
                            });
                                  } else {
                                    setFormData({
                              vendor_id: "",
                                      product_id: meta.productId.toString(),
                                      period_type: "monthly",
                                      period_year: meta.periodYear,
                                      period_month: meta.periodMonth ?? new Date().getMonth() + 1,
                                      period_quarter: 1,
                              target_amount: "",
                              description: "",
                            });
                                  }
                                  setShowModal(true);
                          }}
                                title="Configurar meta de negocio"
                        >
                                <Building className="w-4 h-4" />
                        </button>
                              {meta.businessGoal && (
                                <button
                                  className="p-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 hover:text-red-200 transition-all"
                                  onClick={() => handleDeleteBusiness(meta.businessGoal!)}
                                  title="Eliminar meta de negocio"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                          <button
                                className="p-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 hover:text-green-200 transition-all"
                            onClick={() => {
                                  setEditingBusinessGoal(null);
                                  setEditingVendorGoal(null);
                                  setFormMode("vendor");
                                  setFormData({
                                vendor_id: "",
                                    product_id: meta.productId.toString(),
                                    period_type: "monthly",
                                    period_year: meta.periodYear,
                                    period_month: meta.periodMonth ?? new Date().getMonth() + 1,
                                    period_quarter: 1,
                                target_amount: "",
                                description: "",
                              });
                                  setShowModal(true);
                            }}
                                title="Agregar meta de vendedor"
                          >
                                <Plus className="w-4 h-4" />
                          </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expandable vendor list */}
          {filteredMetas.map((meta) => {
            const vendorGoalsForList = isVendorUser
              ? meta.vendorGoals.filter((g) => {
                  const vendorId = combinedUser?.salespersonId;
                  if (vendorId != null && g.vendor_id === vendorId) return true;
                  const username = (combinedUser?.username ?? "").toLowerCase();
                  const vendorName = (g.vendor_name ?? "").toLowerCase();
                  return vendorName === username;
                })
              : meta.vendorGoals;
            
            if (vendorGoalsForList.length === 0) return null;

            return (
              <div key={`vendors-${meta.key}`} className="border-t border-gray-700">
                <details className="group">
                  <summary className="px-6 py-3 cursor-pointer flex items-center justify-between bg-gray-800/50 hover:bg-gray-700/50 transition-all">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-blue-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <Package className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold text-white">{meta.productName}</span>
                      <span className="text-sm text-gray-400">• {meta.periodLabel}</span>
                      <span className="px-2 py-0.5 bg-blue-600/20 rounded text-xs font-medium text-blue-300">
                        {vendorGoalsForList.length}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">Click para {!vendorGoalsForList ? 'ver' : 'expandir'} detalle</span>
                  </summary>
                  
                  <div className="bg-gray-900/50">
                    <table className="w-full">
                      <thead className="bg-gray-800/80 border-y border-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-300 uppercase">Vendedor</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-gray-300 uppercase">Meta</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-gray-300 uppercase">Ventas</th>
                          <th className="px-6 py-3 text-center text-xs font-bold text-gray-300 uppercase">Progreso</th>
                          {!isVendorUser && (
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-300 uppercase">Acciones</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700/50">
                        {vendorGoalsForList.map((goal) => {
                          const vendorProgress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
                          return (
                            <tr key={goal.id} className="hover:bg-gray-800/30 transition-colors">
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                    {(goal.vendor_name || "V").charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-sm font-medium text-white">{goal.vendor_name || "Vendedor"}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3 text-right">
                                <span className="text-sm font-bold text-blue-400 font-mono">${goal.target_amount.toLocaleString()}</span>
                              </td>
                              <td className="px-6 py-3 text-right">
                                <span className="text-sm font-bold text-green-400 font-mono">${goal.current_amount.toLocaleString()}</span>
                              </td>
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-3 justify-center">
                                  <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-blue-500 to-green-400 rounded-full transition-all"
                                      style={{ width: `${Math.min(vendorProgress, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-gray-300 min-w-[3rem] text-right">{Math.round(vendorProgress)}%</span>
                                </div>
                              </td>
                              {!isVendorUser && (
                                <td className="px-6 py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      className="p-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 transition-all"
                                      onClick={() => {
                                        setEditingVendorGoal(goal);
                                        setEditingBusinessGoal(null);
                                        setFormMode("vendor");
                                        setFormData({
                                          vendor_id: goal.vendor_id?.toString() || "",
                                          product_id: goal.product_id?.toString() || "",
                                          period_type: goal.period_type || "monthly",
                                          period_year: goal.period_year,
                                          period_month: goal.period_month || new Date().getMonth() + 1,
                                          period_quarter: goal.period_quarter || 1,
                                          target_amount: goal.target_amount.toString(),
                                          description: goal.description || "",
                                        });
                                        setShowModal(true);
                                      }}
                                      title="Editar"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      className="p-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 transition-all"
                                      onClick={() => handleDeleteVendor(goal)}
                                      title="Eliminar"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}

      {/* Unified Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-blue-500/50 rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-blue-500/30 pb-4">
              <div>
              <h2 className="text-xl font-bold text-white">
                {formMode === "business"
                    ? editingBusinessGoal ? "Editar Meta del Negocio" : "Nueva Meta del Negocio"
                    : editingVendorGoal ? "Editar Meta de Vendedor" : "Nueva Meta de Vendedor"}
              </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {formMode === "business"
                    ? "Configura la meta general del negocio para este producto y período"
                    : "Asigna una meta específica a un vendedor para este producto y período"}
                </p>
              </div>
              <button
                className="text-slate-400 hover:text-white transition-colors"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={formMode === "business" ? handleSubmitBusiness : handleSubmitVendor} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Producto *</label>
                    <select
                      required
                      value={formData.product_id}
                      onChange={(e) => setFormData((prev) => ({ ...prev, product_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-blue-500/50 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Seleccionar producto</option>
                      {(products || []).map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                {formMode === "vendor" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Vendedor *</label>
                    <select
                      required
                      value={formData.vendor_id}
                      onChange={(e) => setFormData((prev) => ({ ...prev, vendor_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-blue-500/50 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Seleccionar vendedor</option>
                      {(vendors || []).map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Año *</label>
                      <input
                        type="number"
                        required
                        value={formData.period_year}
                        onChange={(e) => setFormData((prev) => ({ ...prev, period_year: parseInt(e.target.value, 10) }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-blue-500/50 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Mes *</label>
                      <select
                        required
                        value={formData.period_month}
                        onChange={(e) => setFormData((prev) => ({ ...prev, period_month: parseInt(e.target.value, 10) }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-blue-500/50 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {monthNames.map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name}
                      </option>
                        ))}
                      </select>
                    </div>
                  </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Meta ({formMode === "business" ? "Negocio" : "Vendedor"}) ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.target_amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, target_amount: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-blue-500/50 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej. 5000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Descripción (opcional)</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-blue-500/50 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Detalles o alcance de la meta"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-blue-500/30">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-slate-300 bg-slate-800 rounded-lg hover:bg-slate-700 border border-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white rounded-lg hover:shadow-lg transition-all ${
                    formMode === "business"
                      ? "bg-gradient-to-r from-blue-500 to-purple-600"
                      : "bg-gradient-to-r from-green-500 to-teal-600"
                  }`}
                >
                  {editingBusinessGoal || editingVendorGoal ? "Actualizar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-blue-500/50 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-blue-500/30 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Configuración de Metas</h2>
                <p className="text-sm text-slate-400 mt-1">Configura las metas del negocio y asigna metas a los vendedores por producto y período.</p>
              </div>
              <button
                className="text-slate-400 hover:text-white text-2xl font-bold transition-colors"
                onClick={closeBulkModal}
                type="button"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBulk} className="space-y-4 flex-1 flex flex-col overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Año</label>
                  <input
                    type="number"
                    required
                    value={bulkPeriodYear}
                    onChange={(e) => setBulkPeriodYear(Math.max(2000, parseInt(e.target.value, 10) || new Date().getFullYear()))}
                    className="w-full px-3 py-2 bg-slate-800 border border-blue-500/50 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Mes</label>
                  <select
                    required
                    value={bulkPeriodMonth}
                    onChange={(e) => setBulkPeriodMonth(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-slate-800 border border-blue-500/50 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {monthNames.map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <p className="text-xs text-slate-400">Las metas existentes del período se precargan automáticamente.</p>
                </div>
              </div>

              <div className="border-t border-blue-500/30 pt-4">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Productos y Metas
                  {products && products.length > 0 && (
                    <span className="ml-2 text-sm text-slate-400 font-normal">({products.length} productos)</span>
                  )}
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2 min-h-[400px]">
                {productsLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-3"></div>
                    <p className="text-sm text-slate-400">Cargando productos...</p>
                  </div>
                ) : !products || products.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-blue-500/30 rounded-lg">
                    <Package className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-300 mb-1">No hay productos disponibles</p>
                    <p className="text-xs text-slate-500">Crea productos primero en la sección de Productos</p>
                  </div>
                ) : (
                  products.map((product) => {
                    const existingGoal = (productGoals || []).find(
                      (g) =>
                        g.product_id === product.id &&
                        g.period_year === bulkPeriodYear &&
                        g.period_month === bulkPeriodMonth
                    );
                  const value = bulkEntries[product.id] ?? "";
                    const businessTarget = value ? Number(value.replace(/[$,\s]/g, "")) : (existingGoal?.total_target_amount ?? 0);
                    const businessCurrent = existingGoal?.current_amount ?? 0;
                    const businessProgress = businessTarget > 0 ? (businessCurrent / businessTarget) * 100 : 0;
                    const isExpanded = expandedProducts.has(product.id);

                    const productVendorGoals = (goals || []).filter(
                      (g) =>
                        g.product_id === product.id &&
                        g.period_year === bulkPeriodYear &&
                        g.period_month === bulkPeriodMonth &&
                        g.vendor_id
                    );
                    const vendorTotal = productVendorGoals.reduce((sum, g) => sum + (g.target_amount || 0), 0);
                    const coverage = businessTarget > 0 ? (vendorTotal / businessTarget) * 100 : 0;

                  return (
                      <div key={product.id} className="bg-slate-800/70 border border-blue-500/30 rounded-lg overflow-hidden">
                        <div className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-slate-800/90 transition-colors">
                          <div className="col-span-12 md:col-span-3">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-blue-400" />
                      <div>
                        <p className="text-sm font-semibold text-white">{product.name}</p>
                        <p className="text-xs text-slate-400">{product.category_name || "Sin categoría"}</p>
                      </div>
                            </div>
                          </div>

                          <div className="col-span-6 md:col-span-2">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Meta Negocio ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={value}
                          onChange={(e) => handleBulkValueChange(product.id, e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-blue-500/50 text-white rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0"
                        />
                      </div>

                          <div className="col-span-6 md:col-span-2">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">Progreso</span>
                                <span className="text-white font-medium">{Math.round(businessProgress)}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden border border-blue-500/20">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(businessProgress, 100)}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>Actual: ${businessCurrent.toLocaleString()}</span>
                                <span>Meta: ${businessTarget.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="col-span-6 md:col-span-2">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">Cobertura</span>
                                <span className="text-green-300 font-medium">{Math.round(coverage)}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden border border-green-500/20">
                                <div
                                  className="h-full bg-gradient-to-r from-green-500 to-teal-600 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(coverage, 100)}%` }}
                                />
                              </div>
                              <div className="text-xs text-slate-400">
                                Vendedores: ${vendorTotal.toLocaleString()}
                              </div>
                            </div>
                          </div>

                          <div className="col-span-12 md:col-span-3 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => toggleProductExpansion(product.id)}
                              className="px-3 py-1.5 text-xs font-medium text-blue-300 bg-blue-500/20 border border-blue-500/50 rounded hover:bg-blue-500/30 transition-colors"
                            >
                              {isExpanded ? "Ocultar vendedores ▲" : "Ver vendedores ▼"}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-blue-500/20 bg-slate-900/50 p-4 space-y-2">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Vendedores</h4>
                              <select
                                onChange={(e) => {
                                  const vendorId = Number(e.target.value);
                                  if (vendorId) {
                                    const key = `${product.id}_${vendorId}`;
                                    const existingVendorGoal = productVendorGoals.find((g) => g.vendor_id === vendorId);
                                    if (!(key in bulkVendorEntries) && !existingVendorGoal) {
                                      handleBulkVendorValueChange(product.id, vendorId, "");
                                      if (!expandedProducts.has(product.id)) {
                                        toggleProductExpansion(product.id);
                                      }
                                    }
                                  }
                                  e.currentTarget.value = "";
                                }}
                                className="text-xs bg-slate-800 border border-green-500/50 text-green-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-500"
                              >
                                <option value="">+ Agregar vendedor</option>
                                {(vendors || [])
                                  .filter((vendor) => {
                                    const key = `${product.id}_${vendor.id}`;
                                    return !(key in bulkVendorEntries) && !productVendorGoals.find((g) => g.vendor_id === vendor.id);
                                  })
                                  .map((vendor) => (
                                    <option key={vendor.id} value={vendor.id}>
                                      {vendor.name}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div className="space-y-2">
                              {(() => {
                                const vendorsToShow = (vendors || []).filter((vendor) => {
                                  const key = `${product.id}_${vendor.id}`;
                                  return key in bulkVendorEntries || productVendorGoals.find((g) => g.vendor_id === vendor.id);
                                });

                                if (vendorsToShow.length === 0) {
                                  return (
                                    <div className="text-center py-4 text-sm text-slate-400">
                                      <p>No hay vendedores asignados. Selecciona uno del dropdown arriba.</p>
                    </div>
                  );
                                }

                                return vendorsToShow.map((vendor) => {
                                  const key = `${product.id}_${vendor.id}`;
                                  const vendorValue = bulkVendorEntries[key] ?? "";
                                  const existingVendorGoal = productVendorGoals.find((g) => g.vendor_id === vendor.id);
                                  const vendorTarget = vendorValue
                                    ? Number(vendorValue.replace(/[$,\s]/g, ""))
                                    : (existingVendorGoal?.target_amount ?? 0);
                                  const vendorCurrent = existingVendorGoal?.current_amount ?? 0;
                                  const vendorProgress = vendorTarget > 0 ? (vendorCurrent / vendorTarget) * 100 : 0;

                                  return (
                                    <div key={vendor.id} className="bg-slate-800/70 border border-green-500/20 rounded-lg p-3 grid grid-cols-12 gap-3 items-center">
                                      <div className="col-span-12 md:col-span-2">
                                        <p className="text-sm font-medium text-white">{vendor.name}</p>
                                      </div>

                                      <div className="col-span-6 md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Meta ($)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={vendorValue}
                                          onChange={(e) => handleBulkVendorValueChange(product.id, vendor.id, e.target.value)}
                                          className="w-full px-2 py-1.5 bg-slate-900 border border-green-500/50 text-white rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                          placeholder="0"
                                        />
                                      </div>

                                      <div className="col-span-6 md:col-span-4">
                                        <div className="space-y-1">
                                          <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">Progreso</span>
                                            <span className="text-green-300 font-medium">{Math.round(vendorProgress)}%</span>
                                          </div>
                                          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden border border-green-500/20">
                                            <div
                                              className="h-full bg-gradient-to-r from-green-400 to-teal-500 rounded-full transition-all duration-300"
                                              style={{ width: `${Math.min(vendorProgress, 100)}%` }}
                                            />
                                          </div>
                                          <div className="flex items-center justify-between text-xs text-slate-400">
                                            <span>Actual: ${vendorCurrent.toLocaleString()}</span>
                                            <span>Meta: ${vendorTarget.toLocaleString()}</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="col-span-12 md:col-span-4 flex items-center justify-end">
                                        {existingVendorGoal && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              if (confirm(`¿Eliminar meta del vendedor ${vendor.name}?`)) {
                                                try {
                                                  await authFetch(`/api/goals/${existingVendorGoal.id}`, { method: "DELETE" });
                                                  const newKey = `${product.id}_${vendor.id}`;
                                                  setBulkVendorEntries((prev) => {
                                                    const updated = { ...prev };
                                                    delete updated[newKey];
                                                    return updated;
                                                  });
                                                  refetchGoals();
                                                } catch (error) {
                                                  console.error("Error eliminando meta:", error);
                                                  alert("No fue posible eliminar la meta.");
                                                }
                                              }
                                            }}
                                            className="px-2 py-1 text-xs text-red-300 bg-red-500/20 border border-red-500/50 rounded hover:bg-red-500/30 transition-colors"
                                          >
                                            Eliminar
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeBulkModal}
                  className="px-4 py-2 text-slate-300 bg-slate-800 rounded-lg hover:bg-slate-700 border border-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBulk}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingBulk ? "Guardando..." : "Guardar metas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
