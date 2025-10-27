import React, { useState } from 'react';
import { BarChart3, Calendar, Database, Home, Bell } from 'lucide-react';
import NotificationsSystem from './NotificationsSystem';

interface MainNavigationProps {
  currentView: 'pipeline' | 'dashboard' | 'calendar';
  onNavigate: (view: 'pipeline' | 'dashboard' | 'calendar') => void;
  currentUser: {
    id: string;
    name: string;
    role: 'admin' | 'vendedor';
  };
}

const MainNavigation: React.FC<MainNavigationProps> = ({ 
  currentView, 
  onNavigate, 
  currentUser 
}) => {
  const navigationItems = [
    {
      id: 'pipeline',
      label: 'Pipeline',
      icon: <Database className="w-5 h-5" />,
      description: 'Gestión de clientes y ventas'
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <BarChart3 className="w-5 h-5" />,
      description: 'Historial de actividades'
    },
    {
      id: 'calendar',
      label: 'Calendario',
      icon: <Calendar className="w-5 h-5" />,
      description: 'Llamadas programadas'
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 rounded-lg p-2">
              <Home className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                CRM Pro
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sistema de gestión comercial
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 group relative ${
                  currentView === item.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={item.description}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
                
                {/* Active indicator */}
                {currentView === item.id && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-1 h-1 bg-blue-600 rounded-full"></div>
                )}
              </button>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <NotificationsSystem 
              currentUser={currentUser}
            />

            {/* User info */}
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-700">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {currentUser.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {currentUser.role}
                </p>
              </div>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainNavigation;