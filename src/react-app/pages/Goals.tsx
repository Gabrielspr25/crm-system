import { useState } from "react";
import { Plus, Search, Edit, Trash2, Target, TrendingUp, DollarSign, Package, Building, Users } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";

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
  product_description: string;
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

export default function Goals() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editingProductGoal, setEditingProductGoal] = useState<ProductGoal | null>(null);
  const [selectedProductGoal, setSelectedProductGoal] = useState<ProductGoal | null>(null);
  const [goalType, setGoalType] = useState<"general" | "product">("general");
  
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

  const [vendorAssignments, setVendorAssignments] = useState<Array<{
    vendor_id: number;
    assigned_amount: number;
    notes: string;
  }>>([]);

  const { data: goals, loading: goalsLoading, refetch: refetchGoals } = useApi<Goal[]>("/api/goals");
  const { data: productGoals, loading: productGoalsLoading, refetch: refetchProductGoals } = useApi<ProductGoal[]>("/api/product-goals");
  const { data: vendors } = useApi<Vendor[]>("/api/vendors");
  const { data: products } = useApi<Product[]>("/api/products");

  // Calculate totals
  const totalGeneralTarget = (goals || []).reduce((sum, goal) => sum + goal.target_amount, 0);
  const totalGeneralCurrent = (goals || []).reduce((sum, goal) => sum + goal.current_amount, 0);
  const totalProductTarget = (productGoals || []).reduce((sum, goal) => sum + goal.total_target_amount, 0);
  const totalProductCurrent = (productGoals || []).reduce((sum, goal) => sum + goal.current_amount, 0);
  const totalStoreTarget = totalGeneralTarget + totalProductTarget;
  const totalStoreCurrent = totalGeneralCurrent + totalProductCurrent;

  const filteredGoals = (goals || []).filter(goal =>
    (goal.description && goal.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (goal.vendor_name && goal.vendor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (goal.product_name && goal.product_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredProductGoals = (productGoals || []).filter(goal =>
    (goal.product_name && goal.product_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (goal.description && goal.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmitGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        vendor_id: formData.vendor_id ? parseInt(formData.vendor_id) : null,
        product_id: formData.product_id ? parseInt(formData.product_id) : null,
        target_amount: parseFloat(formData.target_amount),
        period_month: formData.period_type === "monthly" ? formData.period_month : null,
        period_quarter: formData.period_type === "quarterly" ? formData.period_quarter : null,
      };

      if (editingGoal) {
        await authFetch(`/api/goals/${editingGoal.id}`, {
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
      setEditingGoal(null);
      resetForm();
      refetchGoals();
    } catch (error) {
      console.error("Error saving general goal:", error);
    }
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        product_id: parseInt(formData.product_id),
        period_year: formData.period_year,
        period_month: formData.period_month,
        total_target_amount: parseFloat(formData.target_amount),
        description: formData.description || null,
      };

      if (editingProductGoal) {
        await authFetch(`/api/product-goals/${editingProductGoal.id}`, {
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
      setEditingProductGoal(null);
      resetForm();
      refetchProductGoals();
    } catch (error) {
      console.error("Error saving product goal:", error);
    }
  };

  const handleAssignVendors = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProductGoal) return;
    
    try {
      await authFetch(`/api/product-goals/${selectedProductGoal.id}/assign-vendors`, {
        method: "POST",
        json: { assignments: vendorAssignments },
      });

      setShowAssignModal(false);
      setSelectedProductGoal(null);
      setVendorAssignments([]);
      refetchProductGoals();
    } catch (error) {
      console.error("Error assigning vendors:", error);
    }
  };

  const handleEditGeneral = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalType("general");
    setFormData({
      vendor_id: goal.vendor_id ? goal.vendor_id.toString() : "",
      product_id: goal.product_id ? goal.product_id.toString() : "",
      period_type: goal.period_type,
      period_year: goal.period_year,
      period_month: goal.period_month || new Date().getMonth() + 1,
      period_quarter: goal.period_quarter || 1,
      target_amount: goal.target_amount.toString(),
      description: goal.description || "",
    });
    setShowModal(true);
  };

  const handleEditProduct = (goal: ProductGoal) => {
    setEditingProductGoal(goal);
    setGoalType("product");
    setFormData({
      vendor_id: "",
      product_id: goal.product_id.toString(),
      period_type: "monthly",
      period_year: goal.period_year,
      period_month: goal.period_month,
      period_quarter: 1,
      target_amount: goal.total_target_amount.toString(),
      description: goal.description || "",
    });
    setShowModal(true);
  };

  const handleDeleteGeneral = async (goal: Goal) => {
    if (!confirm(`¿Está seguro de eliminar esta meta?`)) return;

    try {
      await authFetch(`/api/goals/${goal.id}`, {
        method: "DELETE",
      });
      refetchGoals();
    } catch (error) {
      console.error("Error deleting goal:", error);
    }
  };

  const handleDeleteProduct = async (goal: ProductGoal) => {
    if (!confirm(`¿Está seguro de eliminar la meta de ${goal.product_name}?`)) return;

    try {
      await authFetch(`/api/product-goals/${goal.id}`, {
        method: "DELETE",
      });
      refetchProductGoals();
    } catch (error) {
      console.error("Error deleting product goal:", error);
    }
  };

  const openAssignModal = (goal: ProductGoal) => {
    setSelectedProductGoal(goal);
    const initialAssignments = (vendors || []).map(vendor => ({
      vendor_id: vendor.id,
      assigned_amount: 0,
      notes: "",
    }));
    setVendorAssignments(initialAssignments);
    setShowAssignModal(true);
  };

  const resetForm = () => {
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
  };

  const getPeriodLabel = (goal: Goal | ProductGoal) => {
    if ('period_type' in goal) {
      // General goal
      switch (goal.period_type) {
        case "monthly":
          const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
          return `${monthNames[goal.period_month! - 1]} ${goal.period_year}`;
        case "quarterly":
          return `Q${goal.period_quarter} ${goal.period_year}`;
        case "yearly":
          return `${goal.period_year}`;
        default:
          return "Período desconocido";
      }
    } else {
      // Product goal
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      return `${monthNames[goal.period_month - 1]} ${goal.period_year}`;
    }
  };

  const getProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "from-green-500 to-emerald-600";
    if (progress >= 50) return "from-yellow-500 to-orange-600";
    return "from-red-500 to-pink-600";
  };

  const getTotalAssigned = () => {
    return vendorAssignments.reduce((sum, assignment) => sum + assignment.assigned_amount, 0);
  };

  if (goalsLoading || productGoalsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-white">Cargando metas...</div>
      </div>
    );
  }

  const storeProgress = getProgress(totalStoreCurrent, totalStoreTarget);
  const storeProgressColor = getProgressColor(storeProgress);

  return (
    <div className="space-y-6">
      {/* Header with Store Total */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Metas de la Tienda</h1>
            <p className="text-slate-300 mt-1">Gestiona todas las metas del negocio en un solo lugar</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                resetForm();
                setEditingGoal(null);
                setEditingProductGoal(null);
                setGoalType("general");
                setShowModal(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              <Plus className="w-5 h-5 mr-2" />
              Meta General
            </button>
            <button
              onClick={() => {
                resetForm();
                setEditingGoal(null);
                setEditingProductGoal(null);
                setGoalType("product");
                setShowModal(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              <Plus className="w-5 h-5 mr-2" />
              Meta Producto
            </button>
          </div>
        </div>

        {/* Store Total Summary Card */}
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className={`p-3 bg-gradient-to-r ${storeProgressColor} bg-opacity-20 rounded-lg`}>
                <Building className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-bold text-white">Total de la Tienda</h2>
                <p className="text-slate-300">Rendimiento general del negocio</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{storeProgress.toFixed(1)}%</div>
              <div className="text-slate-300 text-sm">Progreso Total</div>
            </div>
          </div>
          
          <div className="w-full bg-slate-700 rounded-full h-3 mb-4">
            <div
              className={`bg-gradient-to-r ${storeProgressColor} h-3 rounded-full transition-all duration-700`}
              style={{ width: `${storeProgress}%` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-green-400">
                ${(totalStoreCurrent / 1000).toFixed(0)}K
              </div>
              <div className="text-slate-400 text-sm">Ventas Actuales</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-400">
                ${(totalStoreTarget / 1000).toFixed(0)}K
              </div>
              <div className="text-slate-400 text-sm">Meta Total</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-400">
                ${((totalStoreTarget - totalStoreCurrent) / 1000).toFixed(0)}K
              </div>
              <div className="text-slate-400 text-sm">Restante</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar metas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* General Goals Section */}
      {filteredGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Metas Generales ({filteredGoals.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredGoals.map((goal) => {
              const progress = getProgress(goal.current_amount, goal.target_amount);
              const progressColor = getProgressColor(progress);
              
              return (
                <div key={`general-${goal.id}`} className="bg-slate-800 rounded-lg shadow-md border border-slate-700 hover:shadow-lg transition-all duration-200 transform hover:scale-102">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center">
                        <div className={`p-2 bg-gradient-to-r ${progressColor} bg-opacity-10 rounded-lg`}>
                          <Target className="w-4 h-4 text-white" />
                        </div>
                        <div className="ml-2">
                          <h3 className="text-sm font-semibold text-white">
                            {getPeriodLabel(goal)}
                          </h3>
                          {goal.product_name ? (
                            <p className="text-xs text-green-400 font-medium">{goal.product_name}</p>
                          ) : goal.vendor_name ? (
                            <p className="text-xs text-slate-300">{goal.vendor_name}</p>
                          ) : (
                            <p className="text-xs text-blue-400 font-medium">Meta General</p>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleEditGeneral(goal)}
                          className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteGeneral(goal)}
                          className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {goal.description && (
                      <p className="text-xs text-slate-300 mb-3 line-clamp-2">{goal.description}</p>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center text-slate-300">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          <span>Progreso</span>
                        </div>
                        <span className="font-medium text-white">{progress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1.5">
                        <div
                          className={`bg-gradient-to-r ${progressColor} h-1.5 rounded-full transition-all duration-500`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-700 mt-3">
                      <div className="flex items-center">
                        <DollarSign className="w-3 h-3 text-green-600 mr-1" />
                        <div>
                          <p className="text-xs text-slate-400">Actual</p>
                          <p className="text-sm font-medium text-white">
                            ${(goal.current_amount / 1000).toFixed(0)}K
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Meta</p>
                        <p className="text-sm font-medium text-blue-400">
                          ${(goal.target_amount / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Product Goals Section */}
      {filteredProductGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <Package className="w-5 h-5 mr-2" />
            Metas por Producto ({filteredProductGoals.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProductGoals.map((goal) => {
              const progress = getProgress(goal.current_amount, goal.total_target_amount);
              const progressColor = getProgressColor(progress);
              
              return (
                <div key={`product-${goal.id}`} className="bg-slate-800 rounded-lg shadow-md border border-slate-700 hover:shadow-lg transition-all duration-200 transform hover:scale-102">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center flex-1">
                        <div className={`p-2 bg-gradient-to-r ${progressColor} bg-opacity-10 rounded-lg`}>
                          <Package className="w-4 h-4 text-white" />
                        </div>
                        <div className="ml-2 flex-1">
                          <h3 className="text-sm font-semibold text-white line-clamp-1">
                            {goal.product_name}
                          </h3>
                          <p className="text-xs text-slate-300">{getPeriodLabel(goal)}</p>
                        </div>
                      </div>
                      <div className="flex space-x-1 ml-2">
                        <button
                          onClick={() => openAssignModal(goal)}
                          className="p-1 text-slate-400 hover:text-green-400 transition-colors"
                          title="Asignar vendedores"
                        >
                          <Users className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleEditProduct(goal)}
                          className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(goal)}
                          className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {goal.description && (
                      <p className="text-xs text-slate-300 mb-3 line-clamp-2">{goal.description}</p>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center text-slate-300">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          <span>Progreso</span>
                        </div>
                        <span className="font-medium text-white">{progress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1.5">
                        <div
                          className={`bg-gradient-to-r ${progressColor} h-1.5 rounded-full transition-all duration-500`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-700 mt-3">
                      <div className="flex items-center">
                        <DollarSign className="w-3 h-3 text-green-600 mr-1" />
                        <div>
                          <p className="text-xs text-slate-400">Actual</p>
                          <p className="text-sm font-medium text-white">
                            ${(goal.current_amount / 1000).toFixed(0)}K
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Meta</p>
                        <p className="text-sm font-medium text-blue-400">
                          ${(goal.total_target_amount / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredGoals.length === 0 && filteredProductGoals.length === 0 && (
        <div className="text-center py-12">
          <Target className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-white">No hay metas</h3>
          <p className="mt-1 text-sm text-slate-300">
            {searchTerm ? "No se encontraron metas con ese criterio" : "Comienza agregando una nueva meta"}
          </p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">
              {goalType === "general" ? 
                (editingGoal ? "Editar Meta General" : "Nueva Meta General") :
                (editingProductGoal ? "Editar Meta de Producto" : "Nueva Meta de Producto")
              }
            </h2>
            
            <form onSubmit={goalType === "general" ? handleSubmitGeneral : handleSubmitProduct} className="space-y-4">
              {goalType === "product" ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Producto *
                    </label>
                    <select
                      required
                      value={formData.product_id}
                      onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Seleccionar producto</option>
                      {(products || []).map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Año *
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.period_year}
                        onChange={(e) => setFormData({ ...formData, period_year: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Mes *
                      </label>
                      <select
                        required
                        value={formData.period_month}
                        onChange={(e) => setFormData({ ...formData, period_month: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => (
                          <option key={month} value={month}>
                            {new Date(2000, month - 1).toLocaleString('es-ES', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Producto (opcional)
                    </label>
                    <select
                      value={formData.product_id}
                      onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Meta general (todos los productos)</option>
                      {(products || []).map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Vendedor (opcional)
                    </label>
                    <select
                      value={formData.vendor_id}
                      onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Meta general (todos los vendedores)</option>
                      {(vendors || []).map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Tipo de Período *
                    </label>
                    <select
                      required
                      value={formData.period_type}
                      onChange={(e) => setFormData({ ...formData, period_type: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="monthly">Mensual</option>
                      <option value="quarterly">Trimestral</option>
                      <option value="yearly">Anual</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Año *
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.period_year}
                      onChange={(e) => setFormData({ ...formData, period_year: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {formData.period_type === "monthly" && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Mes *
                      </label>
                      <select
                        required
                        value={formData.period_month}
                        onChange={(e) => setFormData({ ...formData, period_month: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => (
                          <option key={month} value={month}>
                            {new Date(2000, month - 1).toLocaleString('es-ES', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.period_type === "quarterly" && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Trimestre *
                      </label>
                      <select
                        required
                        value={formData.period_quarter}
                        onChange={(e) => setFormData({ ...formData, period_quarter: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={1}>Q1 (Enero - Marzo)</option>
                        <option value={2}>Q2 (Abril - Junio)</option>
                        <option value={3}>Q3 (Julio - Septiembre)</option>
                        <option value={4}>Q4 (Octubre - Diciembre)</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Meta de Ventas ($) *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingGoal(null);
                    setEditingProductGoal(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors border border-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200"
                >
                  {editingGoal || editingProductGoal ? "Actualizar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Vendors Modal */}
      {showAssignModal && selectedProductGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">
              Asignar Meta: {selectedProductGoal.product_name} - {getPeriodLabel(selectedProductGoal)}
            </h2>
            
            <div className="mb-4 p-4 bg-slate-700 rounded-lg border border-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">Meta Total:</span>
                <span className="text-lg font-bold text-white">
                  ${selectedProductGoal.total_target_amount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-medium text-slate-300">Total Asignado:</span>
                <span className={`text-lg font-bold ${
                  getTotalAssigned() === selectedProductGoal.total_target_amount ? 'text-green-400' : 'text-orange-400'
                }`}>
                  ${getTotalAssigned().toLocaleString()}
                </span>
              </div>
            </div>
            
            <form onSubmit={handleAssignVendors} className="space-y-4">
              <div className="space-y-3">
                {vendorAssignments.map((assignment, index) => {
                  const vendor = vendors?.find(v => v.id === assignment.vendor_id);
                  if (!vendor) return null;
                  
                  return (
                    <div key={vendor.id} className="p-4 border border-slate-600 rounded-lg bg-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-white">{vendor.name}</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1">
                            Monto Asignado ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={assignment.assigned_amount}
                            onChange={(e) => {
                              const newAssignments = [...vendorAssignments];
                              newAssignments[index].assigned_amount = parseFloat(e.target.value) || 0;
                              setVendorAssignments(newAssignments);
                            }}
                            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1">
                            Notas
                          </label>
                          <input
                            type="text"
                            value={assignment.notes}
                            onChange={(e) => {
                              const newAssignments = [...vendorAssignments];
                              newAssignments[index].notes = e.target.value;
                              setVendorAssignments(newAssignments);
                            }}
                            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedProductGoal(null);
                    setVendorAssignments([]);
                  }}
                  className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors border border-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200"
                >
                  Asignar Vendedores
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
