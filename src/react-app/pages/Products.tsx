import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Package, DollarSign } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";

interface Product {
  id: string; // UUID
  name: string;
  category_id: string | null; // UUID
  category_name: string | null;
  description: string | null;
  price: number | null;
  monthly_goal: number;
  created_at: string;
}

interface Category {
  id: string; // UUID
  name: string;
  description: string | null;
  created_at: string;
}

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    description: "",
    price: "",
    monthly_goal: "",
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
        monthly_goal: formData.monthly_goal ? parseInt(formData.monthly_goal) : 0,
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
      monthly_goal: product.monthly_goal ? product.monthly_goal.toString() : "0",
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
      monthly_goal: "0",
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
                    className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20"
                  >
                    <Package
                      className="w-5 h-5 text-blue-600 dark:text-blue-400"
                    />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{product.name}</h3>
                    {product.category_name && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white mt-1"
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

                {product.price !== null && product.price !== undefined && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <DollarSign className="w-4 h-4 mr-1" />
                    <span className="font-medium">Precio:</span>
                    <span className="ml-1">${product.price.toLocaleString()}</span>
                  </div>
                )}

                {product.monthly_goal > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Meta mensual:</span> {product.monthly_goal} unidades
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
                  Meta Mensual (unidades)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.monthly_goal}
                  onChange={(e) => setFormData({ ...formData, monthly_goal: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="0"
                />
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
    </div>
  );
}
