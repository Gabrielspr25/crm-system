import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save, GripVertical } from 'lucide-react';

interface CustomFieldOption {
  id: number;
  field_id: number;
  label: string;
  color: string;
  sort_order: number;
}

interface CustomField {
  id: number;
  name: string;
  type: string;
  options: CustomFieldOption[];
}

interface FieldEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fields: CustomField[]) => void;
}

const COLOR_PALETTE = [
  // Grises
  { name: 'Gris Claro', value: 'bg-gray-100 text-gray-800', preview: 'bg-gray-100' },
  { name: 'Gris', value: 'bg-gray-200 text-gray-800', preview: 'bg-gray-200' },
  { name: 'Gris Medio', value: 'bg-gray-300 text-gray-900', preview: 'bg-gray-300' },
  { name: 'Gris Oscuro', value: 'bg-gray-400 text-gray-900', preview: 'bg-gray-400' },
  
  // Azules
  { name: 'Azul Claro', value: 'bg-blue-100 text-blue-800', preview: 'bg-blue-100' },
  { name: 'Azul', value: 'bg-blue-200 text-blue-800', preview: 'bg-blue-200' },
  { name: 'Azul Medio', value: 'bg-blue-300 text-blue-900', preview: 'bg-blue-300' },
  { name: 'Azul Intenso', value: 'bg-blue-400 text-blue-900', preview: 'bg-blue-400' },
  
  // Verdes
  { name: 'Verde Claro', value: 'bg-green-100 text-green-800', preview: 'bg-green-100' },
  { name: 'Verde', value: 'bg-green-200 text-green-800', preview: 'bg-green-200' },
  { name: 'Verde Medio', value: 'bg-green-300 text-green-900', preview: 'bg-green-300' },
  { name: 'Verde Intenso', value: 'bg-green-400 text-green-900', preview: 'bg-green-400' },
  
  // Esmeraldas
  { name: 'Esmeralda Claro', value: 'bg-emerald-100 text-emerald-800', preview: 'bg-emerald-100' },
  { name: 'Esmeralda', value: 'bg-emerald-200 text-emerald-800', preview: 'bg-emerald-200' },
  { name: 'Esmeralda Medio', value: 'bg-emerald-300 text-emerald-900', preview: 'bg-emerald-300' },
  { name: 'Esmeralda Intenso', value: 'bg-emerald-400 text-emerald-900', preview: 'bg-emerald-400' },
  
  // Verde-Azulados
  { name: 'Teal Claro', value: 'bg-teal-100 text-teal-800', preview: 'bg-teal-100' },
  { name: 'Teal', value: 'bg-teal-200 text-teal-800', preview: 'bg-teal-200' },
  { name: 'Teal Medio', value: 'bg-teal-300 text-teal-900', preview: 'bg-teal-300' },
  { name: 'Teal Intenso', value: 'bg-teal-400 text-teal-900', preview: 'bg-teal-400' },
  
  // Amarillos
  { name: 'Amarillo Claro', value: 'bg-yellow-100 text-yellow-800', preview: 'bg-yellow-100' },
  { name: 'Amarillo', value: 'bg-yellow-200 text-yellow-800', preview: 'bg-yellow-200' },
  { name: 'Amarillo Medio', value: 'bg-yellow-300 text-yellow-900', preview: 'bg-yellow-300' },
  { name: 'Amarillo Intenso', value: 'bg-yellow-400 text-yellow-900', preview: 'bg-yellow-400' },
  
  // Naranjas
  { name: 'Naranja Claro', value: 'bg-orange-100 text-orange-800', preview: 'bg-orange-100' },
  { name: 'Naranja', value: 'bg-orange-200 text-orange-800', preview: 'bg-orange-200' },
  { name: 'Naranja Medio', value: 'bg-orange-300 text-orange-900', preview: 'bg-orange-300' },
  { name: 'Naranja Intenso', value: 'bg-orange-400 text-orange-900', preview: 'bg-orange-400' },
  
  // Rojos
  { name: 'Rojo Claro', value: 'bg-red-100 text-red-800', preview: 'bg-red-100' },
  { name: 'Rojo', value: 'bg-red-200 text-red-800', preview: 'bg-red-200' },
  { name: 'Rojo Medio', value: 'bg-red-300 text-red-900', preview: 'bg-red-300' },
  { name: 'Rojo Intenso', value: 'bg-red-400 text-red-900', preview: 'bg-red-400' },
  
  // Rosas
  { name: 'Rosa Claro', value: 'bg-pink-100 text-pink-800', preview: 'bg-pink-100' },
  { name: 'Rosa', value: 'bg-pink-200 text-pink-800', preview: 'bg-pink-200' },
  { name: 'Rosa Medio', value: 'bg-pink-300 text-pink-900', preview: 'bg-pink-300' },
  { name: 'Rosa Intenso', value: 'bg-pink-400 text-pink-900', preview: 'bg-pink-400' },
  
  // Púrpuras
  { name: 'Púrpura Claro', value: 'bg-purple-100 text-purple-800', preview: 'bg-purple-100' },
  { name: 'Púrpura', value: 'bg-purple-200 text-purple-800', preview: 'bg-purple-200' },
  { name: 'Púrpura Medio', value: 'bg-purple-300 text-purple-900', preview: 'bg-purple-300' },
  { name: 'Púrpura Intenso', value: 'bg-purple-400 text-purple-900', preview: 'bg-purple-400' },
  
  // Índigos
  { name: 'Índigo Claro', value: 'bg-indigo-100 text-indigo-800', preview: 'bg-indigo-100' },
  { name: 'Índigo', value: 'bg-indigo-200 text-indigo-800', preview: 'bg-indigo-200' },
  { name: 'Índigo Medio', value: 'bg-indigo-300 text-indigo-900', preview: 'bg-indigo-300' },
  { name: 'Índigo Intenso', value: 'bg-indigo-400 text-indigo-900', preview: 'bg-indigo-400' },
  
  // Cianes
  { name: 'Cian Claro', value: 'bg-cyan-100 text-cyan-800', preview: 'bg-cyan-100' },
  { name: 'Cian', value: 'bg-cyan-200 text-cyan-800', preview: 'bg-cyan-200' },
  { name: 'Cian Medio', value: 'bg-cyan-300 text-cyan-900', preview: 'bg-cyan-300' },
  { name: 'Cian Intenso', value: 'bg-cyan-400 text-cyan-900', preview: 'bg-cyan-400' },
  
  // Pizarras
  { name: 'Pizarra Claro', value: 'bg-slate-100 text-slate-800', preview: 'bg-slate-100' },
  { name: 'Pizarra', value: 'bg-slate-200 text-slate-800', preview: 'bg-slate-200' },
  { name: 'Pizarra Medio', value: 'bg-slate-300 text-slate-900', preview: 'bg-slate-300' },
  { name: 'Pizarra Intenso', value: 'bg-slate-400 text-slate-900', preview: 'bg-slate-400' },
];

const FieldEditor: React.FC<FieldEditorProps> = ({ isOpen, onClose, onSave }) => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [editingField, setEditingField] = useState<number | null>(null);
  const [editingOption, setEditingOption] = useState<number | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<number | null>(null);
  const [newOptionText, setNewOptionText] = useState('');
  const [addingOptionToField, setAddingOptionToField] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFields();
    }
  }, [isOpen]);

  const loadFields = async () => {
    // Cargar desde localStorage los datos actuales
    let estadosActuales = [];
    let pasosActuales = [];
    
    try {
      const savedEstados = localStorage.getItem('pipeline-estados');
      const savedPasos = localStorage.getItem('pipeline-pasos');
      
      if (savedEstados) {
        estadosActuales = JSON.parse(savedEstados);
      } else {
        // Estados por defecto
        estadosActuales = [
          { id: 'sin_decision', name: 'Sin decisión', color: 'bg-gray-200 text-gray-800' },
          { id: 'llamar', name: 'Llamar', color: 'bg-yellow-200 text-yellow-800' },
          { id: 'en_proceso', name: 'En proceso', color: 'bg-blue-200 text-blue-800' }
        ];
      }
      
      if (savedPasos) {
        pasosActuales = JSON.parse(savedPasos);
      } else {
        // Pasos por defecto
        pasosActuales = [
          { id: 'contacto_inicial', name: 'Contacto inicial', color: 'bg-gray-200 text-gray-800' },
          { id: 'ff', name: 'FF', color: 'bg-blue-200 text-blue-800' },
          { id: 'propuesta', name: 'Propuesta', color: 'bg-teal-200 text-teal-800' }
        ];
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
      // Valores por defecto en caso de error
      estadosActuales = [
        { id: 'sin_decision', name: 'Sin decisión', color: 'bg-gray-200 text-gray-800' },
        { id: 'llamar', name: 'Llamar', color: 'bg-yellow-200 text-yellow-800' },
        { id: 'en_proceso', name: 'En proceso', color: 'bg-blue-200 text-blue-800' }
      ];
      pasosActuales = [
        { id: 'contacto_inicial', name: 'Contacto inicial', color: 'bg-gray-200 text-gray-800' },
        { id: 'ff', name: 'FF', color: 'bg-blue-200 text-blue-800' },
        { id: 'propuesta', name: 'Propuesta', color: 'bg-teal-200 text-teal-800' }
      ];
    }
    
    const fieldsData: CustomField[] = [
      {
        id: 1,
        name: 'Estado',
        type: 'single_select',
        options: estadosActuales.map((estado, index) => ({
          id: index + 1,
          field_id: 1,
          label: estado.name,
          color: estado.color,
          sort_order: index + 1
        }))
      },
      {
        id: 2,
        name: 'Pasos',
        type: 'single_select',
        options: pasosActuales.map((paso, index) => ({
          id: index + 100,
          field_id: 2,
          label: paso.name,
          color: paso.color,
          sort_order: index + 1
        }))
      }
    ];
    
    setFields(fieldsData);
  };

  const addNewField = () => {
    const newField: CustomField = {
      id: Math.max(...fields.map(f => f.id), 0) + 1,
      name: 'Nuevo Campo',
      type: 'single_select',
      options: []
    };
    setFields([...fields, newField]);
    setEditingField(newField.id);
  };

  const updateFieldName = (fieldId: number, newName: string) => {
    setFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, name: newName } : field
    ));
  };

  const deleteField = (fieldId: number) => {
    if (window.confirm('¿Estás seguro de eliminar este campo? Se perderán todas sus opciones.')) {
      setFields(prev => prev.filter(field => field.id !== fieldId));
    }
  };

  const addOption = (fieldId: number) => {
    if (!newOptionText.trim()) return;

    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    const newOption: CustomFieldOption = {
      id: Math.max(...fields.flatMap(f => f.options.map(o => o.id)), 0) + 1,
      field_id: fieldId,
      label: newOptionText,
      color: 'bg-gray-200 text-gray-800',
      sort_order: field.options.length + 1
    };

    setFields(prev => prev.map(field => 
      field.id === fieldId 
        ? { ...field, options: [...field.options, newOption] }
        : field
    ));

    setNewOptionText('');
    setAddingOptionToField(null);
  };

  const updateOption = (optionId: number, updates: Partial<CustomFieldOption>) => {
    setFields(prev => prev.map(field => ({
      ...field,
      options: field.options.map(option => 
        option.id === optionId ? { ...option, ...updates } : option
      )
    })));
  };

  const deleteOption = (fieldId: number, optionId: number) => {
    if (window.confirm('¿Eliminar esta opción?')) {
      setFields(prev => prev.map(field => 
        field.id === fieldId
          ? { ...field, options: field.options.filter(opt => opt.id !== optionId) }
          : field
      ));
    }
  };

  const ColorPicker: React.FC<{
    selectedColor: string;
    onChange: (color: string) => void;
    onClose: () => void;
  }> = ({ selectedColor, onChange, onClose }) => (
    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 z-50 w-80">
      <div className="mb-2">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selecciona un color</h4>
      </div>
      
      <div className="max-h-64 overflow-y-auto">
        <div className="grid grid-cols-6 gap-2">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color.name}
              onClick={() => {
                onChange(color.value);
                onClose();
              }}
              className={`h-8 rounded-md border-2 ${color.preview} transition-all hover:scale-105 hover:shadow-md ${
                selectedColor === color.value ? 'ring-2 ring-blue-500 ring-offset-1' : 'border-gray-300 hover:border-gray-400'
              }`}
              title={color.name}
            />
          ))}
        </div>
      </div>
      
      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
        <button
          onClick={onClose}
          className="w-full text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-center py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Configurar Campos
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Personaliza los campos Estado y Pasos con opciones y colores únicos
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          <div className="space-y-6">
            {/* Botón Agregar Campo */}
            <button
              onClick={addNewField}
              className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <Plus className="w-5 h-5 text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">Agregar nuevo campo</span>
            </button>

            {/* Lista de Campos */}
            {fields.map((field) => (
              <div key={field.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                {/* Header del Campo */}
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {editingField === field.id ? (
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => updateFieldName(field.id, e.target.value)}
                          onBlur={() => setEditingField(null)}
                          onKeyPress={(e) => e.key === 'Enter' && setEditingField(null)}
                          className="text-lg font-semibold bg-transparent border-b border-blue-500 focus:outline-none text-gray-900 dark:text-white"
                          autoFocus
                        />
                      ) : (
                        <>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white uppercase">
                            {field.name}
                          </h3>
                          <button
                            onClick={() => setEditingField(field.id)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="Editar nombre"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => deleteField(field.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Eliminar campo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Opciones del Campo */}
                <div className="p-4 space-y-3">
                  {field.options.map((option) => (
                    <div key={option.id} className="flex items-center gap-3 group">
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="relative">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${option.color}`}>
                          {editingOption === option.id ? (
                            <input
                              type="text"
                              value={option.label}
                              onChange={(e) => updateOption(option.id, { label: e.target.value })}
                              onBlur={() => setEditingOption(null)}
                              onKeyPress={(e) => e.key === 'Enter' && setEditingOption(null)}
                              className="bg-transparent border-0 focus:outline-none min-w-[100px]"
                              autoFocus
                            />
                          ) : (
                            option.label
                          )}
                        </span>
                        
                        {showColorPicker === option.id && (
                          <ColorPicker
                            selectedColor={option.color}
                            onChange={(color) => updateOption(option.id, { color })}
                            onClose={() => setShowColorPicker(null)}
                          />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingOption(option.id)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Editar texto"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setShowColorPicker(showColorPicker === option.id ? null : option.id)}
                          className="p-1 text-gray-400 hover:text-purple-600"
                          title="Cambiar color"
                        >
                          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-300 to-blue-300"></div>
                        </button>
                        <button
                          onClick={() => deleteOption(field.id, option.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Eliminar opción"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Agregar nueva opción */}
                  {addingOptionToField === field.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newOptionText}
                        onChange={(e) => setNewOptionText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addOption(field.id)}
                        placeholder="Nombre de la opción..."
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                      />
                      <button
                        onClick={() => addOption(field.id)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setAddingOptionToField(null);
                          setNewOptionText('');
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingOptionToField(field.id)}
                      className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar opción
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Los cambios se aplicarán inmediatamente a todo el pipeline
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onSave(fields);
                onClose();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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

export default FieldEditor;