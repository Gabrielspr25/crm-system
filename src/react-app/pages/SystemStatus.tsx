import { useState } from 'react';
import { Activity, CheckCircle, XCircle, Loader, AlertTriangle } from 'lucide-react';
import { authFetch } from '@/react-app/utils/auth';

interface CheckResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
  details?: any;
}

interface DiagnosticResponse {
  checks: CheckResult[];
  summary: {
    total: number;
    success: number;
    warnings: number;
    errors: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  timestamp: string;
}

export default function SystemStatus() {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [summary, setSummary] = useState<DiagnosticResponse['summary'] | null>(null);

  const runDiagnostics = async () => {
    setIsChecking(true);
    setResults([]);
    setSummary(null);

    try {
      const response = await authFetch('/api/system/diagnostics');
      if (!response.ok) throw new Error('Error en diagnóstico');
      
      const data: DiagnosticResponse = await response.json();
      setResults(data.checks || []);
      setSummary(data.summary || null);
    } catch (error) {
      setResults([{
        name: 'Diagnóstico General',
        status: 'error',
        message: error instanceof Error ? error.message : 'Error desconocido'
      }]);
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = (status: CheckResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'error':
        return <XCircle className="h-6 w-6 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
      default:
        return <Loader className="h-6 w-6 text-gray-400 animate-spin" />;
    }
  };

  const getStatusColor = (status: CheckResult['status']) => {
    switch (status) {
      case 'success':
        return 'border-green-500 bg-green-50 dark:bg-green-950';
      case 'error':
        return 'border-red-500 bg-red-50 dark:bg-red-950';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950';
      default:
        return 'border-gray-300 bg-gray-50 dark:bg-gray-900';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Activity className="h-8 w-8" />
            Estado del Sistema
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Diagnóstico completo: Base de datos, librerías, archivos y configuraciones
          </p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={isChecking}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {isChecking ? (
            <>
              <Loader className="h-5 w-5 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <Activity className="h-5 w-5" />
              Ejecutar Diagnóstico
            </>
          )}
        </button>
      </div>

      {summary && (
        <div className={`mb-6 p-6 rounded-lg border-2 ${
          summary.status === 'healthy' ? 'bg-green-50 border-green-500 dark:bg-green-950' :
          summary.status === 'warning' ? 'bg-yellow-50 border-yellow-500 dark:bg-yellow-950' :
          'bg-red-50 border-red-500 dark:bg-red-950'
        }`}>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Resumen del Diagnóstico
          </h2>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{summary.total}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Verificaciones</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{summary.success}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Exitosos</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{summary.warnings}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Advertencias</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{summary.errors}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Errores</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${
                summary.status === 'healthy' ? 'text-green-600' :
                summary.status === 'warning' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {summary.status === 'healthy' ? '✓' : summary.status === 'warning' ? '⚠' : '✗'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Estado General</div>
            </div>
          </div>
        </div>
      )}

      {results.length === 0 && !isChecking && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
          <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Haz clic en "Ejecutar Diagnóstico" para verificar el sistema
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((result, index) => (
            <div
              key={index}
              className={`border-l-4 p-4 rounded-r-lg ${getStatusColor(result.status)}`}
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                    {result.name}
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    {result.message}
                  </p>
                  {result.details && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        Ver detalles
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isChecking && results.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
          <Loader className="h-5 w-5 animate-spin" />
          <span>Ejecutando verificaciones...</span>
        </div>
      )}
    </div>
  );
}
