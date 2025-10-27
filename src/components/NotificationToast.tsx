import React, { useEffect, useState } from 'react';
import { Notification } from '../hooks/useNotifications';

interface NotificationToastProps {
  notification: Notification | null;
  onClose: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      
      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300); // Wait for animation to complete
  };

  if (!notification) return null;

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

  const getToastStyle = (action: string) => {
    const styles: Record<string, string> = {
      created: 'bg-green-500 border-green-600',
      updated: 'bg-blue-500 border-blue-600',
      deleted: 'bg-red-500 border-red-600',
    };
    return styles[action] || 'bg-gray-500 border-gray-600';
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] pointer-events-none">
      <div
        className={`pointer-events-auto transform transition-all duration-300 ease-in-out ${
          isVisible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
        }`}
      >
        <div className={`max-w-sm w-full ${getToastStyle(notification.action)} shadow-lg rounded-lg border`}>
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="text-white text-xl">
                  {getNotificationIcon(notification.type, notification.action)}
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-white">
                  {notification.message}
                </p>
                <p className="mt-1 text-xs text-white/80">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  onClick={handleClose}
                  className="inline-flex text-white hover:text-gray-200 focus:outline-none focus:text-gray-200 transition ease-in-out duration-150"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationToast;