import { useState, useEffect } from 'react';
import { X, Search, Calendar, Clock, Users, CheckSquare, Square } from 'lucide-react';
import { authFetch } from '../utils/auth';

interface Client {
  id: string;
  name: string;
  email: string;
  salesperson_name: string;
  has_cancelled_bans?: boolean;
  has_bans?: boolean;
}

interface ClientSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (clientIds: string[], scheduledAt: string | null) => void;
}

export default function ClientSelectorModal({ isOpen, onClose, onSelect }: ClientSelectorModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'cancelled'>('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [showListModal, setShowListModal] = useState(false);
  const itemsPerPage = 50;

  useEffect(() => {
    if (isOpen) {
      loadClients();
    }
  }, [isOpen]);

  const loadClients = async () => {
    try {
      const response = await authFetch('/api/clients');
      if (response.ok) {
        const data = await response.json();
        console.log('Clients data:', data); // Debug
        
        // Validar que data sea un array
        const clientsArray = Array.isArray(data) ? data : (data.clients || []);
        
        // Solo clientes con email válido
        const clientsWithEmail = clientsArray.filter((c: any) => c.email && c.email.includes('@'));
        setClients(clientsWithEmail);
      }
    } catch (error) {
      console.error('Error cargando clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredClients = () => {
    let filtered = clients;

    // Filtrar por tab (activos/cancelados)
    if (activeTab === 'active') {
      // Activos: clientes que NO tienen todos sus BANs cancelados
      filtered = filtered.filter(c => !c.has_cancelled_bans || c.has_bans);
    } else {
      // Cancelados: clientes que tienen al menos un BAN cancelado
      filtered = filtered.filter(c => c.has_cancelled_bans);
    }

    // Filtrar por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  const getPaginatedClients = () => {
    const filtered = getFilteredClients();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(getFilteredClients().length / itemsPerPage);
  };

  const toggleClient = (clientId: string) => {
    if (selectedIds.includes(clientId)) {
      setSelectedIds(selectedIds.filter(id => id !== clientId));
    } else {
      setSelectedIds([...selectedIds, clientId]);
    }
  };

  const toggleAll = () => {
    const currentPageIds = getPaginatedClients().map(c => c.id);
    const allSelected = currentPageIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(selectedIds.filter(id => !currentPageIds.includes(id)));
    } else {
      const newSelected = [...selectedIds];
      currentPageIds.forEach(id => {
        if (!newSelected.includes(id)) {
          newSelected.push(id);
        }
      });
      setSelectedIds(newSelected);
    }
  };

  const handleConfirm = () => {
    if (selectedIds.length === 0) {
      alert('Selecciona al menos un cliente');
      return;
    }

    let scheduledAt = null;
    if (scheduledDate && scheduledTime) {
      scheduledAt = `${scheduledDate}T${scheduledTime}:00`;
    }

    onSelect(selectedIds, scheduledAt);
    onClose();
  };

  const openList = (type: 'active' | 'cancelled') => {
    setActiveTab(type);
    setSearchTerm('');
    setCurrentPage(1);
    setShowListModal(true);
  };

  const closeList = () => {
    setShowListModal(false);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleCloseAll = () => {
    setShowListModal(false);
    setSelectedIds([]);
    setScheduledDate('');
    setScheduledTime('');
    onClose();
  };

  if (!isOpen) return null;

  const totalPages = getTotalPages();
  const currentPageClients = getPaginatedClients();
  const allCurrentSelected = currentPageClients.length > 0 && currentPageClients.every(c => selectedIds.includes(c.id));

  // MODAL INICIAL: Seleccionar tipo de clientes
  if (!showListModal) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between p-8 border-b border-gray-700">
            <div>
              <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <Users className="w-8 h-8 text-indigo-500" />
                Seleccionar Destinatarios
              </h2>
              <p className="text-gray-400 text-lg mt-2">
                {selectedIds.length} cliente{selectedIds.length !== 1 ? 's' : ''} seleccionado{selectedIds.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={handleCloseAll}
              className="text-gray-400 hover:text-white transition-colors p-3 hover:bg-gray-800 rounded-lg"
            >
              <X className="w-7 h-7" />
            </button>
          </div>

          <div className="p-8 space-y-8">
            {/* Scheduler */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-semibold text-xl flex items-center gap-3">
                  <Clock className="w-6 h-6 text-indigo-400" />
                  Programar Envío
                </h3>
                {!scheduledDate && !scheduledTime && (
                  <span className="px-4 py-2 bg-green-600/20 text-green-400 rounded-lg text-base font-medium border border-green-600/30">
                    ⚡ Envío Inmediato
                  </span>
                )}
              </div>
              
              {!scheduledDate && !scheduledTime && (
                <div className="mb-5 p-4 bg-green-900/20 rounded-xl border border-green-600/30">
                  <p className="text-green-400 text-base flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    La campaña se enviará <strong className="font-bold">INMEDIATAMENTE</strong> al continuar
                  </p>
                </div>
              )}
              
              <div className="flex gap-6">
                <div className="flex-1">
                  <label className="block text-base text-gray-400 mb-3">
                    <Calendar className="inline w-5 h-5 mr-2" />
                    Fecha (opcional)
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-gray-700 text-white text-lg px-5 py-4 rounded-xl border border-gray-600 focus:border-indigo-500 focus:outline-none"
                    placeholder="Dejar vacío para enviar ahora"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-base text-gray-400 mb-3">
                    <Clock className="inline w-5 h-5 mr-2" />
                    Hora (opcional)
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-gray-700 text-white text-lg px-5 py-4 rounded-xl border border-gray-600 focus:border-indigo-500 focus:outline-none"
                    placeholder="Dejar vacío para enviar ahora"
                  />
                </div>
                {(scheduledDate || scheduledTime) && (
                  <button
                    onClick={() => {
                      setScheduledDate('');
                      setScheduledTime('');
                    }}
                    className="self-end px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors font-medium"
                    title="Volver a envío inmediato"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              {scheduledDate && scheduledTime && (
                <p className="text-lg text-yellow-400 mt-5 flex items-center gap-2">
                  📅 Se enviará el {new Date(scheduledDate).toLocaleDateString()} a las {scheduledTime}
                </p>
              )}
            </div>

            {/* Botones para elegir tipo */}
            <div>
              <h3 className="text-white font-semibold text-xl mb-5">Selecciona el tipo de clientes:</h3>
              <div className="grid grid-cols-2 gap-6">
                <button
                  onClick={() => openList('active')}
                  className="p-8 bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <div className="text-3xl mb-3">✅</div>
                  <div className="text-2xl font-bold">Clientes Activos</div>
                  <div className="text-green-100 text-base mt-2">Con servicios vigentes</div>
                </button>

                <button
                  onClick={() => openList('cancelled')}
                  className="p-8 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <div className="text-3xl mb-3">⛔</div>
                  <div className="text-2xl font-bold">Clientes Cancelados</div>
                  <div className="text-red-100 text-base mt-2">Con servicios cancelados</div>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-8 border-t border-gray-700 flex justify-between items-center">
            <button
              onClick={handleCloseAll}
              className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white text-lg font-medium rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-semibold rounded-xl transition-all shadow-lg"
            >
              Continuar con {selectedIds.length} cliente{selectedIds.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MODAL DE LISTA: Mostrar clientes para seleccionar (95vw - pantalla completa)
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-[95vw] max-h-[95vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-gray-700">
          <div className="flex items-center gap-6">
            <button
              onClick={closeList}
              className="text-gray-400 hover:text-white transition-colors p-3 hover:bg-gray-800 rounded-lg"
              title="Volver"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className={`text-3xl font-bold text-white flex items-center gap-3 ${
                activeTab === 'active' ? 'text-green-400' : 'text-red-400'
              }`}>
                <Users className={`w-8 h-8 ${activeTab === 'active' ? 'text-green-500' : 'text-red-500'}`} />
                {activeTab === 'active' ? 'Clientes Activos' : 'Clientes Cancelados'}
              </h2>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-gray-400 text-lg">
                  {selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''} • {getFilteredClients().length} disponibles
                </p>
                {!scheduledDate && !scheduledTime ? (
                  <span className="px-3 py-1 bg-green-600/20 text-green-400 rounded-lg text-sm font-medium border border-green-600/30 flex items-center gap-1">
                    ⚡ Envío inmediato
                  </span>
                ) : scheduledDate && scheduledTime ? (
                  <span className="px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded-lg text-sm font-medium border border-yellow-600/30 flex items-center gap-1">
                    📅 {new Date(scheduledDate).toLocaleDateString()} {scheduledTime}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <button
            onClick={handleCloseAll}
            className="text-gray-400 hover:text-white transition-colors p-3 hover:bg-gray-800 rounded-lg"
          >
            <X className="w-7 h-7" />
          </button>
        </div>

        {/* Search */}
        <div className="p-8 border-b border-gray-700">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar cliente por nombre o email (ej: 'Juan', 'maria@email.com')..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-800 text-white text-lg pl-14 pr-6 py-4 rounded-xl border border-gray-700 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          {searchTerm && (
            <p className="text-sm text-gray-400 mt-2 ml-1">
              🔍 Filtrando: {getFilteredClients().length} resultado{getFilteredClients().length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">Cargando clientes...</div>
            </div>
          ) : currentPageClients.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-gray-400 text-lg mb-2">No se encontraron clientes</p>
                <p className="text-gray-500 text-sm">Intenta cambiar los filtros de búsqueda</p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-8 py-5 text-left">
                    <button
                      onClick={toggleAll}
                      className="flex items-center gap-3 text-white hover:text-indigo-400 transition-colors"
                    >
                      {allCurrentSelected ? (
                        <CheckSquare className="w-7 h-7" />
                      ) : (
                        <Square className="w-7 h-7" />
                      )}
                      <span className="text-sm font-semibold text-gray-400 uppercase">
                        Todos (página)
                      </span>
                    </button>
                  </th>
                  <th className="px-8 py-5 text-left text-sm font-semibold text-gray-400 uppercase">
                    Cliente
                  </th>
                  <th className="px-8 py-5 text-left text-sm font-semibold text-gray-400 uppercase">
                    Email
                  </th>
                  <th className="px-8 py-5 text-left text-sm font-semibold text-gray-400 uppercase">
                    Vendedor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {currentPageClients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => toggleClient(client.id)}
                    className="hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <td className="px-8 py-5">
                      {selectedIds.includes(client.id) ? (
                        <CheckSquare className="w-7 h-7 text-indigo-500" />
                      ) : (
                        <Square className="w-7 h-7 text-gray-600" />
                      )}
                    </td>
                    <td className="px-8 py-5 text-white font-medium text-lg">{client.name}</td>
                    <td className="px-8 py-5 text-gray-300 text-base">{client.email}</td>
                    <td className="px-8 py-5 text-gray-400 text-base">{client.salesperson_name || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer with Pagination */}
        <div className="p-8 border-t border-gray-700 flex items-center justify-between">
          <div className="text-base text-gray-400">
            Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, getFilteredClients().length)} de {getFilteredClients().length} clientes
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-6 py-3 bg-gray-800 text-white text-base font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
              >
                Anterior
              </button>
              
              <div className="flex gap-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-5 py-3 text-base font-medium rounded-xl transition-colors ${
                        currentPage === pageNum
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-6 py-3 bg-gray-800 text-white text-base font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={closeList}
              className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white text-lg font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-semibold rounded-xl transition-all shadow-lg"
            >
              Continuar con {selectedIds.length} cliente{selectedIds.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
