
import { useState, useMemo } from "react";
import {
    Calendar as CalendarIcon,
    Phone,
    Clock,
    AlertCircle,
    ChevronRight,
    CheckCircle2,
    CalendarCheck,
    Search,
    Filter,
    ExternalLink
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useNavigate } from "react-router";

interface FollowUpProspect {
    id: number;
    company_name: string;
    client_id: string | null;
    priority_id: number | null;
    vendor_id: number | null;
    step_id: number | null;
    next_call_date: string | null;
    last_call_date: string | null;
    notes: string | null;
    priority_name?: string;
    priority_color?: string;
    vendor_name?: string;
    step_name?: string;
    contact_phone?: string;
}

export default function Agenda() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const { data: prospects, loading } = useApi<FollowUpProspect[]>("/api/follow-up-prospects");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = useMemo(() => {
        if (!prospects) return { today: 0, overdue: 0, upcoming: 0 };

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        return prospects.reduce((acc, p) => {
            if (!p.next_call_date) return acc;
            const d = new Date(p.next_call_date);
            d.setHours(0, 0, 0, 0);

            if (d.getTime() === now.getTime()) acc.today++;
            else if (d.getTime() < now.getTime()) acc.overdue++;
            else acc.upcoming++;

            return acc;
        }, { today: 0, overdue: 0, upcoming: 0 });
    }, [prospects]);

    const sortedProspects = useMemo(() => {
        if (!prospects) return [];

        return [...prospects]
            .filter(p => p.next_call_date)
            .sort((a, b) => {
                const da = new Date(a.next_call_date!).getTime();
                const db = new Date(b.next_call_date!).getTime();
                return da - db;
            })
            .filter(p =>
                p.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.vendor_name && p.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()))
            );
    }, [prospects, searchTerm]);

    const groupedAgenda = useMemo(() => {
        const groups: { title: string; items: FollowUpProspect[]; type: 'overdue' | 'today' | 'upcoming' }[] = [
            { title: 'Atrasados', items: [], type: 'overdue' },
            { title: 'Para Hoy', items: [], type: 'today' },
            { title: 'Próximos Días', items: [], type: 'upcoming' }
        ];

        // Obtener fecha local YYYY-MM-DD
        const toLocalISODate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const todayStr = toLocalISODate(new Date());

        sortedProspects.forEach(p => {
            if (!p.next_call_date) return;

            // Asumimos que la fecha viene en ISO o UTC, la convertimos a objeto Date y extraemos YYYY-MM-DD local
            const callDateObj = new Date(p.next_call_date);
            const callDateStr = toLocalISODate(callDateObj);

            if (callDateStr < todayStr) groups[0].items.push(p);
            else if (callDateStr === todayStr) groups[1].items.push(p);
            else groups[2].items.push(p);
        });

        return groups.filter(g => g.items.length > 0);
    }, [sortedProspects]);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin border-4 border-blue-500 border-t-transparent rounded-full h-12 w-12" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
                        <CalendarCheck className="w-10 h-10 text-blue-500" />
                        Panel General de Gestión
                    </h1>
                    <p className="text-slate-400 mt-2 text-lg">Control diario de llamadas y tareas pendientes.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 transition-all w-64"
                        />
                    </div>
                    <button
                        onClick={() => navigate('/seguimiento')}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all font-semibold shadow-lg shadow-blue-900/20"
                    >
                        Ver Todo
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-2xl p-6 shadow-xl backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <AlertCircle size={120} className="text-red-500" />
                    </div>
                    <p className="text-red-400 font-bold uppercase tracking-wider text-xs">Gestiones Atrasadas</p>
                    <p className="text-5xl font-black text-white mt-2">{stats.overdue}</p>
                    <div className="mt-4 flex items-center gap-2 text-red-300/60 text-sm">
                        <Clock size={14} />
                        <span>Requiere atención inmediata</span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-2xl p-6 shadow-xl backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <CalendarIcon size={120} className="text-blue-500" />
                    </div>
                    <p className="text-blue-400 font-bold uppercase tracking-wider text-xs">Programadas para Hoy</p>
                    <p className="text-5xl font-black text-white mt-2">{stats.today}</p>
                    <div className="mt-4 flex items-center gap-2 text-blue-300/60 text-sm">
                        <Phone size={14} />
                        <span>Llamadas planeadas para este día</span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-2xl p-6 shadow-xl backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <CheckCircle2 size={120} className="text-purple-500" />
                    </div>
                    <p className="text-purple-400 font-bold uppercase tracking-wider text-xs">Próximos Días</p>
                    <p className="text-5xl font-black text-white mt-2">{stats.upcoming}</p>
                    <div className="mt-4 flex items-center gap-2 text-purple-300/60 text-sm">
                        <Filter size={14} />
                        <span>Futura carga de trabajo</span>
                    </div>
                </div>
            </div>

            {/* Agenda Sections */}
            <div className="space-y-10">
                {groupedAgenda.length === 0 ? (
                    <div className="text-center py-20 bg-slate-800/20 rounded-3xl border border-dashed border-slate-700">
                        <CalendarCheck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-300">No hay gestiones pendientes</h3>
                        <p className="text-slate-500">¡Buen trabajo! Estás al día con tus prospectos.</p>
                    </div>
                ) : (
                    groupedAgenda.map(group => (
                        <div key={group.title} className="space-y-4">
                            <div className="flex items-center gap-4">
                                <h2 className={`text-xl font-bold px-4 py-1 rounded-full ${group.type === 'overdue' ? 'bg-red-500/20 text-red-400' :
                                    group.type === 'today' ? 'bg-blue-500/20 text-blue-400' :
                                        'bg-slate-700/50 text-slate-300'
                                    }`}>
                                    {group.title}
                                </h2>
                                <div className="flex-1 h-px bg-slate-800" />
                                <span className="text-slate-500 text-sm font-medium">{group.items.length} clientes</span>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {group.items.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => navigate(`/seguimiento?edit=${item.id}`)}
                                        className="bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-blue-500/50 rounded-2xl p-5 transition-all cursor-pointer group/card flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${group.type === 'overdue' ? 'bg-red-500/10 text-red-500 group-hover/card:bg-red-500/20' :
                                                group.type === 'today' ? 'bg-blue-500/10 text-blue-500 group-hover/card:bg-blue-500/20' :
                                                    'bg-slate-700 text-slate-400 group-hover/card:bg-slate-600'
                                                }`}>
                                                <Phone size={20} />
                                            </div>

                                            <div className="min-w-0">
                                                <h3 className="font-bold text-slate-100 group-hover/card:text-white transition-colors truncate">
                                                    {item.company_name}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm">
                                                    <span className="text-slate-500 flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {formatDate(item.next_call_date!)}
                                                    </span>
                                                    {item.priority_name && (
                                                        <span
                                                            className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-tight text-white/90"
                                                            style={{ backgroundColor: item.priority_color }}
                                                        >
                                                            {item.priority_name}
                                                        </span>
                                                    )}
                                                    {item.step_name && (
                                                        <span className="text-slate-400 bg-slate-700/30 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-600/50">
                                                            {item.step_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="text-right hidden sm:block">
                                                <p className="text-xs text-slate-500">Vendedor</p>
                                                <p className="text-sm font-semibold text-slate-300">{item.vendor_name || 'Sin asignar'}</p>
                                            </div>
                                            <div className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center text-slate-500 group-hover/card:text-blue-400 group-hover/card:border-blue-500/30 group-hover/card:bg-blue-500/5 transition-all">
                                                <ExternalLink size={18} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
