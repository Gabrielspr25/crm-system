import React, { useState, useEffect } from 'react';
import { Meta } from '../types';
import { CrmDataHook } from '../hooks/useCrmData';

interface MetaModalProps {
  isOpen: boolean;
  onClose: () => void;
  meta?: Meta | null;
  crmData: CrmDataHook;
  currentUser: any;
}

const MetaModal: React.FC<MetaModalProps> = ({ isOpen, onClose, meta, crmData, currentUser }) => {
  const { salespeople, addMeta, updateMeta } = crmData;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    vendedorId: '',
    metaValor: '',
    tipoMeta: 'ventas',
    categoria: '',
    description: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    activa: true
  });

  useEffect(() => {
    if (meta) {
      setFormData({
        vendedorId: meta.vendedorId || '',
        metaValor: meta.metaValor.toString(),
        tipoMeta: meta.tipoMeta || 'ventas',
        categoria: meta.categoria || '',
        description: meta.description || '',
        month: meta.month || new Date().getMonth() + 1,
        year: meta.year || new Date().getFullYear(),
        activa: meta.activa !== false
      });
    } else {
      // Reset form for new meta
      setFormData({
        vendedorId: currentUser.role === 'salesperson' ? currentUser.id : '',
        metaValor: '',
        tipoMeta: 'ventas',
        categoria: '',
        description: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        activa: true
      });
    }
    setError(null);
  }, [meta, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validar datos antes de enviar
      if (!formData.vendedorId) {
        throw new Error('Debe seleccionar un vendedor');
      }
      if (!formData.metaValor || parseFloat(formData.metaValor) <= 0) {
        throw new Error('El valor de la meta debe ser mayor a 0');
      }

      const metaData = {
        ...formData,
        metaValor: parseFloat(formData.metaValor),
        month: parseInt(formData.month.toString()),
        year: parseInt(formData.year.toString())
      };

      console.log('💾 Guardando meta:', metaData);

      if (meta) {
        console.log('✏️ Actualizando meta ID:', meta.id);
        await updateMeta(meta.id, metaData);
      } else {
        console.log('🆕 Creando nueva meta');
        await addMeta(metaData);
      }

      console.log('✅ Meta guardada exitosamente');
      onClose();
    } catch (err: any) {
      console.error('❌ Error al guardar meta:', err);
      setError(err.message || 'Error al guardar la meta');
    } finally {
      setLoading(false);
    }
  };

  const tipoMetaOptions = [
    { value: 'ventas', label: '💰 Ventas' },
    { value: 'clientes', label: '👥 Nuevos Clientes' },
    { value: 'productos', label: '📦 Productos Vendidos' },
    { value: 'llamadas', label: '📞 Llamadas Realizadas' },
    { value: 'reuniones', label: '🤝 Reuniones' },
    { value: 'otro', label: '📊 Otro' }
  ];

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear + i - 1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-secondary rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-text-primary">
              {meta ? '✏️ Editar Meta' : '🎯 Nueva Meta'}
            </h2>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary text-2xl leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Vendedor */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Vendedor *
              </label>
                <select
                  value={formData.vendedorId}
                  onChange={(e) => setFormData(prev => ({ ...prev, vendedorId: e.target.value }))}
                  className="w-full bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent"
                  required
                  disabled={currentUser.role === 'salesperson'}
                >
                  <option value="">Seleccionar...</option>
                  {currentUser.role === 'admin' && (
                    <option value="NEGOCIO" className="font-bold bg-blue-600 text-white">
                      🏢 NEGOCIO (Meta Global)
                    </option>
                  )}
                  <optgroup label="Vendedores Individuales">
                    {salespeople.map(person => (
                      <option key={person.id} value={person.id}>
                        👤 {person.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              {currentUser.role === 'salesperson' ? (
                <p className="text-xs text-text-secondary mt-1">
                  Solo puedes crear metas para ti mismo
                </p>
              ) : formData.vendedorId === 'NEGOCIO' ? (
                <p className="text-xs text-accent mt-1">
                  🏢 Crear meta global del negocio - Los vendedores individuales contribuirán a esta meta
                </p>
              ) : (
                <p className="text-xs text-text-secondary mt-1">
                  Meta individual del vendedor seleccionado
                </p>
              )}
            </div>

            {/* Tipo de Meta */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Tipo de Meta *
              </label>
              <select
                value={formData.tipoMeta}
                onChange={(e) => setFormData(prev => ({ ...prev, tipoMeta: e.target.value }))}
                className="w-full bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent"
                required
              >
                {tipoMetaOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Categoría
              </label>
              <input
                type="text"
                value={formData.categoria}
                onChange={(e) => setFormData(prev => ({ ...prev, categoria: e.target.value }))}
                className="w-full bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="ej: Productos premium, Clientes nuevos..."
              />
            </div>

            {/* Valor de la Meta */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Valor de la Meta *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-text-secondary">
                  {formData.tipoMeta === 'ventas' ? '$' : '#'}
                </span>
                <input
                  type="number"
                  step={formData.tipoMeta === 'ventas' ? '0.01' : '1'}
                  min="0"
                  value={formData.metaValor}
                  onChange={(e) => setFormData(prev => ({ ...prev, metaValor: e.target.value }))}
                  className="w-full bg-tertiary border border-border rounded-lg pl-8 pr-3 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder={
                    formData.vendedorId === 'NEGOCIO' 
                      ? (formData.tipoMeta === 'ventas' ? '100000.00 (Meta total del negocio)' : '500')
                      : (formData.tipoMeta === 'ventas' ? '25000.00 (Meta individual)' : '50')
                  }
                  required
                />
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {formData.vendedorId === 'NEGOCIO' 
                  ? (formData.tipoMeta === 'ventas' 
                    ? '🏢 Meta total del negocio - Los vendedores individuales sumarán a esta meta' 
                    : '🏢 Meta total del negocio en cantidad')
                  : (formData.tipoMeta === 'ventas' 
                    ? '👤 Meta individual - Contribuye a la meta del negocio' 
                    : '👤 Meta individual en cantidad')
                }
              </p>
            </div>

            {/* Período */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Mes *
                </label>
                <select
                  value={formData.month}
                  onChange={(e) => setFormData(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                  className="w-full bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent"
                  required
                >
                  {months.map((month, index) => (
                    <option key={index + 1} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Año *
                </label>
                <select
                  value={formData.year}
                  onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                  className="w-full bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent"
                  required
                >
                  {years.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Descripción
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                placeholder="Describe los detalles de esta meta..."
              />
            </div>

            {/* Estado Activo */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="activa"
                checked={formData.activa}
                onChange={(e) => setFormData(prev => ({ ...prev, activa: e.target.checked }))}
                className="w-4 h-4 text-accent bg-tertiary border-border rounded focus:ring-accent focus:ring-2"
              />
              <label htmlFor="activa" className="text-sm text-text-primary">
                Meta activa
              </label>
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-tertiary text-text-secondary py-2 px-4 rounded-lg hover:bg-border transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 bg-accent text-primary font-medium py-2 px-4 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Guardando...' : (meta ? 'Actualizar' : 'Crear Meta')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MetaModal;