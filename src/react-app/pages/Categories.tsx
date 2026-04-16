import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Folder, ChevronDown, ChevronRight, Check, X, GripVertical, Loader2 } from "lucide-react";
import { Reorder, AnimatePresence } from "framer-motion";
import { useApi } from "../hooks/useApi";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface CategoryStep {
  id: number;
  category_id: string;
  step_name: string;
  step_order: number;
}

export default function Categories() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });

  // Qué categorías están expandidas
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Pasos por categoría: { [catId]: CategoryStep[] }
  const [stepsByCategory, setStepsByCategory] = useState<Record<string, CategoryStep[]>>({});
  // Estado de loading de pasos
  const [stepsLoading, setStepsLoading] = useState<Record<string, boolean>>({});
  // Nuevo paso en draft por categoría
  const [newStepName, setNewStepName] = useState<Record<string, string>>({});
  // Paso en edición inline: { [stepId]: string }
  const [editingStep, setEditingStep] = useState<Record<number, string>>({});

  const { data: categories, loading: categoriesLoading, refetch: refetchCategories } =
    useApi<Category[]>("/api/categories");

  const filteredCategories = (categories || []).filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cat.description && cat.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // ── Cargar pasos de una categoría cuando se expande ──────────────────────
  const loadSteps = async (catId: string) => {
    setStepsLoading(prev => ({ ...prev, [catId]: true }));
    try {
      const res = await authFetch(`/api/categories/${catId}/steps`);
      const data: CategoryStep[] = res.ok ? await res.json() : [];
      setStepsByCategory(prev => ({ ...prev, [catId]: data }));
    } finally {
      setStepsLoading(prev => ({ ...prev, [catId]: false }));
    }
  };

  const toggleExpand = (catId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
        if (!stepsByCategory[catId]) loadSteps(catId);
      }
      return next;
    });
  };

  // ── CRUD categorías ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await authFetch(`/api/categories/${editingCategory.id}`, { method: "PUT", json: formData });
      } else {
        await authFetch("/api/categories", { method: "POST", json: formData });
      }
      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: "", description: "" });
      refetchCategories();
      window.dispatchEvent(new CustomEvent('categories-updated'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (cat: Category) => {
    setEditingCategory(cat);
    setFormData({ name: cat.name, description: cat.description || "" });
    setShowModal(true);
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"?\nEsto también eliminará todos sus pasos.`)) return;
    const res = await authFetch(`/api/categories/${cat.id}`, { method: "DELETE" });
    if (!res.ok) { alert((await res.json()).error || "Error"); return; }
    refetchCategories();
    window.dispatchEvent(new CustomEvent('categories-updated'));
  };

  // ── CRUD pasos ────────────────────────────────────────────────────────────
  const handleAddStep = async (catId: string) => {
    const name = (newStepName[catId] || "").trim();
    if (!name) return;
    const res = await authFetch(`/api/categories/${catId}/steps`, {
      method: "POST",
      json: { step_name: name }
    });
    if (!res.ok) { alert("No se pudo crear el paso"); return; }
    setNewStepName(prev => ({ ...prev, [catId]: "" }));
    await loadSteps(catId);
  };

  const handleSaveStep = async (step: CategoryStep) => {
    const name = (editingStep[step.id] ?? step.step_name).trim();
    if (!name) return;
    await authFetch(`/api/category-steps/${step.id}`, {
      method: "PUT",
      json: { step_name: name }
    });
    setEditingStep(prev => { const n = { ...prev }; delete n[step.id]; return n; });
    await loadSteps(step.category_id);
  };

  const handleDeleteStep = async (step: CategoryStep) => {
    if (!confirm(`¿Eliminar el paso "${step.step_name}"?`)) return;
    await authFetch(`/api/category-steps/${step.id}`, { method: "DELETE" });
    await loadSteps(step.category_id);
  };

  const handleReorder = async (catId: string, newSteps: CategoryStep[]) => {
    // Optimistic update
    setStepsByCategory(prev => ({ ...prev, [catId]: newSteps }));

    const payload = newSteps.map((s, i) => ({ step_id: s.id, step_order: i + 1 }));
    try {
      const res = await authFetch("/api/category-steps/reorder", {
        method: "PATCH",
        json: { steps: payload }
      });
      if (!res.ok) throw new Error("Error reordering");
    } catch (err) {
      console.error(err);
      loadSteps(catId); // Revert/Sync
    }
  };

  if (categoriesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400">Cargando categorías...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Categorías</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Organiza productos y define los <span className="text-purple-400 font-medium">pasos de venta</span> por categoría
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setFormData({ name: "", description: "" }); setEditingCategory(null); setShowModal(true); }}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva Categoría
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar categorías..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
        />
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {filteredCategories.map(cat => {
          const expanded = expandedIds.has(cat.id);
          const steps = stepsByCategory[cat.id] || [];
          const loading = stepsLoading[cat.id];
          const done = steps.filter(s => false).length; // placeholder – para cliente es dinámico

          return (
            <div key={cat.id} className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 overflow-hidden">
              {/* Card header */}
              <div className="p-5 flex items-center justify-between">
                <button
                  onClick={() => toggleExpand(cat.id)}
                  className="flex items-center gap-3 flex-1 text-left group"
                >
                  <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40 transition-colors">
                    <Folder className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{cat.name}</h3>
                    {cat.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{cat.description}</p>
                    )}
                  </div>
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                    {steps.length > 0 ? `${steps.length} paso${steps.length !== 1 ? 's' : ''}` : expanded ? '0 pasos' : '...'}
                  </span>
                  {expanded
                    ? <ChevronDown className="w-4 h-4 text-gray-400 ml-1 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 ml-1 shrink-0" />
                  }
                </button>

                {isAdmin && (
                  <div className="flex items-center gap-1 ml-3">
                    <button onClick={() => handleEdit(cat)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors rounded-lg">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(cat)} className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Steps panel */}
              {expanded && (
                <div className="border-t border-gray-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2">
                  {loading ? (
                    <div className="text-sm text-gray-400 py-2 text-center">Cargando pasos...</div>
                  ) : steps.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-3">
                      {isAdmin ? "Sin pasos aún. Agrega el primero →" : "Esta categoría no tiene pasos definidos."}
                    </div>
                  ) : (
                    <Reorder.Group
                      axis="y"
                      values={steps}
                      onReorder={(newSteps) => handleReorder(cat.id, newSteps)}
                      className="space-y-1.5"
                    >
                      {steps.map((step, idx) => (
                        <Reorder.Item
                          key={step.id}
                          value={step}
                          className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-slate-700 shadow-sm"
                        >
                          {isAdmin && (
                            <div className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-purple-400 transition-colors">
                              <GripVertical className="w-4 h-4" />
                            </div>
                          )}
                          <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          {editingStep[step.id] !== undefined ? (
                            <>
                              <input
                                autoFocus
                                value={editingStep[step.id]}
                                onChange={e => setEditingStep(prev => ({ ...prev, [step.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveStep(step); if (e.key === 'Escape') setEditingStep(prev => { const n = { ...prev }; delete n[step.id]; return n; }); }}
                                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white border-b border-purple-400 outline-none"
                              />
                              <button onClick={() => handleSaveStep(step)} className="text-green-500 hover:text-green-400 p-1"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setEditingStep(prev => { const n = { ...prev }; delete n[step.id]; return n; })} className="text-gray-400 hover:text-gray-200 p-1"><X className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{step.step_name}</span>
                              {isAdmin && (
                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => setEditingStep(prev => ({ ...prev, [step.id]: step.step_name }))} className="text-gray-400 hover:text-blue-400 p-1 transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => handleDeleteStep(step)} className="text-gray-400 hover:text-red-400 p-1 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              )}
                            </>
                          )}
                        </Reorder.Item>

                      ))}
                    </Reorder.Group>
                  )}

                  {/* Add step input (admin only) */}
                  {isAdmin && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Nombre del nuevo paso..."
                        value={newStepName[cat.id] || ""}
                        onChange={e => setNewStepName(prev => ({ ...prev, [cat.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddStep(cat.id); }}
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                      <button
                        onClick={() => handleAddStep(cat.id)}
                        disabled={!(newStepName[cat.id] || "").trim()}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Agregar
                      </button>
                    </div>
                  )}

                  <p className="text-[11px] text-gray-400 pt-1">
                    💡 Estos pasos aparecen en el tab <strong>Pasos</strong> de cada cliente para que el equipo los marque como completados.
                  </p>
                </div>
              )}
            </div>
          );
        })}
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

      {/* Modal crear/editar categoría */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="Descripción de la categoría"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingCategory(null); }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
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
