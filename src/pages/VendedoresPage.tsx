import React, { useState } from 'react';
import { Salesperson } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';
import SalespersonModal from '../components/SalespersonModal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import TargetIcon from '../components/icons/TargetIcon';

interface VendedoresPageProps {
  crmData: CrmDataHook;
  currentUser: Salesperson;
}

const VendedoresPage: React.FC<VendedoresPageProps> = ({ crmData, currentUser }) => {
  const { salespeople, deleteSalesperson, metas } = crmData;
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingSalesperson, setEditingSalesperson] = useState<Salesperson | null>(null);

  if (currentUser.role !== 'admin') {
      return (
          <div className="text-center p-12">
              <h1 className="text-2xl font-bold text-red-500">Acceso Denegado</h1>
              <p className="text-text-secondary mt-2">No tienes permisos para ver esta página.</p>
          </div>
      );
  }

  const handleAddNew = () => {
    setEditingSalesperson(null);
    setModalOpen(true);
  };

  const handleEdit = (salesperson: Salesperson) => {
    setEditingSalesperson(salesperson);
    setModalOpen(true);
  };

  const handleDelete = (salespersonId: string) => {
    if (window.confirm('Al eliminar este vendedor, los clientes asignados a él quedarán sin asignar. ¿Está seguro de que desea continuar?')) {
      deleteSalesperson(salespersonId);
    }
  };

  // Función para obtener metas por categoría de un vendedor
  const getVendedorMetas = (vendedorId: string) => {
    const vendedorMetas = metas.filter(meta => meta.vendedorId === vendedorId && meta.activa);
    
    const categorias = {
      'Claro TV': 0,
      'Fijo': 0,
      'Móvil': 0, 
      'Cloud': 0,
      'PoS': 0
    };
    
    vendedorMetas.forEach(meta => {
      const categoria = meta.categoria;
      if (categoria && categorias.hasOwnProperty(categoria)) {
        categorias[categoria as keyof typeof categorias] += meta.metaValor;
      }
    });
    
    return categorias;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-text-primary">Vendedores</h1>
        <button
          onClick={handleAddNew}
          className="flex items-center bg-accent text-primary font-bold py-2 px-4 rounded-lg hover:bg-sky-300 transition-colors"
        >
          <PlusIcon />
          <span className="ml-2">Añadir Vendedor</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {salespeople.map(person => {
          const vendedorMetas = getVendedorMetas(person.id);
          const totalMetas = Object.values(vendedorMetas).reduce((sum, value) => sum + value, 0);
          
          return (
          <div key={person.id} className="bg-secondary p-6 rounded-lg shadow-lg text-center flex flex-col items-center group relative record-item">
            <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button onClick={() => handleEdit(person)} className="bg-tertiary/80 p-2 rounded-full text-accent hover:text-sky-300">
                <PencilIcon />
              </button>
              <button onClick={() => handleDelete(person.id)} className="bg-tertiary/80 p-2 rounded-full text-red-500 hover:text-red-400">
                <TrashIcon />
              </button>
            </div>
            <img 
              src={person.avatar} 
              alt={person.name}
              className="w-24 h-24 rounded-full mb-4 border-4 border-tertiary object-cover"
            />
            <h2 className="text-lg font-bold text-text-primary">{person.name}</h2>
            <p className="text-sm text-accent break-all">{person.email}</p>
            <p className="text-xs text-text-secondary capitalize mt-1">({person.role})</p>
            <div className="mt-4 border-t border-tertiary w-full pt-4">
              <div className="flex items-center justify-center text-text-secondary mb-2">
                <TargetIcon className="w-5 h-5 mr-2" />
                <span className="text-sm font-bold">Metas Asignadas</span>
              </div>
              {totalMetas > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-blue-400">Claro TV:</span>
                      <span className="text-text-primary font-semibold">${vendedorMetas['Claro TV'].toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-400">Fijo:</span>
                      <span className="text-text-primary font-semibold">${vendedorMetas['Fijo'].toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-400">Móvil:</span>
                      <span className="text-text-primary font-semibold">${vendedorMetas['Móvil'].toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cyan-400">Cloud:</span>
                      <span className="text-text-primary font-semibold">${vendedorMetas['Cloud'].toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-yellow-400">PoS:</span>
                      <span className="text-text-primary font-semibold">${vendedorMetas['PoS'].toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-tertiary/50 flex justify-between text-xs">
                    <span className="text-text-secondary">Total:</span>
                    <span className="text-accent font-bold">${totalMetas.toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <div className="text-text-secondary text-xs text-center py-2">
                  <p>Sin metas asignadas</p>
                  <p className="text-accent mt-1">Asignar desde Módulo de Metas</p>
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {isModalOpen && (
        <SalespersonModal
          isOpen={isModalOpen}
          onClose={() => setModalOpen(false)}
          salesperson={editingSalesperson}
          crmData={crmData}
        />
      )}
    </div>
  );
};

export default VendedoresPage;