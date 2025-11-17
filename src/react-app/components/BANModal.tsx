import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface BANModalProps {
  onSave: (data: { ban_number: string; description?: string; status?: string }) => void;
  onClose: () => void;
  ban?: { id: number; ban_number: string; description?: string | null; status?: string };
}

export default function BANModal({ onSave, onClose, ban }: BANModalProps) {
  const [formData, setFormData] = useState({
    ban_number: ban?.ban_number || '',
    description: ban?.description || '',
    status: (ban?.status || 'active') as 'active' | 'cancelled',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Actualizar formData cuando cambie el prop ban
  useEffect(() => {
    if (ban) {
      setFormData({
        ban_number: ban.ban_number || '',
        description: ban.description || '',
        status: (ban.status || 'active') as 'active' | 'cancelled',
      });
    } else {
      setFormData({
        ban_number: '',
        description: '',
        status: 'active',
      });
    }
  }, [ban]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.ban_number.trim()) {
      alert('El nÃºmero BAN es obligatorio');
      return;
    }

    if (formData.ban_number.length !== 9 || !/^\d+$/.test(formData.ban_number)) {
      alert('El nÃºmero BAN debe tener exactamente 9 dÃ­gitos');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        ban_number: formData.ban_number,
        description: formData.description.trim() || undefined,
        status: formData.status,
      });
      // Si llegamos aquÃ­, el BAN se creÃ³ exitosamente - resetear y cerrar
      setFormData({ ban_number: '', description: '', status: 'active' });
      setIsSubmitting(false);
      onClose();
    } catch (error) {
      // Si hay error, solo resetear el loading y mantener el modal abierto
      setIsSubmitting(false);
      console.error('Error creating BAN:', error);
    }
  };

  const handleClose = () => {
    setFormData({ ban_number: '', description: '', status: 'active' });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-200 dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-t-xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {ban ? 'Editar BAN' : 'Nuevo BAN'}
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-200/50 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* BAN Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              NÃºmero BAN *
            </label>
            <input
              type="text"
              value={formData.ban_number}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                setFormData(prev => ({ ...prev, ban_number: value }));
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
              placeholder="123456789"
              maxLength={9}
              required
              readOnly={!!ban}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Debe ser un nÃºmero de 9 dÃ­gitos Ãºnicos
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              DescripciÃ³n del BAN
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
              placeholder="DescripciÃ³n opcional del BAN"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Estado
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'cancelled' }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100"
            >
              <option value="active">Activo</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (ban ? 'Guardando...' : 'Creando...') : (ban ? 'Guardar Cambios' : 'Crear BAN')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

