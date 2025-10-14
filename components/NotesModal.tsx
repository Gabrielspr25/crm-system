import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Calendar, User } from 'lucide-react';

interface PipelineItem {
  id: string;
  clientName: string;
  companyName: string;
  salespersonName: string;
  notas: string;
  fechaUpdate: string;
  estado: string;
  paso: string;
}

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PipelineItem | undefined;
  onSave: (notes: string) => void;
}

const NotesModal: React.FC<NotesModalProps> = ({ isOpen, onClose, item, onSave }) => {
  const [notes, setNotes] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (item) {
      setNotes(item.notas || '');
      setHasChanges(false);
    }
  }, [item]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setHasChanges(value !== (item?.notas || ''));
  };

  const handleSave = () => {
    onSave(notes);
    setHasChanges(false);
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirmClose = window.confirm('Tienes cambios sin guardar. ¿Estás seguro de cerrar?');
      if (!confirmClose) return;
    }
    onClose();
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Notas de seguimiento
              </h2>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
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
                  <span className="text-gray-500">Vendedor:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {item.salespersonName}
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-500 text-xs">
                    Última actualización: {item.fechaUpdate}
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

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notas y comentarios de seguimiento
            </label>
            <div className="relative">
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                className="w-full h-40 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Escribe aquí tus notas sobre el cliente, llamadas realizadas, próximos pasos, etc..."
                autoFocus
              />
              <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                {notes.length} caracteres
              </div>
            </div>
          </div>

          {/* Plantillas rápidas */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Plantillas rápidas
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                'Llamada realizada ✓',
                'Pendiente de respuesta',
                'Interesado - seguimiento',
                'Necesita cotización',
                'Agendar próxima llamada',
                'Cliente caliente 🔥'
              ].map((template) => (
                <button
                  key={template}
                  onClick={() => {
                    const newText = notes ? `${notes}\n• ${template}` : `• ${template}`;
                    handleNotesChange(newText);
                  }}
                  className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            {hasChanges && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                Cambios sin guardar
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              Guardar Notas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesModal;