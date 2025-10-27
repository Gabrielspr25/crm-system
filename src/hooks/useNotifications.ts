import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

export interface Notification {
  id: string;
  type: 'clients' | 'products' | 'salespeople' | 'categories' | 'subscribers' | 'bans' | 'metas';
  action: 'created' | 'updated' | 'deleted';
  data: any;
  timestamp: string;
  message: string;
  read: boolean;
}

export const useNotifications = (socket: Socket | null) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleDataUpdate = (update: {
      type: string;
      action: string;
      data: any;
      timestamp: string;
    }) => {
      const notification: Notification = {
        id: `${update.type}-${update.action}-${Date.now()}`,
        type: update.type as Notification['type'],
        action: update.action as Notification['action'],
        data: update.data,
        timestamp: update.timestamp,
        message: generateNotificationMessage(update.type, update.action, update.data),
        read: false,
      };

      setNotifications(prev => [notification, ...prev].slice(0, 50)); // Mantener solo 50 notificaciones
    };

    socket.on('data-update', handleDataUpdate);

    return () => {
      socket.off('data-update', handleDataUpdate);
    };
  }, [socket]);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const clearNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
  };
};

const generateNotificationMessage = (type: string, action: string, data: any): string => {
  const typeLabels: Record<string, string> = {
    clients: 'Cliente',
    products: 'Producto',
    salespeople: 'Vendedor',
    categories: 'Categoría',
    subscribers: 'Suscriptor',
    bans: 'Ban',
    metas: 'Meta',
  };

  const actionLabels: Record<string, string> = {
    created: 'creado',
    updated: 'actualizado',
    deleted: 'eliminado',
  };

  const typeLabel = typeLabels[type] || type;
  const actionLabel = actionLabels[action] || action;

  const getName = (data: any) => {
    return data?.name || data?.nombre || data?.title || data?.email || `#${data?.id || 'N/A'}`;
  };

  return `${typeLabel} ${getName(data)} ha sido ${actionLabel}`;
};