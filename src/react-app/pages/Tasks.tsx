
import { useState, useMemo } from "react";
import {
    CheckSquare,
    Clock,
    User,
    ChevronRight,
    AlertCircle,
    Search,
    CheckCircle2,
    Phone
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";
import { useNavigate } from "react-router";

interface FollowUpStep {
    id: number;
    name: string;
    description: string;
    order_index: number;
}

interface FollowUpProspect {
    id: number;
    company_name: string;
    client_id: string | null;
    priority_id: number | null;
    vendor_id: number | null;
    step_id: number | null;
    next_call_date: string | null;
    step_name?: string;
    priority_name?: string;
    priority_color?: string;
    vendor_name?: string;
}

export default function Tasks() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");

    const { data: prospects, loading: loadingProspects, refetch: refetchProspects } = useApi<FollowUpProspect[]>("/api/follow-up-prospects");
    const { data: steps, loading: loadingSteps } = useApi<FollowUpStep[]>("/api/follow-up-prospects/steps");

    // Ordenar pasos
    const sortedSteps = useMemo(() => {
        return (steps || []).sort((a, b) => a.order_index - b.order_index);
    }, [steps]);

    const filteredTasks = useMemo(() => {
        if (!prospects) return [];
        return prospects
            .filter(p => !p.next_call_date || p.step_id || p.company_name.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(p => p.company_name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [prospects, searchTerm]);

    const handleCompleteStep = async (prospect: FollowUpProspect) => {
        if (!prospect.step_id) return;

        if (!confirm(`¿Marcar "${prospect.step_name}" como completado para ${prospect.company_name}?`)) {
            return;
        }

        try {
            await authFetch('/api/call-logs', {
                method: 'POST',
                json: {
                    follow_up_id: prospect.id,
                    call_date: new Date().toISOString(),
                    notes: `Tarea "${prospect.step_name}" completada desde el módulo de tareas.`,
                    outcome: 'completed',
                    step_id: prospect.step_id,
                    step_completed: true
                }
            });
            refetchProspects();
        } catch (error) {
            console.error("Error al completar tarea:", error);
            alert("No se pudo completar la tarea.");
        }
    };

    if (loadingProspects || loadingSteps) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin border-4 border-blue-500 border-t-transparent rounded-full h-12 w-12" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <CheckSquare className="w-8 h-8 text-blue-500" />
                        Gestión de Tareas
                    </h1>
                    <p className="text-slate-400 mt-1">Lista de acciones pendientes por cliente en el proceso de venta.</p>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar por cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-800/50 border-b border-slate-700">
                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente / Empresa</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tarea Actual (Paso)</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Progreso</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Prioridad</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {filteredTasks.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    No se encontraron tareas pendientes.
                                </td>
                            </tr>
                        ) : (
                            filteredTasks.map(prospect => {
                                const currentStepIndex = sortedSteps.findIndex(s => s.id === prospect.step_id);
                                const progressPercent = sortedSteps.length > 0
                                    ? ((currentStepIndex === -1 ? sortedSteps.length : currentStepIndex) / sortedSteps.length) * 100
                                    : 0;

                                return (
                                    <tr key={prospect.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                    <User size={18} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-100 group-hover:text-white">{prospect.company_name}</p>
                                                    <p className="text-xs text-slate-500">{prospect.vendor_name || 'Sin vendedor'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {prospect.step_name ? (
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-blue-400 flex items-center gap-1">
                                                        <Clock size={14} className="animate-pulse" />
                                                        {prospect.step_name}
                                                    </span>
                                                    <span className="text-xs text-slate-500 mt-1">
                                                        {steps?.find(s => s.id === prospect.step_id)?.description || 'Pendiente de acción'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-600 bg-slate-800/50 px-2 py-1 rounded">Sin paso asignado</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${progressPercent}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                                    {Math.round(progressPercent)}% Completado
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {prospect.priority_name && (
                                                <span
                                                    className="px-2 py-1 rounded text-[10px] font-bold text-white shadow-sm"
                                                    style={{ backgroundColor: prospect.priority_color }}
                                                >
                                                    {prospect.priority_name}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleCompleteStep(prospect)}
                                                    disabled={!prospect.step_id}
                                                    className="bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/20 text-emerald-500 hover:text-white p-2 rounded-lg transition-all disabled:opacity-30 disabled:pointer-events-none"
                                                    title="Marcar paso como completado"
                                                >
                                                    <CheckCircle2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/seguimiento?edit=${prospect.id}`)}
                                                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white p-2 rounded-lg transition-all"
                                                    title="Ir al detalle del cliente"
                                                >
                                                    <ChevronRight size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg">¿Cómo funciona?</h3>
                        <p className="text-slate-400 text-sm mt-1">
                            Este módulo muestra la **tarea inmediata** de cada cliente según el flujo definido.
                            Al completar una tarea, el sistema avanza automáticamente al siguiente paso del proceso de venta.
                        </p>
                    </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex items-start gap-4">
                    <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                        <Phone size={24} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg">Próximas Llamadas</h3>
                        <p className="text-slate-400 text-sm mt-1">
                            Recuerda que también puedes ver las fechas programadas en el **Panel General**.
                            Aquí te enfocas en **qué hacer**, allá en **cuándo llamar**.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
