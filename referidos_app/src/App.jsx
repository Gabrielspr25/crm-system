import React, { useState, useEffect } from 'react';
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
  Mail
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Mock data generator for initial state
const initialData = [
  {
    id: 1,
    nombre: 'Juan Pérez',
    tipo: 'Masivo',
    modelo: 'iPhone 15 Pro',
    color: 'Titanio Natural',
    vendedor: 'Carlos Garcia',
    email: 'juan.perez@example.com',
    reservado: true,
    estado: 'Completado',
    fecha: '2024-03-10',
    notas: 'Cliente muy interesado en accesorios adicionales.'
  },
  {
    id: 2,
    nombre: 'Maria Rodriguez',
    tipo: 'Negocio',
    modelo: 'Samsung S24 Ultra',
    color: 'Violeta',
    vendedor: 'Ana Lopez',
    email: 'maria.rod@example.com',
    reservado: false,
    estado: 'Pendiente',
    fecha: '2024-03-12',
    notas: 'Llamar el martes para confirmar.'
  },
];

function App() {
  const [data, setData] = useState(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');

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
    reservado: false,
    estado: 'Pendiente',
    fecha: new Date().toISOString().split('T')[0],
    notas: ''
  });

  // Dark Mode State
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      setData(prev => prev.map(item => item.id === editingId ? { ...formData, id: editingId } : item));
    } else {
      setData(prev => [...prev, { ...formData, id: Date.now() }]);
    }
    closeModal();
  };

  const handleAddStatus = (e) => {
    e.preventDefault();
    if (!newStatusName.trim()) return;
    const newId = Math.max(...statuses.map(s => s.id), 0) + 1;
    // Default color for new statuses (gray)
    const defaultColor = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    setStatuses(prev => [...prev, { id: newId, name: newStatusName, color: defaultColor }]);
    setNewStatusName('');
  };

  const handleDeleteStatus = (id) => {
    if (confirm('¿Eliminar este estado?')) {
      setStatuses(prev => prev.filter(s => s.id !== id));
    }
  };

  const openModal = (item = null) => {
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
        reservado: false,
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

  const handleDelete = (id) => {
    if (confirm('¿Estás seguro de eliminar este registro?')) {
      setData(prev => prev.filter(item => item.id !== id));
    }
  };

  const filteredData = data.filter(item => {
    const matchesSearch =
      item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.modelo.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'Todos' || item.estado === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (statusName) => {
    const status = statuses.find(s => s.name === statusName);
    return status ? status.color : 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 shadow-sm sticky top-0 z-10 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gestión de Referidos</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Cambiar Tema"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button
              onClick={() => setIsStatusModalOpen(true)}
              className="hidden sm:flex px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Gestionar Estados
            </button>
            <button
              onClick={() => openModal()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow-md active:scale-95 duration-150"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Registro</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Search and Filter Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex flex-1 gap-4 w-full">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por nombre, email, modelo..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
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
                  <th className="px-6 py-4 font-semibold">Notas</th>
                  <th className="px-6 py-4 font-semibold">Producto</th>
                  <th className="px-6 py-4 font-semibold">Vendedor</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 font-semibold">Reservado</th>
                  <th className="px-6 py-4 font-semibold">Fecha</th>
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
                      <td className="px-6 py-4 max-w-xs">
                        {item.notas ? (
                          <div className="flex items-start gap-1.5" title={item.notas}>
                            <FileText className="w-3 h-3 mt-0.5 text-slate-400 shrink-0" />
                            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{item.notas}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sin notas</span>
                        )}
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
                            {item.vendedor.charAt(0)}
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
                        {item.reservado ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                            <CheckCircle2 className="w-4 h-4" /> Sí
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 font-medium text-xs">
                            <span className="w-4 h-4 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-600">
                              <XCircle className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                            </span> No
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {item.fecha}
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
      </main>

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
                    name="fecha"
                    value={formData.fecha}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all dark:[color-scheme:dark]"
                  />
                </div>

                {/* Reservado Checkbox */}
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      id="reservado"
                      name="reservado"
                      checked={formData.reservado}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-600 dark:bg-slate-900"
                    />
                    <label htmlFor="reservado" className="cursor-pointer select-none font-medium text-slate-700 dark:text-slate-200">Marcar como Reservado</label>
                  </div>
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
                      className="text-rose-500 hover:bg-rose-50 p-1 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New */}
              <form onSubmit={handleAddStatus} className="flex gap-2">
                <input
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  placeholder="Nuevo estado..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!newStatusName.trim()}
                  className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
