import React, { useState, useMemo } from 'react';
import { Ban, Client, Subscriber } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';
import PlusIcon from './icons/PlusIcon';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import UserGroupIcon from './icons/UserGroupIcon';
import BanModal from './BanModal';
import SubscriberModal from './SubscriberModal';
import WarningIcon from './icons/WarningIcon';

interface ClientBansManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  crmData: CrmDataHook;
}

const ClientBansManagerModal: React.FC<ClientBansManagerModalProps> = ({ isOpen, onClose, client, crmData }) => {
    const { bans, subscribers, products, categories, addBan, deleteBan, deleteSubscriber, cancelSubscriber } = crmData;
    
    const [expandedBanId, setExpandedBanId] = useState<string | null>(null);
    const [isBanModalOpen, setBanModalOpen] = useState(false);
    const [editingBan, setEditingBan] = useState<Ban | null>(null);
    const [newBan, setNewBan] = useState<Ban | null>(null);
    
    const [isSubscriberModalOpen, setSubscriberModalOpen] = useState(false);
    const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
    const [currentBanIdForSubscriber, setCurrentBanIdForSubscriber] = useState<string | null>(null);

    const clientBans = useMemo(() => bans.filter(b => b.clientId === client.id), [bans, client.id]);

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
        return bans.reduce((acc, ban) => {
            const banSubscribers = subscribers.filter(s => s.banId === ban.id);
            acc[ban.id] = banSubscribers.length;
            return acc;
        }, {} as Record<string, number>);
    }, [bans, subscribers]);
    
    const handleAddNewBan = async () => {
        console.log('🔄 Creando BAN para cliente:', client.id);
        try {
            const createdBan = await addBan({ number: '', clientId: client.id });
            console.log('🎯 BAN creado:', createdBan);
            setNewBan(createdBan);
            setBanModalOpen(true);
        } catch (error) {
            console.error('❌ Error al crear BAN:', error);
        }
    };

    const handleSaveBan = () => {
        setBanModalOpen(false);
        if (newBan?.id) {
            setCurrentBanIdForSubscriber(newBan.id);
            setSubscriberModalOpen(true);
        } else {
            console.error('❌ No se pudo obtener ID del BAN creado');
        }
    };

    const handleEditBan = (ban: Ban) => {
        setEditingBan(ban);
        setBanModalOpen(true);
    };
    const handleDeleteBan = (banId: string) => {
        if (window.confirm('¿Está seguro? Se eliminará el BAN y todos sus suscriptores.')) {
            deleteBan(banId);
        }
    };
    
    const handleAddNewSubscriber = (banId: string) => {
        setCurrentBanIdForSubscriber(banId);
        setEditingSubscriber(null);
        setSubscriberModalOpen(true);
    };
    
    const handleEditSubscriber = (subscriber: Subscriber) => {
        setCurrentBanIdForSubscriber(subscriber.banId);
        setEditingSubscriber(subscriber);
        setSubscriberModalOpen(true);
    };

    const handleDeleteSubscriber = (subscriberId: string) => {
       deleteSubscriber(subscriberId);
    };

    const getStatusClass = (status: Ban['status'] | Subscriber['status']) => {
        switch (status) {
            case 'activo': return 'bg-green-500/20 text-green-400';
            case 'cancelado': return 'bg-red-500/20 text-red-400';
            case 'suspendido': return 'bg-yellow-500/20 text-yellow-400';
            default: return 'bg-slate-500/20 text-slate-400';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-primary bg-opacity-80 flex justify-center items-center z-[60] p-4">
            <div className="bg-secondary rounded-lg shadow-xl p-8 w-full max-w-6xl max-h-[90vh] flex flex-col transform transition-all">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-tertiary">
                    <h2 className="text-2xl font-bold text-text-primary">Gestionar BANs para: <span className="text-accent">{client.name}</span></h2>
                     <button
                        onClick={handleAddNewBan}
                        className="flex items-center bg-accent text-primary font-bold py-2 px-4 rounded-lg hover:bg-sky-300 transition-colors"
                    >
                        <PlusIcon />
                        <span className="ml-2">Nuevo BAN</span>
                    </button>
                </div>
                
                <div className="flex-grow overflow-y-auto pr-2">
                    <div className="bg-primary rounded-lg shadow-inner overflow-hidden">
                        {clientBans.length > 0 ? (
                        <table className="w-full text-sm text-left text-text-secondary">
                          <thead className="text-xs text-text-secondary uppercase bg-tertiary">
                            <tr>
                              <th scope="col" className="px-6 py-3">Número BAN</th>
                              <th scope="col" className="px-6 py-3">Estado</th>
                              <th scope="col" className="px-6 py-3 text-center">Suscriptores</th>
                              <th scope="col" className="px-6 py-3 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientBans.map(ban => (
                              <React.Fragment key={ban.id}>
                                <tr className="border-b border-tertiary hover:bg-tertiary/40">
                                  <td className="px-6 py-4 font-medium text-text-primary">{ban.number}</td>
                                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusClass(ban.status)}`}>{ban.status}</span></td>
                                  <td className="px-6 py-4 text-center">
                                      <div className="flex items-center justify-center">
                                          <span>{subscriberCounts[ban.id] || 0}</span>
                                          {(subscriberCounts[ban.id] || 0) === 0 && <span className="ml-2 text-yellow-400" title="Este BAN no tiene suscriptores"><WarningIcon/></span>}
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <button onClick={() => setExpandedBanId(expandedBanId === ban.id ? null : ban.id)} className="text-accent hover:text-sky-300 p-2" title="Gestionar Suscriptores">
                                      <UserGroupIcon />
                                    </button>
                                    <button onClick={() => handleEditBan(ban)} className="text-accent hover:text-sky-300 p-2 ml-1" title="Editar BAN"><PencilIcon /></button>
                                    <button onClick={() => handleDeleteBan(ban.id)} className="text-red-500 hover:text-red-400 p-2 ml-1" title="Eliminar BAN"><TrashIcon /></button>
                                  </td>
                                </tr>
                                {expandedBanId === ban.id && (
                                    <tr className="bg-tertiary/20">
                                        <td colSpan={4} className="p-4">
                                           <div className="flex justify-between items-center mb-2">
                                                <h3 className="font-semibold text-text-primary">Suscriptores del BAN: {ban.number}</h3>
                                                <button onClick={() => handleAddNewSubscriber(ban.id)} className="flex items-center text-accent text-sm font-bold py-1 px-3 rounded-md hover:bg-tertiary">
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
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-text-secondary">Este cliente no tiene BANs asignados.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-4 mt-auto border-t border-tertiary flex justify-end">
                    <button onClick={onClose} className="bg-tertiary text-text-primary py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors">Cerrar</button>
                </div>
            </div>

            {isBanModalOpen && (
                <BanModal
                    isOpen={isBanModalOpen}
                    onClose={() => {
                        setBanModalOpen(false);
                        setEditingBan(null);
                        setNewBan(null);
                    }}
                    ban={editingBan || newBan}
                    crmData={crmData}
                    onSave={editingBan ? undefined : handleSaveBan}
                />
            )}
            {isSubscriberModalOpen && currentBanIdForSubscriber && (
                <SubscriberModal 
                    isOpen={isSubscriberModalOpen} 
                    onClose={() => {
                        setSubscriberModalOpen(false);
                        setNewBan(null);
                    }} 
                    subscriber={editingSubscriber} 
                    banId={currentBanIdForSubscriber} 
                    crmData={crmData}
                    isFirstSubscriberRequired={!!newBan}
                />
            )}
        </div>
    );
};

export default ClientBansManagerModal;