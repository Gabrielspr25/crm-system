import React, { useState, useEffect } from 'react';

interface ConfigOption {
  id: string;
  name: string;
  color: string;
}

interface PipelineConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'estados' | 'pasos';
  options: ConfigOption[];
  onSave: (options: ConfigOption[]) => void;
}

const PipelineConfigModal: React.FC<PipelineConfigModalProps> = ({
  isOpen,
  onClose,
  type,
  options,
  onSave
}) => {
  const [localOptions, setLocalOptions] = useState<ConfigOption[]>([]);
  const [fieldTitle, setFieldTitle] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLocalOptions([...options]);
      setFieldTitle(type === 'estados' ? 'Estados' : 'Pasos');
    }
  }, [isOpen, options, type]);

  const addOption = () => {
    const newOption: ConfigOption = {
      id: Date.now().toString(),
      name: '',
      color: '#6b7280'
    };
    setLocalOptions([...localOptions, newOption]);
  };

  const updateOption = (id: string, field: keyof ConfigOption, value: string) => {
    setLocalOptions(prev => 
      prev.map(opt => 
        opt.id === id ? { ...opt, [field]: value } : opt
      )
    );
  };

  const removeOption = (id: string) => {
    setLocalOptions(prev => prev.filter(opt => opt.id !== id));
  };

  const handleSave = () => {
    // Filtrar opciones vacías
    const validOptions = localOptions.filter(opt => opt.name.trim() !== '');
    onSave(validOptions);
    onClose();
  };

  const getColorOptions = () => [
    { value: '#f59e0b', label: '🟡' },
    { value: '#3b82f6', label: '🔵' },
    { value: '#6b7280', label: '⚫' },
    { value: '#8b5cf6', label: '🟣' },
    { value: '#ec4899', label: '🩷' },
    { value: '#10b981', label: '🟢' },
    { value: '#ef4444', label: '🔴' },
    { value: '#f97316', label: '🟠' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Editar campo</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">👥 Gestionar acceso</span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* Field Title */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Título del campo *
            </label>
            <input
              type="text"
              value={fieldTitle}
              onChange={(e) => setFieldTitle(e.target.value)}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Field Type */}
          <div className="mb-4">
            <span className="block text-sm text-gray-400 mb-2">Tipo de campo</span>
            <div className="flex items-center gap-2">
              <span className="text-white">⚪ Selección única</span>
            </div>
          </div>

          {/* Add Description Link */}
          <button className="text-blue-400 text-sm mb-4 hover:text-blue-300">
            + Agregar descripción
          </button>

          {/* Options */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-3">
              Opciones *
            </label>
            
            <div className="space-y-2">
              {localOptions.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <select
                    value={option.color}
                    onChange={(e) => updateOption(option.id, 'color', e.target.value)}
                    className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {getColorOptions().map(colorOpt => (
                      <option key={colorOpt.value} value={colorOpt.value}>
                        {colorOpt.label}
                      </option>
                    ))}
                  </select>
                  
                  <input
                    type="text"
                    value={option.name}
                    onChange={(e) => updateOption(option.id, 'name', e.target.value)}
                    placeholder={`Opción ${index + 1}`}
                    className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  
                  <button
                    onClick={() => removeOption(option.id)}
                    className="text-gray-400 hover:text-red-400 px-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addOption}
              className="mt-3 text-blue-400 hover:text-blue-300 text-sm"
            >
              + Agregar una opción
            </button>
          </div>

          {/* Additional Options */}
          <div className="space-y-3 mb-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="bg-gray-700 border-gray-600 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">
                Agregar a la biblioteca de campos de claroprssdelivery.com
              </span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="bg-gray-700 border-gray-600 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">
                Notificar a los colaboradores cuando se cambie el valor de este campo
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-750">
          <button
            onClick={onClose}
            className="px-4 py-2 text-red-400 border border-red-400 rounded hover:bg-red-400 hover:text-white transition-colors"
          >
            Eliminar campo
          </button>
          
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
          >
            Guardar los cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default PipelineConfigModal;