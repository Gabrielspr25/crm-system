import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  crmData: CrmDataHook;
}

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, product, crmData }) => {
  const { categories, addProduct, updateProduct } = crmData;
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [monthlyGoal, setMonthlyGoal] = useState(0);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setPrice(product.price);
      setCategoryId(product.categoryId);
      setMonthlyGoal(product.monthlyGoal || 0);
    } else {
      setName('');
      setPrice(0);
      setCategoryId(categories[0]?.id || '');
      setMonthlyGoal(0);
    }
  }, [product, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || price < 0 || !categoryId) {
      alert('Por favor, complete todos los campos. El precio no puede ser negativo.');
      return;
    }
    
    const productData = { name, price, categoryId, monthlyGoal };
    
    if (product) {
      updateProduct({ ...productData, id: product.id });
    } else {
      addProduct(productData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-secondary rounded-lg shadow-xl p-8 w-full max-w-6xl transform transition-all">
        <h2 className="text-2xl font-bold mb-6 text-text-primary">{product ? 'Editar Producto' : 'Crear Nuevo Producto'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Nombre del Producto</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-tertiary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent" required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Precio</label>
              <input type="number" step="0.01" value={price} onChange={e => setPrice(parseFloat(e.target.value))} className="w-full bg-tertiary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent" required />
            </div>
             <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Meta Mensual</label>
              <input type="number" step="1" value={monthlyGoal} onChange={e => setMonthlyGoal(parseFloat(e.target.value))} className="w-full bg-tertiary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Categoría</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-tertiary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent" required>
              {categories.length === 0 && <option disabled>Cree una categoría primero</option>}
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
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

export default ProductModal;