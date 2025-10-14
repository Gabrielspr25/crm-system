import React, { useState, useEffect } from 'react';
import { Client } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  crmData: CrmDataHook;
  onSave: (client: Client, createBan: boolean) => void;
  onManageBans: (client: Client) => void;
}

const initialFormData: Omit<Client, 'id'> = {
    name: '',
    company: '',
    email: '',
    phone: '',
    mobile: '',
    address: '',
    city: '',
    zipCode: '',
    taxId: '',
    notes: '',
    salespersonId: null,
    productIds: [],
    banIds: [],
    pipelineStatusId: null,
    comments: 0,
    isCompleted: false,
    priority: null,
    group: 'Móvil',
    pipelineValues: {
      fijoNew: 0,
      fijoRen: 0,
      movilNew: 0,
      movilRen: 0,
      claroTv: 0,
    },
    dateCalled: '',
    dateToCall: '',
};

const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, client, crmData, onSave, onManageBans }) => {
  const [formData, setFormData] = useState<Omit<Client, 'id'>>(initialFormData);
  const [createBanOnSave, setCreateBanOnSave] = useState(false);
  
  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        company: client.company,
        email: client.email,
        phone: client.phone,
        mobile: client.mobile || '',
        address: client.address || '',
        city: client.city || '',
        zipCode: client.zipCode || '',
        taxId: client.taxId || '',
        notes: client.notes || '',
        salespersonId: client.salespersonId,
        productIds: client.productIds,
        banIds: client.banIds,
        pipelineStatusId: client.pipelineStatusId,
        comments: client.comments,
        isCompleted: client.isCompleted,
        priority: client.priority,
        group: client.group,
        pipelineValues: client.pipelineValues || initialFormData.pipelineValues,
        dateCalled: client.dateCalled || '',
        dateToCall: client.dateToCall || '',
      });
    } else {
       setFormData({
        ...initialFormData,
        salespersonId: crmData.salespeople[0]?.id || null,
      });
    }
    setCreateBanOnSave(false);
  }, [client, crmData.salespeople, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (client) {
      await crmData.updateClient({ ...formData, id: client.id });
      onClose();
    } else {
      try {
        console.log('🔄 Creando cliente...', formData);
        const newClient = await crmData.addClient(formData);
        console.log('✅ Cliente creado exitosamente:', newClient);
        
        // Si el checkbox está marcado, notificar para crear BAN
        if (createBanOnSave) {
          console.log('🔄 Checkbox marcado, abriendo modal de BAN para cliente:', newClient.id);
          onSave(newClient, true);
        } else {
          console.log('✅ Cerrando modal, sin BAN');
          onClose();
        }
      } catch (error) {
        console.error('❌ Error al crear cliente:', error);
        alert('Error al crear el cliente. Por favor, inténtalo de nuevo.');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-75 flex justify-center items-center z-50 overflow-y-auto p-4">
      <div className="bg-secondary rounded-lg shadow-xl p-8 w-full max-w-6xl transform transition-all">
        <h2 className="text-2xl font-bold mb-6 text-text-primary">{client ? 'Editar Cliente' : 'Crear Nuevo Cliente'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" name="name" placeholder="Nombre y Apellido" value={formData.name} onChange={handleInputChange} className="w-full text-white placeholder-gray-400 bg-gray-900 border border-gray-600 focus:ring focus:ring-blue-500 p-3 rounded-md" required />
            <input type="text" name="company" placeholder="Compañía" value={formData.company} onChange={handleInputChange} className="w-full text-white placeholder-gray-400 bg-gray-900 border border-gray-600 focus:ring focus:ring-blue-500 p-3 rounded-md" required />
            <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleInputChange} className="w-full text-white placeholder-gray-400 bg-gray-900 border border-gray-600 focus:ring focus:ring-blue-500 p-3 rounded-md" required />
            <input type="tel" name="phone" placeholder="Teléfono" value={formData.phone} onChange={handleInputChange} className="w-full text-white placeholder-gray-400 bg-gray-900 border border-gray-600 focus:ring focus:ring-blue-500 p-3 rounded-md" />
            <input type="tel" name="mobile" placeholder="Celular" value={formData.mobile} onChange={handleInputChange} className="w-full text-white placeholder-gray-400 bg-gray-900 border border-gray-600 focus:ring focus:ring-blue-500 p-3 rounded-md" />
            <input type="text" name="taxId" placeholder="Tax ID" value={formData.taxId} onChange={handleInputChange} className="w-full text-white placeholder-gray-400 bg-gray-900 border border-gray-600 focus:ring focus:ring-blue-500 p-3 rounded-md" />
          </div>

          <fieldset className="border border-tertiary p-4 rounded-md">
            <legend className="text-sm font-medium text-text-secondary px-2">Dirección</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="text" name="address" placeholder="Dirección" value={formData.address} onChange={handleInputChange} className="w-full text-white placeholder-gray-400 bg-gray-900 border border-gray-600 focus:ring focus:ring-blue-500 p-3 rounded-md md:col-span-3" />
                <input type="text" name="city" placeholder="Pueblo" value={formData.city} onChange={handleInputChange} className="w-full text-white placeholder-gray-400 bg-gray-900 border border-gray-600 focus:ring focus:ring-blue-500 p-3 rounded-md" />
                <input type="text" name="zipCode" placeholder="Zip Code" value={formData.zipCode} onChange={handleInputChange} className="w-full text-white placeholder-gray-400 bg-gray-900 border border-gray-600 focus:ring focus:ring-blue-500 p-3 rounded-md" />
            </div>
          </fieldset>

           <textarea name="notes" placeholder="Notas Adicionales" value={formData.notes} onChange={handleInputChange} className="w-full text-white placeholder-gray-400 bg-gray-900 border border-gray-600 focus:ring focus:ring-blue-500 p-3 rounded-md h-24" />

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Vendedor Asignado</label>
            <select name="salespersonId" value={formData.salespersonId || ''} onChange={handleInputChange} className="w-full text-white bg-gray-900 border border-gray-600 focus:ring focus:ring-blue-500 p-3 rounded-md">
                <option value="">Sin asignar</option>
                {crmData.salespeople.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {!client && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="createBanOnSave"
                  checked={createBanOnSave}
                  onChange={(e) => setCreateBanOnSave(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-accent bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                />
                <div>
                  <label htmlFor="createBanOnSave" className="block text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
                    Crear BAN inmediatamente
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Se abrirá automáticamente el formulario para crear un BAN después de guardar el cliente
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>
         <div className="flex justify-between items-center pt-6">
             <div>
                {client && (
                    <button
                        type="button"
                        onClick={() => onManageBans(client)}
                        className="bg-slate-700 text-text-secondary py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors"
                    >
                        Gestionar BANs
                    </button>
                )}
            </div>
            <div className="flex space-x-4">
              <button type="button" onClick={onClose} className="bg-tertiary text-text-primary py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors">Cancelar</button>
              <button type="submit" onClick={handleSubmit} className="bg-accent text-primary font-bold py-2 px-4 rounded-lg hover:bg-sky-300 transition-colors">Guardar Cambios</button>
            </div>
          </div>
      </div>
    </div>
  );
};

export default ClientModal;