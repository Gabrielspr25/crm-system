import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  User,
  CheckCircle2,
  XCircle,
  FileText,
  Save,
  Trash2,
  Edit2,
  Mail,
  Bell,
  Calendar,
  Phone,
  X,
  UserPlus,
  Building2,
  WifiOff
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { authFetch } from "@/react-app/utils/auth";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Mock data generator for initial state
const initialData: any[] = [];

export default function ReferidosPage() {
  const [data, setData] = useState(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [todayAlerts, setTodayAlerts] = useState<any[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  
  // Tabs state
  const [activeTab, setActiveTab] = useState<'lista' | 'registrar'>('lista');
  
  // Online/Offline detection
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Quick client form state
  const [quickClientForm, setQuickClientForm] = useState({
    nombre: '',
    contacto: '',
    telefono: '',
    email: '',
    tax_id: '',
    ban_number: '',
    notas: ''
  });
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Status Management State
  const [statuses, setStatuses] = useState([
    { id: 1, name: 'Pendiente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    { id: 2, name: 'Completado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { id: 3, name: 'Cancelado', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' }
  ]);
  const [newStatusName, setNewStatusName] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'Masivo',
    modelo: '',
    color: '',
    vendedor: '',
    email: '',
    imei: '',
    suscriptor: '',
    estado: 'Pendiente',
    fecha: new Date().toISOString().split('T')[0],
    notas: ''
  });

  useEffect(() => {
    loadReferidos();
    
    // Online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Verificar alertas del día cuando cambia la data
  useEffect(() => {
    checkTodayAlerts();
  }, [data]);

  const checkTodayAlerts = () => {
    const today = new Date().toISOString().split('T')[0];
    const alertsForToday = data.filter(item => {
      if (!item.fecha) return false;
      const itemDate = new Date(item.fecha).toISOString().split('T')[0];
      return itemDate === today && item.estado !== 'Completado';
    });
    setTodayAlerts(alertsForToday);
    if (alertsForToday.length > 0) {
      setShowAlerts(true);
    }
  };

  const loadReferidos = async () => {
    try {
      const res = await authFetch('/api/referidos');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Error loading referidos", error);
    }
  };
  
  // Debounced search function
  const debouncedSearch = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (query: string) => {
      clearTimeout(timeoutId);
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      timeoutId = setTimeout(async () => {
        try {
          const res = await authFetch(`/api/referidos/search?q=${encodeURIComponent(query)}`);
          if (res.ok) {
            const results = await res.json();
            setSearchResults(results);
          }
        } catch (error) {
          console.error('Error searching:', error);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    };
  }, []);
  
  // Quick client submit
  const handleQuickClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) return;
    
    try {
      const userStr = localStorage.getItem('crm_user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      const res = await authFetch('/api/referidos/quick-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...quickClientForm,
          salesperson_id: user?.salesperson_id
        })
      });
      
      if (res.ok) {
        alert('✅ Cliente y referido creados exitosamente');
        setQuickClientForm({
          nombre: '',
          contacto: '',
          telefono: '',
          email: '',
          tax_id: '',
          ban_number: '',
          notas: ''
        });
        setActiveTab('lista');
        loadReferidos();
      } else {
        const error = await res.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating quick client:', error);
      alert('❌ Error al crear cliente');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const res = await authFetch(`/api/referidos/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const updated = await res.json();
          setData(prev => prev.map(item => item.id === editingId ? updated : item));
          closeModal();
        }
      } else {
        const res = await authFetch('/api/referidos', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const created = await res.json();
          setData(prev => [created, ...prev]);
          closeModal();
        }
      }
    } catch (error) {
      console.error("Error saving", error);
    }
  };

  const handleAddStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusName.trim()) return;
    const newId = Math.max(...statuses.map(s => s.id), 0) + 1;
    // Default color for new statuses (gray)
    const defaultColor = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    setStatuses(prev => [...prev, { id: newId, name: newStatusName, color: defaultColor }]);
    setNewStatusName('');
  };

  const handleDeleteStatus = (id: number) => {
    if (confirm('¿Eliminar este estado?')) {
      setStatuses(prev => prev.filter(s => s.id !== id));
    }
  };

  const openModal = (item: any = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData(item);
    } else {
      setEditingId(null);
      setFormData({
        nombre: '',
        tipo: 'Masivo',
        modelo: '',
        color: '',
        vendedor: '',
        email: '',
        imei: '',
        suscriptor: '',
        estado: statuses[0]?.name || '',
        fecha: new Date().toISOString().split('T')[0],
        notas: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de eliminar este registro?')) {
      try {
        const res = await authFetch(`/api/referidos/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setData(prev => prev.filter(item => item.id !== id));
        }
      } catch (error) {
        console.error("Error deleting", error);
      }
    }
  };

  const filteredData = data.filter(item => {
    const matchesSearch =
      item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.email && item.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.modelo && item.modelo.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'Todos' || item.estado === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (statusName: string) => {
    const status = statuses.find(s => s.name === statusName);
    return status ? status.color : 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans transition-colors duration-200">

      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-500 text-white p-3 text-center font-semibold flex items-center justify-center gap-2">
          <WifiOff className="w-5 h-5" />
          Sin conexión a Internet
        </div>
      )}

      {/* Alerta de Recordatorios del Día */}
      {showAlerts && todayAlerts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 w-96 bg-amber-50 dark:bg-amber-900/90 border border-amber-200 dark:border-amber-700 rounded-xl shadow-2xl overflow-hidden animate-pulse">
          <div className="bg-amber-500 dark:bg-amber-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold">
              <Bell className="w-5 h-5 animate-bounce" />
              <span>🔔 Llamados de Hoy ({todayAlerts.length})</span>
            </div>
            <button
              onClick={() => setShowAlerts(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {todayAlerts.map((item, idx) => (
              <div
                key={item.id}
                className={cn(
                  "px-4 py-3 flex items-center justify-between hover:bg-amber-100 dark:hover:bg-amber-800/50 transition-colors cursor-pointer",
                  idx !== todayAlerts.length - 1 && "border-b border-amber-200 dark:border-amber-700"
                )}
                onClick={() => {
                  openModal(item);
                  setShowAlerts(false);
                }}
              >
                <div className="flex-1">
                  <div className="font-semibold text-amber-900 dark:text-amber-100">{item.nombre}</div>
                  <div className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2 mt-1">
                    <Phone className="w-3 h-3" />
                    <span>{item.tipo} - {item.modelo || 'Sin producto'}</span>
                  </div>
                  {item.notas && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 truncate max-w-[250px]">
                      📝 {item.notas}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold",
                    getStatusColor(item.estado)
                  )}>
                    {item.estado}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal(item);
                      setShowAlerts(false);
                    }}
                    className="text-xs text-amber-600 dark:text-amber-300 hover:underline flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" /> Gestionar
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 bg-amber-100 dark:bg-amber-800/50 text-xs text-amber-700 dark:text-amber-300 text-center">
            <Calendar className="w-3 h-3 inline mr-1" />
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 shadow-sm rounded-lg mb-6 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <User className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Gestión de Referidos
            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300 font-normal">v2.2-MOBILE</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* Botón de Alertas */}
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className={cn(
              "relative px-3 py-2 min-h-[44px] rounded-lg flex items-center gap-2 transition-colors",
              todayAlerts.length > 0
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            )}
            title="Llamados del día"
          >
            <Bell className={cn("w-5 h-5", todayAlerts.length > 0 && "animate-bounce")} />
            {todayAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {todayAlerts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsCalendarOpen(true)}
            className="p-2 min-h-[44px] rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors"
            title="Calendario"
          >
            <Calendar className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsStatusModalOpen(true)}
            className="hidden sm:flex px-4 py-2 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Gestionar Estados
          </button>
          <button
            onClick={() => openModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 min-h-[44px] rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow-md active:scale-95 duration-150"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Registro</span>
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('lista')}
          className={cn(
            "px-4 py-3 min-h-[44px] font-medium transition-colors relative flex items-center gap-2",
            activeTab === 'lista'
              ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          )}
        >
          <FileText className="w-4 h-4" />
          Lista de Referidos
          <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full text-xs">
            {data.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('registrar')}
          className={cn(
            "px-4 py-3 min-h-[44px] font-medium transition-colors relative flex items-center gap-2",
            activeTab === 'registrar'
              ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          )}
        >
          <UserPlus className="w-4 h-4" />
          Registrar Cliente
        </button>
      </div>

      {/* Main Content */}
      <div className="w-full">
        {activeTab === 'lista' ? (
          <>
            {/* Search and Filter Bar */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="flex flex-1 gap-4 w-full">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, email, modelo..."
                    className="w-full pl-10 pr-4 py-2 min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
            </div>

            {/* Status Filter */}
            <div className="w-48">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
              >
                <option value="Todos">Todos los Estados</option>
                {statuses.map(status => (
                  <option key={status.id} value={status.name}>{status.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 text-sm text-slate-500 dark:text-slate-400 shrink-0 mt-4 sm:mt-0">
            <span className="font-medium bg-white dark:bg-slate-900 px-3 py-1.5 rounded-md shadow-sm border border-slate-200 dark:border-slate-800">
              Total: {filteredData.length}
            </span>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">Cliente</th>
                  <th className="px-6 py-4 font-semibold">Segm.</th>
                  <th className="px-6 py-4 font-semibold">Fecha</th>
                  <th className="px-6 py-4 font-semibold">Producto</th>
                  <th className="px-6 py-4 font-semibold">Vendedor</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 font-semibold">IMEI</th>
                  <th className="px-6 py-4 font-semibold">Suscriptor</th>
                  <th className="px-6 py-4 font-semibold">Notas</th>
                  <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredData.length > 0 ? (
                  filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 dark:text-white">{item.nombre}</div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {item.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide border",
                          item.tipo === 'Masivo'
                            ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30"
                            : "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/30"
                        )}>
                          {item.tipo || 'Masivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          {item.fecha ? new Date(item.fecha).toLocaleDateString() : '-'}
                          {item.fecha && new Date(item.fecha).toISOString().split('T')[0] === new Date().toISOString().split('T')[0] && (
                            <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                              <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                              HOY
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 dark:text-white">{item.modelo}</div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 inline-block"></span>
                          {item.color}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">
                            {item.vendedor ? item.vendedor.charAt(0) : '?'}
                          </div>
                          <span className="dark:text-slate-300">{item.vendedor}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-semibold",
                          getStatusColor(item.estado)
                        )}>
                          {item.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-600 dark:text-slate-300 font-mono text-xs">{item.imei || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-600 dark:text-slate-300 text-xs">{item.suscriptor || '-'}</span>
                      </td>
                      <td className="px-6 py-4 min-w-[250px]">
                        {item.notas ? (
                          <div className="flex items-start gap-1.5" title={item.notas}>
                            <FileText className="w-3 h-3 mt-0.5 text-slate-400 shrink-0" />
                            <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-normal break-words leading-relaxed">{item.notas}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sin notas</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openModal(item)}
                            className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md transition-colors"
                            title="Editar y Ver Notas"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-md transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400 dark:text-slate-600">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="w-8 h-8 opacity-20" />
                        <p>No se encontraron registros</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
          </>
        ) : null}
      </div>

      {/* Main Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={closeModal}
          ></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingId ? 'Editar Registro' : 'Nuevo Referido / Cliente'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                {/* Nombre */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre Completo</label>
                  <input
                    required
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    placeholder="cliente@ejemplo.com"
                  />
                </div>

                {/* Tipo de Cliente (Segmento) */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Segmento</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={cn(
                      "cursor-pointer border rounded-lg px-3 py-2 text-center text-sm font-medium transition-all",
                      formData.tipo === 'Masivo'
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-500"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}>
                      <input
                        type="radio"
                        name="tipo"
                        value="Masivo"
                        checked={formData.tipo === 'Masivo'}
                        onChange={handleInputChange}
                        className="hidden"
                      />
                      Masivo
                    </label>
                    <label className={cn(
                      "cursor-pointer border rounded-lg px-3 py-2 text-center text-sm font-medium transition-all",
                      formData.tipo === 'Negocio'
                        ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-500"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}>
                      <input
                        type="radio"
                        name="tipo"
                        value="Negocio"
                        checked={formData.tipo === 'Negocio'}
                        onChange={handleInputChange}
                        className="hidden"
                      />
                      Negocio
                    </label>
                  </div>
                </div>

                {/* Vendedor */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vendedor</label>
                  <input
                    name="vendedor"
                    value={formData.vendedor}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    placeholder="Nombre del Vendedor"
                  />
                </div>

                {/* Modelo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Modelo</label>
                  <input
                    name="modelo"
                    value={formData.modelo}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    placeholder="Ej. iPhone 15"
                  />
                </div>

                {/* Color */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Color</label>
                  <input
                    name="color"
                    value={formData.color}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    placeholder="Ej. Negro"
                  />
                </div>

                {/* Estado */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</label>
                    <button
                      type="button"
                      onClick={() => setIsStatusModalOpen(true)}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      + Gestionar
                    </button>
                  </div>
                  <select
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  >
                    {statuses.map(status => (
                      <option key={status.id} value={status.name}>{status.name}</option>
                    ))}
                  </select>
                </div>

                {/* Fecha */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha</label>
                  <input
                    type="date"
                    min="2020-01-01"
                    max="2030-12-31"
                    name="fecha"
                    value={formData.fecha}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all dark:[color-scheme:dark]"
                  />
                </div>

                {/* IMEI */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">IMEI</label>
                  <input
                    type="number"
                    name="imei"
                    value={formData.imei}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    placeholder="Número de IMEI"
                  />
                </div>

                {/* Suscriptor */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Suscriptor</label>
                  <input
                    name="suscriptor"
                    value={formData.suscriptor}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    placeholder="Nombre del Suscriptor"
                  />
                </div>

                {/* Notas */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-3 h-3" /> Notas
                  </label>
                  <textarea
                    name="notas"
                    value={formData.notas}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    placeholder="Agregar detalles importantes sobre este caso..."
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 flex gap-3 justify-end border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {editingId ? 'Guardar Cambios' : 'Crear Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      {isCalendarOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCalendarOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-6 h-6 text-indigo-600" /> Calendario de Llamadas
              </h2>
              <button onClick={() => setIsCalendarOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  const today = new Date();
                  const currentMonth = today.getMonth();
                  const currentYear = today.getFullYear();
                  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

                  return Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dateStr = new Date(currentYear, currentMonth, day).toISOString().split('T')[0];
                    const callsForDay = data.filter(item =>
                      item.fecha &&
                      item.fecha.startsWith(dateStr) &&
                      item.estado !== 'Completado' &&
                      item.estado !== 'Cancelado'
                    );

                    const isToday = dateStr === today.toISOString().split('T')[0];

                    if (callsForDay.length === 0 && !isToday) return null; // Only show days with activity or today

                    return (
                      <div key={day} className={cn(
                        "border rounded-xl p-4 transition-all hover:shadow-md",
                        isToday ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 ring-1 ring-indigo-500" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                      )}>
                        <div className="flex justify-between items-center mb-3">
                          <span className={cn(
                            "text-sm font-bold px-2 py-0.5 rounded",
                            isToday ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"
                          )}>
                            {new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-xs font-medium text-slate-400">{callsForDay.length} pendientes</span>
                        </div>

                        <div className="space-y-2">
                          {callsForDay.length > 0 ? (
                            callsForDay.map((client: any) => (
                              <div
                                key={client.id}
                                onClick={() => { setIsCalendarOpen(false); openModal(client); }}
                                className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 cursor-pointer shadow-sm text-sm"
                              >
                                <div className="truncate flex-1">
                                  <div className="font-medium text-slate-700 dark:text-slate-300 truncate">{client.nombre}</div>
                                  <div className="text-[10px] text-slate-500 truncate">{client.modelo || 'Sin modelo'}</div>
                                </div>
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(client.estado).split(' ')[0]}`}></div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-4 text-slate-400 text-xs italic">
                              No hay llamadas programadas
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }).filter(Boolean); // Filter nulls
                })()}
                {/* Fallback if no days shown */}
                {data.filter(i => i.estado !== 'Completado' && i.estado !== 'Cancelado').length === 0 && (
                  <div className="col-span-full text-center py-12 text-slate-500">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <p>¡Todo al día! No hay llamadas pendientes este mes.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Management Modal */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsStatusModalOpen(false)}
          ></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 dark:text-white">Gestionar Estados</h3>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* List */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {statuses.map(status => (
                  <div key={status.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", status.color)}>
                      {status.name}
                    </span>
                    <button
                      onClick={() => handleDeleteStatus(status.id)}
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New */}
              <form onSubmit={handleAddStatus} className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <input
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  placeholder="Nuevo estado..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Tab: Registrar Cliente */}
      {activeTab === 'registrar' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Buscar Cliente Existente */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 h-fit">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                <Search className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Buscar Cliente Existente
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Por BAN, suscriptor o nombre de empresa
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Ej: 849-123-4567, Acme Inc..."
                  className="w-full pl-11 pr-4 py-3 min-h-[44px] rounded-lg border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-all bg-white dark:bg-slate-950 dark:text-white text-base"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    debouncedSearch(e.target.value);
                  }}
                  disabled={!isOnline}
                />
              </div>
              
              {isSearching && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Buscando...
                </div>
              )}
              
              {!isSearching && searchResults.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedClient(result)}
                      className={cn(
                        "w-full text-left p-4 rounded-lg border-2 transition-all min-h-[44px]",
                        selectedClient?.id === result.id && selectedClient?.type === result.type
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {result.type === 'client' && <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />}
                        {result.type === 'ban' && <FileText className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />}
                        {result.type === 'subscriber' && <Phone className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white text-sm">
                            {result.type === 'client' && result.name}
                            {result.type === 'ban' && `BAN: ${result.ban_number}`}
                            {result.type === 'subscriber' && `Tel: ${result.phone}`}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {result.type === 'client' && `Contacto: ${result.contact_name || 'N/A'}`}
                            {result.type === 'ban' && `Cliente: ${result.client_name || 'Sin asignar'}`}
                            {result.type === 'subscriber' && `Cliente: ${result.client_name || 'N/A'} • BAN: ${result.ban_number}`}
                          </div>
                          {result.type === 'client' && result.phone && (
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              📞 {result.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <XCircle className="w-12 h-12 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p>No se encontraron resultados</p>
                  <button
                    onClick={() => {
                      setQuickClientForm({
                        ...quickClientForm,
                        nombre: searchQuery
                      });
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Crear como cliente nuevo →
                  </button>
                </div>
              )}
              
              {selectedClient && (
                <button
                  onClick={() => {
                    alert(`✅ Referir a: ${selectedClient.name || selectedClient.client_name}`);
                    // Aquí puedes abrir el modal de referido con datos pre-llenados
                  }}
                  disabled={!isOnline}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 min-h-[44px] rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Referir Este Cliente
                </button>
              )}
            </div>
          </div>
          
          {/* Card 2: Crear Cliente Nuevo */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 h-fit">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
                <UserPlus className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Crear Cliente Nuevo
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Llena los datos y referir automáticamente
                </p>
              </div>
            </div>
            
            <form onSubmit={handleQuickClientSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                  Empresa / Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickClientForm.nombre}
                  onChange={(e) => setQuickClientForm({...quickClientForm, nombre: e.target.value})}
                  className="w-full px-4 py-3 min-h-[44px] rounded-lg border-2 border-slate-200 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-400 outline-none transition-all bg-white dark:bg-slate-950 dark:text-white text-base"
                  placeholder="Ej: Acme Corporation"
                  disabled={!isOnline}
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                  Persona de Contacto
                </label>
                <input
                  type="text"
                  value={quickClientForm.contacto}
                  onChange={(e) => setQuickClientForm({...quickClientForm, contacto: e.target.value})}
                  className="w-full px-4 py-3 min-h-[44px] rounded-lg border-2 border-slate-200 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-400 outline-none transition-all bg-white dark:bg-slate-950 dark:text-white text-base"
                  placeholder="Ej: Juan Pérez"
                  disabled={!isOnline}
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={quickClientForm.telefono}
                  onChange={(e) => setQuickClientForm({...quickClientForm, telefono: e.target.value})}
                  className="w-full px-4 py-3 min-h-[44px] rounded-lg border-2 border-slate-200 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-400 outline-none transition-all bg-white dark:bg-slate-950 dark:text-white text-base"
                  placeholder="809-555-1234"
                  disabled={!isOnline}
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                  Email
                </label>
                <input
                  type="email"
                  value={quickClientForm.email}
                  onChange={(e) => setQuickClientForm({...quickClientForm, email: e.target.value})}
                  className="w-full px-4 py-3 min-h-[44px] rounded-lg border-2 border-slate-200 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-400 outline-none transition-all bg-white dark:bg-slate-950 dark:text-white text-base"
                  placeholder="contacto@empresa.com"
                  disabled={!isOnline}
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                  RNC / Cédula
                </label>
                <input
                  type="text"
                  value={quickClientForm.tax_id}
                  onChange={(e) => setQuickClientForm({...quickClientForm, tax_id: e.target.value})}
                  className="w-full px-4 py-3 min-h-[44px] rounded-lg border-2 border-slate-200 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-400 outline-none transition-all bg-white dark:bg-slate-950 dark:text-white text-base"
                  placeholder="101-234567-8"
                  maxLength={20}
                  disabled={!isOnline}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Opcional: RNC o Cédula fiscal</p>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                  BAN (Opcional)
                </label>
                <input
                  type="text"
                  value={quickClientForm.ban_number}
                  onChange={(e) => setQuickClientForm({...quickClientForm, ban_number: e.target.value})}
                  className="w-full px-4 py-3 min-h-[44px] rounded-lg border-2 border-slate-200 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-400 outline-none transition-all bg-white dark:bg-slate-950 dark:text-white text-base"
                  placeholder="Ej: 849-123-4567"
                  disabled={!isOnline}
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase flex items-center gap-2">
                  <FileText className="w-3 h-3" /> Notas
                </label>
                <textarea
                  value={quickClientForm.notas}
                  onChange={(e) => setQuickClientForm({...quickClientForm, notas: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-400 outline-none transition-all bg-white dark:bg-slate-950 dark:text-white text-base resize-none"
                  placeholder="Detalles adicionales..."
                  disabled={!isOnline}
                />
              </div>
              
              <button
                type="submit"
                disabled={!isOnline}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 min-h-[44px] rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <CheckCircle2 className="w-5 h-5" />
                Crear y Referir
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
