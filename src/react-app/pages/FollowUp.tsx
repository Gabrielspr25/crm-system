import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Phone, Edit3, Settings, Trash2 } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { authFetch, getCurrentUser } from "@/react-app/utils/auth";

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
  client_id: number | null;
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
}

interface Client {
  id: number;
  name: string;
  business_name: string | null;
  is_active: number;
}

export default function FollowUp() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProspect, setSelectedProspect] = useState<FollowUpProspect | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showPriorityManager, setShowPriorityManager] = useState(false);
  const [showStepManager, setShowStepManager] = useState(false);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);

  const { data: prospects, loading, refetch: refetchProspects } = useApi<FollowUpProspect[]>("/api/follow-up-prospects");
  const { data: priorities, refetch: refetchPriorities } = useApi<Priority[]>("/api/priorities");
  const { data: vendors } = useApi<Vendor[]>("/api/vendors");
  const { data: steps, refetch: refetchSteps } = useApi<FollowUpStep[]>("/api/follow-up-steps");
  const { data: clients } = useApi<Client[]>("/api/clients");

  const uniqueProspects = useMemo(() => {
    const seen = new Map<number, FollowUpProspect>();
    (prospects || []).forEach((prospect) => {
      const key = prospect.client_id ?? prospect.id;
      if (!seen.has(key)) {
        seen.set(key, prospect);
      }
    });
    return Array.from(seen.values()).filter(
      (prospect) => Boolean(prospect.is_active ?? true) && !Boolean(prospect.is_completed)
    );
  }, [prospects]);

  const filteredProspects = uniqueProspects.filter(prospect =>
    prospect.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (prospect.vendor_name && prospect.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
    setSelectedProspect(prospect);
    setShowModal(true);
  };

  const handleCall = async (prospect: FollowUpProspect) => {
    setSelectedProspect(prospect);

    // Fetch call logs for this prospect
    try {
      const response = await authFetch(`/api/call-logs/${prospect.id}`);
      const logs = await response.json();
      setCallLogs(logs);
    } catch (error) {
      console.error("Error fetching call logs:", error);
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
  }) => {
    try {
      await authFetch('/api/call-logs', {
        method: 'POST',
        json: {
          follow_up_id: selectedProspect?.id,
          call_date: new Date().toISOString(),
          ...callData
        }
      });

      refetchProspects();
      setShowCallModal(false);
      setSelectedProspect(null);
    } catch (error) {
      console.error("Error saving call log:", error);
    }
  };

  const handleReturnToBD = async (prospect: FollowUpProspect) => {
    if (!confirm(`¿Devolver "${prospect.company_name}" a la base de datos?`)) {
      return;
    }

    try {
      await authFetch(`/api/follow-up-prospects/${prospect.id}`, {
        method: 'PUT',
        json: {
          is_active: false,
          is_completed: false
        }
      });

      refetchProspects();
    } catch (error) {
      console.error("Error returning prospect to BD:", error);
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
          <h1 className="text-3xl font-bold text-white">Seguimiento</h1>
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

      {/* Search */}
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

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowPriorityManager(true)}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Gestionar Prioridades
        </button>
        <button
          onClick={() => setShowStepManager(true)}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Gestionar Pasos
        </button>
      </div>

      {/* Table */}
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
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha Update</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-800">
              {filteredProspects.map((prospect) => (
                <tr key={prospect.id} className="hover:bg-gray-800 transition-colors">
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
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-300">{prospect.fijo_ren || 0}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-300">{prospect.fijo_new || 0}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-300">{prospect.movil_nueva || 0}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-300">{prospect.movil_renovacion || 0}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-300">{prospect.claro_tv || 0}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-300">{prospect.cloud || 0}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
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
                        className="text-orange-400 hover:text-orange-300 transition-colors"
                        title="Devolver a BD"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredProspects.length === 0 && (
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
          clients={clients || []}
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

      {showStepManager && (
        <StepManagerModal
          steps={steps || []}
          onClose={() => setShowStepManager(false)}
          onSaved={async () => {
            await refetchProspects();
            await refetchSteps();
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
  onSave: (data: Partial<FollowUpProspect>) => void;
  onClose: () => void;
  enforcedVendorId?: number;
  disableVendorSelect?: boolean;
}) {
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
    is_completed: prospect?.is_completed || false
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
      is_completed: prospect?.is_completed || false
    });
  }, [prospect, enforcedVendorId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedVendorId = disableVendorSelect && enforcedVendorId != null
      ? enforcedVendorId
      : formData.vendor_id
        ? parseInt(formData.vendor_id.toString(), 10)
        : null;

    const data = {
      ...formData,
      client_id: formData.client_id ? parseInt(formData.client_id.toString(), 10) : null,
      priority_id: formData.priority_id ? parseInt(formData.priority_id.toString(), 10) : null,
      vendor_id: resolvedVendorId,
      step_id: formData.step_id ? parseInt(formData.step_id.toString(), 10) : null,
    };

    onSave(data);
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
                  Cliente Existente
                </label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                >
                  <option value="">Nuevo prospecto (no cliente existente)</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.business_name || client.name}
                    </option>
                  ))}
                </select>
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

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Paso
                </label>
                <select
                  value={formData.step_id}
                  onChange={(e) => setFormData({ ...formData, step_id: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                >
                  <option value="">Seleccionar paso</option>
                  {steps.map(step => (
                    <option key={step.id} value={step.id}>
                      {step.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Base de Datos
                </label>
                <input
                  type="text"
                  value={formData.base}
                  onChange={(e) => setFormData({ ...formData, base: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  placeholder="BD propia"
                />
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
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {prospect ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
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
  onClose
}: {
  prospect: FollowUpProspect;
  callLogs: CallLog[];
  onSave: (data: { notes: string; outcome: string; next_call_date: string }) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    notes: '',
    outcome: 'completed',
    next_call_date: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-16">
      <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">Registrar Llamada</h2>
            <p className="text-sm text-gray-400">{prospect.company_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-800">
          <div className="p-6 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Resultado</label>
                <select
                  value={formData.outcome}
                  onChange={(e) => setFormData(prev => ({ ...prev, outcome: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="completed">Completada</option>
                  <option value="pending">Pendiente</option>
                  <option value="no_answer">No contesta</option>
                  <option value="voicemail">Correo de voz</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Próxima llamada (solo fecha)</label>
                <input
                  type="date"
                  value={formData.next_call_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, next_call_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Resultados de la llamada, acuerdos, próximas acciones..."
                  required
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Guardar llamada
                </button>
              </div>
            </form>
          </div>

          <div className="p-6 bg-gray-850">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Historial de llamadas</h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {callLogs.length === 0 ? (
                <p className="text-sm text-gray-500">Aún no hay llamadas registradas.</p>
              ) : (
                callLogs.map((log) => (
                  <div key={log.id} className="bg-gray-800 rounded-lg p-3 border border-gray-750">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{new Date(log.call_date).toLocaleString()}</span>
                      <span>{log.outcome || 'N/A'}</span>
                    </div>
                    {log.notes && (
                      <p className="text-sm text-gray-200 mt-2 whitespace-pre-line">{log.notes}</p>
                    )}
                    {log.next_call_date && (
                      <p className="text-xs text-blue-400 mt-1">Próxima llamada: {new Date(log.next_call_date).toLocaleDateString()}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
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
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-4">Nueva prioridad</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre"
                className="px-3 py-2 bg-gray-850 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="color"
                value={newItem.color_hex}
                onChange={(e) => setNewItem(prev => ({ ...prev, color_hex: e.target.value }))}
                className="w-full h-10 bg-gray-850 border border-gray-700 rounded-lg"
              />
              <input
                type="number"
                value={newItem.order_index}
                onChange={(e) => setNewItem(prev => ({ ...prev, order_index: Number(e.target.value) }))}
                className="px-3 py-2 bg-gray-850 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Orden"
              />
              <button
                onClick={handleCreate}
                disabled={loadingId === 'new'}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:text-blue-200 text-white px-3 py-2 rounded-lg transition-colors"
              >
                {loadingId === 'new' ? 'Guardando...' : 'Crear Prioridad'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400">No hay prioridades configuradas.</p>
            ) : (
              items.map(item => (
                <div key={item.id} className="border border-gray-700 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleFieldChange(item.id, 'name', e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-600 rounded-lg text-white bg-transparent focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="color"
                      value={item.color_hex || '#3B82F6'}
                      onChange={(e) => handleFieldChange(item.id, 'color_hex', e.target.value)}
                      className="w-full h-8 border border-gray-600 rounded-lg bg-transparent"
                    />
                    <input
                      type="number"
                      value={item.order_index ?? 0}
                      onChange={(e) => handleFieldChange(item.id, 'order_index', Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-600 rounded-lg text-white bg-transparent focus:ring-2 focus:ring-blue-500"
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={Boolean(item.is_active)}
                        onChange={(e) => handleFieldChange(item.id, 'is_active', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-700 rounded"
                      />
                      Activa
                    </label>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleUpdate(item)}
                        disabled={loadingId === item.id}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:text-blue-200 text-white rounded-lg text-sm"
                      >
                        {loadingId === item.id ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={loadingId === item.id}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:text-red-200 text-white rounded-lg text-sm flex items-center gap-1"
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

interface StepManagerModalProps {
  steps: FollowUpStep[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

function StepManagerModal({ steps, onClose, onSaved }: StepManagerModalProps) {
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-16">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Gestionar Pasos de Seguimiento</h2>
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
          <div className="border border-gray-700 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-white mb-3">Nuevo paso</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre"
                className="w-full px-3 py-1.5 border border-gray-600 rounded-lg text-white bg-transparent focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={newItem.description}
                onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción"
                className="w-full px-3 py-1.5 border border-gray-600 rounded-lg text-white bg-transparent focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                value={newItem.order_index}
                onChange={(e) => setNewItem(prev => ({ ...prev, order_index: Number(e.target.value) }))}
                className="w-full px-3 py-1.5 border border-gray-600 rounded-lg text-white bg-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="Orden"
              />
              <button
                onClick={handleCreate}
                disabled={loadingId === 'new'}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:text-blue-200 text-white px-3 py-2 rounded-lg transition-colors"
              >
                {loadingId === 'new' ? 'Guardando...' : 'Crear Paso'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400">No hay pasos configurados.</p>
            ) : (
              items.map(item => (
                <div key={item.id} className="border border-gray-700 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleFieldChange(item.id, 'name', e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-600 rounded-lg text-white bg-transparent focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={item.description || ''}
                      onChange={(e) => handleFieldChange(item.id, 'description', e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-600 rounded-lg text-white bg-transparent focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      value={item.order_index ?? 0}
                      onChange={(e) => handleFieldChange(item.id, 'order_index', Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-600 rounded-lg text-white bg-transparent focus:ring-2 focus:ring-blue-500"
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={Boolean((item as any).is_active ?? true)}
                        onChange={(e) => setItems(prev => prev.map(p => p.id === item.id ? { ...p, is_active: e.target.checked } : p))}
                        className="w-4 h-4 text-blue-600 border-gray-700 rounded"
                      />
                      Activo
                    </label>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleUpdate(item)}
                        disabled={loadingId === item.id}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:text-blue-200 text-white rounded-lg text-sm"
                      >
                        {loadingId === item.id ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={loadingId === item.id}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:text-red-200 text-white rounded-lg text-sm flex items-center gap-1"
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
