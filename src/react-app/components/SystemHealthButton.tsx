import { useState } from 'react';
import { Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { authFetch } from '@/react-app/utils/auth';

export default function SystemHealthButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    
    try {
      // Usar fetch normal si no requiere auth, o authFetch si lo protegemos
      // Por ahora asumimos que es público o el usuario ya está logueado
      const response = await fetch('/api/health/full');
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Error en diagnóstico');
      
      setResults(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'ok') return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (status === 'error') return <XCircle className="w-5 h-5 text-red-500" />;
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  };

  return (
    <>
      <button
        onClick={() => { setIsOpen(true); runDiagnostics(); }}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-full shadow-lg border border-gray-600 transition-all"
        title="Diagnóstico del Sistema"
      >
        <Activity className="w-5 h-5 text-blue-400" />
        <span className="text-sm font-medium hidden md:inline">Estado Sistema</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
              <div className="flex items-center gap-3">
                <Activity className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-bold text-white">Diagnóstico de Salud del Sistema</h2>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                  <p className="text-gray-400">Ejecutando pruebas de integridad...</p>
                  <p className="text-xs text-gray-600 mt-2">Verificando BD, Tablas, Permisos y Endpoints</p>
                </div>
              ) : error ? (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
                  <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-red-400 mb-2">Error Crítico en Diagnóstico</h3>
                  <p className="text-red-300">{error}</p>
                  <button 
                    onClick={runDiagnostics}
                    className="mt-4 px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg"
                  >
                    Reintentar
                  </button>
                </div>
              ) : results ? (
                <div className="space-y-6">
                  {/* Resumen General */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Base de Datos</p>
                        <p className="text-lg font-bold text-white">{results.database.status === 'ok' ? 'Conectada' : 'Error'}</p>
                      </div>
                      <StatusIcon status={results.database.status} />
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Permisos Escritura</p>
                        <p className="text-lg font-bold text-white">{results.permissions.status === 'ok' ? 'Correctos' : 'Fallidos'}</p>
                      </div>
                      <StatusIcon status={results.permissions.status} />
                    </div>
                  </div>

                  {/* Tablas Críticas */}
                  <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="p-3 bg-gray-700/50 border-b border-gray-700 font-medium text-gray-300">
                      Tablas Críticas
                    </div>
                    <div className="divide-y divide-gray-700">
                      {results.tables.details.map((table: any) => (
                        <div key={table.table} className="p-3 flex justify-between items-center">
                          <span className="text-gray-300 font-mono">{table.table}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">{table.count} registros</span>
                            <StatusIcon status={table.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Funciones Críticas */}
                  <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="p-3 bg-gray-700/50 border-b border-gray-700 font-medium text-gray-300">
                      Integridad de Estructura
                    </div>
                    <div className="divide-y divide-gray-700">
                      {results.critical_functions.details.map((check: any) => (
                        <div key={check.check} className="p-3 flex justify-between items-center">
                          <span className="text-gray-300 font-mono text-sm">{check.check}</span>
                          <div className="flex items-center gap-3">
                            {check.error && <span className="text-xs text-red-400">{check.error}</span>}
                            <StatusIcon status={check.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={runDiagnostics}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Ejecutar Nuevamente
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
