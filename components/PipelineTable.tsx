import React, { useState, useMemo } from 'react';
import { CrmDataHook } from '../hooks/useCrmData';
import { Client } from '../types';
import SingleSelectDropdown, { CLIENT_STATES } from './SingleSelectDropdown';

interface PipelineTableProps {
  crmData: CrmDataHook;
  currentUser: {
    id: string;
    name: string;
    role: 'admin' | 'vendedor';
  };
}

interface PipelineClient extends Client {
  productValues: {
    [key: string]: number;
  };
  totalValue: number;
}

const PipelineTable: React.FC<PipelineTableProps> = ({ crmData, currentUser }) => {
  const { clients, products, salespeople, updateClient, generateIncomeFromCompletedDeal } = crmData;
  const [processingCompletions, setProcessingCompletions] = useState<Set<string>>(new Set());

  // Definir las categorías de pipeline
  const pipelineCategories = [
    { key: 'pipeline_fijo_new', name: 'Fijo Nuevo', icon: '📞' },
    { key: 'pipeline_fijo_ren', name: 'Fijo Ren.', icon: '🔄' },
    { key: 'pipeline_movil_new', name: 'Móvil Nuevo', icon: '📱' },
    { key: 'pipeline_movil_ren', name: 'Móvil Ren.', icon: '📲' },
    { key: 'pipeline_claro_tv', name: 'Claro TV', icon: '📺' }
  ];

  // Filtrar clientes según el rol del usuario
  const filteredClients = useMemo(() => {
    let clientsToShow = clients;
    
    // Si es vendedor, mostrar solo sus clientes asignados y no completados
    if (currentUser.role === 'vendedor') {
      clientsToShow = clients.filter(client => 
        client.salespersonId === currentUser.id && !client.isCompleted
      );
    } else {
      // Admin ve todos los clientes no completados
      clientsToShow = clients.filter(client => !client.isCompleted);
    }

    // Ordenar por fecha de vencimiento (más urgentes primero)
    return clientsToShow
      .map(client => {
        const categoryValues: { [key: string]: number } = {};
        pipelineCategories.forEach(category => {
          // Obtener valores directamente de las columnas del pipeline
          categoryValues[category.key] = Number(client[category.key as keyof Client] || 0);
        });
        
        const totalValue = Object.values(categoryValues).reduce((sum, value) => sum + value, 0);
        
        return {
          ...client,
          productValues: categoryValues, // Mantener el nombre para compatibilidad
          totalValue
        } as PipelineClient;
      })
      .sort((a, b) => {
        // Ordenar por fecha de vencimiento si existe, sino por fecha de creación
        const dateA = a.dateToCall ? new Date(a.dateToCall).getTime() : Date.now();
        const dateB = b.dateToCall ? new Date(b.dateToCall).getTime() : Date.now();
        return dateA - dateB;
      });
  }, [clients, currentUser, pipelineCategories]);

  // Actualizar valor de categoría para un cliente
  const updateCategoryValue = (clientId: string, categoryKey: string, value: number) => {
    const client = filteredClients.find(c => c.id === clientId);
    if (!client) return;

    updateClient({
      ...client,
      [categoryKey]: value
    });
  };

  // Completar venta
  const handleCompleteClient = async (client: PipelineClient) => {
    if (client.totalValue === 0) {
      alert('No puedes completar una venta sin valor. Agrega montos a los productos.');
      return;
    }

    setProcessingCompletions(prev => new Set([...prev, client.id]));

    try {
      // Marcar como completado y desasignar del vendedor
      const updatedClient = {
        ...client,
        isCompleted: true,
        salespersonId: null // Desasignar del vendedor
      };

      console.log('🎯 Completando venta para cliente:', updatedClient);

      await updateClient(updatedClient);

      // El mensaje de éxito se mostrará automáticamente por la lógica en updateClient
      
    } catch (error) {
      console.error('❌ Error completando venta:', error);
      alert('Error al completar la venta. Intenta nuevamente.');
    } finally {
      setProcessingCompletions(prev => {
        const newSet = new Set(prev);
        newSet.delete(client.id);
        return newSet;
      });
    }
  };

  // Obtener información del vendedor
  const getSalespersonName = (salespersonId: string | null) => {
    if (!salespersonId) return 'Sin asignar';
    const salesperson = salespeople.find(s => s.id === salespersonId);
    return salesperson?.name || 'Vendedor no encontrado';
  };

  // Actualizar estado de cliente
  const updateClientState = (clientId: string, newState: string) => {
    const client = filteredClients.find(c => c.id === clientId);
    if (!client) return;

    // Por ahora almacenar el estado en las notas hasta que se agregue un campo específico
    // En el futuro se puede agregar un campo 'state' al modelo Client
    updateClient({
      ...client,
      notes: `[Estado: ${newState}] ${client.notes || ''}`.slice(0, 500) // Limitar longitud
    });
  };

  const getClientState = (client: Client) => {
    // Extraer estado de las notas por ahora (temporal)
    const stateMatch = client.notes?.match(/\[Estado: (.*?)\]/);
    const currentState = stateMatch ? stateMatch[1] : 'nuevo';
    
    return CLIENT_STATES.find(state => state.value === currentState) || CLIENT_STATES[0];
  };

  if (filteredClients.length === 0) {
    return (
      <div className="bg-secondary rounded-xl p-12 text-center shadow-lg border border-tertiary">
        <div className="text-6xl mb-4">🎯</div>
        <h3 className="text-2xl font-bold text-text-primary mb-2">
          {currentUser.role === 'vendedor' ? '¡Tu Pipeline está Limpio!' : 'No hay clientes activos'}
        </h3>
        <p className="text-text-secondary mb-6">
          {currentUser.role === 'vendedor' 
            ? 'Has completado todas tus ventas asignadas. ¡Excelente trabajo!'
            : 'Todos los clientes han sido procesados o no hay clientes asignados.'
          }
        </p>
        <button 
          onClick={() => window.location.href = '/clientes'}
          className="bg-accent text-primary font-semibold px-6 py-3 rounded-lg hover:bg-sky-300 transition-colors"
        >
          Gestionar Clientes
        </button>
      </div>
    );
  }

  return (
    <div className="bg-secondary rounded-xl shadow-2xl border border-tertiary overflow-hidden">
      {/* Header de la tabla */}
      <div className="bg-tertiary px-6 py-4 border-b border-slate-600">
        <h2 className="text-xl font-bold text-text-primary flex items-center">
          📊 Pipeline Activo - {filteredClients.length} Cliente{filteredClients.length !== 1 ? 's' : ''}
        </h2>
        <p className="text-text-secondary text-sm mt-1">
          {currentUser.role === 'vendedor' 
            ? 'Tus clientes asignados para cerrar ventas'
            : 'Todos los clientes activos del equipo'
          }
        </p>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-tertiary border-b border-slate-600">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                👤 Vendedor
              </th>
              {pipelineCategories.map(category => (
                <th key={category.key} className="px-4 py-4 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                  <div className="flex items-center justify-center">
                    <span className="mr-1">{category.icon}</span>
                    {category.name}
                  </div>
                </th>
              ))}
              <th className="px-4 py-4 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                Total
              </th>
              <th className="px-4 py-4 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                📞 Llamadas
              </th>
              <th className="px-4 py-4 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-tertiary">
            {filteredClients.map((client) => {
              const isProcessing = processingCompletions.has(client.id);
              const clientState = getClientState(client);
              
              return (
                <tr 
                  key={client.id} 
                  className="hover:bg-tertiary/40 transition-colors"
                >
                  {/* Cliente */}
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-text-primary font-medium">
                        {client.company || client.name}
                      </div>
                      {client.email && (
                        <div className="text-text-secondary text-xs">
                          📧 {client.email}
                        </div>
                      )}
                      {(client.phone || client.mobile) && (
                        <div className="text-text-secondary text-xs">
                          📞 {client.phone || client.mobile}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Vendedor */}
                  <td className="px-4 py-4">
                    <div className="text-text-primary font-medium">
                      {getSalespersonName(client.salespersonId)}
                    </div>
                  </td>

                  {/* Columnas de Categorías */}
                  {pipelineCategories.map(category => (
                    <td key={category.key} className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center">
                        <span className="text-text-secondary mr-1">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={client.productValues[category.key] || 0}
                          onChange={(e) => updateCategoryValue(
                            client.id, 
                            category.key, 
                            parseFloat(e.target.value) || 0
                          )}
                          className="w-20 bg-primary border border-tertiary rounded px-2 py-1 text-center text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                          placeholder="0"
                        />
                      </div>
                    </td>
                  ))}

                  {/* Total */}
                  <td className="px-4 py-4 text-center">
                    <div className={`font-bold text-lg ${
                      client.totalValue > 0 ? 'text-green-400' : 'text-text-secondary'
                    }`}>
                      ${client.totalValue.toLocaleString()}
                    </div>
                  </td>

                  {/* Llamadas */}
                  <td className="px-4 py-4 text-center">
                    <div className="space-y-1">
                      {client.dateToCall && (
                        <div className="text-xs text-text-secondary">
                          📅 Llamar: {new Date(client.dateToCall).toLocaleDateString('es-ES')}
                        </div>
                      )}
                      {client.dateCalled && (
                        <div className="text-xs text-green-400">
                          ✅ Llamado: {new Date(client.dateCalled).toLocaleDateString('es-ES')}
                        </div>
                      )}
                      {!client.dateToCall && !client.dateCalled && (
                        <div className="text-xs text-text-secondary">
                          Sin llamadas
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-4 text-center">
                    <div className="w-40">
                      <SingleSelectDropdown
                        value={clientState.value}
                        options={CLIENT_STATES}
                        onChange={(newState) => updateClientState(client.id, newState)}
                        placeholder="Seleccionar estado"
                      />
                    </div>
                  </td>

                  {/* Acciones */}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleCompleteClient(client)}
                      disabled={client.totalValue === 0 || isProcessing}
                      className={`font-semibold py-2 px-4 rounded-lg transition-colors ${
                        client.totalValue === 0
                          ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                          : isProcessing
                          ? 'bg-yellow-500 text-yellow-900 cursor-not-allowed'
                          : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 hover:shadow-lg transform hover:scale-105'
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <span className="animate-spin inline-block mr-2">⏳</span>
                          Procesando...
                        </>
                      ) : (
                        <>
                          🎯 Completar Venta
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer con resumen */}
      <div className="bg-tertiary px-6 py-4 border-t border-slate-600">
        <div className="flex justify-between items-center text-sm">
          <div className="text-text-secondary">
            📊 {filteredClients.length} clientes activos
          </div>
          <div className="text-text-primary font-medium">
            💰 Valor total pipeline: ${filteredClients.reduce((sum, client) => sum + client.totalValue, 0).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PipelineTable;
