import React, { useState, useEffect, useRef } from 'react';
import { Users, Calendar, DollarSign, CheckCircle, Plus, Settings, Target, UserPlus, UserMinus, Filter, MoreHorizontal, ChevronDown, Edit2 } from 'lucide-react';
import FieldEditor from '../components/FieldEditor';
import NotesModal from '../components/NotesModal';
import CallsModal from '../components/CallsModal';

interface PipelineItem {
  id: string;
  clientId: string;
  clientName: string;
  companyName: string;
  email: string;
  phone: string;
  salespersonId: string;
  salespersonName: string;
  products: {
    fijoRen: number;
    fijoNew: number;
    lineaReno: number;
    lineaMo: number;
    llamadas: number;
  };
  estado: string;
  paso: string;
  fechaLlamar: string;
  fechaUpdate: string;
  ultimaLlamada?: string;
  proximaLlamada?: string;
  completado: boolean;
  assignedDate: string;
  notas: string;
  urgencia: 'alta' | 'media' | 'baja';
}

interface CustomField {
  id: string;
  name: string;
  color: string;
}

interface MetaVendedor {
  vendedorId: string;
  metaMensual: number;
  completado: number;
  forecast: number;
  porcentajeCompletado: number;
  porcentajeForecast: number;
}

// Componente para badges con dropdown
const BadgeDropdown: React.FC<{
  value: string;
  options: CustomField[];
  onChange: (value: string) => void;
  className?: string;
}> = ({ value, options, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const calculatePosition = () => {
      if (buttonRef.current && isOpen) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;
        
        // Si hay menos de 200px abajo y más espacio arriba, abrir hacia arriba
        if (spaceBelow < 200 && spaceAbove > spaceBelow) {
          setDropdownPosition('top');
        } else {
          setDropdownPosition('bottom');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', calculatePosition);
    window.addEventListener('resize', calculatePosition);
    
    if (isOpen) {
      calculatePosition();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', calculatePosition);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [isOpen]);

  const selectedOption = options.find(option => option.id === value);
  
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
          selectedOption?.color || 'bg-gray-200 text-gray-800'
        } hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`}
      >
        {selectedOption?.name || value}
        <ChevronDown className={`ml-1 w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute z-[100] w-max min-w-full max-w-xs bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 ${
          dropdownPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}>
          <div className="max-h-64 overflow-y-auto py-1">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center transition-colors ${
                  value === option.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${option.color}`}>
                  {option.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Estados configurables - Personaliza desde el modal de configuración
const DEFAULT_ESTADOS: CustomField[] = [
  { id: 'sin_decision', name: 'Sin decisión', color: 'bg-gray-200 text-gray-800' },
  { id: 'llamar', name: 'Llamar', color: 'bg-yellow-200 text-yellow-800' },
  { id: 'en_proceso', name: 'En proceso', color: 'bg-blue-200 text-blue-800' },
];

// Pasos configurables - Personaliza desde el modal de configuración
const DEFAULT_PASOS: CustomField[] = [
  { id: 'contacto_inicial', name: 'Contacto inicial', color: 'bg-gray-200 text-gray-800' },
  { id: 'ff', name: 'FF', color: 'bg-blue-200 text-blue-800' },
  { id: 'propuesta', name: 'Propuesta', color: 'bg-teal-200 text-teal-800' },
];

// Configuración de productos (sin FF que es un paso)
const PRODUCTOS_CONFIG = [
  { key: 'fijoRen', name: 'Fijo Ren', width: 'w-24' },
  { key: 'fijoNew', name: 'Fijo New', width: 'w-24' },
  { key: 'lineaReno', name: 'Línea/Reno', width: 'w-28' },
  { key: 'lineaMo', name: 'Línea/MO', width: 'w-24' },
  { key: 'llamadas', name: 'Llamadas', width: 'w-24' },
];

interface PipelineKanbanProps {
  currentUser?: {
    id: string;
    name: string;
    role: 'admin' | 'vendedor';
  };
}

const PipelineKanban: React.FC<PipelineKanbanProps> = ({ 
  currentUser = { id: 'vendedor1', name: 'Gabriel Sánchez', role: 'vendedor' }
}) => {
  const [pipelineItems, setPipelineItems] = useState<PipelineItem[]>([]);
  const [metaVendedor, setMetaVendedor] = useState<MetaVendedor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editingCalls, setEditingCalls] = useState<string | null>(null);
  
  // Estados y pasos personalizables con persistencia
  const [customEstados, setCustomEstados] = useState<CustomField[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pipeline-estados');
      return saved ? JSON.parse(saved) : DEFAULT_ESTADOS;
    }
    return DEFAULT_ESTADOS;
  });
  
  const [customPasos, setCustomPasos] = useState<CustomField[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pipeline-pasos');
      return saved ? JSON.parse(saved) : DEFAULT_PASOS;
    }
    return DEFAULT_PASOS;
  });

  // Agrupación y filtros
  const [groupBy, setGroupBy] = useState<'vendedor' | 'estado'>('vendedor');
  const [selectedVendedor, setSelectedVendedor] = useState(currentUser.role === 'admin' ? '' : currentUser.id);

  const vendedores = [
    { id: 'vendedor1', name: 'Gabriel Sánchez' },
    { id: 'vendedor2', name: 'María García' },
    { id: 'vendedor3', name: 'Carlos López' },
    { id: 'vendedor4', name: 'Ana Rodríguez' }
  ];

  useEffect(() => {
    loadPipelineData();
    loadMetaVendedor();
  }, [selectedVendedor, currentUser]);

  const loadPipelineData = async () => {
    setIsLoading(true);
    
    // Datos mock del pipeline
    const mockData: PipelineItem[] = [
      {
        id: '1',
        clientId: 'c1',
        clientName: 'GRUPO ODONTOLOGIA',
        companyName: 'GRUPO ODONTOLOGIA',
        email: 'info@grupoodonto.com',
        phone: '787-555-0001',
        salespersonId: 'vendedor1',
        salespersonName: 'Gabriel',
        products: {
          fijoRen: 0,
          fijoNew: 0,
          lineaReno: 1,
          lineaMo: 0,
          llamadas: 0
        },
        estado: 'sin_decision',
        paso: 'contacto_inicial',
        fechaLlamar: new Date().toISOString().split('T')[0],
        fechaUpdate: 'mayo 29',
        ultimaLlamada: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        proximaLlamada: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        completado: false,
        assignedDate: new Date().toISOString().split('T')[0],
        notas: 'Cliente potencial grande, tiene interés en renovar todos sus servicios',
        urgencia: 'alta'
      },
      {
        id: '2',
        clientId: 'c2',
        clientName: 'elizabeth calderon',
        companyName: 'elizabeth calderon',
        email: 'elizabeth@email.com',
        phone: '787-555-0002',
        salespersonId: 'vendedor2',
        salespersonName: 'RANDY',
        products: {
          fijoRen: 0,
          fijoNew: 0,
          lineaReno: 2,
          lineaMo: 0,
          llamadas: 1
        },
        estado: 'en_proceso',
        paso: 'propuesta',
        fechaLlamar: new Date().toISOString().split('T')[0],
        fechaUpdate: 'abr 8',
        ultimaLlamada: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        proximaLlamada: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        completado: false,
        assignedDate: new Date().toISOString().split('T')[0],
        notas: 'Seguimiento activo',
        urgencia: 'media'
      },
      {
        id: '3',
        clientId: 'c3',
        clientName: 'Pablo G Barreto',
        companyName: 'Pablo G Barreto',
        email: 'pablo@email.com',
        phone: '787-555-0003',
        salespersonId: 'vendedor1',
        salespersonName: 'Gabriel',
        products: {
          fijoRen: 0,
          fijoNew: 0,
          lineaReno: 4,
          lineaMo: 0,
          llamadas: 2
        },
        estado: 'llamar',
        paso: 'negociacion',
        fechaLlamar: new Date().toISOString().split('T')[0],
        fechaUpdate: 'abr 8',
        ultimaLlamada: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        proximaLlamada: new Date().toISOString().split('T')[0],
        completado: false,
        assignedDate: new Date().toISOString().split('T')[0],
        notas: 'Interesado en varios servicios',
        urgencia: 'alta'
      }
    ];

    // Filtrar por vendedor si no es admin
    let filteredData = mockData;
    if (currentUser.role === 'vendedor') {
      filteredData = mockData.filter(item => item.salespersonId === currentUser.id);
    } else if (selectedVendedor) {
      filteredData = mockData.filter(item => item.salespersonId === selectedVendedor);
    }

    setPipelineItems(filteredData);
    setIsLoading(false);
  };

  const loadMetaVendedor = async () => {
    // Datos mock de la meta del vendedor
    const vendedorId = currentUser.role === 'vendedor' ? currentUser.id : selectedVendedor;
    
    if (!vendedorId) return;

    const forecast = pipelineItems
      .filter(item => item.salespersonId === vendedorId && !item.completado)
      .reduce((sum, item) => sum + calculateTotal(item), 0);

    const mockMeta: MetaVendedor = {
      vendedorId: vendedorId,
      metaMensual: 50000,
      completado: 15000,
      forecast: forecast,
      porcentajeCompletado: (15000 / 50000) * 100,
      porcentajeForecast: ((15000 + forecast) / 50000) * 100
    };

    setMetaVendedor(mockMeta);
  };

  const calculateTotal = (item: PipelineItem) => {
    return Object.values(item.products).reduce((sum, val) => sum + (val * 100), 0); // Asumiendo $100 por unidad
  };

  const getEstadoName = (estadoId: string) => {
    const estado = customEstados.find(e => e.id === estadoId);
    return estado ? estado.name : estadoId;
  };

  const getEstadoColor = (estadoId: string) => {
    const estado = customEstados.find(e => e.id === estadoId);
    return estado ? estado.color : 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getPasoName = (pasoId: string) => {
    const paso = customPasos.find(p => p.id === pasoId);
    return paso ? paso.name : pasoId;
  };

  const getPasoColor = (pasoId: string) => {
    const paso = customPasos.find(p => p.id === pasoId);
    return paso ? paso.color : 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const handleProductChange = (itemId: string, productKey: string, value: number) => {
    setPipelineItems(prev =>
      prev.map(item =>
        item.id === itemId 
          ? { 
              ...item, 
              products: { ...item.products, [productKey]: value },
              fechaUpdate: new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
            }
          : item
      )
    );
  };

  const handleEstadoChange = (itemId: string, newEstado: string) => {
    setPipelineItems(prev =>
      prev.map(item =>
        item.id === itemId 
          ? { 
              ...item, 
              estado: newEstado,
              fechaUpdate: new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
            }
          : item
      )
    );
  };

  const handlePasoChange = (itemId: string, newPaso: string) => {
    setPipelineItems(prev =>
      prev.map(item =>
        item.id === itemId 
          ? { 
              ...item, 
              paso: newPaso,
              fechaUpdate: new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
            }
          : item
      )
    );
  };

  const handleNotasChange = (itemId: string, newNotas: string) => {
    setPipelineItems(prev =>
      prev.map(item =>
        item.id === itemId 
          ? { 
              ...item, 
              notas: newNotas,
              fechaUpdate: new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
            }
          : item
      )
    );
  };

  const handleCallsChange = (itemId: string, ultimaLlamada?: string, proximaLlamada?: string) => {
    setPipelineItems(prev =>
      prev.map(item =>
        item.id === itemId 
          ? { 
              ...item, 
              ultimaLlamada,
              proximaLlamada,
              fechaUpdate: new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
            }
          : item
      )
    );
  };

  // Funciones para guardar configuración personalizada
  const handleUpdateEstados = (newEstados: CustomField[]) => {
    setCustomEstados(newEstados);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pipeline-estados', JSON.stringify(newEstados));
    }
  };

  const handleUpdatePasos = (newPasos: CustomField[]) => {
    setCustomPasos(newPasos);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pipeline-pasos', JSON.stringify(newPasos));
    }
  };

  const handleCompleteItem = async (item: PipelineItem) => {
    const total = calculateTotal(item);
    
    if (total === 0) {
      alert('⚠️ Debes agregar productos antes de completar la venta.');
      return;
    }

    const confirmacion = window.confirm(
      `¿Confirmas completar esta venta?\n\n` +
      `Cliente: ${item.clientName}\n` +
      `Monto: $${total.toLocaleString()}\n\n` +
      `Esto actualizará tu meta y registrará la venta en Finanzas.`
    );

    if (!confirmacion) return;

    try {
      // Marcar como completado y desasignar
      setPipelineItems(prev =>
        prev.map(i =>
          i.id === item.id ? { ...i, completado: true, salespersonId: '' } : i
        )
      );

      // Actualizar meta del vendedor
      if (metaVendedor) {
        setMetaVendedor(prev => prev ? {
          ...prev,
          completado: prev.completado + total,
          porcentajeCompletado: ((prev.completado + total) / prev.metaMensual) * 100
        } : null);
      }

      // Registrar en finanzas (mock)
      console.log('💰 Registrando venta:', {
        clientId: item.clientId,
        vendedorId: item.salespersonId,
        amount: total,
        products: item.products
      });

      alert(`🎉 ¡Venta completada!\n\nMonto: $${total.toLocaleString()}\nMeta actualizada automáticamente.`);

    } catch (error) {
      console.error('Error al completar venta:', error);
      alert('❌ Error al completar la venta.');
    }
  };

  const handleDesasignarItem = (item: PipelineItem) => {
    const confirmacion = window.confirm(
      `¿Desasignar este cliente?\n\n` +
      `Cliente: ${item.clientName}\n` +
      `Las notas y montos se conservarán para el próximo vendedor.`
    );

    if (!confirmacion) return;

    setPipelineItems(prev =>
      prev.filter(i => i.id !== item.id) // Remove from current view
    );

    alert('✅ Cliente desasignado correctamente. Está disponible para reasignación.');
  };

  const handleNewSale = () => {
    setShowNewSaleModal(true);
  };

  // Función para manejar llamadas desde notificaciones
  const handleCallNow = (call: any) => {
    // Buscar el item correspondiente en el pipeline
    const pipelineItem = pipelineItems.find(item => item.clientId === call.clientId);
    
    if (pipelineItem) {
      // Abrir el modal de llamadas directamente
      setEditingCalls(pipelineItem.id);
    } else {
      // Si no está en el pipeline, mostrar información y abrir dialer
      const confirmCall = window.confirm(
        `¿Llamar a ${call.clientName}?\n\nTeléfono: ${call.phone}\n\nSe abrirá el dialer de tu teléfono.`
      );
      
      if (confirmCall) {
        // Abrir dialer del teléfono
        window.open(`tel:${call.phone}`);
      }
    }
  };

  const groupedItems = React.useMemo(() => {
    const groups: { [key: string]: PipelineItem[] } = {};
    
    pipelineItems.forEach(item => {
      let key = '';
      switch (groupBy) {
        case 'vendedor':
          key = item.salespersonName;
          break;
        case 'estado':
          key = getEstadoName(item.estado);
          break;
        default:
          key = item.salespersonName;
      }
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    return groups;
  }, [pipelineItems, groupBy, customEstados]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Cargando pipeline...</h2>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-full mx-auto px-4 py-4">
          {/* Toolbar superior */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Pipeline de Ventas
              </h1>
              
              <button
                onClick={handleNewSale}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva Venta
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <Filter className="w-4 h-4" />
                Filtrar
              </button>
              
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500"
              >
                <option value="vendedor">Agrupar por Vendedor</option>
                <option value="estado">Agrupar por Estado</option>
              </select>

              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-600 hover:text-gray-900"
                title="Configurar Campos"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Meta del vendedor */}
          {metaVendedor && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Meta Mensual</h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${metaVendedor.metaMensual.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm text-gray-600 dark:text-gray-400">Completado</h4>
                    <p className="text-lg font-semibold text-green-600">
                      ${metaVendedor.completado.toLocaleString()} ({metaVendedor.porcentajeCompletado.toFixed(0)}%)
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm text-gray-600 dark:text-gray-400">Forecast</h4>
                    <p className="text-lg font-semibold text-blue-600">
                      ${metaVendedor.forecast.toLocaleString()} ({metaVendedor.porcentajeForecast.toFixed(0)}%)
                    </p>
                  </div>
                </div>
                
                <div className="w-48">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progreso</span>
                    <span>{metaVendedor.porcentajeForecast.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-green-600 h-3 rounded-full" 
                      style={{ width: `${Math.min(metaVendedor.porcentajeCompletado, 100)}%` }}
                    ></div>
                    <div 
                      className="bg-blue-400 h-3 rounded-full -mt-3 opacity-60" 
                      style={{ width: `${Math.min(metaVendedor.porcentajeForecast, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin: Selector de vendedor */}
          {currentUser.role === 'admin' && (
            <div className="mb-4">
              <select
                value={selectedVendedor}
                onChange={(e) => setSelectedVendedor(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Todos los vendedores</option>
                {vendedores.map(vendedor => (
                  <option key={vendedor.id} value={vendedor.id}>
                    {vendedor.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabla Pipeline - Completamente Responsive */}
      <div className="max-w-full mx-auto px-2 sm:px-4 py-4 lg:py-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <table className="w-full min-w-[1200px]">{/* Ancho mínimo para mantener estructura */}
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Vendedor
                  </th>
                  {PRODUCTOS_CONFIG.map(producto => (
                    <th key={producto.key} className={`px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${producto.width}`}>
                      {producto.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Fecha update
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    ESTADO
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    PASOS
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">
                    NOTAS
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acciones
                  </th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {Object.entries(groupedItems).map(([groupName, items]) => (
                  <React.Fragment key={groupName}>
                    {/* Header del grupo */}
                    <tr className="bg-gray-50 dark:bg-gray-900">
                      <td colSpan={PRODUCTOS_CONFIG.length + 7} className="px-6 py-2">
                        <div className="flex items-center">
                          <ChevronDown className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {groupName}
                          </span>
                          <span className="ml-2 text-sm text-gray-500">
                            ({items.length})
                          </span>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Items del grupo */}
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <CheckCircle className="w-4 h-4 text-gray-300 mr-3" />
                            <span className="text-sm text-gray-900 dark:text-white">
                              {item.clientName}
                            </span>
                          </div>
                        </td>
                        
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {item.salespersonName}
                          </span>
                        </td>

                        {PRODUCTOS_CONFIG.map(producto => (
                          <td key={producto.key} className="px-3 py-4 text-center">
                          {producto.key === 'llamadas' ? (
                              <div className="p-2 space-y-2">
                                {/* Indicador de estado de llamadas */}
                                <div className="flex items-center justify-center">
                                  {item.proximaLlamada && new Date(item.proximaLlamada) <= new Date() ? (
                                    <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" title="Llamada vencida" />
                                  ) : item.proximaLlamada && new Date(item.proximaLlamada).getTime() - new Date().getTime() < 15 * 60 * 1000 ? (
                                    <div className="w-4 h-4 bg-yellow-500 rounded-full animate-bounce" title="Llamada pronto" />
                                  ) : (
                                    <div className="w-4 h-4 bg-green-500 rounded-full" title="Sin urgencia" />
                                  )}
                                </div>
                                
                                {/* Botón principal de gestión */}
                                <button
                                  onClick={() => setEditingCalls(item.id)}
                                  className="w-full bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 hover:from-blue-100 hover:to-green-100 dark:hover:from-blue-900/30 dark:hover:to-green-900/30 transition-all group"
                                >
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-center gap-2">
                                      <Phone className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                                      <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                                        GESTIONAR
                                      </span>
                                    </div>
                                    
                                    {/* Ultima llamada */}
                                    <div className="text-[10px] text-gray-600 dark:text-gray-400">
                                      Ult: {item.ultimaLlamada ?
                                        new Date(item.ultimaLlamada).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }) : 
                                        'Nunca'
                                      }
                                    </div>
                                    
                                    {/* Proxima llamada */}
                                    <div className={`text-[10px] font-medium ${
                                      item.proximaLlamada ? 
                                        new Date(item.proximaLlamada) <= new Date() ? 'text-red-600' : 
                                        new Date(item.proximaLlamada).getTime() - new Date().getTime() < 15 * 60 * 1000 ? 'text-yellow-600' : 
                                        'text-green-600' 
                                      : 'text-gray-500'
                                    }`}>
                                      Prox: {item.proximaLlamada ? 
                                        new Date(item.proximaLlamada).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }) : 
                                        'Sin agendar'
                                      }
                                    </div>
                                  </div>
                                </button>
                              </div>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                value={item.products[producto.key as keyof typeof item.products] || ''}
                                onChange={(e) => handleProductChange(
                                  item.id, 
                                  producto.key, 
                                  parseInt(e.target.value) || 0
                                )}
                                className="w-full text-center text-sm border-0 focus:ring-1 focus:ring-blue-500 bg-transparent"
                                placeholder="0"
                              />
                            )}
                          </td>
                        ))}

                        <td className="px-4 py-4 text-center">
                          <span className="text-sm text-gray-500">
                            {item.fechaUpdate}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <BadgeDropdown
                            value={item.estado}
                            options={customEstados}
                            onChange={(value) => handleEstadoChange(item.id, value)}
                            className="inline-block"
                          />
                        </td>

                        <td className="px-4 py-4 text-center">
                          <BadgeDropdown
                            value={item.paso}
                            options={customPasos}
                            onChange={(value) => handlePasoChange(item.id, value)}
                            className="inline-block"
                          />
                        </td>

                        <td className="px-4 py-4">
                          <button
                            onClick={() => setEditingNotes(item.id)}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors max-w-40"
                          >
                            {item.notas ? (
                              <span className="truncate">
                                {item.notas.length > 30 ? `${item.notas.substring(0, 30)}...` : item.notas}
                              </span>
                            ) : (
                              <span className="text-gray-400">Agregar notas...</span>
                            )}
                            <Edit2 className="w-3 h-3 flex-shrink-0" />
                          </button>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <button
                              onClick={() => handleCompleteItem(item)}
                              disabled={calculateTotal(item) === 0}
                              className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                              Completar
                            </button>
                            <button
                              onClick={() => handleDesasignarItem(item)}
                              className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded"
                              title="Desasignar"
                            >
                              <UserMinus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="px-2 py-4">
                          <Plus className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Nueva Venta */}
      {showNewSaleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Nueva Venta
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Agrega un nuevo cliente que conseguiste y se te asignará automáticamente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewSaleModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Crear Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Profesional para Notas */}
      {editingNotes && (
        <NotesModal
          isOpen={!!editingNotes}
          onClose={() => setEditingNotes(null)}
          item={pipelineItems.find(item => item.id === editingNotes)}
          onSave={(newNotes) => {
            handleNotasChange(editingNotes, newNotes);
            setEditingNotes(null);
          }}
        />
      )}

      {/* Modal Profesional para Llamadas */}
      {editingCalls && (
        <CallsModal
          isOpen={!!editingCalls}
          onClose={() => setEditingCalls(null)}
          item={pipelineItems.find(item => item.id === editingCalls)}
          onSave={(ultimaLlamada, proximaLlamada) => {
            handleCallsChange(editingCalls, ultimaLlamada, proximaLlamada);
            setEditingCalls(null);
          }}
        />
      )}

      {/* Modal de Configuración */}
      <FieldEditor
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={(fields) => {
          // Actualizar estados y pasos desde los campos editados
          console.log('Guardando campos:', fields);
          
          let estadosActualizados = 0;
          let pasosActualizados = 0;
          
          fields.forEach(field => {
            if (field.name.toLowerCase().includes('estado')) {
              const nuevosEstados = field.options.map(opt => ({
                id: opt.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                name: opt.label,
                color: opt.color
              }));
              handleUpdateEstados(nuevosEstados);
              estadosActualizados = nuevosEstados.length;
              console.log('Estados actualizados:', nuevosEstados);
            } else if (field.name.toLowerCase().includes('paso')) {
              const nuevosPasos = field.options.map(opt => ({
                id: opt.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                name: opt.label,
                color: opt.color
              }));
              handleUpdatePasos(nuevosPasos);
              pasosActualizados = nuevosPasos.length;
              console.log('Pasos actualizados:', nuevosPasos);
            }
          });
          
          // Mostrar mensaje de éxito
          alert(`✅ Configuración guardada exitosamente!\n\n📊 Estados: ${estadosActualizados} opciones\n📋 Pasos: ${pasosActualizados} opciones\n\nLos cambios se aplicarán inmediatamente.`);
        }}
      />
    </>
  );
};

export default PipelineKanban;
