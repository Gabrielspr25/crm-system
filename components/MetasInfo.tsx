import React from 'react';
import { CrmDataHook } from '../hooks/useCrmData';

interface MetasInfoProps {
  crmData: CrmDataHook;
}

const MetasInfo: React.FC<MetasInfoProps> = ({ crmData }) => {
  const { metas, salespeople } = crmData;

  if (!metas || metas.length === 0) {
    return (
      <div className="bg-yellow-500 bg-opacity-10 border border-yellow-500 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <div className="text-yellow-500 text-2xl mr-3">⚠️</div>
          <div>
            <h3 className="text-yellow-400 font-semibold">No hay metas configuradas</h3>
            <p className="text-yellow-300 text-sm">
              Configure metas individuales para cada vendedor en la sección de Configuración.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-500 bg-opacity-10 border border-blue-500 rounded-lg p-4 mb-6">
      <div className="flex items-start">
        <div className="text-blue-400 text-2xl mr-3">🎯</div>
        <div className="flex-1">
          <h3 className="text-blue-300 font-semibold mb-2">Metas Configuradas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {metas.map(meta => {
              const vendedor = salespeople.find(s => s.id === meta.vendedor_id);
              return (
                <div key={meta.id} className="bg-blue-900 bg-opacity-30 rounded-lg p-3">
                  <p className="text-blue-100 font-medium">
                    {vendedor?.name || 'Vendedor no encontrado'}
                  </p>
                  <p className="text-blue-200 text-lg font-bold">
                    ${parseFloat(meta.meta_valor.toString()).toLocaleString()}
                  </p>
                  <p className="text-blue-300 text-xs">
                    {meta.periodo} • {meta.activa ? 'Activa' : 'Inactiva'}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-blue-300 text-xs mt-2">
            Las metas se actualizan automáticamente en el dashboard motivacional
          </p>
        </div>
      </div>
    </div>
  );
};

export default MetasInfo;
