import React, { useMemo } from 'react';
import { Meta, Salesperson } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';

interface VendedorMetasProfileProps {
  currentUser: Salesperson;
  crmData: CrmDataHook;
  isOpen: boolean;
  onClose: () => void;
}

const VendedorMetasProfile: React.FC<VendedorMetasProfileProps> = ({ 
  currentUser, 
  crmData, 
  isOpen, 
  onClose 
}) => {
  const { metas = [], incomes } = crmData;

  // Filtrar metas del vendedor actual - SOLUCIÓN: Castear a string
  const myMetas = useMemo(() => {
    console.log('🔍 Filtrando metas para usuario:', currentUser.id);
    console.log('📊 Total metas disponibles:', metas.length);
    console.log('📊 Metas completas:', metas);
    
    // SOLUCIÓN: Forzar conversión a string para comparar
    const filtered = metas.filter(meta => String(meta.vendedorId) === String(currentUser.id));
    console.log('🎯 Metas filtradas para', currentUser.name, ':', filtered);
    
    return filtered;
  }, [metas, currentUser.id]);

  // Calcular progreso de cada meta
  const metasWithProgress = useMemo(() => {
    return myMetas.map(meta => {
      const vendorIncomes = incomes.filter(income => 
        income.salespersonId === meta.vendedorId &&
        new Date(income.date).getFullYear() === meta.year &&
        (new Date(income.date).getMonth() + 1) === meta.month
      );
      
      const totalSales = vendorIncomes.reduce((sum, income) => sum + income.amount, 0);
      const progressPercent = meta.metaValor > 0 ? (totalSales / meta.metaValor) * 100 : 0;
      
      return {
        ...meta,
        totalSales,
        progressPercent: Math.round(progressPercent * 100) / 100,
        remaining: Math.max(0, meta.metaValor - totalSales),
        status: progressPercent >= 100 ? 'completada' : progressPercent >= 75 ? 'en-progreso' : 'pendiente'
      };
    });
  }, [myMetas, incomes]);

  // Obtener metas activas (mostrar todas las disponibles)
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const currentMetas = metasWithProgress.filter(meta => meta.activa);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (year: number, month: number) => {
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-secondary rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-border">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
            />
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-text-primary">
                Mis Metas - {currentUser.name}
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary">Seguimiento personal de objetivos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-2 hover:bg-tertiary rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Banner informativo */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-blue-400 text-sm">
                <strong>Información:</strong> Las metas son programadas por el administrador. Solo puedes ver tu progreso personal aquí.
              </span>
            </div>
          </div>

          {/* Resumen del mes actual */}
          {currentMetas.length > 0 && (
            <div className="bg-tertiary rounded-lg p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                📅 Mis Metas del Mes - {formatDate(currentYear, currentMonth)}
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {currentMetas.map(meta => (
                  <div 
                    key={meta.id} 
                    className={`bg-secondary rounded-lg p-4 border-l-4 ${
                      meta.status === 'completada' ? 'border-green-500' :
                      meta.status === 'en-progreso' ? 'border-yellow-500' : 'border-red-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-text-primary">
                        {meta.categoria || meta.tipoMeta}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        meta.status === 'completada' ? 'bg-green-500/20 text-green-400' :
                        meta.status === 'en-progreso' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {meta.status === 'completada' ? '✅ Completada' :
                         meta.status === 'en-progreso' ? '🔥 En Progreso' : '⏳ Pendiente'}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Meta:</span>
                        <span className="font-medium text-text-primary">
                          {formatCurrency(meta.metaValor)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Logrado:</span>
                        <span className="font-medium text-accent">
                          {formatCurrency(meta.totalSales)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Falta:</span>
                        <span className="font-medium text-text-primary">
                          {formatCurrency(meta.remaining)}
                        </span>
                      </div>
                      
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-text-secondary">Progreso:</span>
                          <span className="text-text-primary font-medium">
                            {meta.progressPercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-border rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              meta.progressPercent >= 100 ? 'bg-green-400' :
                              meta.progressPercent >= 75 ? 'bg-yellow-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(100, meta.progressPercent)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial de metas */}
          <div className="bg-tertiary rounded-lg p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              📊 Historial de Metas
            </h3>
            
            {metasWithProgress.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary rounded-lg">
                    <tr>
                      <th className="px-4 py-3 text-left text-text-primary font-semibold">
                        Período
                      </th>
                      <th className="px-4 py-3 text-left text-text-primary font-semibold">
                        Categoría
                      </th>
                      <th className="px-4 py-3 text-right text-text-primary font-semibold">
                        Meta
                      </th>
                      <th className="px-4 py-3 text-right text-text-primary font-semibold">
                        Logrado
                      </th>
                      <th className="px-4 py-3 text-center text-text-primary font-semibold">
                        Progreso
                      </th>
                      <th className="px-4 py-3 text-center text-text-primary font-semibold">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {metasWithProgress
                      .sort((a, b) => b.year - a.year || b.month - a.month)
                      .map(meta => (
                      <tr key={meta.id} className="hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-3 text-text-primary">
                          {formatDate(meta.year, meta.month)}
                        </td>
                        <td className="px-4 py-3 text-text-primary">
                          <span className="font-medium">
                            {meta.categoria || meta.tipoMeta}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-text-primary font-semibold">
                          {formatCurrency(meta.metaValor)}
                        </td>
                        <td className="px-4 py-3 text-right text-accent font-semibold">
                          {formatCurrency(meta.totalSales)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center space-x-2">
                            <div className="w-16 bg-border rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  meta.progressPercent >= 100 ? 'bg-green-400' :
                                  meta.progressPercent >= 75 ? 'bg-yellow-400' : 'bg-red-400'
                                }`}
                                style={{ width: `${Math.min(100, meta.progressPercent)}%` }}
                              />
                            </div>
                            <span className="text-xs text-text-secondary min-w-[40px]">
                              {meta.progressPercent.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            meta.status === 'completada' ? 'bg-green-500/20 text-green-400' :
                            meta.status === 'en-progreso' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {meta.status === 'completada' ? 'Completada' :
                             meta.status === 'en-progreso' ? 'En Progreso' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📈</div>
                <p className="text-text-secondary">No tienes metas registradas</p>
                <p className="text-text-secondary text-sm mt-1">
                  Las metas son asignadas por el administrador
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendedorMetasProfile;