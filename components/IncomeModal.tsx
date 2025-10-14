import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, FileText, Package, User, Save } from 'lucide-react';
import { Income } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  income?: Income | null;
  crmData: CrmDataHook;
}

const IncomeModal: React.FC<IncomeModalProps> = ({ isOpen, onClose, income, crmData }) => {
  const { createIncome, updateIncome, products, salespeople } = crmData;
  
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    productId: '',
    salespersonId: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (income) {
        setFormData({
          description: income.description,
          amount: income.amount.toString(),
          date: income.date,
          productId: income.productId || '',
          salespersonId: income.salespersonId || ''
        });
      } else {
        setFormData({
          description: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          productId: '',
          salespersonId: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, income]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.description.trim()) {
      newErrors.description = 'La descripciÃ³n es obligatoria';
    }
    
    if (!formData.amount.trim()) {
      newErrors.amount = 'El monto es obligatorio';
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.amount = 'El monto debe ser un nÃºmero positivo';
      }
    }
    
    if (!formData.date) {
      newErrors.date = 'La fecha es obligatoria';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const incomeData = {
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        date: formData.date,
        productId: formData.productId || undefined,
        salespersonId: formData.salespersonId || undefined
      };

      if (income) {
        await updateIncome(income.id, incomeData);
      } else {
        await createIncome(incomeData);
      }
      
      onClose();
    } catch (error) {
      console.error('Error al guardar ingreso:', error);
      setErrors({ submit: 'Error al guardar el ingreso. IntÃ©ntalo de nuevo.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {income ? 'Editar Ingreso' : 'Nuevo Ingreso'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              DescripciÃ³n *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              placeholder="Describe el ingreso..."
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white ${errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Monto *
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              placeholder="0.00"
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white ${errors.amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
            />
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Fecha *
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white ${errors.date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Package className="w-4 h-4 inline mr-1" />
              Producto
            </label>
            <select
              name="productId"
              value={formData.productId}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Seleccionar producto (opcional)</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Vendedor
            </label>
            <select
              name="salespersonId"
              value={formData.salespersonId}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Seleccionar vendedor (opcional)</option>
              {salespeople.map(sp => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>

          {errors.submit && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {income ? 'Actualizar' : 'Crear'} Ingreso
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IncomeModal;
