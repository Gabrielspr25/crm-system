import React, { useState, useEffect } from 'react';
import { ArrowLeft, Phone, FileText, Filter, Search, Calendar, User, Clock, Download, Eye, PhoneCall } from 'lucide-react';

interface ActivityRecord {
  id: string;
  clientId: string;
  clientName: string;
  companyName: string;
  salespersonName: string;
  type: 'llamada' | 'nota';
  fecha: string;
  hora?: string;
  // Para llamadas
  duracion?: number;
  tipoLlamada?: 'entrante' | 'saliente' | 'perdida';
  resultadoLlamada?: 'exitoso' | 'no_contesta' | 'ocupado' | 'voicemail' | 'reagendar';
  // Para notas
  content: string;
  createdAt: string;
}

interface ActivityDashboardProps {
  onBackToPipeline: () => void;
  currentUser?: {
    id: string;
    name: string;
    role: 'admin' | 'vendedor';
  };
}

const ActivityDashboard: React.FC<ActivityDashboardProps> = ({ 
  onBackToPipeline,
  currentUser = { id: 'vendedor1', name: 'Gabriel Sánchez', role: 'vendedor' }
}) => {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityRecord[]>([]);
  const [filters, setFilters] = useState({
    type: 'todos' as 'todos' | 'llamada' | 'nota',
    vendedor: currentUser.role === 'admin' ? '' : currentUser.id,
    dateFrom: '',
    dateTo: '',
    searchTerm: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);

  const vendedores = [
    { id: 'vendedor1', name: 'Gabriel Sánchez' },
    { id: 'vendedor2', name: 'María García' },
    { id: 'vendedor3', name: 'Carlos López' },
    { id: 'vendedor4', name: 'Ana Rodríguez' }
  ];

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [activities, filters]);

  const loadActivities = () => {
    setIsLoading(true);
    
    // Simular carga de datos (aquí cargarías desde tu API)
    const mockActivities: ActivityRecord[] = [
      {
        id: '1',
        clientId: 'c1',
        clientName: 'GRUPO ODONTOLOGIA',
        companyName: 'GRUPO ODONTOLOGIA',
        salespersonName: 'Gabriel Sánchez',
        type: 'llamada',
        fecha: '2024-01-16',
        hora: '14:30',
        duracion: 15,
        tipoLlamada: 'saliente',
        resultadoLlamada: 'exitoso',
        content: 'Cliente muy interesado en renovar todos sus servicios. Solicitó cotización para 5 líneas adicionales. Próxima reunión agendada.',
        createdAt: '2024-01-16T14:45:00'
      },
      {
        id: '2',
        clientId: 'c2',
        clientName: 'elizabeth calderon',
        companyName: 'elizabeth calderon',
        salespersonName: 'Randy García',
        type: 'nota',
        fecha: '2024-01-15',
        content: 'Cliente envió documentación requerida por email. Revisé y todo está en orden. Proceder con la propuesta comercial esta semana.',
        createdAt: '2024-01-15T16:20:00'
      },
      {
        id: '3',
        clientId: 'c1',
        clientName: 'GRUPO ODONTOLOGIA',
        companyName: 'GRUPO ODONTOLOGIA',
        salespersonName: 'Gabriel Sánchez',
        type: 'llamada',
        fecha: '2024-01-12',
        hora: '10:00',
        duracion: 0,
        tipoLlamada: 'saliente',
        resultadoLlamada: 'no_contesta',
        content: 'No contestó la llamada. Intentar de nuevo en la tarde.',
        createdAt: '2024-01-12T10:00:00'
      },
      {
        id: '4',
        clientId: 'c3',
        clientName: 'Pablo G Barreto',
        companyName: 'Pablo G Barreto',
        salespersonName: 'Gabriel Sánchez',
        type: 'nota',
        fecha: '2024-01-11',
        content: 'Cliente preguntó sobre descuentos por volumen. Investigar opciones disponibles para clientes corporativos.',
        createdAt: '2024-01-11T11:30:00'
      },
      {
        id: '5',
        clientId: 'c2',
        clientName: 'elizabeth calderon',
        companyName: 'elizabeth calderon',
        salespersonName: 'Randy García',
        type: 'llamada',
        fecha: '2024-01-10',
        hora: '15:45',
        duracion: 8,
        tipoLlamada: 'entrante',
        resultadoLlamada: 'exitoso',
        content: 'Cliente llamó para consultar sobre el estado de su solicitud. Le expliqué el proceso y tiempos estimados.',
        createdAt: '2024-01-10T15:53:00'
      }
    ];

    // Filtrar por vendedor si no es admin
    let filteredData = mockActivities;
    if (currentUser.role === 'vendedor') {
      filteredData = mockActivities.filter(activity => 
        activity.salespersonName.toLowerCase().includes(currentUser.name.toLowerCase())
      );
    }

    setActivities(filteredData);
    setIsLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...activities];

    // Filtro por tipo
    if (filters.type !== 'todos') {
      filtered = filtered.filter(activity => activity.type === filters.type);
    }

    // Filtro por vendedor
    if (filters.vendedor) {
      const selectedVendedor = vendedores.find(v => v.id === filters.vendedor);
      if (selectedVendedor) {
        filtered = filtered.filter(activity => 
          activity.salespersonName.toLowerCase().includes(selectedVendedor.name.toLowerCase())
        );
      }
    }

    // Filtro por fechas
    if (filters.dateFrom) {
      filtered = filtered.filter(activity => activity.fecha >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filtered = filtered.filter(activity => activity.fecha <= filters.dateTo);
    }

    // Filtro por búsqueda
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(activity => 
        activity.clientName.toLowerCase().includes(term) ||
        activity.companyName.toLowerCase().includes(term) ||
        activity.content.toLowerCase().includes(term)
      );
    }

    // Ordenar por fecha más reciente
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredActivities(filtered);
  };

  const getActivityIcon = (activity: ActivityRecord) => {
    if (activity.type === 'llamada') {
      switch (activity.resultadoLlamada) {
        case 'exitoso': return <Phone className="w-4 h-4 text-green-600" />;
        case 'no_contesta': return <Phone className="w-4 h-4 text-yellow-600" />;
        case 'ocupado': return <Phone className="w-4 h-4 text-orange-600" />;
        case 'voicemail': return <Phone className="w-4 h-4 text-blue-600" />;
        default: return <Phone className="w-4 h-4 text-gray-600" />;
      }
    }
    return <FileText className="w-4 h-4 text-blue-600" />;
  };

  const getResultadoBadge = (resultado: string) => {
    const colors = {
      exitoso: 'bg-green-100 text-green-800',
      no_contesta: 'bg-yellow-100 text-yellow-800',
      ocupado: 'bg-orange-100 text-orange-800',
      voicemail: 'bg-blue-100 text-blue-800',
      reagendar: 'bg-purple-100 text-purple-800'
    };
    return colors[resultado as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const exportData = () => {
    // Simular exportación a CSV
    const csvContent = filteredActivities.map(activity => ({
      Fecha: activity.fecha,
      Cliente: activity.clientName,
      Vendedor: activity.salespersonName,
      Tipo: activity.type,
      Contenido: activity.content.replace(/,/g, ';')
    }));

    console.log('Exportando datos:', csvContent);
    alert('📊 Datos exportados exitosamente!\n(En producción se descargaría un archivo CSV)');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Cargando actividades...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBackToPipeline}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al Pipeline
              </button>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Dashboard de Actividades
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Historial completo de llamadas y notas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Actividad
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="todos">Todos</option>
                <option value="llamada">Llamadas</option>
                <option value="nota">Notas</option>
              </select>
            </div>

            {currentUser.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Vendedor
                </label>
                <select
                  value={filters.vendedor}
                  onChange={(e) => setFilters(prev => ({ ...prev, vendedor: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Todos los vendedores</option>
                  {vendedores.map(vendedor => (
                    <option key={vendedor.id} value={vendedor.id}>
                      {vendedor.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Desde
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  placeholder="Cliente, empresa..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <Phone className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {filteredActivities.filter(a => a.type === 'llamada').length}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Llamadas</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {filteredActivities.filter(a => a.type === 'nota').length}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Notas</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {filteredActivities.filter(a => a.type === 'llamada' && a.resultadoLlamada === 'exitoso').reduce((acc, a) => acc + (a.duracion || 0), 0)}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Min Totales</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <User className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {new Set(filteredActivities.map(a => a.clientId)).size}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Clientes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Activities List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Actividades Recientes ({filteredActivities.length})
            </h3>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {filteredActivities.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No se encontraron actividades con los filtros seleccionados</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredActivities.map((activity) => (
                  <div key={activity.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {getActivityIcon(activity)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {activity.clientName}
                            </p>
                            
                            {activity.type === 'llamada' && activity.resultadoLlamada && (
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${getResultadoBadge(activity.resultadoLlamada)}`}>
                                {activity.resultadoLlamada.replace('_', ' ')}
                              </span>
                            )}

                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {activity.type === 'llamada' ? '📞' : '📝'} {activity.type}
                            </span>
                          </div>

                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                            {activity.content}
                          </p>

                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>
                              📅 {new Date(activity.fecha).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            
                            {activity.hora && (
                              <span>⏰ {activity.hora}</span>
                            )}

                            {activity.duracion !== undefined && activity.duracion > 0 && (
                              <span>⏱️ {activity.duracion}min</span>
                            )}

                            <span>👤 {activity.salespersonName}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedActivity(activity)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                        title="Ver detalles"
                      >
                        <Eye className="w-3 h-3" />
                        Ver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Detalles */}
      {selectedActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {getActivityIcon(selectedActivity)}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Detalles de {selectedActivity.type === 'llamada' ? 'Llamada' : 'Nota'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedActivity(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Cliente
                    </label>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {selectedActivity.clientName}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Vendedor
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedActivity.salespersonName}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Fecha
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {new Date(selectedActivity.fecha).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  {selectedActivity.hora && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Hora
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {selectedActivity.hora}
                      </p>
                    </div>
                  )}
                </div>

                {selectedActivity.type === 'llamada' && (
                  <div className="grid grid-cols-3 gap-4">
                    {selectedActivity.duracion !== undefined && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Duración
                        </label>
                        <p className="text-gray-900 dark:text-white">
                          {selectedActivity.duracion} minutos
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Tipo
                      </label>
                      <p className="text-gray-900 dark:text-white capitalize">
                        {selectedActivity.tipoLlamada}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Resultado
                      </label>
                      <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                        selectedActivity.resultadoLlamada ? getResultadoBadge(selectedActivity.resultadoLlamada) : ''
                      }`}>
                        {selectedActivity.resultadoLlamada?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {selectedActivity.type === 'llamada' ? 'Notas de la llamada' : 'Contenido de la nota'}
                  </label>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                      {selectedActivity.content}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setSelectedActivity(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityDashboard;