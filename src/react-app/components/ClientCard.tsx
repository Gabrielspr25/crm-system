import { useState } from "react";
import { ChevronDown, ChevronRight, Phone, Mail, Building, User, Calendar, DollarSign, Edit, Trash2, Plus } from "lucide-react";
import { Client, Vendor, ClientWithDetails } from "@/shared/types";

interface ClientCardProps {
  client: ClientWithDetails;
  vendors: Vendor[];
  onEdit: (client: Client) => void;
  onDelete: (id: number) => void;
  onAddBAN: (clientId: number) => void;
  onAddSubscriber: (banId: number) => void;
  onEditSubscriber: (subscriber: any) => void;
  onDeleteSubscriber: (subscriberId: number, banId: number) => void;
  onDeleteBAN: (banId: number) => void;
}

export default function ClientCard({ 
  client, 
  vendors, 
  onEdit, 
  onDelete, 
  onAddBAN, 
  onAddSubscriber, 
  onEditSubscriber,
  onDeleteSubscriber,
  onDeleteBAN
}: ClientCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'bans' | 'info'>('bans');

  const vendor = vendors.find(v => v.id === client.vendor_id);

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

  const handleDeleteSubscriber = (subscriberId: number, banId: number) => {
    const ban = client.bans?.find(b => b.id === banId);
    if (ban && ban.subscribers && ban.subscribers.length <= 1) {
      alert('⚠️ No se puede eliminar el último suscriptor de un BAN. Un BAN debe tener al menos un suscriptor activo.');
      return;
    }
    
    if (confirm('¿Estás seguro de que quieres eliminar este suscriptor?')) {
      onDeleteSubscriber(subscriberId, banId);
    }
  };

  const handleDeleteBAN = (banId: number) => {
    const ban = client.bans?.find(b => b.id === banId);
    if (ban && ban.subscribers && ban.subscribers.length > 0) {
      alert('⚠️ No se puede eliminar un BAN que tiene suscriptores activos. Primero elimina todos los suscriptores o transfiere el BAN.');
      return;
    }
    
    if (confirm('¿Estás seguro de que quieres eliminar este BAN?')) {
      onDeleteBAN(banId);
    }
  };

  return (
    <div className="bg-gray-100 dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200">
      {/* Main client row */}
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              ) : (
                <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              )}
            </button>
            
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${client.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{client.name}</h3>
                <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                  {client.business_name && (
                    <span className="flex items-center">
                      <Building className="w-4 h-4 mr-1" />
                      {client.business_name}
                    </span>
                  )}
                  {vendor && (
                    <span className="flex items-center">
                      <User className="w-4 h-4 mr-1" />
                      {vendor.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Only show "Con BAN" badge if client actually has BANs */}
            {client.bans && client.bans.length > 0 ? (
              <>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Con BAN
                </span>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center space-x-3">
                    <span className="font-medium">
                      {client.bans.length} BAN{client.bans.length !== 1 ? 's' : ''}
                    </span>
                    <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-full">
                      {client.bans.reduce((total, ban) => total + (ban.subscribers?.length || 0), 0)} suscriptor{client.bans.reduce((total, ban) => total + (ban.subscribers?.length || 0), 0) !== 1 ? 'es' : ''}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                Sin BAN
              </span>
            )}
            
            <button
              onClick={() => onEdit(client)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => onDelete(client.id)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          {/* Tab navigation */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('bans')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'bans'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-gray-100 dark:bg-slate-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              BANs y Suscriptores ({client.bans?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'info'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-gray-100 dark:bg-slate-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Información de Contacto
            </button>
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'bans' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">BANs Asociados</h4>
                  <button
                    onClick={() => onAddBAN(client.id)}
                    className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar BAN
                  </button>
                </div>

                {client.bans && client.bans.length > 0 ? (
                  <div className="space-y-3">
                    {client.bans.map((ban) => (
                      <div key={ban.id} className="bg-gray-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">BAN: {ban.ban_number}</div>
                            {ban.description && (
                              <div className="text-sm text-slate-600 dark:text-slate-400">{ban.description}</div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => onAddSubscriber(ban.id)}
                              className="flex items-center px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Suscriptor
                            </button>
                            <button
                              onClick={() => handleDeleteBAN(ban.id)}
                              className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {ban.subscribers && ban.subscribers.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                              {ban.subscribers.length} suscriptor{ban.subscribers.length !== 1 ? 'es' : ''} activo{ban.subscribers.length !== 1 ? 's' : ''}
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              {ban.subscribers.map((subscriber) => (
                                <div key={subscriber.id} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <Phone className="w-4 h-4 text-slate-500 dark:text-slate-400 mr-2" />
                                      <span className="font-medium text-slate-900 dark:text-slate-100">{subscriber.phone}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {subscriber.monthly_value && (
                                        <div className="flex items-center text-sm text-green-600">
                                          <DollarSign className="w-3 h-3 mr-1" />
                                          {subscriber.monthly_value}
                                        </div>
                                      )}
                                      <button
                                        onClick={() => onEditSubscriber(subscriber)}
                                        className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSubscriber(subscriber.id, ban.id)}
                                        className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                                    {subscriber.service_type && (
                                      <div className="text-xs text-slate-600 dark:text-slate-400">
                                        <span className="font-medium">Servicio:</span> {subscriber.service_type}
                                      </div>
                                    )}
                                    {subscriber.contract_start_date && (
                                      <div className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        Inicio: {new Date(subscriber.contract_start_date).toLocaleDateString()}
                                      </div>
                                    )}
                                    <div className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      {subscriber.contract_end_date
                                        ? new Date(subscriber.contract_end_date).toLocaleDateString()
                                        : 'Sin fecha'}
                                    </div>
                                    <div>
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
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-red-500 italic bg-red-50 p-3 rounded-lg border border-red-200">
                            ⚠️ Este BAN no tiene suscriptores activos - Viola regla de negocio
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400 italic">
                    No hay BANs asociados a este cliente
                  </div>
                )}
              </div>
            )}

            {activeTab === 'info' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {client.contact_person && (
                    <div className="flex items-center">
                      <User className="w-4 h-4 text-slate-500 dark:text-slate-400 mr-3" />
                      <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">Contacto</div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">{client.contact_person}</div>
                      </div>
                    </div>
                  )}
                  
                  {client.email && (
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-slate-500 dark:text-slate-400 mr-3" />
                      <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">Email</div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">{client.email}</div>
                      </div>
                    </div>
                  )}
                  
                  {client.phone && (
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 text-slate-500 dark:text-slate-400 mr-3" />
                      <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">Teléfono</div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">{client.phone}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {client.address && (
                    <div className="flex items-start">
                      <Building className="w-4 h-4 text-slate-500 dark:text-slate-400 mr-3 mt-1" />
                      <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">Dirección</div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">{client.address}</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400 mr-3" />
                    <div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Creado</div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {new Date(client.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Building className="w-4 h-4 text-slate-500 dark:text-slate-400 mr-3" />
                    <div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Base de Datos</div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {(client as any).base || 'BD propia'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
