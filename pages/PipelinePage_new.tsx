import React, { useState, useEffect } from 'react';
import { Users, Calendar, DollarSign, CheckCircle, Edit, Trash2, Plus, Filter, Search, ChevronDown, Settings, Target } from 'lucide-react';

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
    fijoMovil: number;
    fijoRenovacion: number;
    movilNuevo: number;
    modirRenovacion: number;
  };
  estado: string;
  paso: string;
  fechaLlamar: string;
  fechaVencimiento: string;
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

// Estados dinámicos configurables por vendedor
const DEFAULT_ESTADOS: CustomField[] = [
  { id: 'nuevo', name: 'Nuevo prospecto', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { id: 'contactado', name: 'Contactado', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  { id: 'presentacion', name: 'Presentación enviada', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
  { id: 'negociacion', name: 'En negociación', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { id: 'aprobacion', name: 'Esperando aprobación', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  { id: 'sin_decision', name: 'Sin decisión', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
  { id: 'rechazado', name: 'Rechazado', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' }
];

const DEFAULT_PASOS: CustomField[] = [
  { id: 'investigacion', name: 'Investigación inicial', color: '' },
  { id: 'contacto', name: 'Primer contacto', color: '' },
  { id: 'necesidades', name: 'Análisis de necesidades', color: '' },
  { id: 'propuesta', name: 'Envío de propuesta', color: '' },
  { id: 'seguimiento', name: 'Seguimiento activo', color: '' },
  { id: 'cierre', name: 'Listo para cierre', color: '' }
];

interface PipelinePageProps {
  currentUser?: {
    id: string;
    name: string;
    role: 'admin' | 'vendedor';
  };
}

const PipelinePage: React.FC<PipelinePageProps> = ({ 
  currentUser = { id: 'vendedor1', name: 'Gabriel Sánchez', role: 'vendedor' }
}) => {
  const [pipelineItems, setPipelineItems] = useState<PipelineItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<PipelineItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterUrgencia, setFilterUrgencia] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedVendedor, setSelectedVendedor] = useState(currentUser.role === 'admin' ? '' : currentUser.id);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Estados y pasos personalizables
  const [customEstados, setCustomEstados] = useState<CustomField[]>(DEFAULT_ESTADOS);
  const [customPasos, setCustomPasos] = useState<CustomField[]>(DEFAULT_PASOS);

  // Vendedores disponibles (solo para admin)
  const vendedores = [
    { id: 'vendedor1', name: 'Gabriel Sánchez' },
    { id: 'vendedor2', name: 'María García' },
    { id: 'vendedor3', name: 'Carlos López' },
    { id: 'vendedor4', name: 'Ana Rodríguez' }
  ];

  useEffect(() => {
    loadPipelineData();
  }, [selectedVendedor, currentUser]);

  useEffect(() => {
    filterItems();
  }, [pipelineItems, searchTerm, filterEstado, filterUrgencia, showCompleted]);

  const loadPipelineData = async () => {
    setIsLoading(true);
    
    // Simular carga desde API
    const mockData: PipelineItem[] = [
      {
        id: '1',
        clientId: 'c1',
        clientName: 'SS Group Corp',
        companyName: 'SS Group',
        email: 'contacto@ssgroup.com',
        phone: '787-555-0001',
        salespersonId: 'vendedor1',
        salespersonName: 'Gabriel Sánchez',
        products: {
          fijoMovil: 0,
          fijoRenovacion: 0,
          movilNuevo: 0,
          modirRenovacion: 0
        },
        estado: 'nuevo',
        paso: 'contacto',
        fechaLlamar: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        completado: false,
        assignedDate: new Date().toISOString().split('T')[0],
        notas: 'Cliente potencial grande, tiene interés en renovar todos sus servicios',
        urgencia: 'alta'
      },
      {
        id: '2',
        clientId: 'c2',
        clientName: 'TechCorp Solutions',
        companyName: 'TechCorp',
        email: 'info@techcorp.com',
        phone: '787-555-0002',
        salespersonId: 'vendedor1',
        salespersonName: 'Gabriel Sánchez',
        products: {
          fijoMovil: 180,
          fijoRenovacion: 250,
          movilNuevo: 0,
          modirRenovacion: 120
        },
        estado: 'negociacion',
        paso: 'propuesta',
        fechaLlamar: new Date().toISOString().split('T')[0],
        fechaVencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        completado: false,
        assignedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notas: 'Ya enviada propuesta, esperando respuesta. Muy interesados.',
        urgencia: 'media'
      },
      {
        id: '3',
        clientId: 'c3',
        clientName: 'Innovate Startup',
        companyName: 'Innovate',
        email: 'hello@innovate.com',
        phone: '787-555-0003',
        salespersonId: 'vendedor2',
        salespersonName: 'María García',
        products: {
          fijoMovil: 320,
          fijoRenovacion: 0,
          movilNuevo: 280,
          modirRenovacion: 150
        },
        estado: 'aprobacion',
        paso: 'cierre',
        fechaLlamar: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        fechaVencimiento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        completado: false,
        assignedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notas: 'Lista para cerrar! Solo falta aprobación del CEO.',
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

  const filterItems = () => {
    let filtered = [...pipelineItems];

    // Filtro por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getEstadoName(item.estado).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por estado
    if (filterEstado) {
      filtered = filtered.filter(item => item.estado === filterEstado);
    }

    // Filtro por urgencia
    if (filterUrgencia) {
      filtered = filtered.filter(item => item.urgencia === filterUrgencia);
    }

    // Mostrar/ocultar completados
    if (!showCompleted) {
      filtered = filtered.filter(item => !item.completado);
    }

    // Ordenar por urgencia y fecha de llamada
    filtered.sort((a, b) => {
      // Primero por urgencia
      const urgenciaOrder = { 'alta': 0, 'media': 1, 'baja': 2 };
      if (a.urgencia !== b.urgencia) {
        return urgenciaOrder[a.urgencia] - urgenciaOrder[b.urgencia];
      }
      // Luego por fecha de llamada
      return new Date(a.fechaLlamar).getTime() - new Date(b.fechaLlamar).getTime();
    });

    setFilteredItems(filtered);
  };

  const getEstadoName = (estadoId: string) => {
    const estado = customEstados.find(e => e.id === estadoId);
    return estado ? estado.name : estadoId;
  };

  const getEstadoColor = (estadoId: string) => {
    const estado = customEstados.find(e => e.id === estadoId);
    return estado ? estado.color : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  const getPasoName = (pasoId: string) => {
    const paso = customPasos.find(p => p.id === pasoId);
    return paso ? paso.name : pasoId;
  };

  const getUrgenciaColor = (urgencia: string) => {
    const colors = {
      'alta': 'text-red-600 dark:text-red-400',
      'media': 'text-yellow-600 dark:text-yellow-400',
      'baja': 'text-green-600 dark:text-green-400'
    };
    return colors[urgencia as keyof typeof colors] || 'text-gray-600';
  };

  const getUrgenciaIcon = (urgencia: string) => {
    switch(urgencia) {
      case 'alta': return '🔥';
      case 'media': return '⚡';
      case 'baja': return '🟢';
      default: return '⚪';
    }
  };

  const handleEstadoChange = (itemId: string, newEstado: string) => {
    setPipelineItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, estado: newEstado } : item
      )
    );
    setEditingItem(null);
  };

  const handlePasoChange = (itemId: string, newPaso: string) => {
    setPipelineItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, paso: newPaso } : item
      )
    );
  };

  const handleProductChange = (itemId: string, product: keyof PipelineItem['products'], value: number) => {
    setPipelineItems(prev =>
      prev.map(item =>
        item.id === itemId 
          ? { ...item, products: { ...item.products, [product]: value } }
          : item
      )
    );
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setPipelineItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, notas: notes } : item
      )
    );
  };

  const handleCompleteItem = async (itemId: string) => {
    const item = pipelineItems.find(i => i.id === itemId);
    if (!item) return;

    const total = calculateTotal(item);
    
    if (total === 0) {
      alert('⚠️ Debes agregar montos a los productos antes de completar la venta.');
      return;
    }

    const confirmacion = window.confirm(
      `¿Confirmas completar esta venta por $${total}?\n\n` +
      `Cliente: ${item.clientName}\n` +
      `Empresa: ${item.companyName}\n\n` +
      `Esto registrará automáticamente la venta en Finanzas y actualizará tu meta.`
    );

    if (!confirmacion) return;

    try {
      // Marcar como completado
      setPipelineItems(prev =>
        prev.map(i =>
          i.id === itemId ? { ...i, completado: true } : i
        )
      );

      // Simular registro en finanzas (en producción sería una llamada API)
      console.log('💰 Registrando venta en Finanzas:', {
        clientId: item.clientId,
        salespersonId: item.salespersonId,
        amount: total,
        date: new Date().toISOString(),
        products: item.products
      });

      alert(`🎉 ¡Venta completada exitosamente!\n\nMonto: $${total}\nCliente: ${item.clientName}\n\nSe ha registrado automáticamente en tu meta de Finanzas.`);

    } catch (error) {
      console.error('Error al completar venta:', error);
      alert('❌ Error al completar la venta. Inténtalo de nuevo.');
      
      // Revertir estado si hay error
      setPipelineItems(prev =>
        prev.map(i =>
          i.id === itemId ? { ...i, completado: false } : i
        )
      );
    }
  };

  const calculateTotal = (item: PipelineItem) => {
    return Object.values(item.products).reduce((sum, val) => sum + val, 0);
  };

  const getDaysUntilCall = (fecha: string) => {
    const today = new Date();
    const callDate = new Date(fecha);
    const diffTime = callDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const pendingItems = filteredItems.filter(item => !item.completado);
  const completedItems = filteredItems.filter(item => item.completado);
  const totalPotential = pendingItems.reduce((sum, item) => sum + calculateTotal(item), 0);
  const totalClosed = completedItems.reduce((sum, item) => sum + calculateTotal(item), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Cargando pipeline...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Pipeline de Ventas
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Gestiona tus prospectos y completa ventas
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                <Settings className="w-5 h-5" />
              </button>
              <Target className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Prospectos Activos</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingItems.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ventas Cerradas</p>
                  <p className="text-2xl font-bold text-green-600">{completedItems.length}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pipeline Potencial</p>
                  <p className="text-2xl font-bold text-blue-600">${totalPotential.toLocaleString()}</p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ventas Completadas</p>
                  <p className="text-2xl font-bold text-green-600">${totalClosed.toLocaleString()}</p>
                </div>
                <Target className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          {/* Selector de Vendedor (solo admin) */}
          {currentUser.role === 'admin' && (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700 mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ver pipeline de vendedor
              </label>
              <select
                value={selectedVendedor}
                onChange={(e) => setSelectedVendedor(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
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

          {/* Filtros */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-80">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar clientes, empresas, emails..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los estados</option>
                {customEstados.map(estado => (
                  <option key={estado.id} value={estado.id}>
                    {estado.name}
                  </option>
                ))}
              </select>

              <select
                value={filterUrgencia}
                onChange={(e) => setFilterUrgencia(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toda urgencia</option>
                <option value="alta">🔥 Alta</option>
                <option value="media">⚡ Media</option>
                <option value="baja">🟢 Baja</option>
              </select>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Mostrar completados
              </label>
            </div>
          </div>
        </div>

        {/* Pipeline Items */}
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No hay prospectos
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searchTerm || filterEstado || filterUrgencia ? 'No hay resultados con estos filtros.' : 'Agrega nuevos prospectos para comenzar.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const total = calculateTotal(item);
              const daysUntilCall = getDaysUntilCall(item.fechaLlamar);
              
              return (
                <div
                  key={item.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow border-l-4 border transition-all hover:shadow-lg ${
                    item.completado 
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                      : item.urgencia === 'alta' 
                        ? 'border-red-500'
                        : item.urgencia === 'media'
                          ? 'border-yellow-500'
                          : 'border-blue-500'
                  }`}
                >
                  <div className="p-6">
                    {/* Header del cliente */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {item.clientName}
                          </h3>
                          <span className={`text-sm ${getUrgenciaColor(item.urgencia)}`}>
                            {getUrgenciaIcon(item.urgencia)} {item.urgencia.toUpperCase()}
                          </span>
                          {item.completado && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-xs font-medium">
                              <CheckCircle className="w-3 h-3" />
                              COMPLETADO
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <div>🏢 {item.companyName}</div>
                          <div>📧 {item.email}</div>
                          <div>📱 {item.phone}</div>
                          <div>👤 Vendedor: {item.salespersonName}</div>
                          <div>📅 Asignado: {new Date(item.assignedDate).toLocaleDateString('es-ES')}</div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                          ${total.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Valor total
                        </div>
                      </div>
                    </div>

                    {/* Estados y fechas */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Estado actual
                        </label>
                        {editingItem === `${item.id}-estado` ? (
                          <select
                            value={item.estado}
                            onChange={(e) => handleEstadoChange(item.id, e.target.value)}
                            onBlur={() => setEditingItem(null)}
                            autoFocus
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          >
                            {customEstados.map(estado => (
                              <option key={estado.id} value={estado.id}>
                                {estado.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => !item.completado && setEditingItem(`${item.id}-estado`)}
                            disabled={item.completado}
                            className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${getEstadoColor(item.estado)} ${
                              item.completado ? 'cursor-not-allowed opacity-70' : 'hover:opacity-80 cursor-pointer'
                            }`}
                          >
                            {getEstadoName(item.estado)}
                            {!item.completado && <ChevronDown className="ml-1 w-3 h-3" />}
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Paso actual
                        </label>
                        <select
                          value={item.paso}
                          onChange={(e) => handlePasoChange(item.id, e.target.value)}
                          disabled={item.completado}
                          className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500"
                        >
                          {customPasos.map(paso => (
                            <option key={paso.id} value={paso.id}>
                              {paso.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Fecha para llamar
                        </label>
                        <input
                          type="date"
                          value={item.fechaLlamar}
                          onChange={(e) => setPipelineItems(prev => 
                            prev.map(i => i.id === item.id ? { ...i, fechaLlamar: e.target.value } : i)
                          )}
                          disabled={item.completado}
                          className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500"
                        />
                        <div className={`text-xs mt-1 ${
                          daysUntilCall < 0 ? 'text-red-600' :
                          daysUntilCall === 0 ? 'text-orange-600' :
                          daysUntilCall <= 2 ? 'text-yellow-600' :
                          'text-gray-500'
                        }`}>
                          {daysUntilCall < 0 ? `${Math.abs(daysUntilCall)} días vencida` :
                           daysUntilCall === 0 ? 'Llamar hoy' :
                           `En ${daysUntilCall} días`}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Vencimiento
                        </label>
                        <input
                          type="date"
                          value={item.fechaVencimiento}
                          onChange={(e) => setPipelineItems(prev => 
                            prev.map(i => i.id === item.id ? { ...i, fechaVencimiento: e.target.value } : i)
                          )}
                          disabled={item.completado}
                          className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Productos y montos */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                        <DollarSign className="w-4 h-4 mr-1" />
                        Productos y Montos
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(item.products).map(([productKey, value]) => (
                          <div key={productKey}>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              {productKey === 'fijoMovil' ? '📞 Fijo Móvil' :
                               productKey === 'fijoRenovacion' ? '🔄 Fijo Renovación' :
                               productKey === 'movilNuevo' ? '📱 Móvil Nuevo' :
                               '🔄 Modir Renovación'}
                            </label>
                            <input
                              type="number"
                              value={value}
                              onChange={(e) => handleProductChange(
                                item.id, 
                                productKey as keyof PipelineItem['products'], 
                                parseFloat(e.target.value) || 0
                              )}
                              disabled={item.completado}
                              placeholder="$0"
                              min="0"
                              step="10"
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Notas */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        📝 Notas de seguimiento
                      </label>
                      <textarea
                        value={item.notas}
                        onChange={(e) => handleNotesChange(item.id, e.target.value)}
                        disabled={item.completado}
                        placeholder="Agregar notas sobre el cliente, llamadas, reuniones..."
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    {/* Acciones */}
                    {!item.completado && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleCompleteItem(item.id)}
                          disabled={total === 0}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors font-medium"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Completar Venta (${total.toLocaleString()})
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default PipelinePage;