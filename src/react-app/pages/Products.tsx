import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Package, DollarSign } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";

interface Product {
  id: number;
  name: string;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  description: string | null;
  base_price: number | null;
  commission_percentage: number | null;
  is_recurring: number;
  billing_cycle: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: number;
  name: string;
  color_hex: string | null;
}

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    description: "",
    base_price: "",
    commission_percentage: "",
    is_recurring: false,
    billing_cycle: "monthly",
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
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        base_price: formData.base_price ? parseFloat(formData.base_price) : null,
        commission_percentage: formData.commission_percentage ? parseFloat(formData.commission_percentage) : null,
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
      category_id: product.category_id ? product.category_id.toString() : "",
      description: product.description || "",
      base_price: product.base_price ? product.base_price.toString() : "",
      commission_percentage: product.commission_percentage ? product.commission_percentage.toString() : "",
      is_recurring: Boolean(product.is_recurring),
      billing_cycle: product.billing_cycle || "monthly",
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
      base_price: "",
      commission_percentage: "",
      is_recurring: false,
      billing_cycle: "monthly",
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

      {/* Products Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 hover:shadow-xl transition-shadow duration-200">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      backgroundColor: product.category_color ? `${product.category_color}20` : "#3B82F620"
                    }}
                  >
                    <Package
                      className="w-5 h-5"
                      style={{ color: product.category_color || "#3B82F6" }}
                    />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{product.name}</h3>
                    {product.category_name && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white mt-1"
                        style={{ backgroundColor: product.category_color || "#3B82F6" }}
                      >
                        {product.category_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEdit(product)}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(product)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {product.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">{product.description}</p>
                )}

                {product.base_price && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <DollarSign className="w-4 h-4 mr-1" />
                    <span className="font-medium">Precio base:</span>
                    <span className="ml-1">${product.base_price.toLocaleString()}</span>
                  </div>
                )}

                {product.commission_percentage && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Comisión:</span> {product.commission_percentage}%
                  </div>
                )}

                {product.is_recurring && (
                  <div className="text-sm text-green-600 dark:text-green-400">
                    <span className="font-medium">Facturación:</span> {
                      product.billing_cycle === "monthly" ? "Mensual" :
                        product.billing_cycle === "quarterly" ? "Trimestral" :
                          product.billing_cycle === "yearly" ? "Anual" : "Recurrente"
                    }
                  </div>
                )}
              </div>

              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Creado: {new Date(product.created_at).toLocaleDateString('es-ES')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
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
                  Precio Base
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Porcentaje de Comisión
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.commission_percentage}
                  onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700"
                />
                <label htmlFor="is_recurring" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Facturación recurrente
                </label>
              </div>

              {formData.is_recurring && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ciclo de Facturación
                  </label>
                  <select
                    value={formData.billing_cycle}
                    onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  >
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              )}

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
    </div>
  );
}
