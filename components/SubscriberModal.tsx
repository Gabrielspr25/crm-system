import React, { useState, useEffect } from 'react';
import { Subscriber } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';
import TrashIcon from './icons/TrashIcon'; // Assuming you have a close/trash icon

const initialFormData = {
    phone_number: '',
    status: 'activo',
    product_id: null,
    category_id: null,
    contract_end_date: '',
    equipment: '',
    city: '',
    months_sold: 12,
    payments_made: 0
};

interface SubscriberModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  banId: string;
  crmData: CrmDataHook;
  isFirstSubscriberRequired?: boolean;
}


const SubscriberModal: React.FC<SubscriberModalProps> = ({ isOpen, onClose, subscriber, banId, crmData, isFirstSubscriberRequired = false }) => {
  const { products, categories, addSubscriber, updateSubscriber } = crmData;
  const [formData, setFormData] = useState(initialFormData);
  const [firstSubscriberAdded, setFirstSubscriberAdded] = useState(false);
  
  useEffect(() => {
    if (subscriber) {
      setFormData({
          phone_number: subscriber.phone_number,
          status: subscriber.status,
          product_id: subscriber.product_id,
          category_id: subscriber.category_id,
          contract_end_date: subscriber.contract_end_date,
          equipment: subscriber.equipment,
          city: subscriber.city,
          months_sold: 12,
          payments_made: 0
      });
    } else {
      setFormData({
        ...initialFormData,
        product_id: products[0]?.id || null,
        category_id: categories[0]?.id || null,
      });
    }
    setFirstSubscriberAdded(false); // Reset on open
  }, [subscriber, products, categories, isOpen]);

  if (!isOpen) return null;
  
  const validateForm = (): boolean => {
      if (!formData.phone_number) {
          alert('El número de teléfono es obligatorio.');
          return false;
      }
      if (formData.phone_number.length !== 10) {
          alert('El número de teléfono debe tener exactamente 10 dígitos.');
          return false;
      }
      return true;
  }
  const handleSave = async () => {
      if (!validateForm()) return;

      const subscriberData = { ...formData, banId };
      try {
        if (subscriber) {
            updateSubscriber({ ...subscriberData, id: subscriber.id });
        } else {
            await addSubscriber(subscriberData);
        }
        onClose();
      } catch (error: any) {
        alert(error.message || 'Error al guardar suscriptor');
      }
  };

  const handleSaveAndAddAnother = async () => {
      if (!validateForm()) return;
      
      const subscriberData = { ...formData, banId };
      try {
        await addSubscriber(subscriberData);
        setFirstSubscriberAdded(true);
        // Reset form for the next entry
        setFormData({
          ...initialFormData,
          product_id: products[0]?.id || null,
          category_id: categories[0]?.id || null,
        });
      } catch (error: any) {
        alert(error.message || 'Error al guardar suscriptor');
      }
  }

  const isCancelDisabled = isFirstSubscriberRequired && !firstSubscriberAdded;

  return (
    <div className="fixed inset-0 bg-primary z-[70] flex flex-col p-4 sm:p-6 lg:p-8">
      <header className="flex-shrink-0 flex items-center justify-between pb-4 border-b border-tertiary">
        <div>
            <h2 className="text-2xl font-bold text-text-primary">{subscriber ? 'Editar Suscriptor' : 'AÃ±adir Suscriptor'}</h2>
            {isFirstSubscriberRequired && !firstSubscriberAdded && (
                <p className="text-sm text-yellow-400 mt-1">
                    Â¡AtenciÃ³n! Debe aÃ±adir al menos un suscriptor para este nuevo BAN.
                </p>
            )}
        </div>
        <button onClick={isCancelDisabled ? undefined : onClose} className="p-2 rounded-full hover:bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </header>

      <main className="flex-grow overflow-y-auto py-6">
        <form className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {/* Column 1 */}
            <div className="space-y-6">
                 <div>
                    <label htmlFor="phone_number" className="block text-sm font-semibold text-white mb-2">Número de Teléfono (10 dígitos)</label>
                    <input id="phone_number" type="text" name="phone_number" value={formData.phone_number} onChange={(e) => setFormData(p => ({...p, phone_number: e.target.value}))} className="w-full bg-gray-700 text-white placeholder-gray-300 border border-gray-600 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Ejemplo: 7871234567" required />
                </div>
                <div>
                    <label htmlFor="status" className="block text-sm font-semibold text-white mb-2">Estado</label>
                    <select id="status" name="status" value={formData.status} onChange={(e) => setFormData(p => ({...p, status: e.target.value as any}))} className="w-full bg-gray-700 text-white border border-gray-600 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent">
                        <option value="activo">Activo</option>
                        <option value="suspendido">Suspendido</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                </div>
                 <div>
                    <label htmlFor="product_id" className="block text-sm font-semibold text-white mb-2">Plan</label>
                    <select id="product_id" name="product_id" value={formData.product_id || ''} onChange={(e) => setFormData(p => ({...p, product_id: e.target.value}))} className="w-full bg-gray-700 text-white border border-gray-600 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent">
                        <option value="">Sin Plan</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label htmlFor="category_id" className="block text-sm font-semibold text-white mb-2">Categoría</label>
                    <select id="category_id" name="category_id" value={formData.category_id || ''} onChange={(e) => setFormData(p => ({...p, category_id: e.target.value}))} className="w-full bg-gray-700 text-white border border-gray-600 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent">
                        <option value="">Sin Categoría</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-6">
                <div>
                    <label htmlFor="contract_end_date" className="block text-sm font-semibold text-white mb-2">Venc. Contrato</label>
                    <input id="contract_end_date" type="date" name="contract_end_date" value={formData.contract_end_date} onChange={(e) => setFormData(p => ({...p, contract_end_date: e.target.value}))} className="w-full bg-gray-700 text-white border border-gray-600 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" />
                </div>
                <div>
                    <label htmlFor="equipment" className="block text-sm font-semibold text-white mb-2">Equipo</label>
                    <input id="equipment" type="text" name="equipment" value={formData.equipment} onChange={(e) => setFormData(p => ({...p, equipment: e.target.value}))} className="w-full bg-gray-700 text-white placeholder-gray-300 border border-gray-600 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Ejemplo: Router TP-Link" />
                </div>
                <div>
                    <label htmlFor="city" className="block text-sm font-semibold text-white mb-2">Pueblo</label>
                    <input id="city" type="text" name="city" value={formData.city} onChange={(e) => setFormData(p => ({...p, city: e.target.value}))} className="w-full bg-gray-700 text-white placeholder-gray-300 border border-gray-600 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" placeholder="Ejemplo: San Juan" />
                </div>
            </div>
        </form>
      </main>

      <footer className="flex-shrink-0 flex justify-end items-center space-x-4 pt-4 border-t border-tertiary">
        <button type="button" onClick={onClose} disabled={isCancelDisabled} className="bg-tertiary text-text-primary py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isFirstSubscriberRequired ? 'Terminar' : 'Cancelar'}
        </button>
        {!subscriber && isFirstSubscriberRequired && (
            <button type="button" onClick={handleSaveAndAddAnother} className="bg-slate-600 text-accent font-semibold py-2 px-4 rounded-lg hover:bg-slate-500 transition-colors">
                Guardar y AÃ±adir Otro
            </button>
        )}
        <button type="button" onClick={handleSave} className="bg-accent text-primary font-bold py-2 px-4 rounded-lg hover:bg-sky-300 transition-colors">
            {subscriber ? 'Guardar Cambios' : 'Guardar Suscriptor'}
        </button>
      </footer>
    </div>
  );
};

export default SubscriberModal;
