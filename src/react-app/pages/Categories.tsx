import { useState } from "react";
import { Edit, Folder, Plus, Search, Trash2 } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
}

export default function Categories() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "supervisor";

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });

  const { data: categories, loading: categoriesLoading, refetch: refetchCategories } =
    useApi<Category[]>("/api/categories");
  const { data: products, refetch: refetchProducts } = useApi<Product[]>("/api/products");

  const filteredCategories = (categories || []).filter((cat) =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cat.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({ name: "", description: "" });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
    };
    if (!payload.name) return;

    const response = editingCategory
      ? await authFetch(`/api/categories/${editingCategory.id}`, { method: "PUT", json: payload })
      : await authFetch("/api/categories", { method: "POST", json: payload });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      alert(body?.error || "No se pudo guardar la categoria");
      return;
    }

    setShowModal(false);
    resetForm();
    refetchCategories();
    refetchProducts();
    window.dispatchEvent(new CustomEvent("categories-updated"));
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, description: category.description || "" });
    setShowModal(true);
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Eliminar la categoria "${category.name}"?`)) return;
    const response = await authFetch(`/api/categories/${category.id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      alert(payload?.error || "No se pudo eliminar la categoria");
      return;
    }
    refetchCategories();
    refetchProducts();
    window.dispatchEvent(new CustomEvent("categories-updated"));
  };

  if (categoriesLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-300">
        Cargando categorias...
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-5 bg-slate-950 text-slate-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-white">Categorias</h1>
          <p className="mt-1 text-sm text-slate-400">Organiza el catalogo comercial de productos.</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-500/40 bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Nueva Categoria
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar categorias..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.currentTarget.value)}
          className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-500"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredCategories.map((category) => {
          const categoryProducts = (products || []).filter((product) => product.category_id === category.id);
          return (
            <article
              key={category.id}
              className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/30 transition hover:border-blue-500/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
                    <Folder className="h-5 w-5 text-purple-300" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-white">{category.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                      {category.description || "Sin descripcion"}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(category)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-blue-300"
                      title="Editar categoria"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(category)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-red-300"
                      title="Eliminar categoria"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50">
                {categoryProducts.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-slate-500">Sin productos asignados</div>
                ) : (
                  categoryProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-3 last:border-b-0"
                    >
                      <div className="font-semibold text-slate-100">{product.name}</div>
                      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-200">
                        Producto
                      </span>
                    </div>
                  ))
                )}
              </div>
            </article>
          );
        })}
      </div>

      {filteredCategories.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 px-4 py-12 text-center">
          <Folder className="mx-auto h-10 w-10 text-slate-500" />
          <h3 className="mt-3 text-sm font-semibold text-slate-200">No hay categorias</h3>
          <p className="mt-1 text-sm text-slate-500">
            {searchTerm ? "No se encontraron categorias con ese criterio." : "Crea la primera categoria."}
          </p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-white">
              {editingCategory ? "Editar Categoria" : "Nueva Categoria"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Nombre *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.currentTarget.value })}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Descripcion</label>
                <textarea
                  value={formData.description}
                  onChange={(event) => setFormData({ ...formData, description: event.currentTarget.value })}
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="h-10 rounded-lg border border-slate-700 bg-slate-800 px-4 text-sm text-slate-200 transition hover:border-slate-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-10 rounded-lg border border-blue-500/50 bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
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
