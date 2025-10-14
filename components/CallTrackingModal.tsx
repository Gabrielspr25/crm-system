import React, { useState, useEffect } from 'react';

interface ClientePipeline {
  id: string;
  company: string;
  name: string;
  phone: string;
  salesperson_id: string | null;
}

interface CallRecord {
  id: string;
  date: string;
  time: string;
  type: 'llamada' | 'nota' | 'seguimiento';
  description: string;
  result: string;
  nextAction: string;
  nextCallDate?: string;
}

interface CallTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: ClientePipeline | null;
  onUpdateCallDate: (clientId: string, date: string) => void;
}

const CallTrackingModal: React.FC<CallTrackingModalProps> = ({
  isOpen,
  onClose,
  cliente,
  onUpdateCallDate
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [newCall, setNewCall] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    type: 'llamada' as const,
    description: '',
    result: '',
    nextAction: '',
    nextCallDate: ''
  });

  useEffect(() => {
    if (isOpen && cliente) {
      // Cargar historial de llamadas (mock data por ahora)
      setCallRecords([
        {
          id: '1',
          date: '2025-09-15',
          time: '14:30',
          type: 'llamada',
          description: 'Llamada inicial - Cliente interesado en renovación',
          result: 'Positivo - Solicita cotización',
          nextAction: 'Enviar cotización por email',
          nextCallDate: '2025-09-18'
        },
        {
          id: '2',
          date: '2025-09-13',
          time: '10:15',
          type: 'seguimiento',
          description: 'Seguimiento post-reunión',
          result: 'Cliente necesita tiempo para decidir',
          nextAction: 'Llamar en 3 días',
          nextCallDate: '2025-09-16'
        }
      ]);
    }
  }, [isOpen, cliente]);

  const addCallRecord = () => {
    if (!newCall.description.trim()) return;

    const record: CallRecord = {
      id: Date.now().toString(),
      date: newCall.date,
      time: newCall.time,
      type: newCall.type,
      description: newCall.description,
      result: newCall.result,
      nextAction: newCall.nextAction,
      nextCallDate: newCall.nextCallDate
    };

    setCallRecords(prev => [record, ...prev]);
    
    // Actualizar fecha de próxima llamada en el pipeline
    if (newCall.nextCallDate && cliente) {
      onUpdateCallDate(cliente.id, `${newCall.nextCallDate}T${newCall.time || '09:00'}`);
    }

    // Limpiar formulario
    setNewCall({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      type: 'llamada',
      description: '',
      result: '',
      nextAction: '',
      nextCallDate: ''
    });
  };

  const getTypeIcon = (type: CallRecord['type']) => {
    switch (type) {
      case 'llamada': return '📞';
      case 'nota': return '📝';
      case 'seguimiento': return '👀';
      default: return '📋';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (!isOpen || !cliente) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1 sm:p-2">
      <div className={`bg-gray-800 rounded-lg shadow-xl transition-all duration-300 ${
        isExpanded 
          ? 'w-[99vw] h-[98vh]' 
          : 'w-[95vw] h-[90vh] sm:h-[85vh]'
      } overflow-hidden`}>
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 border-b border-gray-700 bg-gray-750">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-0">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">
              📞 Seguimiento de Llamadas
            </h2>
            <div className="text-xs sm:text-sm text-gray-300 flex flex-wrap gap-1 sm:gap-2">
              <span className="font-medium">{cliente.company}</span>
              <span className="hidden sm:inline">•</span>
              <span className="sm:hidden">-</span>
              <span>{cliente.name}</span>
              <span className="hidden sm:inline">•</span>
              <span className="sm:hidden">-</span>
              <span>{cliente.phone}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-3 sm:px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-500 transition-colors flex items-center gap-2"
              title={isExpanded ? 'Contraer' : 'Expandir'}
            >
              <span className="hidden sm:inline">{isExpanded ? 'Contraer' : 'Expandir'}</span>
              <span>{isExpanded ? '🔽' : '🔼'}</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl sm:text-2xl p-2 hover:bg-gray-700 rounded transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row h-full">
          {/* Panel izquierdo - Nuevo registro */}
          <div className="w-full lg:w-1/3 p-3 sm:p-4 lg:p-6 border-r-0 lg:border-r border-b lg:border-b-0 border-gray-700 bg-gray-750 overflow-y-auto">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
              ➡️ Nuevo Registro
            </h3>
            
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2">Fecha</label>
                  <input
                    type="date"
                    value={newCall.date}
                    onChange={(e) => setNewCall({...newCall, date: e.target.value})}
                    className="w-full bg-gray-700 text-white px-3 py-2 sm:py-3 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2">Hora</label>
                  <input
                    type="time"
                    value={newCall.time}
                    onChange={(e) => setNewCall({...newCall, time: e.target.value})}
                    className="w-full bg-gray-700 text-white px-3 py-2 sm:py-3 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2">Tipo</label>
                <select
                  value={newCall.type}
                  onChange={(e) => setNewCall({...newCall, type: e.target.value as any})}
                  className="w-full bg-gray-700 text-white px-3 py-2 sm:py-3 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                >
                  <option value="llamada">📞 Llamada</option>
                  <option value="nota">📝 Nota</option>
                  <option value="seguimiento">👀 Seguimiento</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2">Descripción *</label>
                <textarea
                  value={newCall.description}
                  onChange={(e) => setNewCall({...newCall, description: e.target.value})}
                  placeholder="Describe lo que ocurrió en esta interacción..."
                  className="w-full bg-gray-700 text-white px-3 py-2 sm:py-3 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2">Resultado</label>
                <textarea
                  value={newCall.result}
                  onChange={(e) => setNewCall({...newCall, result: e.target.value})}
                  placeholder="¿Cuál fue el resultado de la interacción?"
                  className="w-full bg-gray-700 text-white px-3 py-2 sm:py-3 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2">Próxima Acción</label>
                <textarea
                  value={newCall.nextAction}
                  onChange={(e) => setNewCall({...newCall, nextAction: e.target.value})}
                  placeholder="¿Qué se debe hacer a continuación?"
                  className="w-full bg-gray-700 text-white px-3 py-2 sm:py-3 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2">Próxima Llamada</label>
                <input
                  type="date"
                  value={newCall.nextCallDate}
                  onChange={(e) => setNewCall({...newCall, nextCallDate: e.target.value})}
                  className="w-full bg-gray-700 text-white px-3 py-2 sm:py-3 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                />
              </div>

              <button
                onClick={addCallRecord}
                disabled={!newCall.description.trim()}
                className="w-full bg-green-600 text-white py-3 sm:py-4 rounded hover:bg-green-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed font-semibold text-sm sm:text-base"
              >
                💾 Guardar Registro
              </button>
            </div>
          </div>

          {/* Panel derecho - Historial */}
          <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
              📋 Historial de Interacciones ({callRecords.length})
            </h3>

            <div className="space-y-3 sm:space-y-4">
              {callRecords.map((record) => (
                <div key={record.id} className="bg-gray-700 rounded-lg p-3 sm:p-4 border border-gray-600">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3 gap-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-base sm:text-lg">{getTypeIcon(record.type)}</span>
                      <span className="font-medium text-white capitalize text-sm sm:text-base">
                        {record.type}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-400">
                      {formatDate(record.date)} • {record.time}
                    </span>
                  </div>

                  <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                    <div>
                      <span className="text-gray-400 font-semibold">Descripción:</span>
                      <p className="text-gray-200 mt-1 leading-relaxed">{record.description}</p>
                    </div>
                    
                    {record.result && (
                      <div>
                        <span className="text-gray-400 font-semibold">Resultado:</span>
                        <p className="text-gray-200 mt-1 leading-relaxed">{record.result}</p>
                      </div>
                    )}
                    
                    {record.nextAction && (
                      <div>
                        <span className="text-gray-400 font-semibold">Próxima acción:</span>
                        <p className="text-gray-200 mt-1 leading-relaxed">{record.nextAction}</p>
                      </div>
                    )}

                    {record.nextCallDate && (
                      <div className="flex items-center gap-2 mt-2 sm:mt-3">
                        <span className="bg-blue-600 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm">
                          📅 Próxima llamada: {formatDate(record.nextCallDate)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {callRecords.length === 0 && (
                <div className="text-center text-gray-400 py-6 sm:py-8">
                  <p className="text-2xl sm:text-3xl mb-2 sm:mb-3">📝</p>
                  <p className="text-sm sm:text-base mb-1 sm:mb-2">No hay registros de llamadas para este cliente.</p>
                  <p className="text-xs sm:text-sm">Agrega el primer registro en el panel {window.innerWidth < 1024 ? 'superior' : 'izquierdo'}.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallTrackingModal;