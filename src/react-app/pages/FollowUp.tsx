import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router";
import { Search, Plus, Phone, Edit3, Settings, Trash2, ArrowLeft, Calendar as CalendarIcon, List, ChevronLeft, ChevronRight } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";
import { APP_VERSION } from "@/version";

interface Priority {
  id: number;
  name: string;
  color_hex: string;
  order_index: number;
}

interface Vendor {
  id: number;
  name: string;
}

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
  fijo_ren: number;
  fijo_new: number;
  movil_nueva: number;
  movil_renovacion: number;
  claro_tv: number;
  cloud: number;
  mpls: number;
  last_call_date: string | null;
  next_call_date: string | null;
  call_count: number;
  is_completed: boolean;
  completed_date: string | null;
  total_amount: number;
  notes: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  base: string | null;
  updated_at: string | null;
  is_active?: boolean | number | null;
  priority_name?: string;
  priority_color?: string;
  vendor_name?: string;
  step_name?: string;
  client_name?: string;
  client_business_name?: string;
}

interface CallLog {
  id: number;
  follow_up_id: number;
  call_date: string;
  notes: string | null;
  outcome: string | null;
  next_call_date: string | null;
  step_id?: number | null;
  step_completed?: boolean | number | null;
}

interface Client {
  id: string;
  name: string;
  business_name: string | null;
  is_active: number;
}

export default function FollowUp() {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCompleted, setShowCompleted] = useState(false); // Nuevo estado para filtrar completados
  const [selectedProspect, setSelectedProspect] = useState<FollowUpProspect | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showPriorityManager, setShowPriorityManager] = useState(false);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState(new Date());

  const { data: prospects, loading, refetch: refetchProspects } = useApi<FollowUpProspect[]>("/api/follow-up-prospects?include_completed=true");
  const { data: priorities, refetch: refetchPriorities } = useApi<Priority[]>("/api/priorities");
  const { data: vendors } = useApi<Vendor[]>("/api/vendors");
  const { data: steps, refetch: refetchSteps } = useApi<FollowUpStep[]>("/api/follow-up-steps");
  const { data: clients } = useApi<Client[]>("/api/clients");

  // Detectar client_id en URL y abrir modal automáticamente
  useEffect(() => {
    const clientId = searchParams.get('client_id');
    if (clientId && prospects && prospects.length > 0) {
      const prospect = prospects.find(p => p.client_id === clientId);
      if (prospect) {
        setSelectedProspect(prospect);
        setShowModal(true);
      }
    }
  }, [searchParams, prospects]);

  const uniqueProspects = useMemo(() => {
    const seen = new Map<string, FollowUpProspect>();
    
    (prospects || []).forEach((prospect) => {
      // Si tiene client_id, usar como key para deduplicar
      // Si NO tiene client_id, usar id único (no deduplicar)
      const key = prospect.client_id ? `client-${prospect.client_id}` : `prospect-${prospect.id}`;
      if (!seen.has(key)) {
        seen.set(key, prospect);
      }
    });
    
    // NO filtrar por is_active - el filtro de showCompleted ya maneja seguimiento/completados
    return Array.from(seen.values());
  }, [prospects, clients]);

  // Abrir automáticamente el cliente si viene client_id en la URL
  useEffect(() => {
    const clientIdParam = searchParams.get('client_id');
    if (clientIdParam && uniqueProspects.length > 0) {
      // No convertir a número - client_id es UUID (string)
      const prospect = uniqueProspects.find(p => p.client_id === clientIdParam);
      if (prospect && !selectedProspect) {
        setSelectedProspect(prospect);
        setShowModal(true);
      }
    }
  }, [searchParams, uniqueProspects, selectedProspect]);

  // Filtrar por cliente si viene en URL (para contadores)
  const clientIdParam = searchParams.get('client_id');
  const clientFilteredProspects = useMemo(() => {
    if (!clientIdParam) return uniqueProspects;
    return uniqueProspects.filter(p => p.client_id === clientIdParam);
  }, [clientIdParam, uniqueProspects]);

  const filteredProspects = useMemo(() => {
    return clientFilteredProspects.filter(prospect => {
      // Filtro por búsqueda
      const matchesSearch = prospect.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (prospect.vendor_name && prospect.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Filtro por estado completado/seguimiento
      const isCompleted = prospect.completed_date != null;
      const matchesStatus = showCompleted ? isCompleted : !isCompleted;
      
      return matchesSearch && matchesStatus;
    });
  }, [clientFilteredProspects, searchTerm, showCompleted]);

  const authUser = getCurrentUser();
  const isVendorUser = authUser?.role === "vendedor";
  const parsedVendorId = authUser?.salespersonId != null ? Number(authUser.salespersonId) : NaN;
  const vendorIdNumber = isVendorUser && !Number.isNaN(parsedVendorId) ? parsedVendorId : undefined;
  const vendorIdString = isVendorUser && authUser?.salespersonId != null ? String(authUser.salespersonId) : null;

  const visibleVendors = useMemo(() => {
    const list = vendors || [];
    if (isVendorUser && vendorIdString) {
      return list.filter((vendor) => String(vendor.id) === vendorIdString);
    }
    return list;
  }, [vendors, isVendorUser, vendorIdString]);

  const handleEdit = (prospect: FollowUpProspect) => {
    console.log('🔵 handleEdit called:', prospect);
    setSelectedProspect(prospect);
    setShowModal(true);
  };

  // Detectar si se debe abrir el modal automáticamente desde la URL
  useEffect(() => {
    const editId = searchParams.get('edit');
    const isCompleted = searchParams.get('completed') === 'true';
    
    if (editId && prospects) {
      const prospectToEdit = prospects.find(p => p.id === Number(editId));
      if (prospectToEdit) {
        // Abrir el modal automáticamente
        handleEdit(prospectToEdit);
        
        // Limpiar los parámetros de la URL para evitar que se abra de nuevo
        window.history.replaceState({}, '', '/seguimiento');
      }
    }
  }, [searchParams, prospects]);

  const refreshLogs = async () => {
    if (!selectedProspect) return;
    try {
      const response = await authFetch(`/api/call-logs/${selectedProspect.id}`);
      const logs = await response.json();
      setCallLogs(Array.isArray(logs) ? logs : []);
    } catch (error) {
      console.error("Error refreshing logs:", error);
      setCallLogs([]);
    }
  };

  const handleCall = async (prospect: FollowUpProspect) => {
    console.log('🟢 handleCall called:', prospect);
    setSelectedProspect(prospect);

    // Fetch call logs for this prospect
    try {
      const response = await authFetch(`/api/call-logs/${prospect.id}`);
      const logs = await response.json();
      setCallLogs(Array.isArray(logs) ? logs : []);
    } catch (error) {
      console.error("Error fetching call logs:", error);
      setCallLogs([]);
    }

    setShowCallModal(true);
  };

  const handleSaveProspect = async (data: Partial<FollowUpProspect>) => {
    try {
      const url = selectedProspect?.id ? `/api/follow-up-prospects/${selectedProspect.id}` : '/api/follow-up-prospects';
      const method = selectedProspect?.id ? 'PUT' : 'POST';

      const payload = {
        ...data,
        vendor_id: isVendorUser && vendorIdNumber !== undefined ? vendorIdNumber : data.vendor_id,
        completed_date: data.is_completed ? new Date().toISOString() : null,
        fijo_ren: data.fijo_ren || 0,
        fijo_new: data.fijo_new || 0,
        movil_nueva: data.movil_nueva || 0,
        movil_renovacion: data.movil_renovacion || 0,
        claro_tv: data.claro_tv || 0,
        cloud: data.cloud || 0,
        mpls: data.mpls || 0,
      };

      await authFetch(url, {
        method,
        json: payload
      });

      refetchProspects();
      setShowModal(false);
      setSelectedProspect(null);
    } catch (error) {
      console.error("Error saving prospect:", error);
    }
  };

  const handleSaveCall = async (callData: {
    notes: string;
    outcome: string;
    next_call_date: string;
    step_completed: boolean;
  }) => {
    try {
      console.log('[FollowUp] Guardando llamada:', { follow_up_id: selectedProspect?.id, ...callData });
      const response = await authFetch('/api/call-logs', {
        method: 'POST',
        json: {
          follow_up_id: selectedProspect?.id,
          call_date: new Date().toISOString(),
          notes: callData.notes,
          outcome: callData.outcome,
          next_call_date: callData.next_call_date,
          step_id: selectedProspect?.step_id,
          step_completed: callData.step_completed
        }
      });

      if (!response.ok) {
        throw new Error('Error al guardar la llamada');
      }

      console.log('[FollowUp] Llamada guardada exitosamente');
      await refreshLogs(); // Refrescar logs antes de cerrar modal
      refetchProspects();
      setShowCallModal(false);
      setSelectedProspect(null);
    } catch (error) {
      console.error("Error saving call log:", error);
      alert('Error al guardar la llamada. Verifique los datos e intente nuevamente.');
    }
  };

  const handleReturnToBD = async (prospect: FollowUpProspect) => {
    console.log('🟠 handleReturnToBD called:', prospect);
    
    if (!confirm(`¿Devolver "${prospect.company_name}" a la base de datos disponibles?`)) {
      console.log('🟠 User cancelled return');
      return;
    }

    try {
      console.log('🟠 Deleting prospect:', prospect.id);
      // Eliminar el registro de follow_up_prospects para que vuelva a disponibles
      const response = await authFetch(`/api/follow-up-prospects/${prospect.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      console.log('🟠 Prospect deleted successfully');
      refetchProspects();
    } catch (error) {
      console.error("🔴 Error returning prospect to BD:", error);
      alert('Error al devolver el prospecto a la base de datos.');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400">Cargando seguimientos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            Seguimiento
          </h1>
          <p className="text-gray-400 mt-1">Gestiona el seguimiento de tus prospectos</p>
        </div>
        <button
          onClick={() => {
            setSelectedProspect(null);
            setShowModal(true);
          }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Plus className="w-4 h-4" />
          Nuevo Prospecto
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por empresa o vendedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500"
          />
        </div>
        
        {/* Toggle Seguimiento/Completados */}
        <div className="flex bg-gray-800 border border-gray-700 rounded-lg p-1">
          <button
            onClick={() => setShowCompleted(false)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              !showCompleted
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Seguimiento ({clientFilteredProspects.filter(p => p.completed_date == null).length})
          </button>
          <button
            onClick={() => setShowCompleted(true)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              showCompleted
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Completados ({clientFilteredProspects.filter(p => p.completed_date != null).length})
          </button>
        </div>

        {/* Toggle Vista Lista/Calendario */}
        <div className="flex bg-gray-800 border border-gray-700 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Vista Lista"
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'calendar'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Vista Calendario"
          >
            <CalendarIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowPriorityManager(true)}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Gestionar Prioridades
        </button>

      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Empresa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Prioridad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Vendedor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Pasos</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Fijo Ren</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Fijo New</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Móvil Nueva</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Móvil Reno</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">ClaroTV</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Cloud</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">MPLS</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Base</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-800">
                {filteredProspects.map((prospect) => {
                  return (
                  <tr 
                    key={prospect.id} 
                    className="hover:bg-gray-800 transition-colors"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-200">{prospect.company_name}</div>
                      {prospect.client_name && (
                        <div className="text-xs text-blue-400">Cliente: {prospect.client_business_name || prospect.client_name}</div>
                      )}
                      {prospect.contact_phone && (
                        <div className="text-xs text-gray-500">{prospect.contact_phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {prospect.priority_name && (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: prospect.priority_color }}
                        >
                          {prospect.priority_name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-300">{prospect.vendor_name || '-'}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-300">{prospect.step_name || '-'}</span>
                    </td>
                    <td className={`px-4 py-4 whitespace-nowrap text-center ${(prospect.fijo_ren && parseFloat(prospect.fijo_ren.toString()) > 0) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>
                      <span className="text-sm text-gray-300">{prospect.fijo_ren || 0}</span>
                    </td>
                    <td className={`px-4 py-4 whitespace-nowrap text-center ${(prospect.fijo_new && parseFloat(prospect.fijo_new.toString()) > 0) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>
                      <span className="text-sm text-gray-300">{prospect.fijo_new || 0}</span>
                    </td>
                    <td className={`px-4 py-4 whitespace-nowrap text-center ${(prospect.movil_nueva && parseFloat(prospect.movil_nueva.toString()) > 0) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>
                      <span className="text-sm text-gray-300">{prospect.movil_nueva || 0}</span>
                    </td>
                    <td className={`px-4 py-4 whitespace-nowrap text-center ${(prospect.movil_renovacion && parseFloat(prospect.movil_renovacion.toString()) > 0) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>
                      <span className="text-sm text-gray-300">{prospect.movil_renovacion || 0}</span>
                    </td>
                    <td className={`px-4 py-4 whitespace-nowrap text-center ${(prospect.claro_tv && parseFloat(prospect.claro_tv.toString()) > 0) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>
                      <span className="text-sm text-gray-300">{prospect.claro_tv || 0}</span>
                    </td>
                    <td className={`px-4 py-4 whitespace-nowrap text-center ${(prospect.cloud && parseFloat(prospect.cloud.toString()) > 0) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>
                      <span className="text-sm text-gray-300">{prospect.cloud || 0}</span>
                    </td>
                    <td className={`px-4 py-4 whitespace-nowrap text-center ${(prospect.mpls && parseFloat(prospect.mpls.toString()) > 0) ? 'border-2 border-green-500 bg-green-900/20' : ''}`}>
                      <span className="text-sm text-gray-300">{prospect.mpls || 0}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <span className="text-xs px-2 py-1 rounded bg-blue-900/40 text-blue-200 border border-blue-500/30">
                        {prospect.base || 'BD propia'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-300">{formatDate(prospect.last_call_date)}</div>
                      {prospect.next_call_date && (
                        <div className="text-xs text-blue-400">Próx: {formatDate(prospect.next_call_date)}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleCall(prospect)}
                          className="text-green-400 hover:text-green-300 transition-colors"
                          title="Registrar llamada"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(prospect)}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReturnToBD(prospect)}
                          className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs transition-colors flex items-center gap-1"
                          title="Devolver a disponibles"
                        >
                          <ArrowLeft className="w-3 h-3" />
                          Devolver
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <CalendarView
          currentDate={calendarDate}
          onDateChange={setCalendarDate}
          prospects={filteredProspects}
          onSelectProspect={handleEdit}
        />
      )}

      {viewMode === 'list' && filteredProspects.length === 0 && (
        <div className="text-center py-12">
          <Phone className="mx-auto h-12 w-12 text-gray-600" />
          <h3 className="mt-2 text-sm font-medium text-gray-300">No hay prospectos</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? "No se encontraron resultados con ese criterio" : "Comienza agregando un nuevo prospecto"}
          </p>
        </div>
      )}

      {/* Prospect Modal */}
      {showModal && (
        <ProspectModal
          prospect={selectedProspect}
          priorities={priorities || []}
          vendors={visibleVendors}
          steps={steps || []}
          clients={Array.isArray(clients) ? clients : (clients as any)?.data || []}
          onSave={handleSaveProspect}
          onClose={() => {
            setShowModal(false);
            setSelectedProspect(null);
          }}
          enforcedVendorId={isVendorUser ? vendorIdNumber : undefined}
          disableVendorSelect={isVendorUser}
        />
      )}

      {/* Call Modal */}
      {showCallModal && selectedProspect && (
        <CallModal
          prospect={selectedProspect}
          callLogs={callLogs}
          onSave={handleSaveCall}
          onClose={() => {
            setShowCallModal(false);
            setSelectedProspect(null);
          }}
          steps={steps || []}
          onStepsUpdated={refetchSteps}
          onRefreshLogs={refreshLogs}
        />
      )}

      {showPriorityManager && (
        <PriorityManagerModal
          priorities={priorities || []}
          onClose={() => setShowPriorityManager(false)}
          onSaved={async () => {
            await refetchProspects();
            await refetchPriorities();
          }}
        />
      )}


    </div>
  );
}

// Prospect Modal Component
function ProspectModal({
  prospect,
  priorities,
  vendors,
  steps,
  clients,
  onSave,
  onClose,
  enforcedVendorId,
  disableVendorSelect = false
}: {
  prospect: FollowUpProspect | null;
  priorities: Priority[];
  vendors: Vendor[];
  steps: FollowUpStep[];
  clients: Client[];
  onSave: (data: Partial<FollowUpProspect>) => Promise<void>;
  onClose: () => void;
  enforcedVendorId?: number;
  disableVendorSelect?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    company_name: prospect?.company_name || '',
    client_id: prospect?.client_id ? String(prospect.client_id) : '',
    priority_id: prospect?.priority_id ? String(prospect.priority_id) : '',
    vendor_id: prospect?.vendor_id ? String(prospect.vendor_id) : enforcedVendorId != null ? String(enforcedVendorId) : '',
    step_id: prospect?.step_id ? String(prospect.step_id) : '',
    fijo_ren: prospect?.fijo_ren || 0,
    fijo_new: prospect?.fijo_new || 0,
    movil_nueva: prospect?.movil_nueva || 0,
    movil_renovacion: prospect?.movil_renovacion || 0,
    claro_tv: prospect?.claro_tv || 0,
    cloud: prospect?.cloud || 0,
    mpls: prospect?.mpls || 0,
    contact_phone: prospect?.contact_phone || '',
    contact_email: prospect?.contact_email || '',
    notes: prospect?.notes || '',
    base: prospect?.base || '',
    is_completed: prospect?.completed_date != null
  });

  useEffect(() => {
    setFormData({
      company_name: prospect?.company_name || '',
      client_id: prospect?.client_id ? String(prospect.client_id) : '',
      priority_id: prospect?.priority_id ? String(prospect.priority_id) : '',
      vendor_id: prospect?.vendor_id ? String(prospect.vendor_id) : enforcedVendorId != null ? String(enforcedVendorId) : '',
      step_id: prospect?.step_id ? String(prospect.step_id) : '',
      fijo_ren: prospect?.fijo_ren || 0,
      fijo_new: prospect?.fijo_new || 0,
      movil_nueva: prospect?.movil_nueva || 0,
      movil_renovacion: prospect?.movil_renovacion || 0,
      claro_tv: prospect?.claro_tv || 0,
      cloud: prospect?.cloud || 0,
      mpls: prospect?.mpls || 0,
      contact_phone: prospect?.contact_phone || '',
      contact_email: prospect?.contact_email || '',
      notes: prospect?.notes || '',
      base: prospect?.base || '',
      is_completed: prospect?.completed_date != null
    });
  }, [prospect, enforcedVendorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (saving) return; // Prevenir doble submit
    
    setSaving(true);
    try {
      const resolvedVendorId = disableVendorSelect && enforcedVendorId != null
        ? enforcedVendorId
        : formData.vendor_id
          ? parseInt(formData.vendor_id.toString(), 10)
          : null;

      const data = {
        ...formData,
        client_id: formData.client_id || null,
        priority_id: formData.priority_id ? parseInt(formData.priority_id.toString(), 10) : null,
        vendor_id: resolvedVendorId,
      };

      console.log('[FollowUp] Guardando prospecto:', data);
      await onSave(data);
      console.log('[FollowUp] Prospecto guardado exitosamente');
      // Cerrar modal después de guardar exitosamente
      onClose();
    } catch (error) {
      console.error('Error al guardar prospecto:', error);
      // El modal NO se cierra si hay error, para que el usuario pueda reintentar
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-6">
            {prospect ? 'Editar Prospecto' : 'Nuevo Prospecto'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Prioridad
                </label>
                <select
                  value={formData.priority_id}
                  onChange={(e) => setFormData({ ...formData, priority_id: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                >
                  <option value="">Seleccionar prioridad</option>
                  {priorities.map(priority => (
                    <option key={priority.id} value={priority.id}>
                      {priority.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Vendedor
                </label>
                <select
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  disabled={disableVendorSelect || vendors.length <= 1}
                  required
                >
                  <option value="">Seleccionar vendedor</option>
                  {vendors.map(vendor => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
                {(disableVendorSelect || vendors.length === 1) && (
                  <p className="mt-2 text-xs text-gray-400">Asignado automáticamente a tu usuario.</p>
                )}
              </div>
            </div>

            {/* Products Grid */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Productos Negociados</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {[
                  { key: 'fijo_ren', label: 'Fijo Ren' },
                  { key: 'fijo_new', label: 'Fijo New' },
                  { key: 'movil_nueva', label: 'Móvil Nueva' },
                  { key: 'movil_renovacion', label: 'Móvil Reno' },
                  { key: 'claro_tv', label: 'ClaroTV' },
                  { key: 'cloud', label: 'Cloud' },
                  { key: 'mpls', label: 'MPLS' }
                ].map(product => (
                  <div key={product.key}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {product.label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData[product.key as keyof typeof formData] as number}
                      onChange={(e) => setFormData({
                        ...formData,
                        [product.key]: parseFloat(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notas
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_completed}
                  onChange={(e) => setFormData({ ...formData, is_completed: e.target.checked })}
                  className="rounded border-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 bg-gray-800"
                />
                <span className="ml-2 text-sm text-gray-300">Marcar como completado</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : (prospect ? 'Actualizar' : 'Crear')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Step Manager Panel (Embedded)
function StepManagerPanel({ steps, onSaved }: { steps: FollowUpStep[]; onSaved: () => Promise<void> | void }) {
  const [items, setItems] = useState<FollowUpStep[]>([]);
  const [newItem, setNewItem] = useState({ name: '', description: '', order_index: (steps?.length || 0) + 1, is_active: true });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadingId, setLoadingId] = useState<number | 'new' | null>(null);

  useEffect(() => {
    setItems(
      (steps || []).map(step => ({
        ...step,
        description: step.description || '',
        order_index: step.order_index ?? 0,
        is_active: Boolean((step as any).is_active ?? true)
      }))
    );
  }, [steps]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const handleFieldChange = (id: number, field: keyof FollowUpStep, value: unknown) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: field === 'order_index' ? Number(value) : value } : item));
  };

  const handleCreate = async () => {
    if (!newItem.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre es obligatorio.' });
      return;
    }

    setLoadingId('new');
    try {
      const response = await authFetch('/api/follow-up-steps', {
        method: 'POST',
        json: {
          name: newItem.name.trim(),
          description: newItem.description?.trim() || null,
          order_index: Number(newItem.order_index) || 0,
          is_active: newItem.is_active
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'No fue posible crear el paso.');
      }

      setMessage({ type: 'success', text: 'Paso creado correctamente.' });
      setNewItem({ name: '', description: '', order_index: (steps?.length || 0) + 1, is_active: true });
      await onSaved();
    } catch (error) {
      console.error('Create step error:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error al crear el paso.' });
    } finally {
      setLoadingId(null);
    }
  };

  const handleUpdate = async (item: FollowUpStep & { is_active?: boolean | number | null }) => {
    setLoadingId(item.id);
    try {
      const response = await authFetch(`/api/follow-up-steps/${item.id}`, {
        method: 'PUT',
        json: {
          name: (item.name || '').trim(),
          description: item.description?.trim() || null,
          order_index: Number(item.order_index) || 0,
          is_active: Boolean((item as any).is_active ?? true)
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'No fue posible actualizar el paso.');
      }

      setMessage({ type: 'success', text: 'Paso actualizado.' });
      await onSaved();
    } catch (error) {
      console.error('Update step error:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error al actualizar el paso.' });
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este paso?')) return;
    setLoadingId(id);
    try {
      const response = await authFetch(`/api/follow-up-steps/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'No fue posible eliminar el paso.');
      }
      setMessage({ type: 'success', text: 'Paso eliminado.' });
      await onSaved();
    } catch (error) {
      console.error('Delete step error:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error al eliminar el paso.' });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {message && (
        <div
          className={`mx-4 mt-4 mb-2 rounded-lg px-4 py-3 text-sm border ${message.type === 'success'
              ? 'border-green-500/40 bg-green-900/30 text-green-100'
              : 'border-red-500/40 bg-red-900/30 text-red-100'
            }`}
        >
          {message.text}
        </div>
      )}

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* Header Row for New Step */}
        <div className="grid grid-cols-[3rem_1fr_1fr_5rem] gap-3 pb-4 border-b border-gray-800 items-center">
          <div className="text-center text-xs text-gray-500 font-medium">Orden</div>
          <div className="text-xs text-gray-500 font-medium">Nombre del Nuevo Paso</div>
          <div className="text-xs text-gray-500 font-medium">Descripción / Días estimados</div>
          <div></div>
        </div>

        <div className="grid grid-cols-[3rem_1fr_1fr_5rem] gap-3 py-2 items-center">
          <input
            type="number"
            value={newItem.order_index}
            onChange={(e) => setNewItem(prev => ({ ...prev, order_index: Number(e.target.value) }))}
            className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm text-center focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="#"
          />
          <input
            type="text"
            value={newItem.name}
            onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Nombre del paso..."
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="text"
            value={newItem.description}
            onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Ej: Día 3, Enviar correo..."
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={loadingId === 'new'}
            className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:text-blue-200 text-white rounded text-sm font-medium transition-colors"
          >
            {loadingId === 'new' ? '...' : 'Crear'}
          </button>
        </div>

        {/* List Header */}
        <div className="mt-6 mb-2 grid grid-cols-[3rem_1fr_1fr_5rem] gap-3 px-1 items-center">
          <div className="text-center text-xs text-gray-500 font-medium">Orden</div>
          <div className="text-xs text-gray-500 font-medium">Pasos Existentes</div>
          <div className="text-xs text-gray-500 font-medium">Descripción</div>
          <div className="text-center text-xs text-gray-500 font-medium">Acciones</div>
        </div>

        <div className="space-y-1">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No hay pasos configurados.</p>
          ) : (
            items.sort((a, b) => a.order_index - b.order_index).map(item => (
              <div key={item.id} className="group grid grid-cols-[3rem_1fr_1fr_5rem] gap-3 py-1 hover:bg-gray-800/30 rounded px-1 transition-colors items-center">
                <input
                  type="number"
                  value={item.order_index}
                  onChange={(e) => handleFieldChange(item.id, 'order_index', e.target.value)}
                  className="px-2 py-1 bg-transparent border border-transparent group-hover:border-gray-700 rounded text-gray-400 text-sm text-center focus:bg-gray-800 focus:text-white focus:border-blue-500 transition-all"
                />
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleFieldChange(item.id, 'name', e.target.value)}
                  className="px-3 py-1 bg-transparent border border-transparent group-hover:border-gray-700 rounded text-gray-300 text-sm focus:bg-gray-800 focus:text-white focus:border-blue-500 transition-all"
                />
                <input
                  type="text"
                  value={item.description || ''}
                  onChange={(e) => handleFieldChange(item.id, 'description', e.target.value)}
                  placeholder="Sin descripción"
                  className="px-3 py-1 bg-transparent border border-transparent group-hover:border-gray-700 rounded text-gray-400 text-sm focus:bg-gray-800 focus:text-white focus:border-blue-500 transition-all"
                />
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleUpdate(item)}
                    disabled={loadingId === item.id}
                    title="Guardar cambios"
                    className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={loadingId === item.id}
                    title="Eliminar paso"
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Call Modal Component
function CallModal({
  prospect,
  callLogs,
  onSave,
  onClose,
  steps,
  onStepsUpdated,
  onRefreshLogs
}: {
  prospect: FollowUpProspect;
  callLogs: CallLog[];
  onSave: (data: { notes: string; outcome: string; next_call_date: string; step_completed: boolean }) => void;
  onClose: () => void;
  steps: FollowUpStep[];
  onStepsUpdated: () => Promise<void> | void;
  onRefreshLogs: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    notes: '',
    outcome: 'completed',
    next_call_date: '',
    step_completed: false
  });
  const [activeTab, setActiveTab] = useState<'all' | 'manage'>('all');
  const [activeMainTab, setActiveMainTab] = useState<'steps' | 'call'>('call');
  
  // Ordenar pasos y encontrar el actual
  const sortedSteps = useMemo(() => [...steps].sort((a, b) => a.order_index - b.order_index), [steps]);
  const currentStep = useMemo(() => steps.find(s => s.id === prospect.step_id), [steps, prospect.step_id]);
  
  // Calcular historial de fechas de completado basado en logs
  const stepCompletionDates = useMemo(() => {
    const dates: Record<number, string> = {};
    if (Array.isArray(callLogs)) {
      callLogs.forEach(log => {
        if (log.step_completed && log.step_id) {
          // Si hay múltiples logs para el mismo paso, tomamos el más reciente (asumiendo que callLogs viene ordenado o lo ordenamos)
          // Pero callLogs suele venir ordenado por fecha desc.
          if (!dates[log.step_id]) {
             dates[log.step_id] = log.call_date;
          }
        }
      });
    }
    return dates;
  }, [callLogs]);



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleStepClick = async (step: FollowUpStep) => {
    const isCompleted = !!stepCompletionDates[step.id];
    if (isCompleted) return; 

    if (!confirm(`¿Marcar "${step.name}" como completado?`)) return;

    try {
      await authFetch('/api/call-logs', {
        method: 'POST',
        json: {
          follow_up_id: prospect.id,
          call_date: new Date().toISOString(),
          notes: `Paso "${step.name}" completado desde checklist.`,
          outcome: 'completed',
          step_id: step.id,
          step_completed: true
        }
      });
      await onRefreshLogs();
      // Intentar actualizar el prospecto en segundo plano si es posible
      if (onStepsUpdated) onStepsUpdated();
    } catch (error) {
      console.error(error);
      alert('Error al completar el paso');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-800 w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-800 bg-gray-900/50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Phone className="w-5 h-5 text-blue-500" />
              Registrar Actividad
            </h2>
            <p className="text-sm text-gray-400 flex items-center gap-2">
              {prospect.company_name} 
              <span className="text-gray-600">•</span> 
              <span className="text-blue-400">{prospect.contact_phone || 'Sin teléfono'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            ×
          </button>
        </div>

        {/* Main Tabs */}
        <div className="flex border-b border-gray-800 bg-gray-900/50 shrink-0">
          <button 
            onClick={() => setActiveMainTab('call')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors text-center ${activeMainTab === 'call' ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/30' : 'text-gray-400 hover:text-white hover:bg-gray-800/20'}`}
          >
            Llamada
          </button>
          <button 
            onClick={() => setActiveMainTab('steps')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors text-center ${activeMainTab === 'steps' ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/30' : 'text-gray-400 hover:text-white hover:bg-gray-800/20'}`}
          >
            Pasos del Caso
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          
          {/* TAB: PASOS (CHECKLIST) */}
          {activeMainTab === 'steps' && (
            <div className="flex-1 flex flex-col bg-gray-900/30">
              <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/20">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Progreso del Cliente</h3>
                <button 
                  onClick={() => setActiveTab('manage')} 
                  className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Configurar Pasos
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {activeTab === 'manage' ? (
                  <div className="h-full flex flex-col">
                     <div className="flex justify-between items-center mb-2">
                        <h4 className="text-white font-medium">Editar Pasos</h4>
                        <button onClick={() => setActiveTab('all')} className="text-xs text-gray-400 hover:text-white">Volver</button>
                     </div>
                     <StepManagerPanel steps={steps} onSaved={() => { onStepsUpdated(); setActiveTab('all'); }} />
                  </div>
                ) : (
                  sortedSteps.map((step, index) => {
                    const completionDate = stepCompletionDates[step.id];
                    const isCompleted = !!completionDate;
                    const isCurrent = currentStep?.id === step.id;
                    
                    return (
                      <div 
                        key={step.id}
                        className={`
                          relative flex items-center gap-3 p-4 rounded-lg border transition-all duration-200 max-w-3xl mx-auto w-full
                          ${isCompleted ? 'bg-green-900/10 border-green-900/30 opacity-70' : 'hover:bg-gray-800/50 border-gray-800'}
                          ${isCurrent && !isCompleted ? 'bg-gray-800 border-blue-500/50 shadow-lg shadow-blue-900/10' : ''}
                        `}
                      >
                        {/* Line connector */}
                        {index !== sortedSteps.length - 1 && (
                          <div className="absolute left-[1.65rem] top-10 bottom-[-1rem] w-px bg-gray-800 -z-10" />
                        )}

                        <div 
                          onClick={() => handleStepClick(step)}
                          className={`
                            w-8 h-8 rounded flex items-center justify-center shrink-0 border mt-0.5 transition-colors cursor-pointer
                            ${isCompleted ? 'bg-green-600 border-green-600 text-white' : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'}
                          `}
                        >
                          {isCompleted && <CheckIcon className="w-5 h-5" />}
                        </div>

                        {/* FECHA AL LADO DE LA CASILLA */}
                        <div className="flex flex-col justify-center min-w-[100px]">
                           {isCompleted ? (
                              <span className="text-xs font-bold text-green-400 bg-green-900/20 px-2 py-1 rounded border border-green-900/30 text-center">
                                {new Date(completionDate).toLocaleDateString()}
                              </span>
                           ) : (
                              <span className="text-[10px] text-gray-600 text-center italic">
                                --/--/----
                              </span>
                           )}
                        </div>

                        <div className="flex-1 min-w-0" onClick={() => handleStepClick(step)}>
                          <div className="flex justify-between items-center">
                            <p className={`text-base font-medium cursor-pointer ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-200'}`}>
                              {step.name}
                            </p>
                            {step.description && (
                              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded ml-2">
                                {step.description}
                              </span>
                            )}
                          </div>
                          
                          {!isCompleted && isCurrent && (
                            <p className="text-sm text-blue-400 mt-1">Paso actual sugerido</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

              </div>
            </div>
          )}

          {/* TAB: LLAMADA (FORMULARIO Y HISTORIAL) */}
          {activeMainTab === 'call' && (
            <div className="flex-1 flex flex-col bg-gray-900">
              
              {/* Formulario (Parte Superior) */}
              <div className="p-6 border-b border-gray-800 bg-gray-800/10">
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1 uppercase">Resultado de la llamada</label>
                      <select
                        value={formData.outcome}
                        onChange={(e) => setFormData(prev => ({ ...prev, outcome: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      >
                        <option value="completed">Completada (Hablé con el cliente)</option>
                        <option value="pending">Pendiente (Llamar más tarde)</option>
                        <option value="no_answer">No contesta</option>
                        <option value="voicemail">Correo de voz / Buzón</option>
                        <option value="wrong_number">Número equivocado</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1 uppercase">Próximo Seguimiento</label>
                      <div className="relative">
                        <input
                          type="date"
                          min="2020-01-01"
                          max="2030-12-31"
                          value={formData.next_call_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, next_call_date: e.target.value }))}
                          className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pl-10"
                        />
                        <CalendarIcon className="w-4 h-4 text-gray-500 absolute left-3 top-2" />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-400 mb-1 uppercase">Notas de la conversación</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                      placeholder="Escribe aquí los detalles importantes..."
                      required
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div className="text-xs text-gray-500">
                      {formData.step_completed ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-blue-400 flex items-center gap-1 font-medium">
                            <CheckIcon className="w-3 h-3" />
                            Se avanzará al siguiente paso
                          </span>
                          <span className="text-gray-500 text-[10px]">
                            Fecha de completado: {new Date(formData.next_call_date || new Date()).toLocaleDateString()} (Fecha de la llamada)
                          </span>
                        </div>
                      ) : (
                        <span>El paso actual se mantendrá pendiente</span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-900/20 transition-all hover:scale-105 active:scale-95"
                      >
                        Guardar Registro
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Historial (Parte Inferior) */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="px-6 py-3 bg-gray-900 border-b border-gray-800">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Historial de Actividad</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {callLogs.length === 0 ? (
                    <div className="text-center py-10 opacity-50">
                      <List className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">No hay llamadas registradas aún.</p>
                    </div>
                  ) : (
                    callLogs.map((log) => (
                      <div key={log.id} className="relative pl-6 pb-3 last:pb-0 border-l border-gray-800 last:border-0">
                        <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-gray-700 border-2 border-gray-900"></div>
                        <div className="bg-gray-800/50 rounded-lg p-2.5 border border-gray-800 hover:border-gray-700 transition-colors">
                          <div className="flex justify-between items-start mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-300">
                                {new Date(log.call_date).toLocaleDateString()} 
                                <span className="text-gray-500 mx-1">·</span>
                                {new Date(log.call_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {log.step_completed && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-900/30 text-green-400 border border-green-900/50">
                                  Paso Completado
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              log.outcome === 'completed' ? 'bg-blue-900/20 text-blue-300 border-blue-900/30' :
                              log.outcome === 'no_answer' ? 'bg-red-900/20 text-red-300 border-red-900/30' :
                              'bg-gray-700 text-gray-300 border-gray-600'
                            }`}>
                              {log.outcome === 'completed' ? 'Completada' : 
                               log.outcome === 'no_answer' ? 'No contesta' : 
                               log.outcome === 'voicemail' ? 'Buzón' : log.outcome}
                            </span>
                          </div>
                          
                          {log.notes && (
                            <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{log.notes}</p>
                          )}
                          
                          {log.next_call_date && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-400/80">
                              <CalendarIcon className="w-3 h-3" />
                              <span>Próxima llamada: {new Date(log.next_call_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

interface PriorityManagerModalProps {
  priorities: Priority[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

function PriorityManagerModal({ priorities, onClose, onSaved }: PriorityManagerModalProps) {
  type EditablePriority = Priority & { is_active?: boolean | number | null };

  const [items, setItems] = useState<EditablePriority[]>([]);
  const [newItem, setNewItem] = useState({ name: '', color_hex: '#3B82F6', order_index: (priorities?.length || 0) + 1, is_active: true });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadingId, setLoadingId] = useState<number | 'new' | null>(null);

  useEffect(() => {
    setItems(
      (priorities || []).map((priority) => ({
        ...priority,
        color_hex: priority.color_hex || '#3B82F6',
        is_active: Boolean((priority as any).is_active ?? true),
        order_index: priority.order_index ?? 0
      }))
    );
  }, [priorities]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const handleFieldChange = (id: number, field: keyof EditablePriority, value: unknown) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
            ...item,
            [field]:
              field === 'order_index'
                ? Number(value)
                : field === 'is_active'
                  ? value
                  : value
          }
          : item
      )
    );
  };

  const handleCreate = async () => {
    if (!newItem.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre es obligatorio.' });
      return;
    }

    setLoadingId('new');
    try {
      const response = await authFetch('/api/priorities', {
        method: 'POST',
        json: {
          name: newItem.name.trim(),
          color_hex: newItem.color_hex || '#3B82F6',
          order_index: Number(newItem.order_index) || 0,
          is_active: newItem.is_active
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'No fue posible crear la prioridad.');
      }

      setMessage({ type: 'success', text: 'Prioridad creada correctamente.' });
      setNewItem({ name: '', color_hex: '#3B82F6', order_index: (priorities?.length || 0) + 1, is_active: true });
      await onSaved();
    } catch (error) {
      console.error('Create priority error:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error al crear la prioridad.' });
    } finally {
      setLoadingId(null);
    }
  };

  const handleUpdate = async (item: EditablePriority) => {
    setLoadingId(item.id);
    try {
      const response = await authFetch(`/api/priorities/${item.id}`, {
        method: 'PUT',
        json: {
          name: (item.name || '').trim(),
          color_hex: item.color_hex || '#3B82F6',
          order_index: Number(item.order_index) || 0,
          is_active: item.is_active
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'No fue posible actualizar la prioridad.');
      }

      setMessage({ type: 'success', text: 'Prioridad actualizada.' });
      await onSaved();
    } catch (error) {
      console.error('Update priority error:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error al actualizar la prioridad.' });
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta prioridad?')) return;
    setLoadingId(id);
    try {
      const response = await authFetch(`/api/priorities/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'No fue posible eliminar la prioridad.');
      }
      setMessage({ type: 'success', text: 'Prioridad eliminada.' });
      await onSaved();
    } catch (error) {
      console.error('Delete priority error:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error al eliminar la prioridad.' });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-16">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Gestionar Prioridades</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            ×
          </button>
        </div>

        {message && (
          <div
            className={`mx-6 mt-4 mb-2 rounded-lg px-4 py-3 text-sm border ${message.type === 'success'
                ? 'border-green-500/40 bg-green-900/30 text-green-100'
                : 'border-red-500/40 bg-red-900/30 text-red-100'
              }`}
          >
            {message.text}
          </div>
        )}

        <div className="p-6 space-y-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-4">Nueva prioridad</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre de la prioridad"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-base focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Color</label>
                  <input
                    type="color"
                    value={newItem.color_hex}
                    onChange={(e) => setNewItem(prev => ({ ...prev, color_hex: e.target.value }))}
                    className="w-full h-10 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer"
                  />
                </div>
                <button
                  onClick={handleCreate}
                  disabled={loadingId === 'new'}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:text-blue-200 text-white px-4 py-2 rounded-lg transition-colors font-medium self-end"
                >
                  {loadingId === 'new' ? 'Guardando...' : 'Crear Prioridad'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400">No hay prioridades configuradas.</p>
            ) : (
              items.map(item => (
                <div key={item.id} className="border border-gray-700 rounded-lg p-4 space-y-3 bg-gray-800/30">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleFieldChange(item.id, 'name', e.target.value)}
                      placeholder="Nombre de la prioridad"
                      className="flex-1 px-4 py-2.5 border border-gray-600 rounded-lg text-white bg-gray-800 focus:ring-2 focus:ring-blue-500 text-base"
                    />
                    <input
                      type="color"
                      value={item.color_hex || '#3B82F6'}
                      onChange={(e) => handleFieldChange(item.id, 'color_hex', e.target.value)}
                      className="w-12 h-10 border border-gray-600 rounded-lg bg-gray-800 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-3 justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={Boolean(item.is_active)}
                        onChange={(e) => handleFieldChange(item.id, 'is_active', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-700 rounded"
                      />
                      Activa
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdate(item)}
                        disabled={loadingId === item.id}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:text-blue-200 text-white rounded-lg text-sm font-medium"
                      >
                        {loadingId === item.id ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={loadingId === item.id}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:text-red-200 text-white rounded-lg text-sm flex items-center gap-1 font-medium"
                      >
                        <Trash2 className="w-4 h-4" /> Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}





// Calendar View Component
function CalendarView({
  currentDate,
  onDateChange,
  prospects,
  onSelectProspect
}: {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  prospects: FollowUpProspect[];
  onSelectProspect: (prospect: FollowUpProspect) => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
  
  // Adjust for Monday start (0 = Monday, 6 = Sunday)
  const startDay = (firstDayOfMonth + 6) % 7;
  
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const prevMonth = () => {
    onDateChange(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    onDateChange(new Date(year, month + 1, 1));
  };

  const getProspectsForDay = (day: number) => {
    return prospects.filter(p => {
      if (!p.next_call_date) return false;
      const d = new Date(p.next_call_date);
      // Ajustar zona horaria local para comparación correcta de fecha
      // Usamos UTC para evitar problemas de zona horaria si la fecha viene como ISO string
      // Pero next_call_date suele ser YYYY-MM-DD o ISO. Asumimos que queremos comparar el día calendario.
      // Mejor enfoque: comparar strings YYYY-MM-DD
      
      // Convertir ambas a string YYYY-MM-DD local para comparar
      const dStr = d.toISOString().split('T')[0];
      
      // Construir string local YYYY-MM-DD para el día del calendario
      // Ojo: month es 0-indexed
      const currentMonthStr = (month + 1).toString().padStart(2, '0');
      const currentDayStr = day.toString().padStart(2, '0');
      const targetStr = `${year}-${currentMonthStr}-${currentDayStr}`;
      
      return dStr === targetStr;
    });
  };

  return (
    <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-800 overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-800/50">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <CalendarIcon className="w-6 h-6 text-blue-400" />
          {monthNames[month]} {year}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDateChange(new Date())}
            className="px-3 py-1 text-sm bg-blue-600/20 text-blue-300 rounded-md hover:bg-blue-600/30 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-800">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
          <div key={day} className="py-2 text-center text-sm font-medium text-gray-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 auto-rows-fr bg-gray-900">
        {/* Empty cells for previous month */}
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[120px] border-b border-r border-gray-800 bg-gray-900/50" />
        ))}

        {/* Days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayProspects = getProspectsForDay(day);
          const isToday = 
            day === new Date().getDate() && 
            month === new Date().getMonth() && 
            year === new Date().getFullYear();

          return (
            <div 
              key={day} 
              className={`min-h-[120px] border-b border-r border-gray-800 p-2 transition-colors hover:bg-gray-800/30 ${
                isToday ? 'bg-blue-900/10' : ''
              }`}
            >
              <div className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>
                {day}
              </div>
              
              <div className="space-y-1">
                {dayProspects.map(prospect => (
                  <button
                    key={prospect.id}
                    onClick={() => onSelectProspect(prospect)}
                    className="w-full text-left p-1.5 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-200 truncate">
                        {prospect.company_name}
                      </span>
                      {prospect.priority_color && (
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: prospect.priority_color }}
                        />
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate mt-0.5">
                      {prospect.step_name || 'Sin paso'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        
        {/* Empty cells for next month to fill grid */}
        {Array.from({ length: (7 - ((startDay + daysInMonth) % 7)) % 7 }).map((_, i) => (
          <div key={`next-${i}`} className="min-h-[120px] border-b border-r border-gray-800 bg-gray-900/50" />
        ))}
      </div>
    </div>
  );
}
