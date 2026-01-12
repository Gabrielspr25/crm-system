import { useState, useEffect } from "react";
import { X, Calendar, User, CreditCard } from "lucide-react";
import { CreateSubscriber } from "@/shared/types";

interface SubscriberModalProps {
  banId: number;
  subscriber?: any;
  onSave: (data: CreateSubscriber | any) => void;
  onClose: () => void;
}

export default function SubscriberModal({ banId, subscriber, onSave, onClose }: SubscriberModalProps) {
  const [formData, setFormData] = useState({
    phone: '',
    ban_id: banId,
    service_type: '',
    monthly_value: 0,
    months: 12 as number | '',
    remaining_payments: 0 as number | '',
    status: 'activo' as 'activo' | 'cancelado' | 'suspendido',
    cancel_reason: '',
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Calculate contract end date based on remaining payments
  const calculateContractEndDate = (remainingPayments: number) => {
    if (remainingPayments < 0) return '';
    
    const today = new Date();
    
    // Si es 0, la fecha de fin es HOY (vence hoy)
    if (remainingPayments === 0) {
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const year = today.getFullYear();
        return `${month}/${day}/${year}`;
    }

    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + remainingPayments);
    // Format as MM/DD/YYYY for display
    const month = String(endDate.getMonth() + 1).padStart(2, '0');
    const day = String(endDate.getDate()).padStart(2, '0');
    const year = endDate.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Calculate contract end date for database (YYYY-MM-DD format)
  const calculateContractEndDateForDB = (remainingPayments: number) => {
    if (remainingPayments < 0) return null;
    
    const today = new Date();
    
    // Si es 0, la fecha de fin es HOY (vence hoy)
    if (remainingPayments === 0) {
        return today.toISOString().split('T')[0];
    }

    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + remainingPayments);
    return endDate.toISOString().split('T')[0];
  };

  // Load existing subscriber data if editing
  useEffect(() => {
    if (subscriber) {
      setFormData({
        phone: subscriber.phone || '',
        ban_id: subscriber.ban_id || banId,
        service_type: subscriber.plan || subscriber.service_type || '',
        monthly_value: subscriber.monthly_value || 0,
        months: subscriber.contract_term || subscriber.months || 12,
        remaining_payments: subscriber.remaining_payments || 0,
        status: (subscriber.status || 'activo') as 'activo' | 'cancelado' | 'suspendido',
        cancel_reason: '',
      });
    }
  }, [subscriber, banId]);

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.phone.trim()) {
      newErrors.phone = 'El número de teléfono es obligatorio';
    } else if (!/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = 'El número de teléfono debe contener exactamente 10 dígitos';
    }

    if (!formData.service_type?.trim()) {
      newErrors.service_type = 'El plan es obligatorio';
    }

    if (!formData.monthly_value || formData.monthly_value <= 0) {
      newErrors.monthly_value = 'El valor mensual es obligatorio y debe ser mayor a 0';
    }

    if (!formData.months || formData.months <= 0) {
      newErrors.months = 'La duración del contrato debe ser mayor a 0';
    }

    if (typeof formData.remaining_payments === 'number' && formData.remaining_payments < 0) {
      newErrors.remaining_payments = 'Los plazos faltantes no pueden ser negativos';
    }

    if (formData.status === 'cancelado' && !formData.cancel_reason) {
      newErrors.cancel_reason = 'Debes seleccionar una razón de cancelación';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      // Calculate contract end date automatically based on remaining payments (for database)
      const remainingPaymentsValue = typeof formData.remaining_payments === 'number' ? formData.remaining_payments : 0;
      const contractEndDate = calculateContractEndDateForDB(remainingPaymentsValue);

      const cleanData: any = {
        phone: formData.phone.trim(),
        ban_id: formData.ban_id,
        plan: formData.service_type.trim(),
        monthly_value: Number(formData.monthly_value),
        contract_term: Number(formData.months || 0),
        remaining_payments: Number(formData.remaining_payments || 0),
        contract_end_date: contractEndDate,
      };

      // If editing, include the subscriber ID
      if (subscriber && subscriber.id) {
        cleanData.id = subscriber.id;
      }

      await onSave(cleanData);
      onClose();
    } catch (error: any) {
      console.error('Error saving subscriber:', error);
      const errorMessage = error?.message || 'Error al guardar el suscriptor. Por favor, intenta de nuevo.';
      alert(errorMessage);
    }
  };

  const isEditing = !!subscriber;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
      <div className="bg-gray-800 dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-600 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-600 dark:border-gray-700 bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-800 dark:to-gray-700 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {isEditing ? 'Editar Suscriptor' : 'Nuevo Suscriptor'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Phone Number */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Número de Teléfono *
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => {
                // Only allow digits and limit to 10 characters
                const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                setFormData(prev => ({ ...prev, phone: value }));
                if (errors.phone) {
                  setErrors(prev => ({ ...prev, phone: '' }));
                }
              }}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 transition-all ${
                errors.phone ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="5041234567"
              maxLength={10}
            />
            {errors.phone && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errors.phone}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center">
              <span className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full mr-2"></span>
              Debe contener exactamente 10 dígitos
            </p>
          </div>

          {/* Plan Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Plan del Cliente *
            </label>
            <input
              type="text"
              value={formData.service_type}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, service_type: e.target.value }));
                if (errors.service_type) {
                  setErrors(prev => ({ ...prev, service_type: '' }));
                }
              }}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 transition-all ${
                errors.service_type ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Ej: Plan Premium, Plan Básico, etc."
            />
            {errors.service_type && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errors.service_type}</p>
            )}
          </div>

          {/* Monthly Value */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Valor Mensual *
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center">
                <CreditCard className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                <span className="text-gray-500 dark:text-gray-400 font-medium">$</span>
              </div>
              <input
                type="number"
                value={formData.monthly_value}
                onChange={(e) => {
                  const value = e.target.value ? Math.max(0, parseFloat(e.target.value) || 0) : 0;
                  setFormData(prev => ({ ...prev, monthly_value: value }));
                  if (errors.monthly_value) {
                    setErrors(prev => ({ ...prev, monthly_value: '' }));
                  }
                }}
                className={`w-full pl-16 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 transition-all ${
                  errors.monthly_value ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            {errors.monthly_value && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errors.monthly_value}</p>
            )}
          </div>

          {/* Duration in Months */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Duración del Contrato (meses) *
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.months === '' ? '' : formData.months}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setFormData(prev => ({ ...prev, months: value === '' ? '' as any : parseInt(value) }));
                if (errors.months) {
                  setErrors(prev => ({ ...prev, months: '' }));
                }
              }}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 transition-all ${
                errors.months ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="12"
            />
            {errors.months && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errors.months}</p>
            )}
          </div>

          {/* Remaining Payments */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Plazos Faltantes
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.remaining_payments === '' ? '' : formData.remaining_payments}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setFormData(prev => ({ ...prev, remaining_payments: value === '' ? '' as any : parseInt(value) }));
                if (errors.remaining_payments) {
                  setErrors(prev => ({ ...prev, remaining_payments: '' }));
                }
              }}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 transition-all ${
                errors.remaining_payments ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="0"
            />
            {errors.remaining_payments && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errors.remaining_payments}</p>
            )}
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center">
              <span className="w-1 h-1 bg-blue-500 rounded-full mr-2"></span>
              La fecha de vencimiento se calculará automáticamente
            </p>
          </div>

          {/* Contract End Date - Auto Calculated Display */}
          {typeof formData.remaining_payments === 'number' && formData.remaining_payments > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Fecha de Vencimiento del Contrato (Calculada)
              </label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  value={calculateContractEndDate(formData.remaining_payments)}
                  readOnly
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-700 dark:bg-gray-700 text-gray-300 dark:text-gray-300 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center">
                <span className="w-1 h-1 bg-blue-500 rounded-full mr-2"></span>
                Se calcula automáticamente basado en los plazos faltantes
              </p>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Estado
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'activo' | 'cancelado' | 'suspendido' }))}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100"
            >
              <option value="activo">Activo</option>
              <option value="cancelado">Cancelado</option>
              <option value="suspendido">Suspendido</option>
            </select>
          </div>

          {/* Cancel Reason - Solo si está cancelado */}
          {formData.status === 'cancelado' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Razón de Cancelación *
              </label>
              <select
                value={formData.cancel_reason}
                onChange={(e) => setFormData(prev => ({ ...prev, cancel_reason: e.target.value }))}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 dark:bg-gray-800 text-gray-100 dark:text-gray-100 ${
                  errors.cancel_reason ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
                required
              >
                <option value="">Seleccionar razón...</option>
                <option value="Deuda">Deuda</option>
                <option value="Sin Deuda">Sin Deuda</option>
                <option value="Portout">Portout</option>
              </select>
              {errors.cancel_reason && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errors.cancel_reason}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Obligatorio cuando el suscriptor está cancelado
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-8 py-3 text-white rounded-xl transition-all duration-200 shadow-lg font-semibold ${
                isEditing 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-green-500/25'
              }`}
            >
              {isEditing ? 'Actualizar Suscriptor' : 'Crear Suscriptor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
