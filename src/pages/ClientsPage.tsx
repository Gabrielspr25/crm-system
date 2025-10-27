import React, { useState, useMemo } from 'react';
import { Client, Ban, Subscriber, Salesperson } from '../types';
import ClientModal from '../components/ClientModal';
import { CrmDataHook } from '../hooks/useCrmData';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import BanModal from '../components/BanModal';
import SubscriberModal from '../components/SubscriberModal';
import ClientBansManagerModal from '../components/ClientBansManagerModal';
import WarningIcon from '../components/icons/WarningIcon';

interface ClientsPageProps {
  crmData: CrmDataHook;
  currentUser: Salesperson;
}

const ClientsPage: React.FC<ClientsPageProps> = ({ crmData, currentUser }) => {
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [newBan, setNewBan] = useState<Ban | null>(null);

  const [isSubscriberModalOpen, setIsSubscriberModalOpen] = useState(false);
  
  const [managingBansForClient, setManagingBansForClient] = useState<Client | null>(null);
  
  const { clients, salespeople, deleteClient, bans, subscribers } = crmData;
  
  const userClients = useMemo(() => {
    if (currentUser.role === 'admin') {
        return clients;
    }
    return clients.filter(c => c.salespersonId === currentUser.id);
  }, [clients, currentUser]);


  const handleAddNew = () => {
    setEditingClient(null);
    setIsClientModalOpen(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsClientModalOpen(true);
  };
  
  const handleDelete = async (clientId: string) => {
    if(window.confirm('¿Está seguro de que desea eliminar este cliente? Se eliminarán también todos sus BANs y suscriptores asociados.')) {
        await deleteClient(clientId);
    }
  }

  const handleSaveClient = (savedClient: Client, createBan: boolean) => {
      setIsClientModalOpen(false);
      if (createBan) {
          // Pasar null al BAN modal con clientId, que creará el BAN internamente
          const banToCreate = { id: '', number: '', clientId: savedClient.id, status: 'activo' as const, lastUpdated: '', subscribers: [] };
          setNewBan(banToCreate);
          setIsBanModalOpen(true);
      }
  };
  
  const handleSaveBan = () => {
      setIsBanModalOpen(false);
      setIsSubscriberModalOpen(true);
  }

  const handleManageBans = (client: Client) => {
      setIsClientModalOpen(false);
      setManagingBansForClient(client);
  }
  
  const salespeopleMap = useMemo(() => 
    salespeople.reduce((acc, s) => {
      acc[s.id] = s.name;
      return acc;
    }, {} as Record<string, string>), [salespeople]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-text-primary">Clientes</h1>
        <button
          onClick={handleAddNew}
          className="flex items-center bg-accent text-primary font-bold py-2 px-4 rounded-lg hover:bg-sky-300 transition-colors"
        >
          <PlusIcon />
          <span className="ml-2">Nuevo Cliente</span>
        </button>
      </div>

      <div className="bg-secondary rounded-lg shadow-lg overflow-hidden">
        <table className="w-full text-sm text-left text-text-secondary">
          <thead className="text-xs text-text-secondary uppercase bg-tertiary">
            <tr>
              <th scope="col" className="px-6 py-3">Nombre</th>
              <th scope="col" className="px-6 py-3">Compañía</th>
              <th scope="col" className="px-6 py-3">Email</th>
              <th scope="col" className="px-6 py-3">Teléfono</th>
              <th scope="col" className="px-6 py-3">Vendedor</th>
              <th scope="col" className="px-6 py-3">Nº de BANs</th>
              <th scope="col" className="px-6 py-3">Suscriptores</th>
              <th scope="col" className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {userClients.map(client => {
                const clientBans = bans.filter(ban => ban.clientId === client.id);
                const hasEmptyBans = clientBans.length > 0 && clientBans.some(ban => subscribers.filter(sub => sub.banId === ban.id).length === 0);
                const totalSubscribers = clientBans.reduce((acc, ban) => acc + subscribers.filter(sub => sub.banId === ban.id).length, 0);

                return (
                  <tr key={client.id} className="border-b border-tertiary hover:bg-tertiary/40 record-item">
                    <td className="px-6 py-4 font-medium text-text-primary whitespace-nowrap">{client.name}</td>
                    <td className="px-6 py-4">{client.company}</td>
                    <td className="px-6 py-4">{client.email}</td>
                    <td className="px-6 py-4">{client.phone}</td>
                    <td className="px-6 py-4">{client.salespersonId ? salespeopleMap[client.salespersonId] : 'N/A'}</td>
                    <td className="px-6 py-4 text-center">{clientBans.length}</td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center">
                           <span>{totalSubscribers}</span>
                           {hasEmptyBans && <span className="ml-2 text-yellow-400" title="Uno o más BANs de este cliente no tienen suscriptores."><WarningIcon /></span>}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(client)} className="text-accent hover:text-sky-300 p-2">
                        <PencilIcon />
                      </button>
                      <button onClick={() => handleDelete(client.id)} className="text-red-500 hover:text-red-400 p-2 ml-1">
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                )
            })}
          </tbody>
        </table>
      </div>
      
      {isClientModalOpen && (
        <ClientModal
          isOpen={isClientModalOpen}
          onClose={() => setIsClientModalOpen(false)}
          client={editingClient}
          crmData={crmData}
          onSave={handleSaveClient}
          onManageBans={handleManageBans}
        />
      )}

      {isBanModalOpen && newBan && (
        <BanModal
            isOpen={isBanModalOpen}
            onClose={() => {
                setIsBanModalOpen(false);
                setNewBan(null);
            }}
            ban={newBan}
            crmData={crmData}
            onSave={handleSaveBan}
            clientId={newBan.clientId}
        />
      )}

      {isSubscriberModalOpen && newBan && (
        <SubscriberModal
            isOpen={isSubscriberModalOpen}
            onClose={() => {
                setIsSubscriberModalOpen(false);
                setNewBan(null);
            }}
            subscriber={null}
            banId={newBan.id}
            crmData={crmData}
            isFirstSubscriberRequired={true}
        />
      )}

      {managingBansForClient && (
        <ClientBansManagerModal
            isOpen={!!managingBansForClient}
            onClose={() => setManagingBansForClient(null)}
            client={managingBansForClient}
            crmData={crmData}
        />
      )}
    </div>
  );
};

export default ClientsPage;

