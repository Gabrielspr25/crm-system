import { Link, useLocation } from "react-router";
import { 
  Users, 
  PhoneCall, 
  BarChart3, 
  Building2, 
  Target, 
  Folder, 
  Package,
  Sun,
  Moon
} from "lucide-react";
import { useTheme } from "@/react-app/hooks/useTheme";

const navigation = [
  { name: "Clientes", href: "/", icon: Users },
  { name: "Seguimiento", href: "/seguimiento", icon: PhoneCall },
  { name: "Reportes", href: "/reportes", icon: BarChart3 },
  { name: "Vendedores", href: "/vendedores", icon: Building2 },
  { name: "Metas", href: "/metas", icon: Target },
  { name: "Categorías", href: "/categorias", icon: Folder },
  { name: "Productos", href: "/productos", icon: Package },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800 transition-colors duration-300">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 dark:bg-slate-800 shadow-xl border-r border-slate-700 dark:border-slate-700">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center border-b border-slate-700 dark:border-slate-700">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              VentasPro
            </h1>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => {
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
          <div className="p-4 border-t border-slate-700 dark:border-slate-700">
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
