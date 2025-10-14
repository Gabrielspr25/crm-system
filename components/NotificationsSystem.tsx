import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, Phone, Calendar, AlertTriangle, Volume2, VolumeX, Settings } from 'lucide-react';

interface ScheduledCall {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  fecha: string;
  hora: string;
  notas?: string;
  salespersonId: string;
  salespersonName: string;
}

interface Notification {
  id: string;
  type: 'call_reminder' | 'call_now' | 'call_overdue';
  title: string;
  message: string;
  call: ScheduledCall;
  timestamp: string;
  read: boolean;
  urgent: boolean;
}

interface NotificationsSystemProps {
  currentUser: {
    id: string;
    name: string;
    role: 'admin' | 'vendedor';
  };
  onCallNow?: (call: ScheduledCall) => void;
}

const NotificationsSystem: React.FC<NotificationsSystemProps> = ({ 
  currentUser,
  onCallNow 
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserNotifications, setBrowserNotifications] = useState(false);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  
  // Simular llamadas programadas
  useEffect(() => {
    const mockScheduledCalls: ScheduledCall[] = [
      {
        id: '1',
        clientId: 'c1',
        clientName: 'GRUPO ODONTOLOGIA',
        phone: '787-555-0001',
        fecha: new Date().toISOString().split('T')[0], // Hoy
        hora: '15:00',
        notas: 'Llamada para seguimiento de propuesta',
        salespersonId: 'vendedor1',
        salespersonName: 'Gabriel Sánchez'
      },
      {
        id: '2',
        clientId: 'c2',
        clientName: 'elizabeth calderon',
        phone: '787-555-0002',
        fecha: new Date().toISOString().split('T')[0], // Hoy
        hora: new Date(Date.now() + 5 * 60000).toTimeString().slice(0, 5), // En 5 minutos
        notas: 'Revisión de documentos',
        salespersonId: 'vendedor1',
        salespersonName: 'Gabriel Sánchez'
      },
      {
        id: '3',
        clientId: 'c3',
        clientName: 'Pablo G Barreto',
        phone: '787-555-0003',
        fecha: new Date().toISOString().split('T')[0], // Hoy
        hora: new Date(Date.now() - 30 * 60000).toTimeString().slice(0, 5), // Hace 30 min (vencida)
        notas: 'Cotización final',
        salespersonId: 'vendedor1',
        salespersonName: 'Gabriel Sánchez'
      }
    ];

    setScheduledCalls(mockScheduledCalls);
  }, []);

  // Solicitar permisos para notificaciones del navegador
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setBrowserNotifications(true);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          setBrowserNotifications(permission === 'granted');
        });
      }
    }
  }, []);

  // Verificar llamadas programadas cada minuto
  useEffect(() => {
    const checkScheduledCalls = () => {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      const currentDate = now.toISOString().split('T')[0];

      scheduledCalls.forEach(call => {
        if (call.fecha === currentDate && call.salespersonId === currentUser.id) {
          const callTime = new Date(`${call.fecha}T${call.hora}`);
          const timeDiff = callTime.getTime() - now.getTime();
          const minutesDiff = Math.floor(timeDiff / (1000 * 60));

          // Llamada en 15 minutos - Recordatorio
          if (minutesDiff === 15) {
            createNotification({
              type: 'call_reminder',
              title: 'Llamada programada pronto',
              message: `Llamada con ${call.clientName} en 15 minutos`,
              call,
              urgent: false
            });
          }
          
          // Llamada ahora (± 1 minuto)
          else if (Math.abs(minutesDiff) <= 1) {
            createNotification({
              type: 'call_now',
              title: 'Es hora de llamar',
              message: `Llamada programada con ${call.clientName}`,
              call,
              urgent: true
            });
          }
          
          // Llamada vencida (más de 15 minutos de retraso)
          else if (minutesDiff < -15) {
            createNotification({
              type: 'call_overdue',
              title: 'Llamada vencida',
              message: `Llamada con ${call.clientName} programada para las ${call.hora}`,
              call,
              urgent: true
            });
          }
        }
      });
    };

    // Verificar inmediatamente
    checkScheduledCalls();

    // Verificar cada minuto
    const interval = setInterval(checkScheduledCalls, 60000);

    return () => clearInterval(interval);
  }, [scheduledCalls, currentUser.id]);

  const createNotification = useCallback((notificationData: {
    type: 'call_reminder' | 'call_now' | 'call_overdue';
    title: string;
    message: string;
    call: ScheduledCall;
    urgent: boolean;
  }) => {
    const notification: Notification = {
      id: `${notificationData.call.id}-${notificationData.type}-${Date.now()}`,
      ...notificationData,
      timestamp: new Date().toISOString(),
      read: false
    };

    // Evitar duplicados recientes
    const recentNotification = notifications.find(n => 
      n.call.id === notification.call.id && 
      n.type === notification.type &&
      Date.now() - new Date(n.timestamp).getTime() < 300000 // 5 minutos
    );

    if (recentNotification) return;

    setNotifications(prev => [notification, ...prev]);

    // Notificación del navegador
    if (browserNotifications) {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });
    }

    // Sonido de alerta
    if (soundEnabled && notification.urgent) {
      playNotificationSound();
    }

  }, [notifications, browserNotifications, soundEnabled]);

  const playNotificationSound = () => {
    // Crear sonido usando Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log('No se pudo reproducir el sonido de notificación');
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ));
  };

  const dismissNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const handleCallNow = (call: ScheduledCall) => {
    if (onCallNow) {
      onCallNow(call);
    } else {
      // Abrir dialer del teléfono o mostrar número
      window.open(`tel:${call.phone}`);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const urgentCount = notifications.filter(n => !n.read && n.urgent).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'call_reminder': return <Calendar className="w-4 h-4 text-blue-600" />;
      case 'call_now': return <Phone className="w-4 h-4 text-green-600" />;
      case 'call_overdue': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'call_reminder': return 'border-blue-200 bg-blue-50';
      case 'call_now': return 'border-green-200 bg-green-50';
      case 'call_overdue': return 'border-red-200 bg-red-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors ${
          urgentCount > 0 
            ? 'text-red-600 hover:bg-red-50 animate-pulse' 
            : unreadCount > 0
            ? 'text-blue-600 hover:bg-blue-50'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
        title={`${unreadCount} notificaciones sin leer`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 h-5 w-5 text-xs flex items-center justify-center rounded-full text-white font-medium ${
            urgentCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-blue-500'
          }`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Notificaciones ({unreadCount})
              </h3>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title={soundEnabled ? 'Desactivar sonidos' : 'Activar sonidos'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Actions */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Marcar todo como leído
              </button>
              <button
                onClick={clearAll}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Limpiar todo
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay notificaciones</p>
                <p className="text-sm">Te avisaremos cuando tengas llamadas programadas</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 transition-colors ${
                      notification.read ? 'opacity-60' : ''
                    } ${getNotificationColor(notification.type)} hover:bg-opacity-75`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className={`text-sm font-medium ${
                              notification.urgent ? 'text-red-900' : 'text-gray-900'
                            } dark:text-white`}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>📞 {notification.call.phone}</span>
                              <span>⏰ {notification.call.hora}</span>
                              <span>{new Date(notification.timestamp).toLocaleTimeString('es-ES', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => dismissNotification(notification.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-3">
                          {(notification.type === 'call_now' || notification.type === 'call_overdue') && (
                            <button
                              onClick={() => handleCallNow(notification.call)}
                              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <Phone className="w-3 h-3" />
                              Llamar ahora
                            </button>
                          )}
                          
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              Marcar leído
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {browserNotifications ? '🔔 Notificaciones activadas' : '🔕 Notificaciones desactivadas'}
              </span>
              <span>
                {soundEnabled ? '🔊 Sonido activado' : '🔇 Sonido desactivado'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Urgent Alert Overlay */}
      {urgentCount > 0 && !isOpen && (
        <div className="fixed bottom-4 right-4 z-40">
          <div className="bg-red-600 text-white p-4 rounded-lg shadow-xl animate-bounce">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <p className="font-medium">¡Llamadas urgentes!</p>
                <p className="text-sm opacity-90">{urgentCount} llamada{urgentCount > 1 ? 's' : ''} requiere{urgentCount === 1 ? '' : 'n'} atención</p>
              </div>
              <button
                onClick={() => setIsOpen(true)}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-2 transition-colors"
              >
                <Bell className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsSystem;