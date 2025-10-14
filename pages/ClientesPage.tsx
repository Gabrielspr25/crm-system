import React, { useState, useEffect } from 'react';
import { useCrmData } from '../hooks/useCrmData';

interface Cliente {
  id: string;
  company: string;
  name: string;
  email: string;
  phone: string;
  bans: Ban[];
  vendedorAsignado?: string;
}

interface Ban {
  id: string;
  number: string;
  subscribers: Subscriber[];
}

interface Subscriber {
  id: string;
  phoneNumber: string;
  contractEndDate: string;
  status: string;
  plan: string;
}

const ClientesPage: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Usuario actual (en producción vendría del contexto de auth)
  const [currentUser, setCurrentUser] = useState({
    id: 'admin',
    name: 'Administrador',
    role: 'admin' // 'admin' | 'vendedor'
  });

  const vendedores = [
    { id: '', name: 'Sin asignar' },
    { id: 'vendedor1', name: 'Juan Pérez' },
    { id: 'vendedor2', name: 'María García' },
    { id: 'vendedor3', name: 'Carlos López' },
    { id: 'vendedor4', name: 'Ana Rodríguez' }
  ];

  // Simular carga de datos (reemplazar con useCrmData real)
  useEffect(() => {
    setIsLoading(true);
    // Simular datos para demo
    setTimeout(() => {
      const mockClientes: Cliente[] = [
        {
          id: 'client1',
          company: 'Empresa ABC',
          name: 'Juan Pérez',
          email: 'juan@abc.com',
          phone: '787-555-0001',
          vendedorAsignado: 'vendedor1',
          bans: [
            {
              id: 'ban1',
              number: '618093419',
              subscribers: [
                {
                  id: 'sub1',
                  phoneNumber: '7873750202',
                  contractEndDate: '2024-12-15', // VENCIDO
                  status: 'A',
                  plan: 'BREDE4'
                }
              ]
            }
          ]
        },
        {
          id: 'client2',
          company: 'Tech Solutions',
          name: 'María García',
          email: 'maria@tech.com',
          phone: '787-555-0002',
          vendedorAsignado: 'vendedor2',
          bans: [
            {
              id: 'ban2',
              number: '711718822',
              subscribers: [
                {
                  id: 'sub2',
                  phoneNumber: '9392724054',
                  contractEndDate: '2025-03-20', // POR VENCER
                  status: 'A',
                  plan: 'RED3535'
                }
              ]
            }
          ]
        },
        {
          id: 'client3',
          company: '',
          name: 'Cliente Sin Empresa',
          email: 'cliente@email.com',
          phone: '787-555-0003',
          vendedorAsignado: '',
          bans: [
            {
              id: 'ban3',
              number: '751691619',
              subscribers: [
                {
                  id: 'sub3',
                  phoneNumber: '9394609091',
                  contractEndDate: '2026-01-10', // VIGENTE
                  status: 'A',
                  plan: 'RED3535'
                }
              ]
            }
          ]
        }
      ];
      setClientes(mockClientes);
      setFilteredClientes(mockClientes);
      setIsLoading(false);
    }, 1000);
  }, []);

  // Función para obtener la fecha de vencimiento más próxima del cliente
  const getEarliestExpirationDate = (cliente: Cliente): Date => {
    let earliestDate = new Date('2099-12-31');
    
    cliente.bans.forEach(ban => {
      ban.subscribers.forEach(sub => {
        if (sub.contractEndDate) {
          const date = new Date(sub.contractEndDate);
          if (date < earliestDate) {
            earliestDate = date;
          }
        }
      });
    });
    
    return earliestDate;
  };

  // Función para determinar el estado del contrato
  const getContractStatus = (cliente: Cliente): 'vencido' | 'por-vencer' | 'vigente' => {
    const earliestDate = getEarliestExpirationDate(cliente);
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    if (earliestDate < today) {
      return 'vencido';
    } else if (earliestDate <= thirtyDaysFromNow) {
      return 'por-vencer';
    } else {
      return 'vigente';
    }
  };

  // Ordenar clientes por prioridad (vencidos → por vencer → vigentes)
  const sortClientesByExpiration = (clientesList: Cliente[]): Cliente[] => {
    return [...clientesList].sort((a, b) => {
      const statusOrder = { 'vencido': 0, 'por-vencer': 1, 'vigente': 2 };
      const statusA = getContractStatus(a);
      const statusB = getContractStatus(b);
      
      if (statusA !== statusB) {
        return statusOrder[statusA] - statusOrder[statusB];
      }
      
      // Si tienen el mismo status, ordenar por fecha
      const dateA = getEarliestExpirationDate(a);
      const dateB = getEarliestExpirationDate(b);
      return dateA.getTime() - dateB.getTime();
    });
  };

  // Filtrar clientes según búsqueda
  useEffect(() => {
    let filtered = clientes;

    // Filtrar por término de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(cliente => {
        const searchLower = searchTerm.toLowerCase();
        
        // Buscar en datos del cliente
        const matchClient = 
          cliente.company.toLowerCase().includes(searchLower) ||
          cliente.name.toLowerCase().includes(searchLower) ||
          cliente.email.toLowerCase().includes(searchLower) ||
          cliente.phone.includes(searchTerm);

        // Buscar en BANs
        const matchBan = cliente.bans.some(ban => 
          ban.number.includes(searchTerm)
        );

        // Buscar en suscriptores
        const matchSubscriber = cliente.bans.some(ban =>
          ban.subscribers.some(sub =>
            sub.phoneNumber.includes(searchTerm) ||
            sub.plan.toLowerCase().includes(searchLower)
          )
        );

        return matchClient || matchBan || matchSubscriber;
      });
    }

    // Ordenar por fecha de vencimiento
    filtered = sortClientesByExpiration(filtered);
    
    setFilteredClientes(filtered);
  }, [clientes, searchTerm]);

  // Asignar vendedor a cliente
  const handleAsignarVendedor = async (clienteId: string, vendedorId: string) => {
    setClientes(prevClientes => 
      prevClientes.map(cliente => 
        cliente.id === clienteId 
          ? { ...cliente, vendedorAsignado: vendedorId }
          : cliente
      )
    );
    
    // Aquí iría la llamada a la API para guardar la asignación
    console.log(`Cliente ${clienteId} asignado a vendedor ${vendedorId}`);
  };

  const getStatusBadge = (status: 'vencido' | 'por-vencer' | 'vigente') => {
    const styles = {
      'vencido': 'bg-red-600 text-white',
      'por-vencer': 'bg-yellow-600 text-white',
      'vigente': 'bg-green-600 text-white'
    };
    
    const labels = {
      'vencido': 'VENCIDO',
      'por-vencer': 'POR VENCER',
      'vigente': 'VIGENTE'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-bold ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES');
  };

  const getVendedorName = (vendedorId: string): string => {
    const vendedor = vendedores.find(v => v.id === vendedorId);
    return vendedor?.name || 'Sin asignar';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold">Cargando clientes...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <h1 className="text-3xl font-bold text-white mb-3">
            Gestión de Clientes
          </h1>
          <p className="text-gray-300 text-lg">
            Buscador avanzado y asignación de vendedores - {filteredClientes.length} clientes
          </p>
        </div>

        {/* Buscador */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Buscar por compañía, BAN, suscriptor, email o teléfono
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Escribe aquí para buscar..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Clientes */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">
              Clientes ordenados por vencimiento de contrato
            </h2>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-600 rounded"></div>
                Vencidos: {filteredClientes.filter(c => getContractStatus(c) === 'vencido').length}
              </span>
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-600 rounded"></div>
                Por vencer: {filteredClientes.filter(c => getContractStatus(c) === 'por-vencer').length}
              </span>
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-600 rounded"></div>
                Vigentes: {filteredClientes.filter(c => getContractStatus(c) === 'vigente').length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium">Estado</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium">Contacto</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium">BANs / Suscriptores</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium">Próximo Vencimiento</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium">Vendedor Asignado</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredClientes.map((cliente) => {
                  const contractStatus = getContractStatus(cliente);
                  const earliestDate = getEarliestExpirationDate(cliente);
                  
                  return (
                    <tr key={cliente.id} className="hover:bg-gray-750">
                      <td className="px-4 py-3">
                        {getStatusBadge(contractStatus)}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-white">
                            {cliente.company || 'Sin empresa'}
                          </div>
                          <div className="text-gray-400 text-xs">
                            ID: {cliente.id}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-white">{cliente.name}</div>
                          <div className="text-gray-400 text-xs">{cliente.email}</div>
                          <div className="text-gray-400 text-xs">{cliente.phone}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {cliente.bans.map(ban => (
                            <div key={ban.id} className="bg-gray-700 rounded p-2 text-xs">
                              <div className="font-mono text-blue-400">BAN: {ban.number}</div>
                              {ban.subscribers.map(sub => (
                                <div key={sub.id} className="ml-2 text-gray-300">
                                  📱 {sub.phoneNumber} • {sub.plan}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`text-sm ${
                          contractStatus === 'vencido' ? 'text-red-400' :
                          contractStatus === 'por-vencer' ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {formatDate(earliestDate.toISOString().split('T')[0])}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white">
                          {getVendedorName(cliente.vendedorAsignado || '')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={cliente.vendedorAsignado || ''}
                          onChange={(e) => handleAsignarVendedor(cliente.id, e.target.value)}
                          className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {vendedores.map(vendedor => (
                            <option key={vendedor.id} value={vendedor.id}>
                              {vendedor.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredClientes.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No se encontraron clientes que coincidan con tu búsqueda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientesPage;
