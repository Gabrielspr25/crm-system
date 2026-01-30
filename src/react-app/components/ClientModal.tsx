import { useState, useEffect, useMemo } from "react";
import { X, Plus, Hash, Calendar, Edit, Ban } from "lucide-react";
import { Client, Vendor, CreateClient } from "@/shared/types";
import { getCurrentUser } from "@/react-app/utils/auth";

interface BAN {
  id: number;
  ban_number: string;
  client_id: number;
  account_type?: string | null;
  description: string | null;
  status?: string;
  cancel_reason?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  subscribers?: Subscriber[];
}

interface Subscriber {
  id: number;
  phone: string;
  ban_id: number;
  contract_start_date: string | null;
  contract_end_date: string | null;
  service_type: string | null;
  monthly_value: number | null;
  months: number | null;
  remaining_payments: number | null;
  status?: string;
  cancel_reason?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface ClientModalProps {
  client?: Client | null;
  vendors: Vendor[];
  onSave: (data: CreateClient) => void | Promise<void>;
  onClose: () => void;
  clientBANs?: BAN[];
  onCreateBAN?: () => void;
  onAddSubscriber?: (banId: number) => void;
  onEditBAN?: (ban: BAN) => void;
  onEditSubscriber?: (subscriber: Subscriber, banId: number) => void;
  banRequirementPending?: boolean;
}

export default function ClientModal({
  client,
  vendors,
  onSave,
  onClose,
  clientBANs = [],
  onCreateBAN,
  onAddSubscriber,
  onEditBAN,
  onEditSubscriber,
  banRequirementPending
}: ClientModalProps) {
  const [formData, setFormData] = useState<CreateClient>({
    owner_name: '',
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    additional_phone: '',
    cellular: '',
    address: '',
    city: '',
    zip_code: '',
    tax_id: '',
    includes_ban: false,
    vendor_id: undefined,
  });
  const [formMessage, setFormMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingToPOS, setIsSendingToPOS] = useState(false);
  const [posSuccessId, setPosSuccessId] = useState<number | null>(null);

  const authUser = getCurrentUser();
  const isVendorUser = authUser?.role === "vendedor";
  const parsedVendorId = authUser?.salespersonId != null ? Number(authUser.salespersonId) : NaN;
  const vendorIdNumber = isVendorUser && !Number.isNaN(parsedVendorId) ? parsedVendorId : undefined;

  const availableVendors = useMemo(() => {
    // Todos los usuarios ven todos los vendedores (pueden cambiar la asignación)
    return vendors;
  }, [vendors]);

  // Auto-asignar al vendedor si es nuevo cliente y es vendedor, pero permitir cambios
  const effectiveVendorId = formData.vendor_id ?? (isVendorUser && !client ? vendorIdNumber : undefined);

  const banRequirementActive = Boolean(banRequirementPending);

  const getExpirationBadge = (contractEndDate: string | null | undefined) => {
    if (!contractEndDate) {
      return {
        label: 'Vencido +30 días',
        className: 'bg-red-900/60 text-red-100 border border-red-500/40',
      };
    }

    const endDate = new Date(contractEndDate);
    const today = new Date();
    const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Vencido hace ${Math.abs(diffDays)} día${Math.abs(diffDays) !== 1 ? 's' : ''}`,
        className: 'bg-red-900/60 text-red-100 border border-red-500/40',
      };
    }
    if (diffDays <= 15) {
      return {
        label: `Vence en ${diffDays} día${diffDays !== 1 ? 's' : ''}`,
        className: 'bg-orange-900/60 text-orange-100 border border-orange-500/40',
      };
    }
    if (diffDays <= 30) {
      return {
        label: `Vence en ${diffDays} día${diffDays !== 1 ? 's' : ''}`,
        className: 'bg-yellow-900/60 text-yellow-100 border border-yellow-500/40',
      };
    }
    return {
      label: `Vence en ${diffDays} día${diffDays !== 1 ? 's' : ''}`,
      className: 'bg-green-900/60 text-green-100 border border-green-500/40',
    };
  };

  useEffect(() => {
    if (client) {
      setFormData({
        owner_name: (client as any).owner_name ?? '',
        name: client.name || '',
        contact_person: client.contact_person ?? '',
        email: client.email ?? '',
        phone: client.phone ?? '',
        additional_phone: (client as any).additional_phone ?? '',
        cellular: (client as any).cellular ?? '',
        address: client.address ?? '',
        city: (client as any).city ?? '',
        zip_code: (client as any).zip_code ?? '',
        tax_id: (client as any).tax_id ?? '',
        includes_ban: Boolean(client.includes_ban),
        vendor_id: client.vendor_id ?? undefined,
      });
    } else {
      // Reset form when creating new client
      setFormData({
        owner_name: '',
        name: '',
        business_name: '',
        contact_person: '',
        email: '',
        phone: '',
        secondary_phone: '',
        mobile_phone: '',
        address: '',
        city: '',
        zip_code: '',
        tax_id: '',
        base: 'BD propia',
        includes_ban: false,
        vendor_id: undefined,
      });
    }

    // Si es vendedor creando nuevo cliente, auto-asignar su vendor_id por defecto
    if (!client && isVendorUser && vendorIdNumber !== undefined) {
      setFormData((prev) => ({ ...prev, vendor_id: vendorIdNumber }));
    }

    setFormMessage(null);
    setIsSaving(false);
  }, [client, isVendorUser, vendorIdNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);
    setIsSaving(true);

    try {
      await onSave(formData);
    } catch (error: any) {
      // Manejar error 409 del backend
      if (error.message && error.message.includes('Ya existe un cliente')) {
        setFormMessage({ type: 'error', text: error.message });
      } else {
        setFormMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error al guardar el cliente' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnviarAPOS = async () => {
    if (!client) {
      setFormMessage({ type: 'error', text: 'Debe guardar el cliente primero antes de enviar al POS' });
      return;
    }

    setIsSendingToPOS(true);
    setFormMessage(null);
    setPosSuccessId(null);

    try {
      const response = await authFetch('/api/pos/enviar-cliente', {
        method: 'POST',
        json: {
          ...client,
          tax_id: formData.tax_id || client.tax_id,
          salesperson_id: effectiveVendorId
        }
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Error al enviar cliente al POS' }));
        throw new Error(result.error || 'Error al enviar cliente al POS');
      }

      const result = await response.json();

      setPosSuccessId(result.clientecreditoid);
      setFormMessage({ 
        type: 'success', 
        text: `✅ Cliente enviado al POS exitosamente. ID POS: ${result.clientecreditoid}` 
      });
    } catch (error: any) {
      setFormMessage({ 
        type: 'error', 
        text: error.message || 'Error al enviar cliente al POS' 
      });
    } finally {
      setIsSendingToPOS(false);
    }
  };

  const isEditing = !!client;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 dark:bg-gray-800 rounded-xl shadow-xl max-w-7xl w-full h-[95vh] flex flex-col border border-gray-600 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-600 dark:border-gray-700 bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-800 dark:to-gray-700 rounded-t-xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {client ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h2>
          <button
            onClick={() => {
              if (!banRequirementActive && !isSaving) {
                onClose();
              }
            }}
            disabled={banRequirementActive || isSaving}
            className={`p-2 rounded-lg transition-colors ${banRequirementActive || isSaving
                ? 'cursor-not-allowed text-gray-400 dark:text-gray-600'
                : 'hover:bg-gray-200/50 dark:hover:bg-gray-700'
              }`}
          >
            <X className={`w-5 h-5 ${banRequirementActive || isSaving ? 'text-gray-500 dark:text-gray-600' : 'text-gray-600 dark:text-gray-400'}`} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Form Section */}
          <div className="flex-1 p-6 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {formMessage && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${formMessage.type === 'error'
                      ? 'border-red-500/60 bg-red-900/40 text-red-100'
                      : 'border-green-500/60 bg-green-900/40 text-green-100'
                    }`}
                >
                  {formMessage.text}
                </div>
              )}

              {banRequirementActive && (
                <div className="rounded-lg border border-yellow-500/60 bg-yellow-900/40 text-yellow-100 px-4 py-3 text-sm">
                  Este cliente requiere al menos un BAN con un suscriptor activo antes de finalizar (o actualiza el registro desmarcando la opción de BAN).
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Empresa / Razón Social */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Empresa / Razón Social *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: SAN GERMAN GLASS CORP"
                    required
                  />
                </div>

                {/* RNC / Cédula */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    RNC / Cédula *
                  </label>
                  <input
                    type="text"
                    value={formData.tax_id || ''}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="RNC o Cédula fiscal"
                    required
                  />
                </div>

                {/* Nombre y Apellido Dueño */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre y Apellido Dueño
                  </label>
                  <input
                    type="text"
                    value={formData.owner_name || ''}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Juan Pérez"
                  />
                </div>

                {/* Persona de Contacto */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Persona de Contacto *
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person || ''}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: María González"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="correo@ejemplo.com"
                    autoComplete="off"
                    required
                  />
                </div>

                {/* Teléfono Principal */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Teléfono Principal *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 787 234 5678"
                    required
                  />
                </div>

                {/* Celular */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Celular *
                  </label>
                  <input
                    type="tel"
                    value={formData.cellular || ''}
                    onChange={(e) => setFormData({ ...formData, cellular: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 787 999 8888"
                    required
                  />
                </div>

                {/* Teléfono Adicional */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Teléfono Adicional
                  </label>
                  <input
                    type="tel"
                    value={formData.additional_phone || ''}
                    onChange={(e) => setFormData({ ...formData, additional_phone: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Teléfono adicional (opcional)"
                  />
                </div>

                {/* Dirección */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dirección *
                  </label>
                  <textarea
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Dirección completa del cliente"
                    required
                  />
                </div>

                {/* Ciudad */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ciudad *
                  </label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ciudad del cliente"
                    required
                  />
                </div>

                {/* Código Postal */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Código Postal *
                  </label>
                  <input
                    type="text"
                    value={formData.zip_code || ''}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Código postal"
                    required
                  />
                </div>

                {/* Vendedor Asignado */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Vendedor Asignado *
                  </label>
                  <select
                    value={effectiveVendorId ?? ''}
                    onChange={(e) => {
                      const nextId = e.target.value ? parseInt(e.target.value, 10) : undefined;
                      setFormData(prev => ({
                        ...prev,
                        vendor_id: Number.isNaN(nextId) ? undefined : nextId,
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100"
                    required
                  >
                    <option value="">Seleccione un vendedor</option>
                    {availableVendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                  {isVendorUser && !client && effectiveVendorId === vendorIdNumber && (
                    <p className="mt-2 text-xs text-green-400 dark:text-green-400">
                      ✅ Auto-asignado a tu usuario. Puedes cambiarlo si es necesario.
                    </p>
                  )}
                </div>

                {/* Includes BAN */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Configuración de BAN
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="includes_ban"
                      checked={formData.includes_ban}
                      onChange={(e) => setFormData(prev => ({ ...prev, includes_ban: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-600 rounded focus:ring-blue-500 bg-gray-800 dark:bg-gray-800"
                    />
                    <label htmlFor="includes_ban" className="text-sm text-gray-300">
                      Este cliente incluye BANs
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={banRequirementActive || isSaving}
                  className={`px-4 py-2 rounded-lg transition-colors ${banRequirementActive || isSaving
                      ? 'text-gray-500 dark:text-gray-500 bg-gray-200/50 dark:bg-gray-700/50 cursor-not-allowed'
                      : 'text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                  Cancelar
                </button>
                
                {/* Botón Enviar a POS - Solo visible si es edición */}
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleEnviarAPOS}
                    disabled={isSendingToPOS || isSaving || !!posSuccessId}
                    className={`px-6 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                      posSuccessId
                        ? 'bg-green-600 text-white cursor-default'
                        : isSendingToPOS
                        ? 'bg-purple-900/60 text-purple-200 cursor-wait'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/25'
                    }`}
                  >
                    {posSuccessId ? (
                      <>
                        <span>✓</span>
                        <span>Enviado al POS</span>
                      </>
                    ) : isSendingToPOS ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <span>📤</span>
                        <span>Enviar a POS</span>
                      </>
                    )}
                  </button>
                )}
                
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-6 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/25 ${isSaving
                      ? 'bg-blue-900/60 text-blue-200 cursor-wait'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                    }`}
                >
                  {isSaving ? 'Guardando...' : client ? 'Actualizar Cliente' : 'Crear Cliente'}
                </button>
              </div>
            </form>
          </div>

          {isEditing && (
            <div className="w-full md:w-96 border-l border-gray-200 dark:border-gray-700 p-6 bg-gray-800 dark:bg-gray-900 flex flex-col overflow-hidden">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                BANs del Cliente
              </h3>
              <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                {clientBANs.length === 0 ? (
                  <div className="text-center py-8">
                    <Hash className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Este cliente no tiene BANs
                    </p>
                    {onCreateBAN && (
                      <button
                        type="button"
                        onClick={onCreateBAN}
                        className="mt-3 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                      >
                        Crear el primer BAN
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                  {console.log('🔴🔴🔴 ClientModal - clientBANs ANTES del map:', clientBANs)}
                  {console.log('🔴🔴🔴 ClientModal - clientBANs.length:', clientBANs.length)}
                  {clientBANs.map((ban) => {
                    console.log('🟡 Renderizando BAN:', ban.ban_number, 'account_type:', ban.account_type);
                    return (
                    <div key={ban.id} className="bg-gray-700 dark:bg-gray-800 rounded-lg border border-gray-600 dark:border-gray-600 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center">
                            <Hash className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
                            <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                              BAN: {ban.ban_number}
                            </span>
                          </div>
                          {ban.account_type && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-900/40 text-blue-200 border border-blue-500/30">
                              {ban.account_type}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {onEditBAN && (
                            <button
                              type="button"
                              onClick={() => onEditBAN(ban)}
                              className="p-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                              title="Editar BAN"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('¿Estás seguro de que deseas eliminar este BAN?')) {
                                // Lógica para eliminar el BAN
                              }
                            }}
                            className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                            title="Eliminar BAN"
                          >
                            <Ban className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {ban.description && (
                        <p className="text-xs text-gray-300 mb-3">
                          {ban.description}
                        </p>
                      )}

                      {/* Subscribers */}
                      <div className="space-y-2">
                        {ban.subscribers && ban.subscribers.length > 0 ? (
                          ban.subscribers.map((subscriber) => (
                            <div key={subscriber.id} className="flex items-center justify-between bg-gray-600 dark:bg-gray-700 rounded p-2">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3" />
                                <div className="font-mono text-xs text-gray-900 dark:text-gray-100">
                                  {subscriber.phone}
                                </div>
                                {subscriber.service_type && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {subscriber.service_type}
                                  </div>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                {subscriber.monthly_value && (
                                  <div className="text-xs text-green-600 dark:text-green-400">
                                    ${subscriber.monthly_value}/mes
                                  </div>
                                )}
                                <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {subscriber.contract_end_date
                                    ? new Date(subscriber.contract_end_date).toLocaleDateString()
                                    : 'Sin fecha'}
                                </div>
                                {(() => {
                                  const { label, className } = getExpirationBadge(subscriber.contract_end_date);
                                  return (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${className}`}>
                                      {label}
                                    </span>
                                  );
                                })()}
                              </div>
                              {onEditSubscriber && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onEditSubscriber(subscriber, ban.id)}
                                    className="p-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                                    title="Editar Suscriptor"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onEditSubscriber(subscriber, ban.id)}
                                    className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                                    title="Cancelar Suscriptor"
                                  >
                                    <Ban className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))

                        ) : (
                          <div className="text-center py-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Sin suscriptores</p>
                          </div>
                        )}
                        {onAddSubscriber && (
                          <button
                            type="button"
                            onClick={() => onAddSubscriber(ban.id)}
                            className="w-full flex items-center justify-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Agregar Suscriptor
                          </button>
                        )}
                      </div>
                    </div>
                  );
                  })}
                  </>

                )}              </div>            </div>
          )}
        </div>
      </div>
    </div>
  );
}
