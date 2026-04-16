/**
 * ClientTasksPanel.tsx
 * Muestra el progreso del cliente en los pasos definidos por categoría.
 * Los pasos se crean en el módulo "Categorías" → cada categoría tiene sus pasos plantilla.
 * El cliente tiene su propio estado (marcado / sin marcar) por paso.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, GripVertical, Loader2 } from "lucide-react";
import { authFetch } from "@/react-app/utils/auth";

interface ClientTasksPanelProps {
  client: {
    id: string | number;
    name?: string | null;
    business_name?: string | null;
    all_service_types?: string | null;
    primary_service_type?: string | null;
  };
}

interface StepRow {
  step_id: number;
  category_id: string;
  step_name: string;
  step_order: number;
  category_name: string;
  is_done: boolean;
  done_at: string | null;
  notes: string | null;
  client_step_id: number | null;
}

interface GroupedCategory {
  category_id: string;
  category_name: string;
  steps: StepRow[];
}

export default function ClientTasksPanel({ client }: ClientTasksPanelProps) {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [toggling, setToggling] = useState<number | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const dragStep = useRef<number | null>(null);
  const dragOverStep = useRef<number | null>(null);
  const [dragActiveStep, setDragActiveStep] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/clients/${client.id}/steps`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const data: StepRow[] = await res.json();
      setSteps(data);
      // Expandir todas las categorías por defecto
      const cats = new Set(data.map(s => s.category_id));
      setExpandedCats(cats);
    } catch (e: any) {
      setError(e.message || "Error cargando pasos");
    } finally {
      setLoading(false);
    }
  }, [client.id]);

  useEffect(() => { void load(); }, [load]);

  const handleToggle = async (step: StepRow) => {
    setToggling(step.step_id);
    const newValue = !step.is_done;
    // Optimistic update
    setSteps(prev => prev.map(s => s.step_id === step.step_id ? { ...s, is_done: newValue } : s));
    try {
      const res = await authFetch(`/api/clients/${client.id}/steps/${step.step_id}`, {
        method: "PATCH",
        json: { is_done: newValue }
      });
      if (!res.ok) throw new Error("Error al actualizar");
    } catch {
      // Revert on error
      setSteps(prev => prev.map(s => s.step_id === step.step_id ? { ...s, is_done: !newValue } : s));
    } finally {
      setToggling(null);
    }
  };

  const handleStepDragStart = (stepId: number) => {
    dragStep.current = stepId;
    setDragActiveStep(stepId);
  };

  const handleStepDragEnter = (stepId: number) => {
    dragOverStep.current = stepId;
  };

  const handleStepDragEnd = useCallback(async (categoryId: string) => {
    const from = dragStep.current;
    const to = dragOverStep.current;
    dragStep.current = null;
    dragOverStep.current = null;
    setDragActiveStep(null);

    if (from === null || to === null || from === to) return;

    // Reorder within this category
    setSteps(prev => {
      const catSteps = prev.filter(s => s.category_id === categoryId);
      const others = prev.filter(s => s.category_id !== categoryId);
      const fromIdx = catSteps.findIndex(s => s.step_id === from);
      const toIdx = catSteps.findIndex(s => s.step_id === to);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const reordered = [...catSteps];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      // Assign new step_order values (1-based)
      const updated = reordered.map((s, i) => ({ ...s, step_order: i + 1 }));
      return [...others, ...updated];
    });

    // Persist to backend
    setSavingOrder(true);
    try {
      const catSteps = steps.filter(s => s.category_id === categoryId);
      const reordered = [...catSteps];
      const fromIdx = reordered.findIndex(s => s.step_id === from);
      const toIdx = reordered.findIndex(s => s.step_id === to);
      if (fromIdx !== -1 && toIdx !== -1) {
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);
        const payload = reordered.map((s, i) => ({ step_id: s.step_id, step_order: i + 1 }));
        await authFetch("/api/category-steps/reorder", {
          method: "PATCH",
          json: { steps: payload }
        });
      }
    } catch (e) {
      console.error("Error guardando orden:", e);
    } finally {
      setSavingOrder(false);
    }
  }, [steps]);

  const toggleCat = (catId: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  };

  // ──────────────────────────────── FILTRADO POR SERVICIO ────────────────────────────────
  // Si el cliente es solo Fijo, ocultamos Móvil. Si es solo Móvil, ocultamos Fijo.
  // Si es Convergente o no tiene definidos tipos, mostramos todo.
  const serviceTypes = (client.all_service_types || "").toLowerCase();
  const isFijo = serviceTypes.includes("fijo");
  const isMovil = serviceTypes.includes("movil") || serviceTypes.includes("móvil");
  const isConvergente = isFijo && isMovil;

  // Agrupar por categoría con filtrado inteligente
  const grouped: GroupedCategory[] = [];
  const catMap = new Map<string, GroupedCategory>();

  for (const step of steps) {
    const catName = step.category_name.toLowerCase();
    
    // Lógica de exclusión
    if (!isConvergente) {
      if (isFijo && (catName.includes("movil") || catName.includes("móvil"))) continue;
      if (isMovil && catName.includes("fijo")) continue;
    }

    if (!catMap.has(step.category_id)) {
      const g = { category_id: step.category_id, category_name: step.category_name, steps: [] };
      catMap.set(step.category_id, g);
      grouped.push(g);
    }
    catMap.get(step.category_id)!.steps.push(step);
  }

  // ──────────────────────────────── RENDER ────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Cargando pasos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400 space-y-2">
        <p className="font-medium">⚠️ {error}</p>
        <button onClick={() => void load()} className="text-sm text-blue-400 hover:underline">Reintentar</button>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="text-center py-14 text-gray-500 space-y-2">
        <div className="text-4xl">📋</div>
        <p className="font-medium text-gray-300">No hay pasos definidos aún</p>
        <p className="text-sm text-gray-500">
          Ve a <strong className="text-purple-400">Categorías</strong> → expande una categoría → agrega sus pasos de venta.
        </p>
      </div>
    );
  }

  const totalSteps = steps.length;
  const doneSteps = steps.filter(s => s.is_done).length;
  const pct = Math.round((doneSteps / totalSteps) * 100);

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">Progreso general</span>
          <span className="text-sm font-bold text-white">{doneSteps} / {totalSteps} pasos</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2.5">
          <div
            className="h-2.5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">{pct}% completado</p>
      </div>

      {/* Categories */}
      {grouped.map(cat => {
        const catDone = cat.steps.filter(s => s.is_done).length;
        const catTotal = cat.steps.length;
        const expanded = expandedCats.has(cat.category_id);

        return (
          <div key={cat.category_id} className="rounded-xl border border-slate-700 overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCat(cat.category_id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expanded
                  ? <ChevronDown className="w-4 h-4 text-purple-400" />
                  : <ChevronRight className="w-4 h-4 text-purple-400" />
                }
                <span className="font-semibold text-white text-sm">{cat.category_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catDone === catTotal
                  ? 'bg-green-900/40 text-green-300 border border-green-700/40'
                  : 'bg-slate-700 text-gray-400'
                  }`}>
                  {catDone}/{catTotal}
                </span>
              </div>
            </button>

            {/* Steps list */}
            {expanded && (
              <ol className="divide-y divide-slate-800 bg-slate-900/40">
                {cat.steps.map((step, idx) => {
                  const isToggling = toggling === step.step_id;
                  const isDragging = dragActiveStep === step.step_id;
                  return (
                    <li
                      key={step.step_id}
                      draggable
                      onDragStart={() => handleStepDragStart(step.step_id)}
                      onDragEnter={() => handleStepDragEnter(step.step_id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnd={() => void handleStepDragEnd(cat.category_id)}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors select-none
                        ${isDragging ? 'opacity-40 bg-purple-500/10' : 'hover:bg-slate-800/40'}
                      `}
                    >
                      {/* Drag handle */}
                      <GripVertical className="w-4 h-4 text-slate-600 cursor-grab active:cursor-grabbing flex-shrink-0" />

                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggle(step)}
                        disabled={isToggling}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200
                          ${step.is_done
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-slate-600 hover:border-purple-400 text-transparent'
                          }
                          ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                        `}
                      >
                        {isToggling
                          ? <Loader2 className="w-3 h-3 animate-spin text-white" />
                          : <Check className="w-3.5 h-3.5" />
                        }
                      </button>

                      {/* Step name */}
                      <div className="flex-1">
                        <span className={`text-sm ${step.is_done ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                          <span className="text-gray-500 text-xs mr-1.5">{idx + 1}.</span>
                          {step.step_name}
                        </span>
                        {step.done_at && (
                          <p className="text-[10px] text-green-400 mt-0.5">
                            ✅ {new Date(step.done_at).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {savingOrder && (
              <div className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] text-slate-500 border-t border-slate-800">
                <Loader2 className="w-3 h-3 animate-spin" /> Guardando orden...
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
