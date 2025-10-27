
import React, { useState, useEffect } from 'react';
import { Category } from '../types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (category: Category) => void;
}

const CategoryModal: React.FC<CategoryModalProps> = ({ isOpen, onClose, category, addCategory, updateCategory }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (category) {
      setName(category.name);
    } else {
      setName('');
    }
  }, [category]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('El nombre de la categoría no puede estar vacío.');
      return;
    }
    
    if (category) {
      updateCategory({ ...category, name });
    } else {
      addCategory({ name });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-secondary rounded-lg shadow-xl p-8 w-full max-w-6xl transform transition-all">
        <h2 className="text-2xl font-bold mb-6 text-text-primary">{category ? 'Editar Categoría' : 'Crear Nueva Categoría'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Nombre de la Categoría</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-tertiary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent" required />
          </div>
        </form>
         <div className="flex justify-end space-x-4 pt-6">
            <button type="button" onClick={onClose} className="bg-tertiary text-text-primary py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors">Cancelar</button>
            <button type="submit" onClick={handleSubmit} className="bg-accent text-primary font-bold py-2 px-4 rounded-lg hover:bg-sky-300 transition-colors">Guardar Cambios</button>
          </div>
      </div>
    </div>
  );
};

export default CategoryModal;