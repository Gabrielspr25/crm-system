import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Package, DollarSign, Settings } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";

interface Product {
  id: string; // UUID
  name: string;
  category_id: string | null; // UUID
  category_name: string | null;
  description: string | null;
  price: number | null;
  commission_percentage: number;
  created_at: string;
}

interface Category {
  id: string; // UUID
  name: string;
  description: string | null;
  created_at: string;
}

interface CommissionTier {
  id: string;
  product_id: string;
  range_min: number;
  range_max: number | null;
  commission_amount: number;
}

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showTiersModal, setShowTiersModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductForTiers, setSelectedProductForTiers] = useState<Product | null>(null);
  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [editingTier, setEditingTier] = useState<CommissionTier | null>(null);
  const [tierFormData, setTierFormData] = useState({
    range_min: "",
    range_max: "",
    commission_amount: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    description: "",
    price: "",
    commission_percentage: "",
  });

  const { data: products, loading: productsLoading, refetch: refetchProducts } = useApi<Product[]>("/api/products");
  const { data: categories, refetch: refetchCategories } = useApi<Category[]>("/api/categories");

  const filteredProducts = (products || []).filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (product.category_name && product.category_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        category_id: formData.category_id || null,
        price: formData.price ? parseFloat(formData.price) : null,
        commission_percentage: formData.commission_percentage ? parseFloat(formData.commission_percentage) : 10.00,
      };

      if (editingProduct) {
        await authFetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          json: payload,
        });
      } else {
        await authFetch("/api/products", {
          method: "POST",
          json: payload,
        });
      }

      setShowModal(false);
      setEditingProduct(null);
      resetForm();
      refetchProducts();
      // Disparar evento para que otros componentes refresquen
      window.dispatchEvent(new CustomEvent('products-updated'));
    } catch (error) {
      console.error("Error saving product:", error);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category_id: product.category_id || "",
      description: product.description || "",
      price: product.price ? product.price.toString() : "",
      commission_percentage: product.commission_percentage ? product.commission_percentage.toString() : "10.00",
    });
    setShowModal(true);
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`¿Está seguro de eliminar el producto "${product.name}"?`)) return;

    try {
      await authFetch(`/api/products/${product.id}`, {
        method: "DELETE",
      });
      refetchProducts();
      // Disparar evento para que otros componentes refresquen
      window.dispatchEvent(new CustomEvent('products-updated'));
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category_id: "",
      description: "",
      price: "",
      commission_percentage: "10.00",
    });
  };

  const handleManageTiers = async (product: Product) => {
    setSelectedProductForTiers(product);
    try {
      const response = await authFetch(`/api/products/${product.id}/tiers`);
      const data = await response.json();
      setTiers(data);
      setShowTiersModal(true);
    } catch (error) {
      console.error("Error loading tiers:", error);
      setTiers([]);
      setShowTiersModal(true);
    }
  };

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForTiers) return;

    try {
      const payload = {
        product_id: selectedProductForTiers.id,
        range_min: parseFloat(tierFormData.range_min),
        range_max: tierFormData.range_max ? parseFloat(tierFormData.range_max) : null,
        commission_amount: parseFloat(tierFormData.commission_amount),
      };

      if (editingTier) {
        await authFetch(`/api/products/tiers/${editingTier.id}`, {
          method: "PUT",
          json: payload,
        });
      } else {
        await authFetch("/api/products/tiers", {
          method: "POST",
          json: payload,
        });
      }

      // Recargar tiers
      const response = await authFetch(`/api/products/${selectedProductForTiers.id}/tiers`);
      const data = await response.json();
      setTiers(data);

      setEditingTier(null);
      setTierFormData({ range_min: "", range_max: "", commission_amount: "" });
    } catch (error) {
      console.error("Error saving tier:", error);
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    if (!confirm("¿Eliminar este rango de comisión?")) return;

    try {
      await authFetch(`/api/products/tiers/${tierId}`, {
        method: "DELETE",
      });

      if (selectedProductForTiers) {
        const response = await authFetch(`/api/products/${selectedProductForTiers.id}/tiers`);
        const data = await response.json();
        setTiers(data);
      }
    } catch (error) {
      console.error("Error deleting tier:", error);
    }
  };

  const handleEditTier = (tier: CommissionTier) => {
    setEditingTier(tier);
    setTierFormData({
      range_min: tier.range_min.toString(),
      range_max: tier.range_max?.toString() || "",
      commission_amount: tier.commission_amount.toString(),
    });
  };

  // Escuchar eventos de actualización de categorías
  useEffect(() => {
    const handleCategoriesUpdate = () => {
      console.log("🔄 Refrescando categorías desde evento...");
      refetchCategories();
    };

    window.addEventListener('categories-updated', handleCategoriesUpdate);

    return () => {
      window.removeEventListener('categories-updated', handleCategoriesUpdate);
    };
  }, [refetchCategories]);

  if (productsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600 dark:text-gray-300">Cargando productos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Productos</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona tu catálogo de productos</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingProduct(null);
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Producto
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar productos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-300"
        />
      </div>

      {/* Products Table */}
      {filteredProducts.length > 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Precio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    % Ganancia Empresa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Creado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                          <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {product.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.category_name ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          {product.category_name}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">Sin categoría</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
                        {product.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.price !== null && product.price !== undefined ? (
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          ${product.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {product.commission_percentage}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(product.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {(product.name.toLowerCase().includes('movil') || product.name.toLowerCase().includes('móvil')) && (
                          <button
                            onClick={() => handleManageTiers(product)}
                            className="p-2 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                            title="Gestionar Comisiones"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay productos</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? "No se encontraron productos con ese criterio" : "Comienza agregando un nuevo producto"}
          </p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingProduct ? "Editar Producto" : "Nuevo Producto"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Categoría
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  <option value="">Seleccionar categoría</option>
                  {(categories || []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Precio
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  % Ganancia Empresa
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.commission_percentage}
                  onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="3.2"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Fijo New: 3.2% | Fijo Ren: 1.6% | TV/Cloud/MPLS: 100% | Móvil: usa Tiers
                </p>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingProduct(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200"
                >
                  {editingProduct ? "Actualizar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gestión de Tiers (solo MÓVIL) */}
      {showTiersModal && selectedProductForTiers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Comisiones por Tiers - {selectedProductForTiers.name}
              </h2>
              <button
                onClick={() => {
                  setShowTiersModal(false);
                  setSelectedProductForTiers(null);
                  setEditingTier(null);
                  setTierFormData({ range_min: "", range_max: "", commission_amount: "" });
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Define rangos de precio del plan y su comisión correspondiente. Ejemplo: Planes de $30-$39.99 generan $114.75 de comisión.
            </p>

            {/* Formulario Agregar/Editar Tier */}
            <form onSubmit={handleSaveTier} className="mb-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Precio Mínimo *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={tierFormData.range_min}
                    onChange={(e) => setTierFormData({ ...tierFormData, range_min: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    placeholder="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Precio Máximo (vacío = sin límite)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tierFormData.range_max}
                    onChange={(e) => setTierFormData({ ...tierFormData, range_max: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    placeholder="19.99"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Comisión Empresa ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={tierFormData.commission_amount}
                    onChange={(e) => setTierFormData({ ...tierFormData, commission_amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    placeholder="61.20"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4 space-x-3">
                {editingTier && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTier(null);
                      setTierFormData({ range_min: "", range_max: "", commission_amount: "" });
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-slate-600 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  {editingTier ? "Actualizar Tier" : "Agregar Tier"}
                </button>
              </div>
            </form>

            {/* Tabla de Tiers */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Rango de Precio
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Comisión Empresa
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Vendedor (50%)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {tiers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No hay tiers configurados. Agrega el primero arriba.
                      </td>
                    </tr>
                  ) : (
                    tiers.map((tier) => (
                      <tr key={tier.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          ${tier.range_min.toFixed(2)} - {tier.range_max ? `$${tier.range_max.toFixed(2)}` : 'Sin límite'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400">
                          ${tier.commission_amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-blue-600 dark:text-blue-400">
                          ${(tier.commission_amount * 0.5).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleEditTier(tier)}
                              className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTier(tier.id)}
                              className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowTiersModal(false);
                  setSelectedProductForTiers(null);
                  setEditingTier(null);
                  setTierFormData({ range_min: "", range_max: "", commission_amount: "" });
                }}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
