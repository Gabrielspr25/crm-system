import React, { useState, useEffect } from 'react';
import { X, Save, Phone, Calendar, Clock, Plus, Trash2, Edit2, CheckCircle } from 'lucide-react';

interface PipelineItem {
  id: string;
  clientName: string;
  companyName: string;
  phone: string;
  email: string;
  salespersonName: string;
  ultimaLlamada?: string;
  proximaLlamada?: string;
  notas: string;
}

interface CallRecord {
  id: string;
  fecha: string;
  hora: string;
  duracion: number; // en minutos
  tipo: 'entrante' | 'saliente' | 'perdida';
  notas: string;
  resultado: 'exitoso' | 'no_contesta' | 'ocupado' | 'voicemail' | 'reagendar';
}

interface CallsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PipelineItem | undefined;
  onSave: (ultimaLlamada?: string, proximaLlamada?: string) => void;
}

const CallsModal: React.FC<CallsModalProps> = ({ isOpen, onClose, item, onSave }) => {
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [newCall, setNewCall] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().slice(0, 5),
    duracion: 0,
    tipo: 'saliente' as 'entrante' | 'saliente' | 'perdida',
    notas: '',
    resultado: 'exitoso' as 'exitoso' | 'no_contesta' | 'ocupado' | 'voicemail' | 'reagendar'
  });
  const [proximaLlamada, setProximaLlamada] = useState({
    fecha: '',
    hora: '',
    notas: ''
  });
  const [activeTab, setActiveTab] = useState<'historial' | 'nueva' | 'programar'>('nueva');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (item) {
      // Cargar historial de llamadas (simulado)
      const mockHistory: CallRecord[] = [
        {
          id: '1',
          fecha: '2024-01-15',
          hora: '14:30',
          duracion: 12,
          tipo: 'saliente',
          notas: 'Cliente interesado en renovar. Pidió cotización.',
          resultado: 'exitoso'
        },
        {
          id: '2',
          fecha: '2024-01-10',
          hora: '10:15',
          duracion: 0,
          tipo: 'saliente',
          notas: 'No contestó. Intentar más tarde.',
          resultado: 'no_contesta'
        }
      ];
      setCallHistory(mockHistory);

      // Cargar próxima llamada si existe
      if (item.proximaLlamada) {
        setProximaLlamada({
          fecha: item.proximaLlamada,
          hora: '09:00',
          notas: ''
        });
      }
    }
  }, [item]);

  const handleNewCallChange = (field: string, value: any) => {
    setNewCall(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleProximaLlamadaChange = (field: string, value: any) => {
    setProximaLlamada(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const addNewCall = () => {
    if (!newCall.notas.trim()) {
      alert('Por favor agrega notas de la llamada');
      return;
    }

    const callRecord: CallRecord = {
      id: Date.now().toString(),
      ...newCall
    };

    setCallHistory(prev => [callRecord, ...prev]);
    
    // Reset form
    setNewCall({
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toTimeString().slice(0, 5),
      duracion: 0,
      tipo: 'saliente',
      notas: '',
      resultado: 'exitoso'
    });

    setActiveTab('historial');
    setHasChanges(true);
  };

  const deleteCall = (callId: string) => {
    if (window.confirm('¿Eliminar este registro de llamada?')) {
      setCallHistory(prev => prev.filter(call => call.id !== callId));
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    const ultimaLlamada = callHistory.length > 0 ? callHistory[0].fecha : undefined;
    const proxima = proximaLlamada.fecha ? proximaLlamada.fecha : undefined;
    
    onSave(ultimaLlamada, proxima);
    setHasChanges(false);
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirmClose = window.confirm('Tienes cambios sin guardar. ¿Estás seguro de cerrar?');
      if (!confirmClose) return;
    }
    onClose();
  };

  const getResultadoColor = (resultado: string) => {
    switch (resultado) {
      case 'exitoso': return 'text-green-600 bg-green-100';
      case 'no_contesta': return 'text-yellow-600 bg-yellow-100';
      case 'ocupado': return 'text-orange-600 bg-orange-100';
      case 'voicemail': return 'text-blue-600 bg-blue-100';
      case 'reagendar': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex flex-col">
      <div className="bg-white dark:bg-gray-800 w-full h-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 lg:p-8 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                <Phone className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                Gestion de Llamadas
              </h2>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-4">
                <span className="font-medium text-gray-900 dark:text-white">
                  {item.clientName}
                </span>
                {item.companyName !== item.clientName && (
                  <span className="text-gray-500 dark:text-gray-400">
                    - {item.companyName}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">{item.phone}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Vendedor:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {item.salespersonName}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-4"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('nueva')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'nueva'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Nueva Llamada
          </button>
          <button
            onClick={() => setActiveTab('programar')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'programar'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Programar Llamada
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'historial'
                ? 'border-b-2 border-purple-500 text-purple-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Historial ({callHistory.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          
          {/* Nueva Llamada */}
          {activeTab === 'nueva' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 rounded-xl p-6 lg:p-8 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <Phone className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="text-xl lg:text-2xl font-bold text-green-900 dark:text-green-100">
                    Registrar Nueva Llamada
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Fecha de la Llamada
                    </label>
                    <input
                      type="date"
                      value={newCall.fecha}
                      onChange={(e) => handleNewCallChange('fecha', e.target.value)}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Hora de la Llamada
                    </label>
                    <input
                      type="time"
                      value={newCall.hora}
                      onChange={(e) => handleNewCallChange('hora', e.target.value)}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tipo
                    </label>
                    <select
                      value={newCall.tipo}
                      onChange={(e) => handleNewCallChange('tipo', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="saliente">Llamada saliente</option>
                      <option value="entrante">Llamada entrante</option>
                      <option value="perdida">Llamada perdida</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Duración (min)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newCall.duracion}
                      onChange={(e) => handleNewCallChange('duracion', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Resultado
                    </label>
                    <select
                      value={newCall.resultado}
                      onChange={(e) => handleNewCallChange('resultado', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="exitoso">Exitoso</option>
                      <option value="no_contesta">No contesta</option>
                      <option value="ocupado">Ocupado</option>
                      <option value="voicemail">Buzón de voz</option>
                      <option value="reagendar">Reagendar</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notas de la llamada
                  </label>
                  <textarea
                    value={newCall.notas}
                    onChange={(e) => handleNewCallChange('notas', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="¿Qué se habló en la llamada? ¿Cuáles fueron los próximos pasos acordados?"
                  />
                </div>

                <button
                  onClick={addNewCall}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Registrar Llamada
                </button>
              </div>
            </div>
          )}

          {/* Programar Llamada */}
          {activeTab === 'programar' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-4">
                  Programar Próxima Llamada
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Fecha
                    </label>
                    <input
                      type="date"
                      value={proximaLlamada.fecha}
                      onChange={(e) => handleProximaLlamadaChange('fecha', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Hora
                    </label>
                    <input
                      type="time"
                      value={proximaLlamada.hora}
                      onChange={(e) => handleProximaLlamadaChange('hora', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Recordatorio / Agenda
                  </label>
                  <textarea
                    value={proximaLlamada.notas}
                    onChange={(e) => handleProximaLlamadaChange('notas', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="¿Qué temas tratar en la próxima llamada?"
                  />
                </div>

                {proximaLlamada.fecha && (
                  <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      📅 Llamada programada para el {new Date(proximaLlamada.fecha).toLocaleDateString('es-ES', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })} a las {proximaLlamada.hora}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Historial */}
          {activeTab === 'historial' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Historial de Llamadas
                </h3>
                <span className="text-sm text-gray-500">
                  {callHistory.length} llamadas registradas
                </span>
              </div>

              {callHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay llamadas registradas aún</p>
                  <p className="text-sm">Usa la pestaña "Nueva Llamada" para agregar registros</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {callHistory.map((call) => (
                    <div key={call.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-medium">
                              {new Date(`${call.fecha}T${call.hora}`).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })} - {call.hora}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${getResultadoColor(call.resultado)}`}>
                              {call.resultado.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-gray-500">
                              {call.tipo} • {call.duracion}min
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {call.notas}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteCall(call.id)}
                          className="p-1 text-gray-400 hover:text-red-600 ml-4"
                          title="Eliminar llamada"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 lg:p-6 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 gap-4 sm:gap-0">
          <div className="flex items-center gap-3">
            {hasChanges && (
              <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                Cambios sin guardar
              </div>
            )}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Gestion completa de llamadas
            </div>
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={handleClose}
              className="flex-1 sm:flex-initial px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all font-medium"
            >
              Cerrar
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all font-bold shadow-lg"
            >
              <Save className="w-5 h-5" />
              Guardar Todo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallsModal;