import React from 'react';
import { CrmDataHook } from '../hooks/useCrmData';

interface DebugPageProps {
  crmData: CrmDataHook;
  currentUser: {
    id: string;
    name: string;
    role: 'admin' | 'vendedor';
  };
}

const DebugPage: React.FC<DebugPageProps> = ({ crmData, currentUser }) => {
  const { clients, salespeople, products, metas, incomes } = crmData;
  
  console.log('🐛 Debug Page rendering with data:', {
    clients: clients?.length,
    salespeople: salespeople?.length,
    products: products?.length,
    metas: metas?.length,
    incomes: incomes?.length,
    currentUser
  });

  return (
    <div className="min-h-screen bg-primary text-text-primary p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🐛 Debug Page</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Usuario Actual */}
          <div className="bg-secondary rounded-lg p-6 border border-accent/20">
            <h2 className="text-xl font-semibold mb-4 text-accent">👤 Usuario Actual</h2>
            <div className="space-y-2 text-sm">
              <div><strong>ID:</strong> {currentUser.id}</div>
              <div><strong>Nombre:</strong> {currentUser.name}</div>
              <div><strong>Rol:</strong> {currentUser.role}</div>
            </div>
          </div>

          {/* Datos CRM */}
          <div className="bg-secondary rounded-lg p-6 border border-accent/20">
            <h2 className="text-xl font-semibold mb-4 text-accent">📊 Datos CRM</h2>
            <div className="space-y-2 text-sm">
              <div><strong>Vendedores:</strong> {salespeople?.length || 0}</div>
              <div><strong>Clientes:</strong> {clients?.length || 0}</div>
              <div><strong>Productos:</strong> {products?.length || 0}</div>
              <div><strong>Metas:</strong> {metas?.length || 0}</div>
              <div><strong>Ingresos:</strong> {incomes?.length || 0}</div>
            </div>
          </div>

          {/* Estado de Carga */}
          <div className="bg-secondary rounded-lg p-6 border border-accent/20">
            <h2 className="text-xl font-semibold mb-4 text-accent">⚡ Estado</h2>
            <div className="space-y-2 text-sm">
              <div><strong>Timestamp:</strong> {new Date().toLocaleTimeString()}</div>
              <div><strong>Estado:</strong> <span className="text-accent">✅ Renderizado</span></div>
              <div><strong>Datos:</strong> <span className="text-accent">✅ Recibidos</span></div>
            </div>
          </div>
        </div>

        {/* Lista de Vendedores */}
        {salespeople && salespeople.length > 0 && (
          <div className="bg-secondary rounded-lg p-6 mt-6 border border-accent/20">
            <h2 className="text-xl font-semibold mb-4 text-accent">👥 Vendedores</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {salespeople.map(person => (
                <div key={person.id} className="bg-tertiary rounded p-4">
                  <div className="font-semibold">{person.name}</div>
                  <div className="text-sm text-text-secondary">{person.email}</div>
                  <div className="text-sm text-text-secondary">Rol: {person.role}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metas */}
        {metas && metas.length > 0 && (
          <div className="bg-secondary rounded-lg p-6 mt-6 border border-accent/20">
            <h2 className="text-xl font-semibold mb-4 text-accent">🎯 Metas Activas</h2>
            <div className="space-y-2">
              {metas.slice(0, 5).map(meta => (
                <div key={meta.id} className="bg-tertiary rounded p-3">
                  <div className="text-sm">
                    <strong>Vendedor ID:</strong> {meta.vendedor_id}
                  </div>
                  <div className="text-sm">
                    <strong>Meta:</strong> ${meta.meta_valor?.toLocaleString()}
                  </div>
                  <div className="text-sm">
                    <strong>Período:</strong> {meta.periodo}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botones de navegación */}
        <div className="mt-8 flex gap-4">
          <button 
            onClick={() => console.log('🔄 Datos actuales:', { clients, salespeople, products, metas, incomes })}
            className="bg-accent text-primary px-4 py-2 rounded-lg hover:bg-accent/80 transition-colors"
          >
            🔍 Log Data
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="bg-tertiary text-text-primary px-4 py-2 rounded-lg hover:bg-tertiary/80 transition-colors"
          >
            🔄 Reload Page
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebugPage;