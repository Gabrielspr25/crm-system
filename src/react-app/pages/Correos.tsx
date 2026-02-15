import React, { useState, useEffect, useMemo } from 'react';
import { Mail, Search, CheckSquare, Square, Monitor, Users, Send, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Ban } from 'lucide-react';
import { authFetch } from '@/react-app/utils/auth';

interface ClientRow {
  id: string;
  name: string;
  business_name?: string;
  email?: string;
  contact_person?: string;
  phone?: string;
}

const PAGE_SIZE = 30;
const DEFAULT_FROM = 'gabriel.sanchez@claropr.com';

// Firma predeterminada (texto plano para mailto:)
const DEFAULT_SIGNATURE = `

--
Gabriel Sánchez
gabriel.sanchez@claropr.com
Claro Puerto Rico`;

export default function CorreosPage() {
  const [activeClients, setActiveClients] = useState<ClientRow[]>([]);
  const [cancelledClients, setCancelledClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [tab, setTab] = useState<'active' | 'cancelled'>('active');
  const [page, setPage] = useState(1);

  // Cargar clientes de ambos tabs
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [resActive, resCancelled] = await Promise.all([
          authFetch('/api/clients?tab=active'),
          authFetch('/api/clients?tab=cancelled')
        ]);
        const filterEmail = (list: any[]) =>
          list.filter((c: any) => c.email && c.email.trim() !== '' && c.email !== 'SIN EMAIL');

        if (resActive.ok) {
          const d = await resActive.json();
          setActiveClients(filterEmail(d.clients || d || []));
        }
        if (resCancelled.ok) {
          const d = await resCancelled.json();
          setCancelledClients(filterEmail(d.clients || d || []));
        }
      } catch (e) {
        console.error('Error cargando clientes:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const clients = tab === 'active' ? activeClients : cancelledClients;

  // Filtrar por búsqueda
  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.business_name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.contact_person || '').toLowerCase().includes(q)
    );
  }, [clients, search]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  // Reset page cuando cambia tab o búsqueda
  useEffect(() => { setPage(1); }, [tab, search]);

  // Toggle selección
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Seleccionar/deseleccionar todos los de la PÁGINA ACTUAL
  const togglePageAll = () => {
    const pageIds = paged.map(c => c.id);
    const allPageSelected = pageIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const pageAllSelected = paged.length > 0 && paged.every(c => selected.has(c.id));

  // Obtener emails seleccionados (de AMBOS tabs)
  const allClients = [...activeClients, ...cancelledClients];
  const selectedClients = allClients.filter(c => selected.has(c.id));
  const selectedEmails = selectedClients.map(c => c.email!).filter(Boolean);

  // Abrir en app de escritorio (mailto:) — clientes van en BCC (copia oculta)
  const openDesktop = () => {
    const bcc = selectedEmails.join(';');
    const subj = encodeURIComponent(subject);
    const fullBody = body + DEFAULT_SIGNATURE;
    const bod = encodeURIComponent(fullBody);
    const link = document.createElement('a');
    link.href = `mailto:?bcc=${bcc}&subject=${subj}&body=${bod}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cuántos seleccionados en cada tab
  const selectedActiveCount = activeClients.filter(c => selected.has(c.id)).length;
  const selectedCancelledCount = cancelledClients.filter(c => selected.has(c.id)).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* Header */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 md:p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-3 rounded-lg">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Correos</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Selecciona clientes y redacta tu correo
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-medium">
                {activeClients.length + cancelledClients.length} con email
              </span>
              {selected.size > 0 && (
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full font-medium">
                  {selected.size} seleccionados
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Composer Section - Colapsable */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <button
            onClick={() => setShowComposer(!showComposer)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-slate-900 dark:text-white">
                Redactar Correo {selected.size > 0 && `(${selected.size} destinatarios)`}
              </span>
            </div>
            {showComposer ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {showComposer && (
            <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-3">

              {/* De: fijo */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">De:</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-sm text-slate-900 dark:text-white font-medium">{DEFAULT_FROM}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">Predeterminado · cambiar en Outlook con "De:"</span>
                </div>
              </div>

              {/* Destinatarios chips */}
              {selectedClients.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">CCO (Copia Oculta): ({selectedClients.length})</label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 max-h-24 overflow-y-auto">
                    {selectedClients.map(c => (
                      <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                        {c.name || c.business_name} &lt;{c.email}&gt;
                        <button onClick={() => toggleSelect(c.id)} className="hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedClients.length === 0 && (
                <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                  Selecciona al menos un cliente de la lista de abajo
                </div>
              )}

              {/* Asunto */}
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Asunto:</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Asunto del correo..."
                />
              </div>

              {/* Cuerpo */}
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Mensaje:</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={5}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  placeholder="Escribe tu mensaje aquí..."
                />
              </div>

              {/* Botones enviar */}
              <div className="pt-1">
                <button
                  onClick={openDesktop}
                  disabled={selectedEmails.length === 0}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
                >
                  <Monitor className="w-4 h-4" />
                  Abrir en Outlook
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tabs + Search + Select Page */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setTab('active')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === 'active'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Users className="w-4 h-4" />
              Activos
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                tab === 'active'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              }`}>
                {activeClients.length}
              </span>
              {selectedActiveCount > 0 && (
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                  {selectedActiveCount} sel
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('cancelled')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === 'cancelled'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Ban className="w-4 h-4" />
              Cancelados
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                tab === 'cancelled'
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              }`}>
                {cancelledClients.length}
              </span>
              {selectedCancelledCount > 0 && (
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                  {selectedCancelledCount} sel
                </span>
              )}
            </button>
          </div>

          {/* Search + Select Page */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Buscar por nombre, empresa, email..."
              />
            </div>
            <button
              onClick={togglePageAll}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              {pageAllSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
              {pageAllSelected ? 'Deseleccionar página' : 'Seleccionar página'}
            </button>
            {selected.size > 0 && (
              <button
                onClick={() => { setSelected(new Set()); }}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              >
                <X className="w-3 h-3" />
                Limpiar todo ({selected.size})
              </button>
            )}
          </div>
        </div>

        {/* Client list */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
              Cargando clientes...
            </div>
          ) : paged.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No se encontraron clientes con email</p>
              {search && <p className="text-sm mt-1">Intenta con otra búsqueda</p>}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {paged.map((c, i) => {
                const isSelected = selected.has(c.id);
                const globalIdx = (safePage - 1) * PAGE_SIZE + i + 1;
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleSelect(c.id)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-transparent'
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 w-5 text-right shrink-0">{globalIdx}</span>
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-600 shrink-0" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900 dark:text-white truncate">
                          {c.name || c.business_name || 'Sin nombre'}
                        </span>
                        {c.contact_person && (
                          <span className="text-xs text-slate-400 truncate hidden md:inline">
                            · {c.contact_person}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{c.email}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination footer */}
          {!loading && filtered.length > 0 && (
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length} clientes
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      p === safePage
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
