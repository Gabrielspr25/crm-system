import React, { useState, useMemo } from 'react';
import { Ban, Subscriber } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import UserGroupIcon from '../components/icons/UserGroupIcon';
import BanModal from '../components/BanModal';
import SubscriberModal from '../components/SubscriberModal';

const BansPage: React.FC<{ crmData: CrmDataHook }> = ({ crmData }) => {
  const { clients, bans, subscribers, products, categories, deleteBan, deleteSubscriber, cancelSubscriber } = crmData;
  
  const [isBanModalOpen, setBanModalOpen] = useState(false);
  const [editingBan, setEditingBan] = useState<Ban | null>(null);
  
  const [isSubscriberModalOpen, setSubscriberModalOpen] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [currentBanIdForSubscriber, setCurrentBanIdForSubscriber] = useState<string | null>(null);

  const clientMap = useMemo(() => 
    clients.reduce((acc, client) => {
        acc[client.id] = client.name;
        return acc;
    }, {} as Record<string, string>), [clients]);

  const productMap = useMemo(() =>
    products.reduce((acc, product) => {
        acc[product.id] = product.name;
        return acc;
    }, {} as Record<string, string>), [products]);
    
  const categoryMap = useMemo(() =>
    categories.reduce((acc, category) => {
        acc[category.id] = category.name;
        return acc;
    }, {} as Record<string, string>), [categories]);

  const subscriberCounts = useMemo(() => {
    return subscribers.reduce((acc, sub) => {
      acc[sub.banId] = (acc[sub.banId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [subscribers]);

  const handleEditBan = (ban: Ban) => {
    setEditingBan(ban);
    setBanModalOpen(true);
  };
  const handleDeleteBan = (banId: string) => {
    if (window.confirm('¿Está seguro? Se eliminará el BAN y todos sus suscriptores.')) {
        deleteBan(banId);
    }
  };

  const handleManageSubscribers = (banId: string) => {
    setCurrentBanIdForSubscriber(banId);
  };
  
  const handleAddNewSubscriber = () => {
    setEditingSubscriber(null);
    setSubscriberModalOpen(true);
  };
  
  const handleEditSubscriber = (subscriber: Subscriber) => {
    setEditingSubscriber(subscriber);
    setSubscriberModalOpen(true);
  };

  const handleDeleteSubscriber = (subscriberId: string) => {
    if (window.confirm('¿Desea eliminar este suscriptor?')) {
        deleteSubscriber(subscriberId);
    }
  };

  const getStatusClass = (status: Ban['status'] | Subscriber['status']) => {
    switch (status) {
        case 'activo': return 'bg-green-500/20 text-green-400';
        case 'cancelado': return 'bg-red-500/20 text-red-400';
        case 'suspendido': return 'bg-yellow-500/20 text-yellow-400';
        default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-text-primary">Gestión de BANs</h1>
      </div>

      <div className="bg-secondary rounded-lg shadow-lg overflow-hidden">
        <table className="w-full text-sm text-left text-text-secondary">
          <thead className="text-xs text-text-secondary uppercase bg-tertiary">
            <tr>
              <th scope="col" className="px-6 py-3">Número BAN</th>
              <th scope="col" className="px-6 py-3">Cliente Asignado</th>
              <th scope="col" className="px-6 py-3">Estado</th>
              <th scope="col" className="px-6 py-3 text-center">Suscriptores</th>
              <th scope="col" className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {bans.map(ban => (
              <React.Fragment key={ban.id}>
                <tr className="border-b border-tertiary hover:bg-tertiary/40 record-item">
                  <td className="px-6 py-4 font-medium text-text-primary">{ban.number}</td>
                  <td className="px-6 py-4">{clientMap[ban.clientId] || 'N/A'}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusClass(ban.status)}`}>{ban.status}</span></td>
                  <td className="px-6 py-4 text-center">{subscriberCounts[ban.id] || 0}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleManageSubscribers(currentBanIdForSubscriber === ban.id ? null : ban.id)} className="text-accent hover:text-sky-300 p-2" title="Gestionar Suscriptores">
                      <UserGroupIcon />
                    </button>
                    <button onClick={() => handleEditBan(ban)} className="text-accent hover:text-sky-300 p-2 ml-1" title="Editar BAN"><PencilIcon /></button>
                    <button onClick={() => handleDeleteBan(ban.id)} className="text-red-500 hover:text-red-400 p-2 ml-1" title="Eliminar BAN"><TrashIcon /></button>
                  </td>
                </tr>
                {currentBanIdForSubscriber === ban.id && (
                    <tr className="bg-tertiary/20">
                        <td colSpan={5} className="p-4">
                           <div className="flex justify-between items-center mb-2">
                                <h3 className="font-semibold text-text-primary">Suscriptores del BAN: {ban.number}</h3>
                                <button onClick={handleAddNewSubscriber} className="flex items-center text-accent text-sm font-bold py-1 px-3 rounded-md hover:bg-tertiary">
                                    <PlusIcon /> <span className="ml-1">Añadir Suscriptor</span>
                                </button>
                           </div>
                            <div className="pl-4 border-l-2 border-slate-600 space-y-2">
                                {subscribers.filter(s => s.banId === ban.id).length > 0 ? subscribers.filter(s => s.banId === ban.id).map(sub => (
                                    <div key={sub.id} className="flex justify-between items-center p-2 rounded-md hover:bg-tertiary/50">
                                        <div>
                                            <p className="text-text-primary font-medium">{sub.phoneNumber}</p>
                                            <p className="text-xs">
                                                <span className={`font-semibold capitalize ${getStatusClass(sub.status)}`}>{sub.status}</span>
                                                {sub.productId && <><span className="text-text-secondary mx-1">|</span><span>Plan: {productMap[sub.productId]}</span></>}
                                                {sub.categoryId && <><span className="text-text-secondary mx-1">|</span><span>Categoría: {categoryMap[sub.categoryId]}</span></>}
                                            </p>
                                        </div>
                                        <div className='flex items-center'>
                                            {sub.status === 'activo' && <button onClick={() => cancelSubscriber(sub.id)} className='text-xs bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/40 px-2 py-1 rounded-md mr-2'>Cancelar</button>}
                                            <button onClick={() => handleEditSubscriber(sub)} className="text-accent hover:text-sky-300 p-1"><PencilIcon/></button>
                                            <button onClick={() => handleDeleteSubscriber(sub.id)} className="text-red-500 hover:text-red-400 p-1 ml-1"><TrashIcon/></button>
                                        </div>
                                    </div>
                                )) : <p className="text-text-secondary italic text-sm p-2">No hay suscriptores para este BAN.</p>}
                           </div>
                        </td>
                    </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      
      {isBanModalOpen && <BanModal isOpen={isBanModalOpen} onClose={() => setBanModalOpen(false)} ban={editingBan} crmData={crmData} />}
      {isSubscriberModalOpen && currentBanIdForSubscriber && <SubscriberModal isOpen={isSubscriberModalOpen} onClose={() => setSubscriberModalOpen(false)} subscriber={editingSubscriber} banId={currentBanIdForSubscriber} crmData={crmData} />}
    </div>
  );
};

export default BansPage;