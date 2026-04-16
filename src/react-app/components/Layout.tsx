import { Link, useLocation, useNavigate } from "react-router";
import { useMemo, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  BarChart3,
  Building2,
  Folder,
  Package,
  FileText,
  CheckSquare,
  UserCircle2,
  Sun,
  Moon,
  Upload,
  Target,
  Mail,
  Layers,
  Activity,
  LayoutDashboard,
  AlertTriangle,
  SendHorizontal,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Mic,
  ShieldCheck,
  KeyRound
} from "lucide-react";


import { useTheme } from "@/react-app/hooks/useTheme";
import { getCurrentUser, clearAuthToken } from "@/react-app/utils/auth";
import { getStoredPermissionSnapshot, isPermissionAllowed } from "@/react-app/utils/permissions";
import { APP_VERSION } from "@/version";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  permissionKey?: string;
  roles?: string[];
  external?: boolean;
};

// VERSION: 2025-01-15-CON-IMPORTADOR-VISUAL

const navigation: NavItem[] = [
  { name: "Panel General", href: "/", icon: LayoutDashboard, permissionKey: "nav.dashboard", roles: ["admin", "supervisor", "vendedor"] },
  { name: "Tareas", href: "/tareas", icon: CheckSquare, permissionKey: "nav.tasks", roles: ["admin", "supervisor", "vendedor"] },
  { name: "Clientes", href: "/clientes", icon: Users, permissionKey: "nav.clients", roles: ["admin", "supervisor", "vendedor"] },
  { name: "Correos", href: "/correos", icon: Mail, permissionKey: "nav.emails", roles: ["admin", "supervisor", "vendedor"] },
  { name: "Campañas", href: "/campanas", icon: SendHorizontal, roles: ["admin"] },
  { name: "Vendedores", href: "/vendedores", icon: Building2, permissionKey: "nav.vendors", roles: ["admin", "supervisor"] },
  { name: "Productos", href: "/productos", icon: Package, permissionKey: "nav.products", roles: ["admin", "supervisor"] },
  { name: "Categorías", href: "/categorias", icon: Folder, roles: ["admin"] },
  { name: "Metas", href: "/metas", icon: Target, permissionKey: "nav.goals", roles: ["admin", "supervisor"] },
  { name: "Comisiones", href: "/reportes", icon: BarChart3, permissionKey: "nav.reports", roles: ["admin", "supervisor", "vendedor"] },
  { name: "Cognos", href: "/discrepancias", icon: AlertTriangle, permissionKey: "nav.cognos", roles: ["admin", "supervisor"] },
  { name: "Historial", href: "/historial", icon: FileText, permissionKey: "nav.audit", roles: ["admin"] },
  { name: "Importador", href: "/importador", icon: Upload, permissionKey: "nav.importer", roles: ["admin", "supervisor"] },
  { name: "Tango", href: "/tango", icon: Activity, permissionKey: "nav.tango", roles: ["admin"] },
  { name: "Reglas y Procesos", href: "/reglas-procesos", icon: FileText, roles: ["admin", "supervisor"], external: true },
  { name: "Perfil", href: "/perfil", icon: UserCircle2, permissionKey: "nav.profile", roles: ["admin", "supervisor", "vendedor"] },
  { name: "Ofertas Web", href: "https://ofertas.ss-group.cloud", icon: Layers, external: true },
];

const commercialSetupHrefs = new Set(["/vendedores", "/productos", "/categorias"]);

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [authSnapshot, setAuthSnapshot] = useState(() => getCurrentUser());
  const role = String(authSnapshot?.role || "admin");
  const roleNormalized = role.trim().toLowerCase();
  const userLabel = authSnapshot?.salespersonName || authSnapshot?.username || "Usuario";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commercialOpen, setCommercialOpen] = useState(true);

  // Verificación de versión - CON IMPORTADOR VISUAL
  useEffect(() => {
    console.log(`✅ LAYOUT VERSION: ${APP_VERSION}`);
    console.log('✅ Navigation items:', navigation.map(n => n.name).join(', '));
  }, []);

  useEffect(() => {
    const syncAuthSnapshot = () => {
      setAuthSnapshot(getCurrentUser());
    };

    window.addEventListener('token-updated', syncAuthSnapshot);
    window.addEventListener('storage', syncAuthSnapshot);

    return () => {
      window.removeEventListener('token-updated', syncAuthSnapshot);
      window.removeEventListener('storage', syncAuthSnapshot);
    };
  }, []);

  const filteredNavigation = useMemo(
    () => navigation.filter((item) => !item.roles || item.roles.includes(roleNormalized)),
    [roleNormalized]
  );

  const commercialSetupItems = useMemo(
    () => filteredNavigation.filter((item) => commercialSetupHrefs.has(item.href)),
    [filteredNavigation]
  );

  const primaryNavigationItems = useMemo(
    () => filteredNavigation.filter((item) => !commercialSetupHrefs.has(item.href)),
    [filteredNavigation]
  );

  const handleLogout = () => {
    clearAuthToken();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 transition-colors duration-300">
      {/* Botón Hamburguesa - Solo visible en móvil */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] p-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg shadow-lg hover:bg-slate-700 transition-colors"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay - Solo visible en móvil cuando sidebar abierto */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 dark:bg-slate-800 shadow-xl border-r border-slate-700 dark:border-slate-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex flex-col items-center justify-center py-4 border-b border-slate-700 dark:border-slate-700">
            <div className="text-center">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                VentasPro
              </h1>
              <p className="text-xs text-slate-400">
                {userLabel} · {role.toUpperCase()}
              </p>
              <p className="text-xs font-bold text-green-400 mt-1">
                {APP_VERSION}
              </p>
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-slate-700 dark:border-slate-700">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-blue-600/40 border border-blue-400/40 text-blue-100 flex items-center justify-center font-semibold mr-3 uppercase">
                {userLabel.slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-100 dark:text-slate-100">
                  {userLabel}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-400">
                  {roleNormalized.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Metas del Vendedor removidas - ahora se muestran en Panel General */}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto space-y-1 p-4">
            {primaryNavigationItems.map((item) => {
              const isActive = location.pathname === item.href;
              const className = `
                group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
                ${isActive
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                  : "text-slate-300 dark:text-slate-300 hover:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-100 dark:hover:text-slate-100"
                }
              `;

              const icon = (
                <item.icon
                  className={`
                    mr-3 h-5 w-5 transition-colors duration-200
                    ${isActive ? "text-white" : "text-slate-400 dark:text-slate-400 group-hover:text-slate-300 dark:group-hover:text-slate-300"}
                  `}
                />
              );

              if (item.external) {
                let finalHref = item.href;

                return (
                  <a
                    key={item.name}
                    href={finalHref}
                    target={item.href.startsWith("http") ? "_blank" : undefined}
                    rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className={className}
                    onClick={() => setSidebarOpen(false)}
                  >
                    {icon}
                    {item.name}
                  </a>
                );
              }


              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={className}
                  onClick={() => setSidebarOpen(false)}
                >
                  {icon}
                  {item.name}
                </Link>
              );
            })}

            {commercialSetupItems.length > 0 && (
              <div className="pt-2 mt-2 border-t border-slate-700/70">
                <button
                  type="button"
                  onClick={() => setCommercialOpen((prev) => !prev)}
                  className={`group w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${commercialSetupHrefs.has(location.pathname)
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                    : "text-slate-300 dark:text-slate-300 hover:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-100 dark:hover:text-slate-100"
                    }`}
                >
                  <span className="flex items-center">
                    <Building2
                      className={`mr-3 h-5 w-5 transition-colors duration-200 ${commercialSetupHrefs.has(location.pathname)
                        ? "text-white"
                        : "text-slate-400 dark:text-slate-400 group-hover:text-slate-300 dark:group-hover:text-slate-300"
                        }`}
                    />
                    Gestion
                  </span>
                  {commercialOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                {commercialOpen && (
                  <div className="mt-1 space-y-1 pl-4">
                    {commercialSetupItems.map((item) => {
                      const isActive = location.pathname === item.href;
                      const className = `
                        group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
                        ${isActive
                          ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                          : "text-slate-300 dark:text-slate-300 hover:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-100 dark:hover:text-slate-100"
                        }
                      `;

                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={className}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <item.icon
                            className={`
                              mr-3 h-4 w-4 transition-colors duration-200
                              ${isActive ? "text-white" : "text-slate-400 dark:text-slate-400 group-hover:text-slate-300 dark:group-hover:text-slate-300"}
                            `}
                          />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Theme Toggle */}
          <div className="p-4 border-t border-slate-700 dark:border-slate-700 space-y-3">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-slate-300 dark:text-slate-300 hover:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-100 dark:hover:text-slate-100 rounded-lg transition-all duration-200"
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {isDark ? (
                <>
                  <Sun className="h-5 w-5 mr-2" />
                  Modo Claro
                </>
              ) : (
                <>
                  <Moon className="h-5 w-5 mr-2" />
                  Modo Oscuro
                </>
              )}
            </button>
            <button
              onClick={() => navigate('/system-status')}
              className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-300 hover:text-white bg-blue-900/30 hover:bg-blue-700/70 rounded-lg transition-all duration-200 mb-2"
              title="Diagnóstico completo del sistema"
            >
              <Activity className="h-5 w-5 mr-2" />
              Estado del Sistema
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-red-300 hover:text-white bg-red-900/30 hover:bg-red-700/70 rounded-lg transition-all duration-200"
            >
              Cerrar sesión
            </button>
          </div>

        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <main className="min-h-screen p-6 lg:p-6 pt-20 lg:pt-6">
          <div className="mx-auto max-w-[98%]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
