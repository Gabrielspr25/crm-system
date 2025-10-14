import React, { useState, useMemo } from 'react';
import { Meta } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';

interface MetaRegistrationSystemProps {
  crmData: CrmDataHook;
  currentUser: any;
}

interface MetaRow {
  id: string;
  vendedor: string;
  vendedorId: string;
  categorias: {
    [key: string]: {
      valor: string;
      activa: boolean;
    };
  };
}

const MetaRegistrationSystem: React.FC<MetaRegistrationSystemProps> = ({
  crmData,
  currentUser
}) => {
  const { salespeople, metas = [], addMeta, updateMeta } = crmData;
  
  const categories = ['Móvil', 'Fijo', 'TV', 'Cloud', 'POS'];
  
  // Período actual por defecto
  const [selectedPeriod, setSelectedPeriod] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  // Estado del formulario masivo
  const [metaRows, setMetaRows] = useState<MetaRow[]>(() => {
    // Inicializar con fila del negocio + vendedores
    const initialRows: MetaRow[] = [];
    
    // Fila del NEGOCIO
    initialRows.push({
      id: 'NEGOCIO',
      vendedor: '🏢 META DEL NEGOCIO',
      vendedorId: 'NEGOCIO',
      categorias: categories.reduce((acc, cat) => {
        acc[cat] = { valor: '', activa: true };
        return acc;
      }, {} as any)
    });

    // Filas de vendedores
    salespeople.forEach(person => {
      initialRows.push({
        id: person.id,
        vendedor: `👤 ${person.name}`,
        vendedorId: person.id,
        categorias: categories.reduce((acc, cat) => {
          acc[cat] = { valor: '', activa: true };
          return acc;
        }, {} as any)
      });
    });

    return initialRows;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar metas existentes para el período seleccionado
  const existingMetas = useMemo(() => {
    return metas.filter(meta => 
      meta.month === selectedPeriod.month && 
      meta.year === selectedPeriod.year
    );
  }, [metas, selectedPeriod]);

  // Actualizar valores con metas existentes
  React.useEffect(() => {
    setMetaRows(prevRows => 
      prevRows.map(row => {
        const updatedRow = { ...row };
        
        categories.forEach(categoria => {
          const existingMeta = existingMetas.find(meta => 
            meta.vendedorId === row.vendedorId && 
            meta.categoria === categoria
          );
          
          if (existingMeta) {
            updatedRow.categorias[categoria] = {
              valor: existingMeta.metaValor.toString(),
              activa: existingMeta.activa
            };
          }
        });

        return updatedRow;
      })
    );
  }, [selectedPeriod.month, selectedPeriod.year]); // Cambiar dependencias para evitar bucle infinito

  // Calcular totales
  const totales = useMemo(() => {
    const businessRow = metaRows.find(row => row.vendedorId === 'NEGOCIO');
    const vendorRows = metaRows.filter(row => row.vendedorId !== 'NEGOCIO');

    return categories.reduce((acc, categoria) => {
      const metaNegocio = businessRow ? parseFloat(businessRow.categorias[categoria]?.valor || '0') : 0;
      const sumVendedores = vendorRows.reduce((sum, row) => {
        return sum + parseFloat(row.categorias[categoria]?.valor || '0');
      }, 0);

      acc[categoria] = {
        metaNegocio,
        sumVendedores,
        diferencia: metaNegocio - sumVendedores,
        porcentaje: metaNegocio > 0 ? (sumVendedores / metaNegocio) * 100 : 0
      };

      return acc;
    }, {} as any);
  }, [metaRows, categories]);

  const updateMetaValue = (rowId: string, categoria: string, valor: string) => {
    setMetaRows(prev =>
      prev.map(row =>
        row.id === rowId
          ? {
              ...row,
              categorias: {
                ...row.categorias,
                [categoria]: { ...row.categorias[categoria], valor }
              }
            }
          : row
      )
    );
  };

  const toggleMetaActiva = (rowId: string, categoria: string) => {
    setMetaRows(prev =>
      prev.map(row =>
        row.id === rowId
          ? {
              ...row,
              categorias: {
                ...row.categorias,
                [categoria]: { 
                  ...row.categorias[categoria], 
                  activa: !row.categorias[categoria].activa 
                }
              }
            }
          : row
      )
    );
  };

  const handleSaveAll = async () => {
    setLoading(true);
    setError(null);

    try {
      for (const row of metaRows) {
        for (const categoria of categories) {
          const metaData = row.categorias[categoria];
          const valor = parseFloat(metaData.valor);
          
          if (valor > 0) {
            // Verificar si ya existe
            const existing = existingMetas.find(meta => 
              meta.vendedorId === row.vendedorId && 
              meta.categoria === categoria
            );

            // Calcular el último día del mes correctamente
            const lastDayOfMonth = new Date(selectedPeriod.year, selectedPeriod.month, 0).getDate();
            
            const metaObj = {
              vendedorId: row.vendedorId === 'NEGOCIO' ? null : row.vendedorId,
              metaValor: valor,
              tipoMeta: 'mensual',
              categoria,
              activa: metaData.activa,
              periodo: `${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}`,
              fechaInicio: `${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}-01`,
              fechaFin: `${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`,
              descripcion: `Meta de ${categoria} - ${selectedPeriod.month}/${selectedPeriod.year}`,
              tipoObjetivo: row.vendedorId === 'NEGOCIO' ? 'negocio' : 'vendedor'
            };
            
            console.log('🎯 MetaRegistrationSystem enviando:', JSON.stringify(metaObj, null, 2));

            if (existing) {
              await updateMeta(existing.id, metaObj);
            } else {
              await addMeta(metaObj);
            }
          }
        }
      }

      alert('✅ Metas guardadas exitosamente');
    } catch (err: any) {
      setError(err.message || 'Error al guardar las metas');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-secondary rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">📊 Registro de Metas</h1>
            <p className="text-text-secondary mt-1">
              Sistema integral para definir metas del negocio y vendedores por categoría
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Selector de período */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-text-primary">Período:</label>
              <select
                value={selectedPeriod.month}
                onChange={(e) => setSelectedPeriod(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                className="bg-tertiary text-text-primary px-3 py-2 rounded border border-border focus:ring-2 focus:ring-accent"
              >
                {Array.from({length: 12}, (_, i) => (
                  <option key={i+1} value={i+1}>
                    {new Date(0, i).toLocaleDateString('es-ES', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                value={selectedPeriod.year}
                onChange={(e) => setSelectedPeriod(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                className="bg-tertiary text-text-primary px-3 py-2 rounded border border-border focus:ring-2 focus:ring-accent"
              >
                {Array.from({length: 3}, (_, i) => (
                  <option key={i} value={new Date().getFullYear() + i}>
                    {new Date().getFullYear() + i}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSaveAll}
              disabled={loading}
              className="bg-accent text-primary font-bold py-2 px-6 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : '💾 Guardar Todas las Metas'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
            ❌ {error}
          </div>
        )}
      </div>

      {/* Tabla de registro masivo */}
      <div className="bg-secondary rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-tertiary">
              <tr>
                <th className="px-4 py-3 text-left text-text-primary font-semibold min-w-[200px]">
                  Vendedor
                </th>
                {categories.map(categoria => (
                  <th key={categoria} className="px-4 py-3 text-center text-text-primary font-semibold min-w-[120px]">
                    {categoria}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-text-primary font-semibold min-w-[100px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {metaRows.map((row, index) => {
                const isBusinessRow = row.vendedorId === 'NEGOCIO';
                const rowTotal = categories.reduce((sum, cat) => 
                  sum + parseFloat(row.categorias[cat]?.valor || '0'), 0
                );

                return (
                  <tr 
                    key={row.id}
                    className={`hover:bg-tertiary/30 transition-colors ${
                      isBusinessRow ? 'bg-blue-500/10 border-t-2 border-blue-500' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <span className={`font-semibold ${
                          isBusinessRow ? 'text-blue-400' : 'text-text-primary'
                        }`}>
                          {row.vendedor}
                        </span>
                        {isBusinessRow && (
                          <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                            META GLOBAL
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {categories.map(categoria => (
                      <td key={categoria} className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="relative">
                            <span className="absolute left-2 top-2 text-text-secondary text-sm">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.categorias[categoria]?.valor || ''}
                              onChange={(e) => updateMetaValue(row.id, categoria, e.target.value)}
                              className={`w-full bg-tertiary border border-border rounded px-6 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent text-center ${
                                isBusinessRow ? 'font-bold border-blue-400' : ''
                              }`}
                              placeholder={isBusinessRow ? '100000' : '25000'}
                            />
                          </div>
                          <div className="flex justify-center">
                            <button
                              onClick={() => toggleMetaActiva(row.id, categoria)}
                              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                                row.categorias[categoria]?.activa
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-500 text-white'
                              }`}
                            >
                              {row.categorias[categoria]?.activa ? '✓ Activa' : '✗ Inactiva'}
                            </button>
                          </div>
                        </div>
                      </td>
                    ))}
                    
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold text-lg ${
                        isBusinessRow ? 'text-blue-400' : 'text-accent'
                      }`}>
                        {formatCurrency(rowTotal)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel de análisis */}
      <div className="bg-secondary rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">📈 Análisis de Distribución</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map(categoria => {
            const stats = totales[categoria];
            const isBalanced = Math.abs(stats.diferencia) < stats.metaNegocio * 0.05; // 5% tolerance

            return (
              <div key={categoria} className="bg-tertiary rounded-lg p-4">
                <h4 className="font-semibold text-text-primary mb-3">{categoria}</h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Meta Negocio:</span>
                    <span className="font-medium text-blue-400">
                      {formatCurrency(stats.metaNegocio)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Suma Vendedores:</span>
                    <span className="font-medium text-green-400">
                      {formatCurrency(stats.sumVendedores)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Diferencia:</span>
                    <span className={`font-bold ${
                      stats.diferencia === 0 ? 'text-green-400' :
                      stats.diferencia > 0 ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {stats.diferencia > 0 ? '+' : ''}{formatCurrency(stats.diferencia)}
                    </span>
                  </div>
                  
                  <div className="pt-2">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-text-secondary">Cobertura:</span>
                      <span className="text-xs font-medium">
                        {stats.porcentaje.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-border rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          stats.porcentaje >= 95 && stats.porcentaje <= 105 ? 'bg-green-400' :
                          stats.porcentaje >= 80 ? 'bg-yellow-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${Math.min(100, stats.porcentaje)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isBalanced ? 'bg-green-500/20 text-green-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {isBalanced ? '✅ Balanceado' : '⚠️ Revisar'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MetaRegistrationSystem;