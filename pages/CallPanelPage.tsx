import React, { useMemo } from 'react';
import { CrmDataHook } from '../hooks/useCrmData';

const CallPanelPage: React.FC<{ crmData: CrmDataHook }> = ({ crmData }) => {
  const { clients, updateClient } = crmData;

  const pendingCalls = useMemo(() => {
    // Get today's date as a YYYY-MM-DD string, crucial for timezone-agnostic comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to the beginning of the day

    return clients.filter(client => {
      // Must have a date to call
      if (!client.dateToCall) {
        return false;
      }
      
      // The date to call must be today or in the past
      const dateToCall = new Date(client.dateToCall);
      dateToCall.setUTCHours(0,0,0,0); // Use UTC to avoid timezone shifts from string conversion
      
      if (dateToCall > today) {
        return false;
      }

      // If it has never been called, it's pending
      if (!client.dateCalled) {
        return true;
      }

      // If it has been called, the call date must be *before* the scheduled call date
      const dateCalled = new Date(client.dateCalled);
      dateCalled.setUTCHours(0,0,0,0);

      return dateCalled < dateToCall;
    }).sort((a,b) => (a.dateToCall || '').localeCompare(b.dateToCall || ''));
  }, [clients]);
  
  const handleMarkAsCalled = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const today = new Date().toISOString().split('T')[0];
      updateClient({ ...client, dateCalled: today });
    }
  };

  const handleReschedule = (clientId: string, newDate: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client && newDate) {
      updateClient({ ...client, dateToCall: newDate });
    }
  };
  
  const formatDate = (dateString: string | undefined) => {
      if(!dateString) return 'N/A';
      // Add a day to counteract timezone issues when formatting
      const date = new Date(dateString);
      date.setUTCDate(date.getUTCDate() + 1);
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-text-primary mb-6">Panel de Llamadas</h1>
       <div className="bg-secondary p-4 rounded-lg shadow-lg mb-6">
            <p className="text-text-secondary">
                Aquí se muestran los clientes con una "Fecha de llamar" programada para hoy o una fecha anterior que no han sido contactados aún.
            </p>
        </div>
      
      {pendingCalls.length === 0 ? (
        <div className="text-center py-10 bg-secondary rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="mt-2 text-lg font-medium text-text-primary">¡Todo al día!</h3>
            <p className="mt-1 text-sm text-text-secondary">No tienes llamadas pendientes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingCalls.map(client => (
            <div key={client.id} className="bg-secondary p-5 rounded-lg shadow-lg flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-lg text-text-primary">{client.company}</p>
                            <p className="text-sm text-text-secondary -mt-1">{client.name}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs text-text-secondary">Llamar el:</p>
                           <p className="font-semibold text-accent">{formatDate(client.dateToCall)}</p>
                        </div>
                    </div>
                    <div className="mt-4 text-sm space-y-2 border-t border-tertiary pt-4">
                        <p><span className="font-semibold text-text-secondary">Tel:</span> {client.phone || 'N/A'}</p>
                        <p><span className="font-semibold text-text-secondary">Cel:</span> {client.mobile || 'N/A'}</p>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-tertiary flex flex-col sm:flex-row gap-2">
                    <button onClick={() => handleMarkAsCalled(client.id)} className="w-full text-center bg-accent/20 text-accent font-semibold py-2 px-3 rounded-md text-sm hover:bg-accent/40 transition-colors">
                        Marcar como Llamado
                    </button>
                    <input 
                        type="date"
                        onChange={(e) => handleReschedule(client.id, e.target.value)}
                        className="w-full bg-tertiary p-2 rounded-md text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                        title="Reprogramar llamada"
                    />
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CallPanelPage;