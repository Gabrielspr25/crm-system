import React, { useState, useMemo } from 'react';
import { CrmDataHook } from '../hooks/useCrmData';
import { Subscriber } from '../types';

const SubscribersPage: React.FC<{ crmData: CrmDataHook }> = ({ crmData }) => {
  const { subscribers, bans, clients, updateSubscriber } = crmData;
  const [statusFilter, setStatusFilter] = useState<'all' | Subscriber['status']>('all');

  const filteredSubscribers = useMemo(() => {
    return subscribers.filter(sub => statusFilter === 'all' || sub.status === statusFilter);
  }, [subscribers, statusFilter]);

  const banClientMap = useMemo(() => {
    return bans.reduce((acc, ban) => {
      const client = clients.find(c => c.id === ban.clientId);
      acc[ban.id] = { banNumber: ban.number, clientCompany: client?.company || 'N/A' };
      return acc;
    }, {} as Record<string, { banNumber: string, clientCompany: string }>);
  }, [bans, clients]);

  const handleFieldChange = (subscriber: Subscriber, field: 'monthsSold' | 'paymentsMade', value: string) => {
    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue) && numericValue >= 0) {
      updateSubscriber({ ...subscriber, [field]: numericValue });
    }
  };

  const calculateExpirationDate = (sub: Subscriber) => {
    const monthsSold = sub.monthsSold || 0;
    const paymentsMade = sub.paymentsMade || 0;
    const remainingMonths = monthsSold - paymentsMade;

    if (remainingMonths <= 0) {
      return 'Pagado';
    }
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + remainingMonths);
    return expirationDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  
  const getStatusClass = (status: Subscriber['status']) => {
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
        <h1 className="text-3xl font-bold text-text-primary">Suscriptores</h1>
        <div>
          <label htmlFor="statusFilter" className="text-sm text-text-secondary mr-2">Filtrar por estado:</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-tertiary text-text-primary text-sm rounded-md p-2 border border-slate-600 focus:ring-accent focus:border-accent"
          >
            <option value="all">Todos</option>
            <option value="activo">Activo</option>
            <option value="suspendido">Suspendido</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>
      
      <div className="bg-secondary rounded-lg shadow-lg overflow-hidden">
        <table className="w-full text-sm text-left text-text-secondary">
          <thead className="text-xs text-text-secondary uppercase bg-tertiary">
            <tr>
              <th scope="col" className="px-6 py-3">Compañía</th>
              <th scope="col" className="px-6 py-3">BAN</th>
              <th scope="col" className="px-6 py-3">Suscriptor (Teléfono)</th>
              <th scope="col" className="px-6 py-3">Estado</th>
              <th scope="col" className="px-6 py-3">Meses Vendidos</th>
              <th scope="col" className="px-6 py-3">Pagos Hechos</th>
              <th scope="col" className="px-6 py-3">Fecha de Vencimiento</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubscribers.map(sub => (
              <tr key={sub.id} className="border-b border-tertiary hover:bg-tertiary/40 record-item">
                <td className="px-6 py-4 font-medium text-text-primary">{banClientMap[sub.banId]?.clientCompany || 'N/A'}</td>
                <td className="px-6 py-4">{banClientMap[sub.banId]?.banNumber || 'N/A'}</td>
                <td className="px-6 py-4 font-semibold text-text-primary">{sub.phoneNumber}</td>
                <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusClass(sub.status)}`}>{sub.status}</span>
                </td>
                <td className="px-6 py-4">
                  <input
                    type="number"
                    value={sub.monthsSold || 0}
                    onChange={(e) => handleFieldChange(sub, 'monthsSold', e.target.value)}
                    className="w-20 bg-tertiary p-1 rounded-md text-center text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </td>
                <td className="px-6 py-4">
                  <input
                    type="number"
                    value={sub.paymentsMade || 0}
                    onChange={(e) => handleFieldChange(sub, 'paymentsMade', e.target.value)}
                    className="w-20 bg-tertiary p-1 rounded-md text-center text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </td>
                <td className="px-6 py-4 font-medium text-accent">{calculateExpirationDate(sub)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubscribersPage;