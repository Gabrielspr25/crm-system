import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Plus, Phone, Clock, User, Edit, Trash2 } from 'lucide-react';

interface ScheduledCall {
  id: string;
  clientId: string;
  clientName: string;
  companyName: string;
  phone: string;
  email: string;
  fecha: string;
  hora: string;
  duracionEstimada: number; // en minutos
  notas: string;
  salespersonId: string;
  salespersonName: string;
  estado: 'programada' | 'completada' | 'cancelada' | 'reprogramada';
  prioridad: 'alta' | 'media' | 'baja';
}

interface CallsSchedulerProps {
  onBackToPipeline: () => void;
  currentUser?: {
    id: string;
    name: string;
    role: 'admin' | 'vendedor';
  };
}

const CallsScheduler: React.FC<CallsSchedulerProps> = ({ 
  onBackToPipeline,
  currentUser = { id: 'vendedor1', name: 'Gabriel Sánchez', role: 'vendedor' }
}) => {
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week'>('day');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<ScheduledCall | null>(null);
  const [showNewCallModal, setShowNewCallModal] = useState(false);

  const vendedores = [
    { id: 'vendedor1', name: 'Gabriel Sánchez' },
    { id: 'vendedor2', name: 'María García' },
    { id: 'vendedor3', name: 'Carlos López' },
    { id: 'vendedor4', name: 'Ana Rodríguez' }
  ];

  useEffect(() => {
    loadScheduledCalls();
  }, [currentDate]);

  const loadScheduledCalls = () => {
    setIsLoading(true);
    
    // Simular carga de llamadas programadas
    const mockCalls: ScheduledCall[] = [
      {
        id: '1',
        clientId: 'c1',
        clientName: 'GRUPO ODONTOLOGIA',
        companyName: 'GRUPO ODONTOLOGIA',
        phone: '787-555-0001',
        email: 'info@grupoodonto.com',
        fecha: new Date().toISOString().split('T')[0], // Hoy
        hora: '09:00',
        duracionEstimada: 30,
        notas: 'Llamada de seguimiento para revisar propuesta de renovación',
        salespersonId: 'vendedor1',
        salespersonName: 'Gabriel Sánchez',
        estado: 'programada',
        prioridad: 'alta'
      },
      {
        id: '2',
        clientId: 'c2',
        clientName: 'elizabeth calderon',
        companyName: 'elizabeth calderon',
        phone: '787-555-0002',
        email: 'elizabeth@email.com',
        fecha: new Date().toISOString().split('T')[0], // Hoy
        hora: '14:30',
        duracionEstimada: 15,
        notas: 'Revisión de documentación enviada',
        salespersonId: 'vendedor1',
        salespersonName: 'Gabriel Sánchez',
        estado: 'programada',
        prioridad: 'media'
      },
      {
        id: '3',
        clientId: 'c3',
        clientName: 'Pablo G Barreto',
        companyName: 'Pablo G Barreto',
        phone: '787-555-0003',
        email: 'pablo@email.com',
        fecha: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Mañana
        hora: '10:00',
        duracionEstimada: 20,
        notas: 'Presentación de cotización final',
        salespersonId: 'vendedor1',
        salespersonName: 'Gabriel Sánchez',
        estado: 'programada',
        prioridad: 'alta'
      },
      {
        id: '4',
        clientId: 'c4',
        clientName: 'Corporación ABC',
        companyName: 'Corporación ABC',
        phone: '787-555-0004',
        email: 'contacto@abc.com',
        fecha: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Mañana
        hora: '15:00',
        duracionEstimada: 45,
        notas: 'Reunión inicial para conocer necesidades',
        salespersonId: 'vendedor2',
        salespersonName: 'María García',
        estado: 'programada',
        prioridad: 'media'
      }
    ];

    // Filtrar por vendedor si no es admin
    let filteredCalls = mockCalls;
    if (currentUser.role === 'vendedor') {
      filteredCalls = mockCalls.filter(call => call.salespersonId === currentUser.id);
    }

    setScheduledCalls(filteredCalls);
    setIsLoading(false);
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDateRange = () => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } else {
      const startOfWeek = new Date(currentDate);
      const endOfWeek = new Date(currentDate);
      
      // Calcular inicio y fin de semana (lunes a domingo)
      const dayOfWeek = currentDate.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      
      startOfWeek.setDate(currentDate.getDate() + diff);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      return `${startOfWeek.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short'
      })} - ${endOfWeek.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })}`;
    }
  };

  const getCallsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return scheduledCalls.filter(call => call.fecha === dateStr);
  };

  const getCallsForView = () => {
    if (view === 'day') {
      return getCallsForDate(currentDate);
    } else {
      const startOfWeek = new Date(currentDate);
      const dayOfWeek = currentDate.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startOfWeek.setDate(currentDate.getDate() + diff);

      const weekCalls: { [key: string]: ScheduledCall[] } = {};
      for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        const dayStr = day.toISOString().split('T')[0];
        weekCalls[dayStr] = getCallsForDate(day);
      }
      return weekCalls;
    }
  };

  const getPriorityColor = (prioridad: string) => {
    switch (prioridad) {
      case 'alta': return 'border-red-400 bg-red-50 text-red-800';
      case 'media': return 'border-yellow-400 bg-yellow-50 text-yellow-800';
      case 'baja': return 'border-green-400 bg-green-50 text-green-800';
      default: return 'border-gray-400 bg-gray-50 text-gray-800';
    }
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'programada': return 'text-blue-600 bg-blue-100';
      case 'completada': return 'text-green-600 bg-green-100';
      case 'cancelada': return 'text-red-600 bg-red-100';
      case 'reprogramada': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const handleCallAction = (call: ScheduledCall, action: 'call' | 'complete' | 'reschedule' | 'cancel') => {
    switch (action) {
      case 'call':
        window.open(`tel:${call.phone}`);
        break;
      case 'complete':
        setScheduledCalls(prev => prev.map(c => 
          c.id === call.id ? { ...c, estado: 'completada' as const } : c
        ));
        break;
      case 'reschedule':
        // Aquí abrirías un modal para reprogramar
        alert('Funcionalidad de reprogramar en desarrollo');
        break;
      case 'cancel':
        if (window.confirm(`¿Cancelar la llamada con ${call.clientName}?`)) {
          setScheduledCalls(prev => prev.map(c => 
            c.id === call.id ? { ...c, estado: 'cancelada' as const } : c
          ));
        }
        break;
    }
  };

  const TimeSlot: React.FC<{ hour: string; calls: ScheduledCall[] }> = ({ hour, calls }) => (
    <div className="flex border-b border-gray-200 dark:border-gray-700 min-h-[60px]">
      <div className="w-20 flex-shrink-0 p-2 text-sm text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
        {hour}
      </div>
      <div className="flex-1 p-2 space-y-1">
        {calls.map(call => (
          <div
            key={call.id}
            className={`p-2 rounded-lg border-l-4 cursor-pointer transition-all hover:shadow-md ${getPriorityColor(call.prioridad)}`}
            onClick={() => setSelectedCall(call)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{call.clientName}</p>
                <p className="text-xs opacity-75">{call.hora} - {call.duracionEstimada}min</p>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(call.estado)}`}>
                {call.estado}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Cargando calendario...</h2>
        </div>
      </div>
    );
  }

  const viewData = getCallsForView();

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
                  Calendario de Llamadas
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Gestiona tus llamadas programadas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowNewCallModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva Llamada
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateDate('prev')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="text-center min-w-[200px]">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {getDateRange()}
                  </h2>
                </div>

                <button
                  onClick={() => navigateDate('next')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={goToToday}
                className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Hoy
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setView('day')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    view === 'day'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Día
                </button>
                <button
                  onClick={() => setView('week')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    view === 'week'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Semana
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar View */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {view === 'day' ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {Array.from({ length: 12 }, (_, i) => {
                const hour = `${8 + i}:00`;
                const hourCalls = (viewData as ScheduledCall[]).filter(call => 
                  call.hora.startsWith(`${8 + i < 10 ? '0' : ''}${8 + i}`)
                );
                return (
                  <TimeSlot key={hour} hour={hour} calls={hourCalls} />
                );
              })}
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-7 gap-4">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day, index) => {
                  const startOfWeek = new Date(currentDate);
                  const dayOfWeek = currentDate.getDay();
                  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                  startOfWeek.setDate(currentDate.getDate() + diff);
                  
                  const currentDay = new Date(startOfWeek);
                  currentDay.setDate(startOfWeek.getDate() + index);
                  
                  const dayStr = currentDay.toISOString().split('T')[0];
                  const dayCalls = (viewData as { [key: string]: ScheduledCall[] })[dayStr] || [];

                  return (
                    <div key={day} className="min-h-[200px]">
                      <div className="text-center p-2 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{day}</p>
                        <p className="text-lg font-semibold text-gray-600 dark:text-gray-400">
                          {currentDay.getDate()}
                        </p>
                      </div>
                      <div className="p-2 space-y-1">
                        {dayCalls.map(call => (
                          <div
                            key={call.id}
                            className={`p-2 rounded text-xs cursor-pointer ${getPriorityColor(call.prioridad)}`}
                            onClick={() => setSelectedCall(call)}
                          >
                            <p className="font-medium truncate">{call.clientName}</p>
                            <p className="opacity-75">{call.hora}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Call Details Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Detalles de la Llamada
                </h3>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
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
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedCall.clientName}
                    </p>
                    {selectedCall.companyName !== selectedCall.clientName && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedCall.companyName}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Vendedor
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedCall.salespersonName}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Fecha
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {new Date(selectedCall.fecha).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long'
                      })}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Hora
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedCall.hora}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Duración estimada
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedCall.duracionEstimada} minutos
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Teléfono
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedCall.phone}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedCall.email}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Prioridad
                    </label>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${getPriorityColor(selectedCall.prioridad)}`}>
                      {selectedCall.prioridad}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Estado
                    </label>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(selectedCall.estado)}`}>
                      {selectedCall.estado}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notas
                  </label>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-gray-900 dark:text-white">
                      {selectedCall.notas}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              {selectedCall.estado === 'programada' && (
                <>
                  <button
                    onClick={() => handleCallAction(selectedCall, 'call')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    Llamar Ahora
                  </button>
                  <button
                    onClick={() => handleCallAction(selectedCall, 'complete')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Marcar Completada
                  </button>
                  <button
                    onClick={() => handleCallAction(selectedCall, 'reschedule')}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    Reprogramar
                  </button>
                  <button
                    onClick={() => handleCallAction(selectedCall, 'cancel')}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Cancelar
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedCall(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Call Modal Placeholder */}
      {showNewCallModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Nueva Llamada
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Funcionalidad en desarrollo. Use el modal de llamadas desde el pipeline por ahora.
            </p>
            <button
              onClick={() => setShowNewCallModal(false)}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallsScheduler;