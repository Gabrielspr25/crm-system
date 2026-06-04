import { useEffect, useState } from "react";
import { Edit, Package, Plus, Search, Trash2 } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";

interface Product {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  description: string | null;
  price: number | null;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
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
  });

  const { data: products, loading: productsLoading, refetch: refetchProducts } = useApi<Product[]>("/api/products");
  const { data: categories, refetch: refetchCategories } = useApi<Category[]>("/api/categories");

  const filteredProducts = (products || []).filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.category_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ name: "", category_id: "", description: "", price: "" });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name: formData.name.trim(),
      category_id: formData.category_id || null,
      description: formData.description.trim() || null,
      price: formData.price ? Number(formData.price) : null,
    };
    if (!payload.name) return;

    const response = editingProduct
      ? await authFetch(`/api/products/${editingProduct.id}`, { method: "PUT", json: payload })
      : await authFetch("/api/products", { method: "POST", json: payload });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      alert(body?.error || "No se pudo guardar el producto");
      return;
    }

    setShowModal(false);
    setEditingProduct(null);
    resetForm();
    refetchProducts();
    window.dispatchEvent(new CustomEvent("products-updated"));
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category_id: product.category_id || "",
      description: product.description || "",
      price: product.price !== null && product.price !== undefined ? String(product.price) : "",
    });
    setShowModal(true);
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Eliminar el producto "${product.name}"?`)) return;
    const response = await authFetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      alert(body?.error || "No se pudo eliminar el producto");
      return;
    }
    refetchProducts();
    window.dispatchEvent(new CustomEvent("products-updated"));
  };

  useEffect(() => {
    const refresh = () => refetchCategories();
    window.addEventListener("categories-updated", refresh);
    return () => window.removeEventListener("categories-updated", refresh);
  }, [refetchCategories]);

  if (productsLoading) {
    return (
      <div className="flex h-64 items-center justify-center bg-slate-950 text-slate-300">
        Cargando productos...
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Productos</h1>
          <p className="mt-1 text-slate-400">Gestiona tu catalogo de productos</p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setEditingProduct(null);
            setShowModal(true);
          }}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500"
        >
          <Plus className="h-5 w-5" />
          Nuevo Producto
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar productos..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.currentTarget.value)}
          className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900 pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-500"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filteredProducts.map((product) => (
          <article
            key={product.id}
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30 transition hover:border-blue-500/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10">
                  <Package className="h-5 w-5 text-blue-300" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-white">{product.name}</h2>
                  {product.category_name && (
                    <span className="mt-1 inline-flex rounded-full border border-blue-500/40 bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                      {product.category_name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => handleEdit(product)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-blue-300"
                  title="Editar producto"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(product)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-red-300"
                  title="Eliminar producto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-400">
              {product.description && <p>{product.description}</p>}
              {product.price !== null && product.price !== undefined && (
                <p>
                  <span className="font-medium text-slate-300">Precio:</span> ${Number(product.price).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-slate-500">
                Creado: {new Date(product.created_at).toLocaleDateString("es-ES")}
              </p>
            </div>
          </article>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 px-4 py-12 text-center">
          <Package className="mx-auto h-10 w-10 text-slate-500" />
          <h3 className="mt-3 text-sm font-semibold text-slate-200">No hay productos</h3>
          <p className="mt-1 text-sm text-slate-500">
            {searchTerm ? "No se encontraron productos con ese criterio." : "Crea el primer producto."}
          </p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-white">
              {editingProduct ? "Editar Producto" : "Nuevo Producto"}
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
                <label className="mb-1 block text-sm font-medium text-slate-300">Categoria</label>
                <select
                  value={formData.category_id}
                  onChange={(event) => setFormData({ ...formData, category_id: event.currentTarget.value })}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-blue-500"
                >
                  <option value="">Seleccionar categoria</option>
                  {(categories || []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
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
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Precio</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(event) => setFormData({ ...formData, price: event.currentTarget.value })}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingProduct(null);
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
