import { Link, useLocation, useNavigate } from "react-router";
import { useMemo, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  PhoneCall,
  BarChart3,
  Building2,
  Folder,
  Package,
  UserCircle2,
  Sun,
  Moon
} from "lucide-react";
import { useTheme } from "@/react-app/hooks/useTheme";
import { getCurrentRole, getCurrentUser, clearAuthToken } from "@/react-app/utils/auth";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
};

// VERSION: 2025-01-15-SIN-METAS-SIN-IMPORTADOR-V4
const navigation: NavItem[] = [
  { name: "Clientes", href: "/", icon: Users, roles: ["admin", "supervisor", "vendedor"] },
  { name: "Seguimiento", href: "/seguimiento", icon: PhoneCall, roles: ["admin", "supervisor", "vendedor"] },
  { name: "Reportes", href: "/reportes", icon: BarChart3, roles: ["admin", "supervisor"] },
  { name: "Vendedores", href: "/vendedores", icon: Building2, roles: ["admin", "supervisor"] },
  { name: "Categorías", href: "/categorias", icon: Folder, roles: ["admin"] },
  { name: "Productos", href: "/productos", icon: Package, roles: ["admin", "supervisor"] },
  { name: "Perfil", href: "/perfil", icon: UserCircle2, roles: ["admin", "supervisor", "vendedor"] }
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const role = getCurrentRole() ?? "admin";
  const user = useMemo(() => getCurrentUser(), []);
  const userLabel = user?.salespersonName || user?.username || "Usuario";

  // Verificación de versión - SIN MAPEO
  useEffect(() => {
    console.log('✅ LAYOUT VERSION: 2025-01-15-SIN-MAPEO');
    console.log('✅ Navigation items:', navigation.map(n => n.name).join(', '));
  }, []);

  const filteredNavigation = useMemo(
    () => navigation.filter((item) => !item.roles || item.roles.includes(role)),
    [role]
  );

  const handleLogout = () => {
    clearAuthToken();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 transition-colors duration-300">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 dark:bg-slate-800 shadow-xl border-r border-slate-700 dark:border-slate-700">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center border-b border-slate-700 dark:border-slate-700">
            <div className="text-center">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                VentasPro
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {userLabel} · {role.toUpperCase()}
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
                  {role.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {filteredNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
                    ${
                      isActive
                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                        : "text-slate-300 dark:text-slate-300 hover:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-100 dark:hover:text-slate-100"
                    }
                  `}
                >
                  <item.icon
                    className={`
                      mr-3 h-5 w-5 transition-colors duration-200
                      ${isActive ? "text-white" : "text-slate-400 dark:text-slate-400 group-hover:text-slate-300 dark:group-hover:text-slate-300"}
                    `}
                  />
                  {item.name}
                </Link>
              );
            })}
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
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-red-300 hover:text-white bg-red-900/30 hover:bg-red-700/70 rounded-lg transition-all duration-200"
            >
              Cerrar sesión
            </button>
          </div>

        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="min-h-screen p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
