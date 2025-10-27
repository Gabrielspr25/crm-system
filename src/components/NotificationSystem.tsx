import React, { useState, useEffect, useMemo } from 'react';
import { Meta } from '../types';

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  metaId?: string;
  vendedorId?: string;
  isRead: boolean;
  autoHide?: boolean;
}

interface NotificationSystemProps {
  metas: any[];
  incomes: any[];
  salespeople: any[];
  currentUser: any;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({
  metas,
  incomes,
  salespeople,
  currentUser
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Generar notificaciones basadas en el estado de las metas
  const generateNotifications = useMemo(() => {
    const newNotifications: Notification[] = [];
    const now = new Date();

    metas.forEach(meta => {
      // Calcular progreso actual
      const vendorIncomes = incomes.filter(income => 
        income.salespersonId === meta.vendedorId &&
        new Date(income.date).getFullYear() === meta.year &&
        (new Date(income.date).getMonth() + 1) === meta.month
      );
      
      const totalSales = vendorIncomes.reduce((sum, income) => sum + income.amount, 0);
      const progressPercent = meta.metaValor > 0 ? (totalSales / meta.metaValor) * 100 : 0;
      const vendorName = salespeople.find(s => s.id === meta.vendedorId)?.name || 'Desconocido';

      // Solo mostrar notificaciones para metas del usuario actual o si es admin
      const shouldNotify = currentUser.role === 'admin' || meta.vendedorId === currentUser.id;
      
      if (!shouldNotify || !meta.activa) return;

      // Meta completada
      if (progressPercent >= 100) {
        newNotifications.push({
          id: `completed-${meta.id}`,
          type: 'success',
          title: '🎉 ¡Meta Completada!',
          message: `${vendorName} ha completado su meta de ${meta.tipoMeta} (${progressPercent.toFixed(1)}%)`,
          timestamp: now,
          metaId: meta.id,
          vendedorId: meta.vendedorId,
          isRead: false,
          autoHide: true
        });
      }
      
      // Meta en progreso excelente (90-99%)
      else if (progressPercent >= 90) {
        newNotifications.push({
          id: `excellent-${meta.id}`,
          type: 'success',
          title: '🔥 ¡Casi Completada!',
          message: `${vendorName} está muy cerca de completar su meta (${progressPercent.toFixed(1)}%)`,
          timestamp: now,
          metaId: meta.id,
          vendedorId: meta.vendedorId,
          isRead: false
        });
      }
      
      // Meta en peligro (final del mes y < 75%)
      else if (progressPercent < 75) {
        const isEndOfMonth = now.getDate() > 20; // Últimos 10 días del mes
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        if (meta.month === currentMonth && meta.year === currentYear && isEndOfMonth) {
          newNotifications.push({
            id: `danger-${meta.id}`,
            type: 'danger',
            title: '⚠️ Meta en Peligro',
            message: `${vendorName} necesita acelerar para alcanzar su meta (${progressPercent.toFixed(1)}%)`,
            timestamp: now,
            metaId: meta.id,
            vendedorId: meta.vendedorId,
            isRead: false
          });
        }
      }
      
      // Meta con buen progreso (75-89%)
      else if (progressPercent >= 75) {
        newNotifications.push({
          id: `good-${meta.id}`,
          type: 'info',
          title: '💪 Buen Progreso',
          message: `${vendorName} va por buen camino con su meta (${progressPercent.toFixed(1)}%)`,
          timestamp: now,
          metaId: meta.id,
          vendedorId: meta.vendedorId,
          isRead: false
        });
      }
    });

    return newNotifications.slice(0, 10); // Limitar a 10 notificaciones más recientes
  }, [metas, incomes, salespeople, currentUser]);

  // Actualizar notificaciones cuando cambien los datos
  useEffect(() => {
    const newNotifications = generateNotifications;
    
    // Marcar como leídas las notificaciones existentes del mismo tipo
    const updatedExistingNotifications = notifications.map(existing => {
      const found = newNotifications.find(n => n.id === existing.id);
      return found ? { ...existing, ...found } : existing;
    });
    
    // Agregar solo notificaciones realmente nuevas
    const reallyNewNotifications = newNotifications.filter(
      newN => !notifications.some(existing => existing.id === newN.id)
    );
    
    if (reallyNewNotifications.length > 0) {
      setNotifications(prev => [
        ...reallyNewNotifications,
        ...updatedExistingNotifications
      ].slice(0, 20)); // Mantener solo las 20 más recientes
    }
  }, [generateNotifications]);

  // Auto-ocultar notificaciones después de un tiempo
  useEffect(() => {
    const timer = setTimeout(() => {
      setNotifications(prev => 
        prev.filter(notification => 
          !notification.autoHide || 
          (new Date().getTime() - notification.timestamp.getTime()) < 5000
        )
      );
    }, 5000);

    return () => clearTimeout(timer);
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const removeNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return '🎉';
      case 'warning': return '⚠️';
      case 'danger': return '🚨';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'success': return 'border-green-500 bg-green-500/10 text-green-400';
      case 'warning': return 'border-yellow-500 bg-yellow-500/10 text-yellow-400';
      case 'danger': return 'border-red-500 bg-red-500/10 text-red-400';
      case 'info': return 'border-blue-500 bg-blue-500/10 text-blue-400';
      default: return 'border-gray-500 bg-gray-500/10 text-gray-400';
    }
  };

  return (
    <>
      {/* Botón de notificaciones en el header */}
      <div className="relative">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-2 text-text-secondary hover:text-text-primary transition-colors"
          title="Notificaciones"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M15 17h5l-5-5V9a6 6 0 10-12 0v3l-5 5h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Panel de notificaciones */}
        {showNotifications && (
          <div className="absolute right-0 top-full mt-2 w-96 bg-secondary border border-border rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h3 className="font-semibold text-text-primary">Notificaciones</h3>
              <div className="flex space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-accent hover:text-sky-300"
                  >
                    Marcar todas como leídas
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-text-secondary hover:text-text-primary"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Lista de notificaciones */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length > 0 ? (
                <div className="divide-y divide-border">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`p-4 cursor-pointer hover:bg-tertiary/50 transition-colors ${
                        !notification.isRead ? 'bg-accent/5' : ''
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h4 className={`font-medium ${getNotificationStyle(notification.type)} text-sm`}>
                              {notification.title}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                              }}
                              className="text-text-secondary hover:text-red-400 ml-2"
                              title="Eliminar notificación"
                            >
                              ×
                            </button>
                          </div>
                          <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-text-secondary mt-2">
                            {notification.timestamp.toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0 mt-2"></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-2">🔕</div>
                  <p className="text-text-secondary">No hay notificaciones</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notificaciones toast para las auto-hide */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications
          .filter(n => n.autoHide && !n.isRead)
          .slice(0, 3)
          .map(notification => (
          <div
            key={`toast-${notification.id}`}
            className={`max-w-sm bg-secondary border-l-4 ${getNotificationStyle(notification.type)} rounded-lg shadow-lg p-4 transform transition-all duration-300 animate-slide-in-right`}
          >
            <div className="flex items-start">
              <span className="text-lg mr-3">{getNotificationIcon(notification.type)}</span>
              <div className="flex-1">
                <h4 className="font-medium text-text-primary text-sm">
                  {notification.title}
                </h4>
                <p className="text-sm text-text-secondary mt-1">
                  {notification.message}
                </p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="text-text-secondary hover:text-text-primary ml-2"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default NotificationSystem;