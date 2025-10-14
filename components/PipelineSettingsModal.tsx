import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Save, Palette } from 'lucide-react';

interface CustomField {
  id: string;
  name: string;
  color: string;
}

interface PipelineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  estados: CustomField[];
  pasos: CustomField[];
  onUpdateEstados: (estados: CustomField[]) => void;
  onUpdatePasos: (pasos: CustomField[]) => void;
}

const COLOR_OPTIONS = [
  { name: 'Gris', value: 'bg-gray-200 text-gray-800', preview: 'bg-gray-200' },
  { name: 'Gris Oscuro', value: 'bg-gray-300 text-gray-800', preview: 'bg-gray-300' },
  { name: 'Azul', value: 'bg-blue-200 text-blue-800', preview: 'bg-blue-200' },
  { name: 'Azul Intenso', value: 'bg-blue-300 text-blue-900', preview: 'bg-blue-300' },
  { name: 'Verde', value: 'bg-green-200 text-green-800', preview: 'bg-green-200' },
  { name: 'Verde Esmeralda', value: 'bg-emerald-200 text-emerald-800', preview: 'bg-emerald-200' },
  { name: 'Verde Azulado', value: 'bg-teal-200 text-teal-800', preview: 'bg-teal-200' },
  { name: 'Amarillo', value: 'bg-yellow-200 text-yellow-800', preview: 'bg-yellow-200' },
  { name: 'Amarillo Intenso', value: 'bg-yellow-300 text-yellow-900', preview: 'bg-yellow-300' },
  { name: 'Naranja', value: 'bg-orange-200 text-orange-800', preview: 'bg-orange-200' },
  { name: 'Naranja Intenso', value: 'bg-orange-300 text-orange-900', preview: 'bg-orange-300' },
  { name: 'Rojo', value: 'bg-red-200 text-red-800', preview: 'bg-red-200' },
  { name: 'Rojo Intenso', value: 'bg-red-300 text-red-900', preview: 'bg-red-300' },
  { name: 'Rosa', value: 'bg-pink-200 text-pink-800', preview: 'bg-pink-200' },
  { name: 'Rosa Intenso', value: 'bg-pink-300 text-pink-900', preview: 'bg-pink-300' },
  { name: 'Púrpura', value: 'bg-purple-200 text-purple-800', preview: 'bg-purple-200' },
  { name: 'Púrpura Intenso', value: 'bg-purple-300 text-purple-900', preview: 'bg-purple-300' },
  { name: 'Índigo', value: 'bg-indigo-200 text-indigo-800', preview: 'bg-indigo-200' },
  { name: 'Cian', value: 'bg-cyan-200 text-cyan-800', preview: 'bg-cyan-200' },
  { name: 'Pizarra', value: 'bg-slate-200 text-slate-800', preview: 'bg-slate-200' },
];

const PipelineSettingsModal: React.FC<PipelineSettingsModalProps> = ({
  isOpen,
  onClose,
  estados,
  pasos,
  onUpdateEstados,
  onUpdatePasos
}) => {
  const [tempEstados, setTempEstados] = useState<CustomField[]>(estados);
  const [tempPasos, setTempPasos] = useState<CustomField[]>(pasos);
  const [editingEstado, setEditingEstado] = useState<string | null>(null);
  const [editingPaso, setEditingPaso] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'estados' | 'pasos'>('estados');

  useEffect(() => {
    setTempEstados(estados);
    setTempPasos(pasos);
  }, [estados, pasos]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateEstados(tempEstados);
    onUpdatePasos(tempPasos);
    onClose();
  };

  const addNewEstado = () => {
    const newEstado: CustomField = {
      id: `estado_${Date.now()}`,
      name: 'Nuevo Estado',
      color: 'bg-gray-100 text-gray-700 border-gray-200'
    };
    setTempEstados([...tempEstados, newEstado]);
    setEditingEstado(newEstado.id);
  };

  const addNewPaso = () => {
    const newPaso: CustomField = {
      id: `paso_${Date.now()}`,
      name: 'Nuevo Paso',
      color: 'bg-gray-100 text-gray-700 border-gray-200'
    };
    setTempPasos([...tempPasos, newPaso]);
    setEditingPaso(newPaso.id);
  };

  const updateEstado = (id: string, updates: Partial<CustomField>) => {
    setTempEstados(prev => prev.map(estado => 
      estado.id === id ? { ...estado, ...updates } : estado
    ));
  };

  const updatePaso = (id: string, updates: Partial<CustomField>) => {
    setTempPasos(prev => prev.map(paso => 
      paso.id === id ? { ...paso, ...updates } : paso
    ));
  };

  const deleteEstado = (id: string) => {
    if (tempEstados.length <= 1) {
      alert('Debe haber al menos un estado disponible.');
      return;
    }
    setTempEstados(prev => prev.filter(estado => estado.id !== id));
  };

  const deletePaso = (id: string) => {
    if (tempPasos.length <= 1) {
      alert('Debe haber al menos un paso disponible.');
      return;
    }
    setTempPasos(prev => prev.filter(paso => paso.id !== id));
  };

  const ColorPicker: React.FC<{
    selectedColor: string;
    onChange: (color: string) => void;
  }> = ({ selectedColor, onChange }) => (
    <div className="grid grid-cols-5 gap-2 mt-3">
      {COLOR_OPTIONS.map((color) => (
        <div key={color.name} className="text-center">
          <button
            onClick={() => onChange(color.value)}
            className={`w-full h-8 rounded-md border-2 ${color.preview} transition-all hover:scale-105 ${
              selectedColor === color.value ? 'ring-2 ring-blue-500 ring-offset-1' : 'border-gray-300'
            }`}
            title={color.name}
          />
          <div className={`mt-1 text-xs px-1 py-0.5 rounded-full ${color.value}`}>
            {color.name}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Configurar Campos del Pipeline
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('estados')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'estados'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Estados ({tempEstados.length})
          </button>
          <button
            onClick={() => setActiveTab('pasos')}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'pasos'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Pasos ({tempPasos.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {activeTab === 'estados' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Estados del Pipeline
                </h3>
                <button
                  onClick={addNewEstado}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Estado
                </button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  🎨 <strong>Personaliza tus estados:</strong> Agrega, edita nombres y elige colores que se ajusten a tu proceso de ventas.
                  Los cambios se guardan automáticamente y se aplicarán a todos los elementos del pipeline.
                </p>
              </div>

              <div className="space-y-3">
                {tempEstados.map((estado) => (
                  <div key={estado.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {editingEstado === estado.id ? (
                          <div>
                            <input
                              type="text"
                              value={estado.name}
                              onChange={(e) => updateEstado(estado.id, { name: e.target.value })}
                              className="text-lg font-medium bg-transparent border-b border-blue-500 focus:outline-none text-gray-900 dark:text-white"
                              autoFocus
                              onBlur={() => setEditingEstado(null)}
                              onKeyPress={(e) => e.key === 'Enter' && setEditingEstado(null)}
                            />
                            <ColorPicker
                              selectedColor={estado.color}
                              onChange={(color) => updateEstado(estado.id, { color })}
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                                {estado.name}
                              </h4>
                              <span className={`text-xs px-2 py-1 rounded-full border ${estado.color}`}>
                                Vista previa
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingEstado(estado.id)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteEstado(estado.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'pasos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Pasos del Pipeline
                </h3>
                <button
                  onClick={addNewPaso}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Paso
                </button>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  📋 <strong>Define tus pasos:</strong> Crea las etapas que mejor representen tu proceso de venta.
                  Cada paso puede tener su color distintivo para fácil identificación.
                </p>
              </div>

              <div className="space-y-3">
                {tempPasos.map((paso) => (
                  <div key={paso.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {editingPaso === paso.id ? (
                          <div>
                            <input
                              type="text"
                              value={paso.name}
                              onChange={(e) => updatePaso(paso.id, { name: e.target.value })}
                              className="text-lg font-medium bg-transparent border-b border-blue-500 focus:outline-none text-gray-900 dark:text-white"
                              autoFocus
                              onBlur={() => setEditingPaso(null)}
                              onKeyPress={(e) => e.key === 'Enter' && setEditingPaso(null)}
                            />
                            <ColorPicker
                              selectedColor={paso.color}
                              onChange={(color) => updatePaso(paso.id, { color })}
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                                {paso.name}
                              </h4>
                              <span className={`text-xs px-2 py-1 rounded-full border ${paso.color}`}>
                                Vista previa
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingPaso(paso.id)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deletePaso(paso.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Los cambios se aplicarán a todos los elementos existentes del pipeline.
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PipelineSettingsModal;