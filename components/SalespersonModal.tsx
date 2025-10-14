import React, { useState, useEffect } from 'react';
import { Salesperson } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';

interface SalespersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesperson: Salesperson | null;
  crmData: CrmDataHook;
}

const SalespersonModal: React.FC<SalespersonModalProps> = ({ isOpen, onClose, salesperson, crmData }) => {
  const { addSalesperson, updateSalesperson } = crmData;
  const [formData, setFormData] = useState({ name: '', email: '', avatar: '', monthlySalesGoal: 0, role: 'vendedor' as 'admin' | 'vendedor' });

  useEffect(() => {
    if (salesperson) {
      setFormData({
        name: salesperson.name,
        email: salesperson.email,
        avatar: salesperson.avatar,
        monthlySalesGoal: salesperson.monthlySalesGoal || 0,
        role: salesperson.role,
      });
    } else {
      setFormData({ name: '', email: '', avatar: '', monthlySalesGoal: 0, role: 'vendedor' });
    }
  }, [salesperson, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      alert('Nombre y Email son campos obligatorios.');
      return;
    }
    
    const finalData = {
        ...formData,
        avatar: formData.avatar || `https://picsum.photos/seed/${Date.now()}/100`
    };

    try {
      if (salesperson) {
        await updateSalesperson({ ...finalData, id: salesperson.id });
      } else {
        await addSalesperson(finalData);
      }
      onClose();
    } catch (error) {
      console.error('Error saving salesperson:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-secondary rounded-lg shadow-xl p-8 w-full max-w-6xl transform transition-all">
        <h2 className="text-2xl font-bold mb-6 text-text-primary">{salesperson ? 'Editar Vendedor' : 'Añadir Nuevo Vendedor'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Nombre Completo</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full bg-tertiary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full bg-tertiary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">URL del Avatar (Opcional)</label>
            <input type="text" name="avatar" value={formData.avatar} onChange={handleInputChange} className="w-full bg-tertiary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent" placeholder="https://ejemplo.com/imagen.png"/>
          </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Meta de Venta Mensual</label>
                <input type="number" step="1" name="monthlySalesGoal" value={formData.monthlySalesGoal} onChange={handleInputChange} className="w-full bg-tertiary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Rol</label>
                <select name="role" value={formData.role} onChange={handleInputChange} className="w-full bg-tertiary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent">
                    <option value="vendedor">Vendedor</option>
                    <option value="admin">Administrador</option>
                </select>
            </div>
          </div>
        </form>
         <div className="flex justify-end space-x-4 pt-6">
            <button type="button" onClick={onClose} className="bg-tertiary text-text-primary py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors">Cancelar</button>
            <button type="submit" onClick={handleSubmit} className="bg-accent text-primary font-bold py-2 px-4 rounded-lg hover:bg-sky-300 transition-colors">Guardar</button>
          </div>
      </div>
    </div>
  );
};

export default SalespersonModal;