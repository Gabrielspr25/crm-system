import React from 'react';
import { Page, Salesperson } from '../types';
import HomeIcon from './icons/HomeIcon';
import UserGroupIcon from './icons/UserGroupIcon';
import CubeIcon from './icons/CubeIcon';
import BriefcaseIcon from './icons/BriefcaseIcon';
import SimIcon from './icons/SimIcon';
import ViewColumnsIcon from './icons/ViewColumnsIcon';
import CurrencyDollarIcon from './icons/CurrencyDollarIcon';
import UploadIcon from './icons/UploadIcon';
import ListBulletIcon from './icons/ListBulletIcon';
import LogoutIcon from './icons/LogoutIcon';
import TargetIcon from './icons/TargetIcon';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  currentUser: Salesperson;
  onLogout: () => void;
  availablePages: Page[];
  onOpenThemeCustomizer?: () => void;
  notificationCenter?: React.ReactNode;
}

const NavLink: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => {
  const baseClasses = "flex items-center px-4 py-3 my-1 transition-colors duration-200 rounded-lg";
  const activeClasses = "bg-tertiary text-accent";
  const inactiveClasses = "text-text-secondary hover:bg-tertiary hover:text-text-primary";
  
  return (
    <a
      href="#"
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      {icon}
      <span className="ml-4 font-medium">{label}</span>
    </a>
  );
};

const navItems: { page: Page, label: string, icon: React.ReactNode }[] = [
    { page: 'Dashboard', label: 'Dashboard', icon: <HomeIcon /> },
    { page: 'Clients', label: 'Clientes', icon: <UserGroupIcon /> },
    { page: 'Vendedores', label: 'Vendedores', icon: <BriefcaseIcon /> },
    { page: 'Products', label: 'Productos', icon: <CubeIcon /> },
    { page: 'Bans', label: 'GestiÃ³n de BANs', icon: <SimIcon /> },
    { page: 'Pipeline', label: 'Pipeline', icon: <ViewColumnsIcon /> },
    { page: 'Finances', label: 'Finanzas', icon: <CurrencyDollarIcon /> },
    { page: 'Metas', label: 'Metas', icon: <TargetIcon /> },
    { page: 'Subscribers', label: 'Suscriptores', icon: <ListBulletIcon /> },
    { page: 'ImportData', label: 'Importar Datos', icon: <UploadIcon /> },
];


const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, currentUser, onLogout, availablePages, onOpenThemeCustomizer, notificationCenter }) => {
  return (
    <aside className="w-64 flex-shrink-0 bg-secondary p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-10 px-4">
          <div className="flex items-center">
           <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6V4m0 16v-2M8 12a4 4 0 118 0 4 4 0 01-8 0z" /></svg>
           <h1 className="text-xl font-bold ml-2 text-text-primary">CRM Pro</h1>
          </div>
          {notificationCenter && (
            <div>
              {notificationCenter}
            </div>
          )}
        </div>
        <nav>
            {navItems.filter(item => availablePages.includes(item.page)).map(item => (
                 <NavLink 
                    key={item.page}
                    icon={item.icon} 
                    label={item.label} 
                    isActive={activePage === item.page} 
                    onClick={() => setActivePage(item.page)} 
                />
            ))}
        </nav>
      </div>
      <div className="border-t border-tertiary pt-4">
        <div className="flex items-center px-4">
            <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover" />
            <div className="ml-3">
                <p className="text-sm font-semibold text-text-primary">{currentUser.name}</p>
                <p className="text-xs text-text-secondary capitalize">{currentUser.role}</p>
            </div>
        </div>
        
        {/* Botón de metas personales removido - ahora en header superior */}
        
        {/* Botón de personalizar tema */}
        {onOpenThemeCustomizer && (
          <button 
            onClick={onOpenThemeCustomizer}
            className="w-full flex items-center mt-2 px-4 py-3 text-text-secondary hover:bg-tertiary hover:text-accent rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
            </svg>
            <span className="ml-4 font-medium">🎨 Personalizar</span>
          </button>
        )}
        
        <button onClick={onLogout} className="w-full flex items-center mt-2 px-4 py-3 text-text-secondary hover:bg-tertiary hover:text-red-400 rounded-lg transition-colors">
            <LogoutIcon />
            <span className="ml-4 font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;