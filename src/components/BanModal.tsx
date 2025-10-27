import React, { useState, useEffect } from 'react';
import { Ban } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';

interface BanModalProps {
  isOpen: boolean;
  onClose: () => void;
  ban: Ban | null;
  crmData: CrmDataHook;
  onSave?: () => void;
  clientId?: string; // Para creación de BAN nuevo
}

const BanModal: React.FC<BanModalProps> = ({ isOpen, onClose, ban, crmData, onSave, clientId }) => {
  const { clients, updateBan, addBan } = crmData;
  const [number, setNumber] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const isEditing = !!(ban && onSave === undefined && ban.id !== '');

  useEffect(() => {
    if (ban) {
      setNumber(ban.number);
    } else {
      setNumber('');
    }
  }, [ban]);

  if (!isOpen) return null;

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newNumber = e.target.value;
      setNumber(newNumber);
      if (isEditing && ban) {
          updateBan({id: ban.id, number: newNumber});
      }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!number.trim()) {
      alert('El número de BAN es obligatorio.');
      return;
    }
    if (number.length !== 9) {
      alert('El número de BAN debe tener exactamente 9 dígitos.');
      return;
    }
    // Validar que no exista otro BAN con el mismo número
    const existingBan = crmData.bans.find(b => b.number === number && b.id !== ban?.id);
    if (existingBan) {
      alert('Ya existe un BAN con este número.');
      return;
    }
    
    setIsCreating(true);
    try {
      if (ban && ban.id && ban.id !== '') {
        // Actualizar BAN existente
        updateBan({ ...ban, number });
      } else if (clientId || ban?.clientId) {
        // Crear nuevo BAN
        const actualClientId = clientId || ban?.clientId;
        if (!actualClientId) {
          alert('Error: no se puede crear BAN sin cliente asociado');
          return;
        }
        console.log('🔄 Creando BAN via BanModal:', { clientId: actualClientId, number });
        await addBan({ clientId: actualClientId, number });
      }
      
      if (onSave) {
          onSave();
      } else {
          onClose();
      }
    } catch (error) {
      console.error('❌ Error en handleSubmit:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-75 flex justify-center items-center z-[70] p-4">
      <div className="bg-secondary rounded-lg shadow-xl p-8 w-full max-w-6xl transform transition-all">
        <h2 className="text-2xl font-bold mb-6 text-text-primary">{isEditing ? 'Editar BAN' : 'Crear Nuevo BAN'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Número de BAN</label>
            <input 
              type="text" 
              name="number" 
              value={number} 
              onChange={handleNumberChange} 
              className="w-full text-white placeholder-gray-400 bg-gray-900 border border-gray-600 focus:ring focus:ring-blue-500 p-3 rounded-md" 
              inputMode="numeric" 
              pattern="\d{9}" 
              maxLength={9}
              placeholder="123456789"
              required 
            />
          </div>
          
          {ban?.clientId && (
            <div className="bg-tertiary p-3 rounded-md">
              <span className="text-sm text-text-secondary">Asignado a: </span>
              <span className="font-semibold text-text-primary">{clients.find(c => c.id === ban.clientId)?.name || 'Cliente no encontrado'}</span>
            </div>
          )}

        </form>
        <div className="flex justify-end space-x-4 pt-6">
          <button type="button" onClick={onClose} className="bg-tertiary text-text-primary py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors">
            {isEditing ? 'Cerrar' : 'Cancelar'}
          </button>
          {onSave && (
            <button 
              type="submit" 
              onClick={handleSubmit} 
              disabled={isCreating}
              className="bg-accent text-primary font-bold py-2 px-4 rounded-lg hover:bg-sky-300 transition-colors disabled:opacity-50"
            >
              {isCreating ? 'Creando BAN...' : 'Siguiente: Añadir Suscriptor'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BanModal;