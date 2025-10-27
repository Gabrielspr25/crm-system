import React, { useState, useEffect } from 'react';
import PipelineConfigModal from '../components/PipelineConfigModal';
import CallTrackingModal from '../components/CallTrackingModal';

interface ClientePipeline {
  id: string;
  company: string;
  name: string;
  phone: string;
  salesperson_id: string | null;
  pipeline_status: string | null;
  pipeline_step: string | null;
  productos: {
    fijo_new: number;
    fijo_ren: number;
    movil_new: number;
    movil_ren: number;
    claro_tv: number;
  };
  date_to_call: string | null;
  notes: string | null;
  is_completed: boolean;
}

interface Vendedor {
  id: string;
  name: string;
}

interface PipelineStatus {
  id: string;
  name: string;
  color: string;
  type: 'estado' | 'paso';
}

const PipelinePage: React.FC = () => {
  const [clientesPipeline, setClientesPipeline] = useState<ClientePipeline[]>([]);
  const [salespeople, setSalespeople] = useState<Vendedor[]>([]);
  const [estados, setEstados] = useState<PipelineStatus[]>([]);
  const [pasos, setPasos] = useState<PipelineStatus[]>([]);
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [currentUser, setCurrentUser] = useState({
    id: 'admin',
    name: 'Administrador',
    role: 'admin'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState<{type: 'estados' | 'pasos' | null}>({type: null});
  const [showClientModal, setShowClientModal] = useState<{clientId: string | null}>({clientId: null});
  const [showCallModal, setShowCallModal] = useState<{clientId: string | null}>({clientId: null});
  const [selectedClientForCall, setSelectedClientForCall] = useState<ClientePipeline | null>(null);

  // Cargar datos del CRM
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/crm-data');
        const data = await response.json();
        
        // Procesar clientes para el pipeline
        const pipelineClients = data.clients.map((client: any) => ({
          id: client.id,
          company: client.company || 'Sin empresa',
          name: client.name,
          phone: client.phone || client.mobile,
          salesperson_id: client.salesperson_id,
          pipeline_status: client.pipeline_status,
          pipeline_step: client.pipeline_step,
          productos: {
            fijo_new: parseFloat(client.pipeline_fijo_new || '0'),
            fijo_ren: parseFloat(client.pipeline_fijo_ren || '0'),
            movil_new: parseFloat(client.pipeline_movil_new || '0'),
            movil_ren: parseFloat(client.pipeline_movil_ren || '0'),
            claro_tv: parseFloat(client.pipeline_claro_tv || '0'),
          },
          date_to_call: client.date_to_call,
          notes: client.notes,
          is_completed: client.is_completed || false
        }));
        
        setClientesPipeline(pipelineClients);
        setSalespeople(data.salespeople);
        
        // Cargar estados y pasos (por ahora mock, después de BD)
        setEstados([
          {id: '1', name: 'En proceso', color: '#f59e0b', type: 'estado'},
          {id: '2', name: 'Llamar', color: '#3b82f6', type: 'estado'},
          {id: '3', name: 'Trabajado', color: '#8b5cf6', type: 'estado'},
        ]);
        
        setPasos([
          {id: '1', name: 'IW', color: '#6b7280', type: 'paso'},
          {id: '2', name: 'FF', color: '#ef4444', type: 'paso'},
          {id: '3', name: 'RUHSSSS', color: '#10b981', type: 'paso'},
          {id: '4', name: 'EQUIPO EN DESPACHO', color: '#f97316', type: 'paso'},
        ]);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error cargando datos:', error);
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Filtrar clientes por vendedor si se selecciona
  const clientesFiltrados = selectedVendedor 
    ? clientesPipeline.filter(cliente => cliente.salesperson_id === selectedVendedor)
    : clientesPipeline;

  // Actualizar campo del cliente
  const updateClientField = async (clientId: string, field: string, value: any) => {
    try {
      // Aquí iría la llamada al backend para actualizar
      console.log('Actualizando cliente:', clientId, field, value);
      
      setClientesPipeline(prev => 
        prev.map(cliente => 
          cliente.id === clientId 
            ? { ...cliente, [field]: value }
            : cliente
        )
      );
    } catch (error) {
      console.error('Error actualizando cliente:', error);
    }
  };

  // Actualizar monto de producto
  const updateProductAmount = (clientId: string, product: string, amount: number) => {
    setClientesPipeline(prev => 
      prev.map(cliente => 
        cliente.id === clientId 
          ? { 
              ...cliente, 
              productos: { 
                ...cliente.productos, 
                [product]: amount 
              }
            }
          : cliente
      )
    );
  };

  // Calcular total de venta por cliente
  const getTotalVenta = (productos: ClientePipeline['productos']): number => {
    return Object.values(productos).reduce((sum, amount) => sum + amount, 0);
  };

  // Completar venta
  const completeSale = async (clientId: string) => {
    const cliente = clientesFiltrados.find(c => c.id === clientId);
    if (!cliente) return;
    
    const total = getTotalVenta(cliente.productos);
    if (total === 0) {
      alert('Debe ingresar montos en los productos antes de completar la venta');
      return;
    }
    
    if (confirm(`¿Completar venta por $${total.toFixed(2)}?`)) {
      try {
        // Aquí iría la lógica para registrar en finanzas y metas
        updateClientField(clientId, 'is_completed', true);
        alert('Venta completada exitosamente');
      } catch (error) {
        console.error('Error completando venta:', error);
      }
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Sin programar';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSalespersonName = (salespersonId: string | null): string => {
    if (!salespersonId) return 'Sin asignar';
    const salesperson = salespeople.find(s => s.id === salespersonId);
    return salesperson?.name || 'Vendedor no encontrado';
  };

  // Manejar configuración de estados/pasos
  const handleConfigSave = (type: 'estados' | 'pasos', options: any[]) => {
    if (type === 'estados') {
      setEstados(options.map(opt => ({...opt, type: 'estado' as const})));
    } else {
      setPasos(options.map(opt => ({...opt, type: 'paso' as const})));
    }
  };

  // Manejar modal de llamadas
  const openCallModal = (cliente: ClientePipeline) => {
    setSelectedClientForCall(cliente);
    setShowCallModal({clientId: cliente.id});
  };

  const handleUpdateCallDate = (clientId: string, date: string) => {
    updateClientField(clientId, 'date_to_call', date);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold">Cargando pipeline...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <h1 className="text-3xl font-bold text-white mb-3">
            Pipeline de Llamadas
          </h1>
          <p className="text-gray-300 text-lg">
            Sistema de seguimiento con estados y pasos estilo Asana
          </p>
        </div>

        {/* Filtro de Vendedor */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Filtrar por Vendedor
          </label>
          <select
            value={selectedVendedor}
            onChange={(e) => setSelectedVendedor(e.target.value)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los vendedores</option>
            {salespeople.map(vendedor => (
              <option key={vendedor.id} value={vendedor.id}>
                {vendedor.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tabla Pipeline */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 w-full">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '12%'}}>
                    Empresa
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '10%'}}>
                    Contacto
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '12%'}}>
                    Vendedor
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '10%'}}>
                    <div className="flex items-center gap-1">
                      Estados
                      <button 
                        onClick={() => setShowConfigModal({type: 'estados'})}
                        className="text-gray-400 hover:text-white text-sm"
                        title="Configurar Estados"
                      >
                        ⚙️
                      </button>
                    </div>
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '10%'}}>
                    <div className="flex items-center gap-1">
                      Pasos
                      <button 
                        onClick={() => setShowConfigModal({type: 'pasos'})}
                        className="text-gray-400 hover:text-white text-sm"
                        title="Configurar Pasos"
                      >
                        ⚙️
                      </button>
                    </div>
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '7%'}}>
                    Fijo N.
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '7%'}}>
                    Fijo R.
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '7%'}}>
                    Movil N.
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '7%'}}>
                    Movil R.
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '7%'}}>
                    Claro TV
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '8%'}}>
                    Total
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '12%'}}>
                    Llamada
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '15%'}}>
                    Notas
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider" style={{width: '8%'}}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {clientesFiltrados.map((cliente) => {
                  const totalVenta = getTotalVenta(cliente.productos);
                  
                  return (
                    <tr key={cliente.id} className={`hover:bg-gray-700 ${
                      cliente.is_completed ? 'bg-green-900 bg-opacity-20' : ''
                    }`}>
                      <td className="px-2 py-4">
                        <button 
                          onClick={() => setShowClientModal({clientId: cliente.id})}
                          className="text-blue-400 hover:text-blue-300 underline text-xs max-w-[120px] truncate text-left"
                          title={cliente.company}
                        >
                          {cliente.company}
                        </button>
                      </td>
                      <td className="px-2 py-4 text-xs text-gray-300">
                        <span className="max-w-[100px] truncate block" title={cliente.phone || 'Sin teléfono'}>
                          {cliente.phone || 'Sin tel.'}
                        </span>
                      </td>
                      <td className="px-2 py-4">
                        <select
                          value={cliente.salesperson_id || ''}
                          onChange={(e) => updateClientField(cliente.id, 'salesperson_id', e.target.value)}
                          className="bg-gray-700 text-white text-xs rounded px-1 py-1 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full max-w-[120px]"
                        >
                          <option value="">Sin asignar</option>
                          {salespeople.map(sp => (
                            <option key={sp.id} value={sp.id}>{sp.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-4">
                        <select
                          value={cliente.pipeline_status || ''}
                          onChange={(e) => updateClientField(cliente.id, 'pipeline_status', e.target.value)}
                          className="bg-gray-700 text-white text-xs rounded px-1 py-1 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full max-w-[100px]"
                        >
                          <option value="">Estado</option>
                          {estados.map(estado => (
                            <option key={estado.id} value={estado.id}>{estado.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-4">
                        <select
                          value={cliente.pipeline_step || ''}
                          onChange={(e) => updateClientField(cliente.id, 'pipeline_step', e.target.value)}
                          className="bg-gray-700 text-white text-xs rounded px-1 py-1 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full max-w-[100px]"
                        >
                          <option value="">Paso</option>
                          {pasos.map(paso => (
                            <option key={paso.id} value={paso.id}>{paso.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-4">
                        <input
                          type="number"
                          value={cliente.productos.fijo_new}
                          onChange={(e) => updateProductAmount(cliente.id, 'fijo_new', parseFloat(e.target.value) || 0)}
                          className="bg-gray-700 text-white text-xs rounded px-1 py-1 w-full max-w-[70px] border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-2 py-4">
                        <input
                          type="number"
                          value={cliente.productos.fijo_ren}
                          onChange={(e) => updateProductAmount(cliente.id, 'fijo_ren', parseFloat(e.target.value) || 0)}
                          className="bg-gray-700 text-white text-xs rounded px-1 py-1 w-full max-w-[70px] border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-2 py-4">
                        <input
                          type="number"
                          value={cliente.productos.movil_new}
                          onChange={(e) => updateProductAmount(cliente.id, 'movil_new', parseFloat(e.target.value) || 0)}
                          className="bg-gray-700 text-white text-xs rounded px-1 py-1 w-full max-w-[70px] border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-2 py-4">
                        <input
                          type="number"
                          value={cliente.productos.movil_ren}
                          onChange={(e) => updateProductAmount(cliente.id, 'movil_ren', parseFloat(e.target.value) || 0)}
                          className="bg-gray-700 text-white text-xs rounded px-1 py-1 w-full max-w-[70px] border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-2 py-4">
                        <input
                          type="number"
                          value={cliente.productos.claro_tv}
                          onChange={(e) => updateProductAmount(cliente.id, 'claro_tv', parseFloat(e.target.value) || 0)}
                          className="bg-gray-700 text-white text-xs rounded px-1 py-1 w-full max-w-[70px] border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-2 py-4 font-bold text-green-400 text-xs">
                        ${totalVenta.toFixed(2)}
                      </td>
                      <td className="px-2 py-4">
                        <button
                          onClick={() => openCallModal(cliente)}
                          className="text-blue-400 hover:text-blue-300 text-xs underline w-full text-left"
                          title="Gestionar seguimiento de llamadas"
                        >
                          {formatDate(cliente.date_to_call)}
                        </button>
                      </td>
                      <td className="px-2 py-4">
                        <input
                          type="text"
                          value={cliente.notes || ''}
                          onChange={(e) => updateClientField(cliente.id, 'notes', e.target.value)}
                          className="bg-gray-700 text-white text-xs rounded px-1 py-1 w-full max-w-[120px] border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Notas..."
                        />
                      </td>
                      <td className="px-2 py-4">
                        <button
                          onClick={() => completeSale(cliente.id)}
                          disabled={cliente.is_completed}
                          className={`px-2 py-1 text-xs rounded w-full ${
                            cliente.is_completed 
                              ? 'bg-green-800 text-green-200 cursor-not-allowed' 
                              : 'bg-green-600 hover:bg-green-500 text-white'
                          }`}
                        >
                          {cliente.is_completed ? '✓ Hecho' : 'Completar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Modales */}
      <PipelineConfigModal
        isOpen={showConfigModal.type !== null}
        onClose={() => setShowConfigModal({type: null})}
        type={showConfigModal.type || 'estados'}
        options={showConfigModal.type === 'estados' ? estados : pasos}
        onSave={(options) => handleConfigSave(showConfigModal.type || 'estados', options)}
      />
      
      <CallTrackingModal
        isOpen={showCallModal.clientId !== null}
        onClose={() => {
          setShowCallModal({clientId: null});
          setSelectedClientForCall(null);
        }}
        cliente={selectedClientForCall}
        onUpdateCallDate={handleUpdateCallDate}
      />
    </div>
  );
};

export default PipelinePage;
