import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface BANModalProps {
  onSave: (data: { ban_number: string; description?: string; status?: string }) => Promise<boolean | { error?: boolean; message?: string } | void>;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      alert('El número BAN es obligatorio');
      return;
    }

    if (formData.ban_number.length !== 9 || !/^\d+$/.test(formData.ban_number)) {
      alert('El número BAN debe tener exactamente 9 dígitos');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSave({
        ban_number: formData.ban_number,
        description: formData.description.trim() || undefined,
        status: formData.status,
      });
      
      // Verificar si onSave retornó un error (false o un objeto con error)
      if (result === false || (typeof result === 'object' && result !== null && 'error' in result)) {
        // Hay un error, mantener el modal abierto
        setIsSubmitting(false);
        // Mostrar el mensaje de error específico si está disponible
        const errorMsg = (typeof result === 'object' && result !== null && 'message' in result) 
          ? result.message 
          : 'Error al crear el BAN. Verifica los datos e intenta nuevamente.';
        setErrorMessage(errorMsg || 'Error al crear el BAN. Verifica los datos e intenta nuevamente.');
        return;
      }
      
      // Limpiar mensaje de error si fue exitoso
      setErrorMessage(null);
      
      // Si llegamos aquí, el BAN se creó exitosamente - resetear y cerrar
      setIsSubmitting(false);
      setFormData({ ban_number: '', description: '', status: 'active' });
      
      // Cerrar el modal inmediatamente
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
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full border border-gray-600 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-600 dark:border-gray-700 bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-800 dark:to-gray-700 rounded-t-xl">
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

        {/* Error Message */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-red-100 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* BAN Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Número BAN *
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
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Debe ser un número de 9 dígitos únicos
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Servicio / Descripción
            </label>
            <select
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100"
            >
              <option value="">Seleccionar tipo...</option>
              <option value="Móvil">Móvil</option>
              <option value="Fijo">Fijo</option>
              <option value="Convergente">Convergente</option>
              <option value="Internet">Internet</option>
              <option value="TV">TV</option>
              <option value="Cloud">Cloud</option>
              <option value="MPLS">MPLS</option>
              <option value="Otro">Otro</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Selecciona el tipo de servicio del BAN
            </p>
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

