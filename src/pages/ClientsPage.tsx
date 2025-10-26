import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, UserPlus, Phone, Mail, Building, Calendar, Users, Hash } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

interface Client {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  salesperson_id?: string;
  pipeline_status_id?: string;
  created_at: string;
}

interface BAN {
  id: string;
  client_id: string;
  number: string;
  status: string;
}

interface Subscriber {
  id: string;
  ban_id: string;
  phone_number: string;
  status: string;
  months_sold: number;
  payments_made: number;
  contract_end_date: string;
}

interface Salesperson {
  id: string;
  name: string;
  avatar?: string;
}

interface Income {
  id: string;
  salesperson_id: string;
  amount: number;
  date: string;
}

const ClientsPage = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [bans, setBans] = useState<BAN[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/crm-data`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('Data received:', data);
        
        setClients(data.clients || []);
        setBans(data.bans || []);
        setSubscribers(data.subscribers || []);
        setSalespeople(data.salespeople || []);
        setIncomes(data.incomes || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helper functions
  const getSalespersonName = (salespersonId: string) => {
    const salesperson = salespeople.find(s => s.id === salespersonId);
    return salesperson?.name || 'Sin asignar';
  };

  const getClientBANs = (clientId: string) => {
    return bans.filter(ban => ban.client_id === clientId);
  };

  const getBANSubscribers = (banId: string) => {
    return subscribers.filter(sub => sub.ban_id === banId);
  };

  const getClientSubscribers = (clientId: string) => {
    const clientBANs = getClientBANs(clientId);
    return clientBANs.flatMap(ban => getBANSubscribers(ban.id));
  };

  const getNextExpirationDate = (clientId: string) => {
    const clientSubscribers = getClientSubscribers(clientId);
    if (clientSubscribers.length === 0) return null;
    
    // Filter valid dates and find the earliest
    const validDates = clientSubscribers
      .filter(sub => sub.contract_end_date && sub.contract_end_date !== 'PAGADO')
      .map(sub => new Date(sub.contract_end_date))
      .sort((a, b) => a.getTime() - b.getTime());
    
    return validDates.length > 0 ? validDates[0] : null;
  };

  const isClientCompleted = (clientId: string) => {
    return incomes.some(income => {
      const client = clients.find(c => c.id === clientId);
      return client && income.salesperson_id === client.salesperson_id;
    });
  };

  const updateClientSalesperson = async (clientId: string, salespersonId: string) => {
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ salesperson_id: salespersonId === 'unassigned' ? null : salespersonId })
      });
      
      if (response.ok) {
        const updatedClient = await response.json();
        setClients(prev => prev.map(client => 
          client.id === clientId ? { ...client, salesperson_id: updatedClient.salesperson_id } : client
        ));
      }
    } catch (error) {
      console.error('Error updating client:', error);
    }
  };

  // Processed and filtered clients
  const processedClients = useMemo(() => {
    let filtered = clients.filter(client => {
      const matchesSearch = searchTerm === '' || 
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone?.includes(searchTerm) ||
        getClientBANs(client.id).some(ban => ban.number.includes(searchTerm)) ||
        getClientSubscribers(client.id).some(sub => sub.phone_number.includes(searchTerm));
      
      if (!matchesSearch) return false;
      
      if (filterStatus === 'completed') return isClientCompleted(client.id);
      if (filterStatus === 'active') return !isClientCompleted(client.id);
      
      return true;
    });

    // Sort by next expiration date (urgent first)
    return filtered.sort((a, b) => {
      const dateA = getNextExpirationDate(a.id);
      const dateB = getNextExpirationDate(b.id);
      
      if (!dateA && !dateB) return a.name.localeCompare(b.name);
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      return dateA.getTime() - dateB.getTime();
    });
  }, [clients, bans, subscribers, incomes, searchTerm, filterStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const completedCount = clients.filter(client => isClientCompleted(client.id)).length;
  const activeCount = clients.length - completedCount;

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          📋 Gestión de Clientes
        </h1>
        <div className="flex gap-4 text-sm">
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
            🟡 Clientes: {completedCount}
          </span>
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
            🔵 Prospectos: {activeCount}
          </span>
          <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full">
            Total: {clients.length}
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por nombre, compañía, email, teléfono, BAN o suscriptor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="all">Todos</option>
            <option value="completed">Clientes</option>
            <option value="active">Prospectos</option>
          </select>
          
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Compañía
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Vendedor asignado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Número de BAN
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cantidad de suscriptores
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Fecha de vencimiento
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {processedClients.map((client) => {
                const clientBANs = getClientBANs(client.id);
                const clientSubscribers = getClientSubscribers(client.id);
                const nextExpiration = getNextExpirationDate(client.id);
                const isCompleted = isClientCompleted(client.id);
                const subscriberNumbers = clientSubscribers.slice(0, 2).map(s => s.phone_number);
                
                return (
                  <tr
                    key={client.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      isCompleted
                        ? 'bg-yellow-50 border-l-4 border-yellow-400 dark:bg-yellow-900/20'
                        : 'bg-white dark:bg-gray-800'
                    }`}
                  >
                    {/* Nombre */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {client.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          ID: {client.id.substring(0, 8)}...
                        </div>
                      </div>
                    </td>
                    
                    {/* Compañía */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-gray-900 dark:text-white">
                            {client.company || 'Sin compañía'}
                          </div>
                          {isCompleted && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              ✓ Cliente
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* Email */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">
                          {client.email || 'Sin email'}
                        </span>
                      </div>
                    </td>
                    
                    {/* Teléfono */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-gray-900 dark:text-white">
                            {client.phone || 'Sin teléfono'}
                          </div>
                          {client.mobile && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Móvil: {client.mobile}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* Vendedor asignado */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={client.salesperson_id || 'unassigned'}
                        onChange={(e) => updateClientSalesperson(client.id, e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="unassigned">Sin asignar</option>
                        {salespeople.map(sp => (
                          <option key={sp.id} value={sp.id}>{sp.name}</option>
                        ))}
                      </select>
                    </td>
                    
                    {/* Número de BAN */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-gray-400" />
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {clientBANs.length} BAN{clientBANs.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </td>
                    
                    {/* Cantidad de suscriptores */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                            {clientSubscribers.length} suscriptor{clientSubscribers.length !== 1 ? 'es' : ''}
                          </span>
                          {subscriberNumbers.length > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              📱 {subscriberNumbers.join(', ')}
                              {clientSubscribers.length > 2 && <span> +{clientSubscribers.length - 2} más...</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* Fecha de vencimiento */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          {nextExpiration ? (
                            <div className={`text-sm ${
                              nextExpiration.getTime() < Date.now() + (30 * 24 * 60 * 60 * 1000)
                                ? 'text-red-600 font-medium'
                                : 'text-gray-900 dark:text-white'
                            }`}>
                              {nextExpiration.toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              })}
                            </div>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400 text-sm">
                              {clientSubscribers.length > 0 ? 'Todos pagados' : 'Sin suscriptores'}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {processedClients.length === 0 && (
          <div className="text-center py-12">
            <UserPlus className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No se encontraron clientes
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm ? 'Prueba con otros términos de búsqueda' : 'Comienza agregando tu primer cliente'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientsPage;
