import { useState, useEffect, useMemo } from "react";
import { X, Plus, Hash, Calendar, Edit, Ban } from "lucide-react";
import { Client, Vendor, CreateClient } from "@/shared/types";
import { getCurrentUser } from "@/react-app/utils/auth";

interface BAN {
  id: number;
  ban_number: string;
  client_id: number;
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
    base: '',
    includes_ban: false,
    vendor_id: undefined,
  });
  const [formMessage, setFormMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
        name: client.name || '',
        business_name: client.business_name ?? '',
        contact_person: client.contact_person ?? '',
        email: client.email ?? '',
        phone: client.phone ?? '',
        secondary_phone: (client as any).secondary_phone ?? '',
        mobile_phone: (client as any).mobile_phone ?? '',
        address: client.address ?? '',
        city: (client as any).city ?? '',
        zip_code: (client as any).zip_code ?? '',
        base: (client as any).base ?? 'BD propia',
        includes_ban: Boolean(client.includes_ban),
        vendor_id: client.vendor_id ?? undefined,
      });
    } else {
      // Reset form when creating new client
      setFormData({
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);

    // Usar el vendor_id del formulario, o auto-asignar si es vendedor creando nuevo cliente
    let vendorIdToUse: number | undefined = formData.vendor_id;

    // Si no hay vendor_id seleccionado y es vendedor creando nuevo cliente, auto-asignar
    if (!vendorIdToUse && !client && isVendorUser && vendorIdNumber !== undefined) {
      vendorIdToUse = vendorIdNumber;
    }

    // Solo Empresa (business_name) es obligatorio
    if (!formData.business_name?.trim()) {
      setFormMessage({ type: 'error', text: 'La empresa es obligatoria.' });
      return;
    }
    // Solo validar vendor_id si es un cliente nuevo (no tiene vendor_id existente)
    if (!client && vendorIdToUse == null) {
      setFormMessage({ type: 'error', text: 'Debe asignar un vendedor.' });
      return;
    }
    if (formData.includes_ban && client && (!clientBANs || clientBANs.length === 0 || clientBANs.every(ban => (ban.subscribers?.length ?? 0) === 0))) {
      setFormMessage({ type: 'error', text: 'Debes registrar al menos un BAN con un suscriptor activo.' });
      return;
    }

    // business_name ya está validado arriba, así que siempre será string
    const cleanData: CreateClient = {
      name: formData.name?.trim() || undefined,
      business_name: formData.business_name.trim(),
      contact_person: formData.contact_person?.trim() || undefined,
      email: formData.email?.trim() || undefined,
      phone: formData.phone?.trim() || undefined,
      secondary_phone: formData.secondary_phone?.trim() || undefined,
      mobile_phone: formData.mobile_phone?.trim() || undefined,
      address: formData.address?.trim() || undefined,
      city: formData.city?.trim() || undefined,
      zip_code: formData.zip_code?.trim() || undefined,
      includes_ban: formData.includes_ban,
      base: formData.base?.trim() || undefined,
      vendor_id: vendorIdToUse ?? undefined, // Convertir null a undefined para TypeScript
    };

    const maybePromise = onSave(cleanData);
    if (maybePromise instanceof Promise) {
      setIsSaving(true);
      maybePromise
        .then(() => {
          setFormMessage(null);
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'No fue posible guardar el cliente.';
          setFormMessage({ type: 'error', text: message });
        })
        .finally(() => {
          setIsSaving(false);
        });
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


              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name - Required */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre del Cliente
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400"
                    placeholder="Ingrese el nombre del cliente"
                  />
                </div>

                {/* Business Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Empresa *
                  </label>
                  <input
                    type="text"
                    value={formData.business_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400"
                    placeholder="Razón social de la empresa"
                    required
                  />
                </div>

                {/* Contact Person */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Persona de Contacto
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400"
                    placeholder="Nombre del contacto principal"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="text"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400"
                    placeholder="correo@ejemplo.com"
                    autoComplete="off"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400"
                    placeholder="+1 234 567 8900"
                  />
                </div>

                {/* Secondary Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Teléfono Adicional
                  </label>
                  <input
                    type="tel"
                    value={formData.secondary_phone || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, secondary_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400"
                    placeholder="Teléfono adicional"
                  />
                </div>

                {/* Mobile Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Celular
                  </label>
                  <input
                    type="tel"
                    value={formData.mobile_phone || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, mobile_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400"
                    placeholder="Número de celular"
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dirección
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400"
                    placeholder="Dirección completa del cliente"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400"
                    placeholder="Ciudad del cliente"
                  />
                </div>

                {/* Zip Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    value={formData.zip_code || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400"
                    placeholder="Código postal"
                  />
                </div>

                {/* Base */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Base de Datos
                  </label>
                  <input
                    type="text"
                    value={formData.base || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, base: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400"
                    placeholder="BD propia"
                  />
                </div>

                {/* Vendor */}
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

          {/* BANs Management Section - Only show when editing */}
          {isEditing && (
            <div className="w-96 border-l border-gray-200 dark:border-gray-700 p-6 bg-gray-800 dark:bg-gray-900 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  BANs del Cliente
                </h3>
                {onCreateBAN && (
                  <button
                    type="button"
                    onClick={onCreateBAN}
                    className="flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Nuevo BAN
                  </button>
                )}
              </div>

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
                  clientBANs.map((ban) => (
                    <div key={ban.id} className="bg-gray-700 dark:bg-gray-800 rounded-lg border border-gray-600 dark:border-gray-600 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <Hash className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
                          <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                            {ban.ban_number}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {ban.subscribers?.length || 0} subs
                          </span>
                          {onEditBAN && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onEditBAN(ban)}
                                className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                                title="Editar BAN"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditBAN(ban)}
                                className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                title="Cancelar BAN"
                              >
                                <Ban className="w-3 h-3" />
                              </button>
                            </div>
                          )}
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
                              <div>
                                <div className="font-mono text-xs text-gray-900 dark:text-gray-100">
                                  {subscriber.phone}
                                </div>
                                {subscriber.service_type && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {subscriber.service_type}
                                  </div>
                                )}
                                {subscriber.monthly_value && (
                                  <div className="text-xs text-green-600 dark:text-green-400">
                                    ${subscriber.monthly_value}/mes
                                  </div>
                                )}
                                <div className="mt-1 flex items-center gap-2">
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
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
