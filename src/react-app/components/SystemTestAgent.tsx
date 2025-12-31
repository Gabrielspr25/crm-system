import { useState } from 'react';
import { 
  Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw, 
  Play, User, CreditCard, Users, FileText, Link2, Trash2,
  ChevronDown, ChevronRight
} from 'lucide-react';

interface TestResult {
  module: string;
  action: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  details?: any;
  timestamp: string;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  duration: string;
  overallStatus: string;
}

interface SystemTestResponse {
  success: boolean;
  timestamp: string;
  summary: TestSummary;
  tests: TestResult[];
}

const MODULE_ICONS: Record<string, any> = {
  'SETUP': Activity,
  'CLIENTES': User,
  'BANS': CreditCard,
  'SUSCRIPTORES': Users,
  'SEGUIMIENTOS': FileText,
  'INTEGRIDAD': Link2,
  'API': Activity,
  'LIMPIEZA': Trash2
};

export default function SystemTestAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SystemTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set());
  const [currentStep, setCurrentStep] = useState<string>('');

  const runSystemTest = async () => {
    setIsRunning(true);
    setError(null);
    setResults(null);
    setExpandedTests(new Set());
    
    // Simulación de pasos para feedback visual
    const steps = [
      'Limpiando datos anteriores...',
      'Creando cliente de prueba...',
      'Verificando campos del cliente...',
      'Creando BAN...',
      'Creando suscriptor...',
      'Probando seguimientos...',
      'Verificando integridad...',
      'Limpiando datos de prueba...'
    ];
    
    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      if (stepIndex < steps.length) {
        setCurrentStep(steps[stepIndex]);
        stepIndex++;
      }
    }, 400);

    try {
      const response = await fetch('/api/system-test/full');
      const data = await response.json();
      
      clearInterval(stepInterval);
      
      if (!response.ok) throw new Error(data.error || 'Error en pruebas del sistema');
      
      setResults(data);
      setCurrentStep('');
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message);
      setCurrentStep('');
    } finally {
      setIsRunning(false);
    }
  };

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedTests);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTests(newExpanded);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'pass') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-400 border border-green-800">
        <CheckCircle className="w-3 h-3" /> OK
      </span>
    );
    if (status === 'fail') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/50 text-red-400 border border-red-800">
        <XCircle className="w-3 h-3" /> FALLÓ
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-400 border border-yellow-800">
        <AlertTriangle className="w-3 h-3" /> SALTADO
      </span>
    );
  };

  const ModuleIcon = ({ module }: { module: string }) => {
    const Icon = MODULE_ICONS[module] || Activity;
    return <Icon className="w-4 h-4" />;
  };

  // Agrupar tests por módulo
  const groupedTests = results?.tests.reduce((acc, test, index) => {
    if (!acc[test.module]) {
      acc[test.module] = [];
    }
    acc[test.module].push({ ...test, originalIndex: index });
    return acc;
  }, {} as Record<string, (TestResult & { originalIndex: number })[]>) || {};

  return (
    <>
      {/* Botón flotante - más grande y visible */}
      <button
        onClick={() => { setIsOpen(true); if (!results) runSystemTest(); }}
        className="fixed bottom-20 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl shadow-lg border border-purple-400/30 transition-all transform hover:scale-105"
        title="Agente de Pruebas del Sistema"
      >
        <Play className="w-5 h-5" />
        <span className="text-sm font-bold">🤖 Probar Sistema</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-5 border-b border-gray-800 bg-gradient-to-r from-purple-900/50 to-blue-900/50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">🤖 Agente de Pruebas</h2>
                    <p className="text-xs text-gray-400">Simula un vendedor probando TODO el sistema</p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-lg">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              {/* Resumen rápido si hay resultados */}
              {results && (
                <div className="mt-4 grid grid-cols-4 gap-3">
                  <div className={`p-3 rounded-lg ${results.summary.overallStatus === 'SISTEMA OK' ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'}`}>
                    <p className="text-xs text-gray-400">Estado</p>
                    <p className={`text-lg font-bold ${results.summary.overallStatus === 'SISTEMA OK' ? 'text-green-400' : 'text-red-400'}`}>
                      {results.summary.overallStatus}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-800 border border-gray-700">
                    <p className="text-xs text-gray-400">Pruebas</p>
                    <p className="text-lg font-bold text-white">{results.summary.total}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-900/30 border border-green-800">
                    <p className="text-xs text-gray-400">Pasaron</p>
                    <p className="text-lg font-bold text-green-400">{results.summary.passed}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-900/30 border border-red-800">
                    <p className="text-xs text-gray-400">Fallaron</p>
                    <p className="text-lg font-bold text-red-400">{results.summary.failed}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1">
              {isRunning ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <RefreshCw className="w-16 h-16 text-purple-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl">🤖</span>
                    </div>
                  </div>
                  <p className="text-lg text-white mt-6 font-medium">Ejecutando pruebas completas...</p>
                  <p className="text-sm text-purple-400 mt-2 animate-pulse">{currentStep}</p>
                  <div className="mt-6 flex gap-2">
                    {['CLIENTES', 'BANS', 'SUSCRIPTORES', 'SEGUIMIENTOS'].map((mod, i) => (
                      <div 
                        key={mod}
                        className="w-3 h-3 rounded-full bg-purple-500 animate-bounce"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                </div>
              ) : error ? (
                <div className="bg-red-900/20 border border-red-800 rounded-xl p-8 text-center">
                  <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-red-400 mb-2">Error Crítico en Pruebas</h3>
                  <p className="text-red-300 mb-4">{error}</p>
                  <button 
                    onClick={runSystemTest}
                    className="px-6 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg font-medium"
                  >
                    Reintentar Pruebas
                  </button>
                </div>
              ) : results ? (
                <div className="space-y-4">
                  {/* Tests agrupados por módulo */}
                  {Object.entries(groupedTests).map(([module, tests]) => {
                    const moduleStatus = tests.every(t => t.status === 'pass') ? 'pass' : 
                                        tests.some(t => t.status === 'fail') ? 'fail' : 'skip';
                    
                    return (
                      <div key={module} className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                        {/* Módulo header */}
                        <div className={`p-4 flex items-center justify-between ${
                          moduleStatus === 'pass' ? 'bg-green-900/20' : 
                          moduleStatus === 'fail' ? 'bg-red-900/20' : 'bg-yellow-900/20'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              moduleStatus === 'pass' ? 'bg-green-900/50 text-green-400' :
                              moduleStatus === 'fail' ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'
                            }`}>
                              <ModuleIcon module={module} />
                            </div>
                            <span className="font-bold text-white">{module}</span>
                            <span className="text-xs text-gray-500">({tests.length} pruebas)</span>
                          </div>
                          <StatusBadge status={moduleStatus} />
                        </div>
                        
                        {/* Tests del módulo */}
                        <div className="divide-y divide-gray-700/50">
                          {tests.map((test) => (
                            <div key={test.originalIndex} className="p-3">
                              <div 
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-700/30 -m-3 p-3 rounded"
                                onClick={() => test.details && toggleExpand(test.originalIndex)}
                              >
                                <div className="flex items-center gap-3">
                                  {test.details ? (
                                    expandedTests.has(test.originalIndex) ? 
                                      <ChevronDown className="w-4 h-4 text-gray-500" /> :
                                      <ChevronRight className="w-4 h-4 text-gray-500" />
                                  ) : <div className="w-4" />}
                                  <div>
                                    <p className="text-sm font-medium text-gray-200">{test.action}</p>
                                    <p className="text-xs text-gray-500">{test.message}</p>
                                  </div>
                                </div>
                                <StatusBadge status={test.status} />
                              </div>
                              
                              {/* Detalles expandidos */}
                              {expandedTests.has(test.originalIndex) && test.details && (
                                <div className="mt-3 ml-7 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                                  <pre className="text-xs text-gray-400 overflow-x-auto">
                                    {JSON.stringify(test.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Info de tiempo */}
                  <div className="text-center text-sm text-gray-500 pt-4">
                    Tiempo total: {results.summary.duration} | {new Date(results.timestamp).toLocaleString()}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800 bg-gray-800/30 flex justify-between items-center">
              <p className="text-xs text-gray-500">
                Este agente prueba: Crear/Editar Clientes, BANs, Suscriptores, Seguimientos
              </p>
              <button 
                onClick={runSystemTest}
                disabled={isRunning}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg font-medium"
              >
                <Play className="w-4 h-4" />
                {isRunning ? 'Ejecutando...' : 'Ejecutar Pruebas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
