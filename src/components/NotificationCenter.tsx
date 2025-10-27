import React, { useState } from 'react';
import { Notification } from '../hooks/useNotifications';

interface NotificationCenterProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearNotification: (id: string) => void;
  onClearAll: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearNotification,
  onClearAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const getNotificationIcon = (type: string, action: string) => {
    const icons: Record<string, Record<string, string>> = {
      clients: {
        created: '👤',
        updated: '✏️',
        deleted: '🗑️',
      },
      products: {
        created: '📦',
        updated: '📝',
        deleted: '🗑️',
      },
      salespeople: {
        created: '👨‍💼',
        updated: '✏️',
        deleted: '🗑️',
      },
      categories: {
        created: '📂',
        updated: '📝',
        deleted: '🗑️',
      },
      subscribers: {
        created: '📧',
        updated: '✏️',
        deleted: '🗑️',
      },
      bans: {
        created: '🚫',
        updated: '⚠️',
        deleted: '✅',
      },
      metas: {
        created: '🎯',
        updated: '📊',
        deleted: '🗑️',
      },
    };

    return icons[type]?.[action] || '📢';
  };

  const getNotificationColor = (action: string) => {
    const colors: Record<string, string> = {
      created: 'text-green-600',
      updated: 'text-blue-600',
      deleted: 'text-red-600',
    };
    return colors[action] || 'text-gray-600';
  };

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diff = now.getTime() - notificationTime.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-secondary hover:text-text-primary transition-colors duration-200"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5-5V9a5 5 0 0 0-10 0v3l-5 5h5a5 5 0 0 0 10 0z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[18px] h-[18px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute right-0 mt-2 w-96 bg-secondary border border-border rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">
                  Notificaciones
                </h3>
                {notifications.length > 0 && (
                  <div className="flex space-x-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={onMarkAllAsRead}
                        className="text-sm text-accent hover:text-accent-dark"
                      >
                        Marcar todas como leídas
                      </button>
                    )}
                    <button
                      onClick={onClearAll}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Limpiar todo
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="text-4xl mb-2">🔔</div>
                  <p className="text-text-secondary">No hay notificaciones</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 border-b border-border hover:bg-primary transition-colors ${
                      !notification.read ? 'bg-accent/5' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="text-lg flex-shrink-0">
                        {getNotificationIcon(notification.type, notification.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${getNotificationColor(notification.action)}`}>
                            {notification.message}
                          </p>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-text-secondary">
                              {formatTime(notification.timestamp)}
                            </span>
                            <button
                              onClick={() => onClearNotification(notification.id)}
                              className="text-text-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {!notification.read && (
                          <button
                            onClick={() => onMarkAsRead(notification.id)}
                            className="text-xs text-accent hover:text-accent-dark mt-1"
                          >
                            Marcar como leída
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;