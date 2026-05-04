import { useState, useEffect, useMemo } from 'react';
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

  // Abrir en app de escritorio (mailto:) — clientes van en BCC (copia oculta).
  // Usamos coma como separador (más compatible que ; cross-cliente).
  // mailto: tiene un límite de URL (~2000 chars en algunos browsers); para
  // listas grandes se recomienda mandar en lotes de ~50 destinatarios.
  const openDesktop = () => {
    if (selectedEmails.length === 0) return;
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    const fullBody = body + DEFAULT_SIGNATURE;
    if (fullBody) params.set('body', fullBody);
    const bcc = encodeURIComponent(selectedEmails.join(','));
    const url = `mailto:?bcc=${bcc}&${params.toString()}`;
    window.location.href = url;
  };

  // Cuántos seleccionados en cada tab
  const selectedActiveCount = activeClients.filter(c => selected.has(c.id)).length;
  const selectedCancelledCount = cancelledClients.filter(c => selected.has(c.id)).length;

  // Aviso de URL muy larga (mailto: tiene ~2000 chars de límite)
  const estimatedUrlLen = `mailto:?bcc=${selectedEmails.join(',')}&subject=${subject}&body=${body}${DEFAULT_SIGNATURE}`.length;
  const urlTooLong = estimatedUrlLen > 1800;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 border border-blue-500/30 p-2.5 rounded-lg">
              <Mail className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Correos</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Seleccioná clientes y abrí Outlook con la lista lista para enviar.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full font-medium border border-blue-500/30">
              {activeClients.length + cancelledClients.length} con email
            </span>
            {selected.size > 0 && (
              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full font-medium border border-emerald-500/30">
                {selected.size} seleccionados
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Composer Section - Colapsable */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowComposer(!showComposer)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Send className="w-5 h-5 text-blue-300" />
            <span className="font-semibold text-white">
              Redactar correo {selected.size > 0 && <span className="text-blue-300">· {selected.size} destinatarios</span>}
            </span>
          </div>
          {showComposer ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {showComposer && (
          <div className="p-4 pt-0 border-t border-slate-700 space-y-3">
            {/* De: fijo */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">De</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 rounded-lg border border-slate-700">
                <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-sm text-white font-medium">{DEFAULT_FROM}</span>
                <span className="text-[10px] text-slate-500 ml-auto">predeterminado · cambiar en Outlook con "De:"</span>
              </div>
            </div>

            {/* Destinatarios chips */}
            {selectedClients.length > 0 ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  CCO (copia oculta) · {selectedClients.length} destinatarios
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900 rounded-lg border border-slate-700 max-h-32 overflow-y-auto">
                  {selectedClients.map(c => (
                    <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-blue-500/20 text-blue-200 px-2 py-1 rounded-full border border-blue-500/30">
                      {c.name || c.business_name} &lt;{c.email}&gt;
                      <button onClick={() => toggleSelect(c.id)} className="hover:text-red-300 transition-colors" title="Quitar">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-amber-200 bg-amber-500/10 p-3 rounded-lg border border-amber-500/30">
                ⚠️ Seleccioná al menos un cliente de la lista de abajo.
              </div>
            )}

            {/* Asunto */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Asunto</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder:text-slate-500"
                placeholder="Asunto del correo..."
              />
            </div>

            {/* Cuerpo */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mensaje</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={6}
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none placeholder:text-slate-500"
                placeholder="Escribí tu mensaje acá... (la firma se agrega automáticamente al final)"
              />
            </div>

            {/* Aviso de URL muy larga */}
            {urlTooLong && (
              <div className="text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/30">
                ⚠️ La cantidad de destinatarios + el mensaje generan una URL muy larga ({estimatedUrlLen} caracteres). Algunos clientes de correo cortan en ~2000. Probá enviar en lotes de menos destinatarios o acortar el mensaje.
              </div>
            )}

            {/* Botón enviar */}
            <div className="pt-1">
              <button
                onClick={openDesktop}
                disabled={selectedEmails.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed"
              >
                <Monitor className="w-4 h-4" />
                Abrir en Outlook ({selectedEmails.length} destinatarios en BCC)
              </button>
              <p className="text-[11px] text-slate-500 mt-2 text-center italic">
                💡 Outlook se abre con la lista cargada. Confirmá el envío manual desde ahí.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs + Search + Select Page */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => setTab('active')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'active'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Activos
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              tab === 'active' ? 'bg-blue-700/60 text-blue-100' : 'bg-slate-700 text-slate-400'
            }`}>
              {activeClients.length}
            </span>
            {selectedActiveCount > 0 && (
              <span className="text-xs bg-emerald-500/30 text-emerald-200 px-1.5 py-0.5 rounded-full border border-emerald-500/40">
                {selectedActiveCount} sel
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('cancelled')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'cancelled'
                ? 'bg-red-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ban className="w-4 h-4" />
            Cancelados
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              tab === 'cancelled' ? 'bg-red-700/60 text-red-100' : 'bg-slate-700 text-slate-400'
            }`}>
              {cancelledClients.length}
            </span>
            {selectedCancelledCount > 0 && (
              <span className="text-xs bg-emerald-500/30 text-emerald-200 px-1.5 py-0.5 rounded-full border border-emerald-500/40">
                {selectedCancelledCount} sel
              </span>
            )}
          </button>
        </div>

        {/* Search + Select Page */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder:text-slate-500"
              placeholder="Buscar por nombre, empresa, email..."
            />
          </div>
          <button
            onClick={togglePageAll}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-700 hover:bg-slate-700/40 hover:border-blue-400/50 text-slate-200 transition-colors"
          >
            {pageAllSelected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
            {pageAllSelected ? 'Deseleccionar página' : 'Seleccionar página'}
          </button>
          {selected.size > 0 && (
            <button
              onClick={() => { setSelected(new Set()); }}
              className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30 transition-colors"
            >
              <X className="w-3 h-3" />
              Limpiar todo ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* Client list */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-3" />
            Cargando clientes...
          </div>
        ) : paged.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No se encontraron clientes con email</p>
            {search && <p className="text-sm mt-1 text-slate-500">Probá con otra búsqueda</p>}
          </div>
        ) : (
          <div className="divide-y divide-slate-700/60">
            {paged.map((c, i) => {
              const isSelected = selected.has(c.id);
              const globalIdx = (safePage - 1) * PAGE_SIZE + i + 1;
              return (
                <div
                  key={c.id}
                  onClick={() => toggleSelect(c.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-500/10 border-l-4 border-blue-500'
                      : 'hover:bg-slate-700/30 border-l-4 border-transparent'
                  }`}
                >
                  <span className="text-[10px] text-slate-500 w-5 text-right shrink-0 font-mono">{globalIdx}</span>
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-blue-400 shrink-0" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-600 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-white truncate">
                        {c.name || c.business_name || 'Sin nombre'}
                      </span>
                      {c.contact_person && (
                        <span className="text-xs text-slate-400 truncate hidden md:inline">
                          · {c.contact_person}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate font-mono">{c.email}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length} clientes
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-300" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                // Limitar a 7 páginas visibles cuando hay muchas
                .filter((p) => totalPages <= 7 || Math.abs(p - safePage) <= 3 || p === 1 || p === totalPages)
                .map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      p === safePage
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
