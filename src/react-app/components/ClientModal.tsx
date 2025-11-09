import { useState, useEffect } from "react";
import { X, Plus, Hash } from "lucide-react";
import { Client, Vendor, CreateClient } from "@/shared/types";

interface BAN {
  id: number;
  ban_number: string;
  client_id: number;
  description: string | null;
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
  banRequirementPending
}: ClientModalProps) {
  const [formData, setFormData] = useState<CreateClient>({
    name: '',
    business_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    includes_ban: false,
    vendor_id: undefined,
  });
  const [formMessage, setFormMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const banRequirementActive = Boolean(banRequirementPending);

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        business_name: client.business_name ?? '',
        contact_person: client.contact_person ?? '',
        email: client.email ?? '',
        phone: client.phone ?? '',
        address: client.address ?? '',
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
        address: '',
        includes_ban: false,
        vendor_id: undefined,
      });
    }
    setFormMessage(null);
    setIsSaving(false);
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);

    if (!formData.name?.trim()) {
      setFormMessage({ type: 'error', text: 'El nombre del cliente es obligatorio.' });
      return;
    }
    if (!formData.business_name?.trim()) {
      setFormMessage({ type: 'error', text: 'La razón social es obligatoria.' });
      return;
    }
    if (!formData.contact_person?.trim()) {
      setFormMessage({ type: 'error', text: 'La persona de contacto es obligatoria.' });
      return;
    }
    if (!formData.email?.trim()) {
      setFormMessage({ type: 'error', text: 'El email es obligatorio.' });
      return;
    }
    if (!formData.phone?.trim()) {
      setFormMessage({ type: 'error', text: 'El teléfono es obligatorio.' });
      return;
    }
    if (!formData.address?.trim()) {
      setFormMessage({ type: 'error', text: 'La dirección es obligatoria.' });
      return;
    }
    if (!formData.vendor_id) {
      setFormMessage({ type: 'error', text: 'Debe asignar un vendedor.' });
      return;
    }
    if (formData.includes_ban && client && (!clientBANs || clientBANs.length === 0 || clientBANs.every(ban => (ban.subscribers?.length ?? 0) === 0))) {
      setFormMessage({ type: 'error', text: 'Debes registrar al menos un BAN con un suscriptor activo.' });
      return;
    }

    const cleanData: CreateClient = {
      name: formData.name.trim(),
      business_name: formData.business_name.trim(),
      contact_person: formData.contact_person.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      includes_ban: formData.includes_ban,
      vendor_id: formData.vendor_id,
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-16">
      <div className="bg-gray-200 dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-t-xl">
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
            className={`p-2 rounded-lg transition-colors ${
              banRequirementActive || isSaving
                ? 'cursor-not-allowed text-gray-400 dark:text-gray-600'
                : 'hover:bg-gray-200/50 dark:hover:bg-gray-700'
            }`}
          >
            <X className={`w-5 h-5 ${banRequirementActive || isSaving ? 'text-gray-500 dark:text-gray-600' : 'text-gray-600 dark:text-gray-400'}`} />
          </button>
        </div>

        <div className="flex">
          {/* Form Section */}
          <div className="flex-1 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {formMessage && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    formMessage.type === 'error'
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre del Cliente *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
                    placeholder="Ingrese el nombre del cliente"
                    required
                  />
                </div>

                {/* Business Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    value={formData.business_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
                    placeholder="Razón social de la empresa"
                    required
                  />
                </div>

                {/* Contact Person */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Persona de Contacto *
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
                    placeholder="Nombre del contacto principal"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
                    placeholder="correo@ejemplo.com"
                    required
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
                    placeholder="+1 234 567 8900"
                    required
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dirección *
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Dirección completa del cliente"
                    required
                  />
                </div>

                {/* Vendor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Vendedor Asignado *
                  </label>
                  <select
                    value={formData.vendor_id || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      vendor_id: e.target.value ? parseInt(e.target.value) : undefined 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100"
                    required
                  >
                    <option value="">Seleccione un vendedor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Includes BAN */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Configuración de BAN
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="includes_ban"
                      checked={formData.includes_ban}
                      onChange={(e) => setFormData(prev => ({ ...prev, includes_ban: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 bg-gray-800 dark:bg-gray-800"
                    />
                    <label htmlFor="includes_ban" className="text-sm text-gray-700 dark:text-gray-300">
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
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    banRequirementActive || isSaving
                      ? 'text-gray-500 dark:text-gray-500 bg-gray-200/50 dark:bg-gray-700/50 cursor-not-allowed'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-6 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/25 ${
                    isSaving
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
            <div className="w-96 border-l border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between mb-4">
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

              <div className="space-y-3 max-h-96 overflow-y-auto">
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
                    <div key={ban.id} className="bg-gray-200 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <Hash className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
                          <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                            {ban.ban_number}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {ban.subscribers?.length || 0} subs
                          </span>
                        </div>
                      </div>
                      
                      {ban.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                          {ban.description}
                        </p>
                      )}

                      {/* Subscribers */}
                      <div className="space-y-2">
                        {ban.subscribers && ban.subscribers.length > 0 ? (
                          ban.subscribers.map((subscriber) => (
                            <div key={subscriber.id} className="flex items-center justify-between bg-gray-300 dark:bg-gray-700 rounded p-2">
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
                              </div>
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
                            className="w-full flex items-center justify-center px-2 py-1.5 border border-dashed border-gray-300 dark:border-gray-600 rounded text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                          >
                            <Plus className="w-3 h-3 mr-1" />
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
