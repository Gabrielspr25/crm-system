import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ClientsPage from './pages/ClientsPage';
import ProductsPage from './pages/ProductsPage';
import VendedoresPage from './pages/VendedoresPage';
import BansPage from './pages/BansPage';
import PipelinePage from './pages/PipelinePage';
import FinancesPage from './pages/FinancesPage';
import ImportDataPage from './pages/ImportDataPage';
import SubscribersPage from './pages/SubscribersPage';
import MetasPage from './pages/MetasPage';
import LoginPage from './pages/LoginPage';
import ThemeCustomizer from './components/ThemeCustomizer';
import VendedorMetasProfile from './components/VendedorMetasProfile';
import NotificationCenter from './components/NotificationCenter';
import NotificationToast from './components/NotificationToast';
import { Page, Salesperson, Theme } from './types';
import { useCrmData } from './hooks/useCrmData';
import { useSocket } from './hooks/useSocket';
import { useNotifications, Notification } from './hooks/useNotifications';

const App: React.FC = () => {
  const crmData = useCrmData();
  const [currentUser, setCurrentUser] = useState<Salesperson | null>(null);
  const [activePage, setActivePage] = useState<Page>('Dashboard');
  const [isThemeCustomizerOpen, setIsThemeCustomizerOpen] = useState(false);
  const [isMetasProfileOpen, setIsMetasProfileOpen] = useState(false);
  const [currentToast, setCurrentToast] = useState<Notification | null>(null);
  
  // Socket.IO connection
  const socket = useSocket(''); // URL relativa, mismo dominio
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
  } = useNotifications(socket);

  // When user logs out, reset active page to their dashboard
  useEffect(() => {
    if (!currentUser) {
      setActivePage('Dashboard');
    } else if (currentUser.theme) {
      // Aplicar tema del usuario al cargar
      applyTheme(currentUser.theme);
    }
  }, [currentUser]);
  
  // Show toast notifications for new updates
  useEffect(() => {
    if (notifications.length > 0 && !currentToast) {
      const latestNotification = notifications[0];
      if (!latestNotification.read) {
        setCurrentToast(latestNotification);
      }
    }
  }, [notifications, currentToast]);
  
  const handleLogin = (user: Salesperson, token: string) => {
    setCurrentUser(user);
    // Apply user theme if available
    if (user.theme) {
      applyTheme(user.theme);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    // Clear stored data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Reset theme to default
    applyTheme({
      mode: 'dark',
      primaryColor: '#10b981',
      bgColor: '#0f172a',
      textColor: '#f8fafc',
      sidebarColor: '#1e293b'
    });
  };

  // Function to apply theme
  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    
    // Aplicar variables CSS principales
    root.style.setProperty('--color-primary', theme.primaryColor);
    root.style.setProperty('--color-bg', theme.bgColor);
    root.style.setProperty('--color-text', theme.textColor);
    root.style.setProperty('--color-sidebar', theme.sidebarColor);
    
    // Aplicar variables derivadas
    root.style.setProperty('--color-accent', theme.primaryColor);
    root.style.setProperty('--color-text-primary', theme.textColor);
    
    // Aplicar clase de modo
    document.body.className = theme.mode === 'dark' ? 'dark-mode' : 'light-mode';
    
    console.log('🎨 Tema aplicado:', theme);
  };
  
  // Function to handle theme updates
  const handleThemeUpdate = (newTheme: Theme) => {
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        theme: newTheme
      });
    }
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }
  
    // Filter pages based on user role
    const availablePages: Page[] = ['Dashboard', 'Clients', 'Products', 'Bans', 'Pipeline', 'Subscribers', 'ImportData'];
    if (currentUser.role === 'admin') {
      availablePages.push('Vendedores', 'Metas', 'Finances');
    }

  const renderContent = () => {
    // If the active page is not available for the current user, default to Dashboard
    const pageToRender = availablePages.includes(activePage) ? activePage : 'Dashboard';

    switch (pageToRender) {
      case 'Dashboard':
        return <Dashboard crmData={crmData} currentUser={currentUser} />;
      case 'Clients':
        return <ClientsPage crmData={crmData} currentUser={currentUser} />;
      case 'Products':
        return <ProductsPage crmData={crmData} />;
      case 'Vendedores':
        return <VendedoresPage crmData={crmData} currentUser={currentUser} />;
      case 'Bans':
        return <BansPage crmData={crmData} />;
      case 'Pipeline':
        return <PipelinePage crmData={crmData} currentUser={currentUser} />;
      case 'Finances':
        return <FinancesPage crmData={crmData} />;
      case 'Metas':
        return <MetasPage crmData={crmData} currentUser={currentUser} />;
      case 'ImportData':
        return <ImportDataPage crmData={crmData} />;
      case 'Subscribers':
        return <SubscribersPage crmData={crmData} />;
      default:
        return <Dashboard crmData={crmData} currentUser={currentUser} />;
    }
  };

  return (
    <div className="flex h-screen bg-primary font-sans">
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        currentUser={currentUser}
        onLogout={handleLogout}
        availablePages={availablePages}
        onOpenThemeCustomizer={() => setIsThemeCustomizerOpen(true)}
        notificationCenter={
          <NotificationCenter
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onClearNotification={clearNotification}
            onClearAll={clearAllNotifications}
          />
        }
      />
      <div className="flex-1 flex flex-col">
        {/* Header superior */}
        {currentUser.role === 'vendedor' && (
          <div className="bg-secondary border-b border-border px-4 sm:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <h1 className="text-base sm:text-lg font-semibold text-text-primary">
                  Panel de {currentUser.name}
                </h1>
              </div>
              <button
                onClick={() => setIsMetasProfileOpen(true)}
                className="flex items-center px-3 sm:px-4 py-2 bg-accent text-primary font-medium rounded-lg hover:bg-sky-300 transition-colors text-sm sm:text-base"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="hidden sm:inline">🎯 Mis Metas</span>
                <span className="sm:hidden">🎯</span>
              </button>
            </div>
          </div>
        )}
        
        {/* Contenido principal */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {renderContent()}
        </main>
      </div>
      
      {/* Theme Customizer */}
      <ThemeCustomizer
        isOpen={isThemeCustomizerOpen}
        onClose={() => setIsThemeCustomizerOpen(false)}
        currentUser={currentUser}
        onThemeUpdate={handleThemeUpdate}
      />
      
      {/* Metas Profile Modal */}
      <VendedorMetasProfile
        isOpen={isMetasProfileOpen}
        onClose={() => setIsMetasProfileOpen(false)}
        currentUser={currentUser}
        crmData={crmData}
      />
      
      {/* Toast Notifications */}
      <NotificationToast
        notification={currentToast}
        onClose={() => setCurrentToast(null)}
      />
    </div>
  );
};

export default App;
