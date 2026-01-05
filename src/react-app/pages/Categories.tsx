import { useState } from "react";
import { Plus, Search, Edit, Trash2, Folder } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";

interface Category {
  id: string; // UUID
  name: string;
  description: string | null;
  created_at: string;
}

export default function Categories() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const { data: categories, loading: categoriesLoading, refetch: refetchCategories } = useApi<Category[]>("/api/categories");

  const filteredCategories = (categories || []).filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCategory) {
        await authFetch(`/api/categories/${editingCategory.id}`, {
          method: "PUT",
          json: formData,
        });
      } else {
        await authFetch("/api/categories", {
          method: "POST",
          json: formData,
        });
      }

      setShowModal(false);
      setEditingCategory(null);
      resetForm();
      refetchCategories();
      // Disparar evento para que otros componentes refresquen
      window.dispatchEvent(new CustomEvent('categories-updated'));
    } catch (error) {
      console.error("Error saving category:", error);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`¿Está seguro de eliminar la categoría "${category.name}"?`)) return;

    try {
      const response = await authFetch(`/api/categories/${category.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Error al eliminar la categoría");
        return;
      }

      refetchCategories();
      // Disparar evento para que otros componentes refresquen
      window.dispatchEvent(new CustomEvent('categories-updated'));
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("Error al eliminar la categoría");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
    });
  };

  if (categoriesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600 dark:text-gray-300">Cargando categorías...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Categorías</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Organiza tus productos por categorías</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingCategory(null);
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nueva Categoría
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar categorías..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-300"
        />
      </div>

      {/* Categories Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredCategories.map((category) => (
          <div key={category.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 hover:shadow-xl transition-shadow duration-200">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div
                    className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20"
                  >
                    <Folder
                      className="w-5 h-5 text-purple-600 dark:text-purple-400"
                    />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{category.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEdit(category)}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Creado: {new Date(category.created_at).toLocaleDateString('es-ES')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCategories.length === 0 && (
        <div className="text-center py-12">
          <Folder className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay categorías</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? "No se encontraron categorías con ese criterio" : "Comienza agregando una nueva categoría"}
          </p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
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
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="Descripción de la categoría"
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCategory(null);
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
                  {editingCategory ? "Actualizar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
