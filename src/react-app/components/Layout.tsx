import { Link, useLocation, useNavigate } from "react-router";
import { useMemo, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  PhoneCall,
  BarChart3,
  Building2,
  Folder,
  Package,
  FileText,
  UserCircle2,
  Sun,
  Moon,
  Upload,
  Target
} from "lucide-react";
import { useTheme } from "@/react-app/hooks/useTheme";
import { getCurrentRole, getCurrentUser, clearAuthToken } from "@/react-app/utils/auth";
import { useApi } from "@/react-app/hooks/useApi";
import { APP_VERSION } from "@/version";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
};

// VERSION: 2025-01-15-CON-IMPORTADOR-VISUAL
const navigation: NavItem[] = [
  { name: "Clientes", href: "/", icon: Users, roles: ["admin", "supervisor", "vendedor"] },
  { name: "Seguimiento", href: "/seguimiento", icon: PhoneCall, roles: ["admin", "supervisor", "vendedor"] },
  { name: "Reportes", href: "/reportes", icon: BarChart3, roles: ["admin", "supervisor", "vendedor"] },
  { name: "Vendedores", href: "/vendedores", icon: Building2, roles: ["admin", "supervisor"] },
  { name: "Categorías", href: "/categorias", icon: Folder, roles: ["admin"] },
  { name: "Productos", href: "/productos", icon: Package, roles: ["admin", "supervisor"] },
  { name: "Metas", href: "/metas", icon: Target, roles: ["admin", "supervisor"] },
  { name: "Importador", href: "/importador", icon: Upload, roles: ["admin", "supervisor"] },
  { name: "Historial", href: "/historial", icon: FileText, roles: ["admin"] },
  { name: "Perfil", href: "/perfil", icon: UserCircle2, roles: ["admin", "supervisor", "vendedor"] }
];

interface LayoutProps {
  children: React.ReactNode;
}

interface Goal {
  id: number;
  vendor_id: number | null;
  vendor_name: string | null;
  product_id: number | null;
  product_name: string | null;
  period_type: string;
  period_year: number;
  period_month: number | null;
  period_quarter: number | null;
  target_amount: number;
  current_amount: number;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// Función para calcular días laborables (lunes a viernes) restantes en el mes
function getWorkingDaysRemaining(): number {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  // Último día del mes
  const lastDay = new Date(currentYear, currentMonth + 1, 0);

  let workingDays = 0;
  const currentDate = new Date(today);

  // Iterar desde hoy hasta el último día del mes
  while (currentDate <= lastDay) {
    const dayOfWeek = currentDate.getDay();
    // 1 = lunes, 5 = viernes
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      workingDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return workingDays;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const role = getCurrentRole() ?? "admin";
  const user = useMemo(() => getCurrentUser(), []);
  const userLabel = user?.salespersonName || user?.username || "Usuario";
  const isVendor = role.toLowerCase() === "vendedor";
  const [goalFilter, setGoalFilter] = useState("");

  // Obtener metas del vendedor para el mes actual
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const goalsUrl = isVendor ? `/api/goals?period_year=${currentYear}&period_month=${currentMonth}` : '/api/goals?period_year=0&period_month=0';
  const { data: vendorGoals } = useApi<Goal[]>(goalsUrl, { immediate: isVendor });

  // Calcular resumen de metas por producto
  const goalsByProduct = useMemo(() => {
    if (!isVendor || !vendorGoals || vendorGoals.length === 0) {
      return [];
    }

    const workingDaysRemaining = getWorkingDaysRemaining();

    // Agrupar metas por producto
    const productMap = new Map<number, { productName: string; target: number; current: number }>();

    vendorGoals.forEach((goal) => {
      const productId = goal.product_id || 0;
      const productName = goal.product_name || 'Sin producto';

      if (!productMap.has(productId)) {
        productMap.set(productId, {
          productName,
          target: 0,
          current: 0
        });
      }

      const product = productMap.get(productId)!;
      product.target += goal.target_amount;
      product.current += goal.current_amount;
    });

    // Convertir a array y calcular métricas por producto
    return Array.from(productMap.entries()).map(([productId, product]) => {
      const remaining = product.target - product.current;
      const dailyGoal = workingDaysRemaining > 0 ? remaining / workingDaysRemaining : 0;
      const progress = product.target > 0 ? (product.current / product.target) * 100 : 0;

      return {
        productId,
        productName: product.productName,
        target: product.target,
        current: product.current,
        remaining,
        dailyGoal,
        progress,
        workingDaysRemaining
      };
    });
  }, [isVendor, vendorGoals]);

  // Verificación de versión - CON IMPORTADOR VISUAL
  useEffect(() => {
    console.log('✅ LAYOUT VERSION: (v5.0 DEBUG)');
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
                  {role.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Metas del Vendedor - Solo para vendedores */}
          {isVendor && goalsByProduct.length > 0 && (
            <div className="p-4 border-b border-slate-700 dark:border-slate-700 space-y-3 max-h-[400px] overflow-y-auto">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-white">Mis Metas</h3>
              </div>

              <input
                type="text"
                placeholder="Filtrar producto..."
                value={goalFilter}
                onChange={(e) => setGoalFilter(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-slate-200 mb-2 focus:ring-1 focus:ring-blue-500"
              />

              <div className="bg-gradient-to-br from-emerald-900/40 to-blue-900/40 border border-emerald-500/30 rounded-lg p-3 shadow-lg space-y-4">
                {goalsByProduct
                  .filter(g => g.productName.toLowerCase().includes(goalFilter.toLowerCase()))
                  .map(productGoal => (
                    <div key={productGoal.productId} className="border-b border-slate-700/50 last:border-0 pb-3 last:pb-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-emerald-300 truncate max-w-[60%]" title={productGoal.productName}>
                          {productGoal.productName}
                        </span>
                        <span className="text-[10px] font-bold text-white">
                          {productGoal.progress.toFixed(1)}%
                        </span>
                      </div>

                      <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(productGoal.progress, 100)}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{productGoal.current.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} / {productGoal.target.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        <span className="text-blue-400">Diaria: ${productGoal.dailyGoal.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  ))}
                {goalsByProduct.filter(g => g.productName.toLowerCase().includes(goalFilter.toLowerCase())).length === 0 && (
                  <p className="text-xs text-slate-500 text-center">No hay productos.</p>
                )}
              </div>

              {goalsByProduct.length > 0 && (
                <p className="text-[10px] text-slate-400 text-center pt-1">
                  {goalsByProduct[0].workingDaysRemaining} días laborables restantes
                </p>
              )}
            </div>
          )}

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
                    ${isActive
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
            <div className="text-center pt-1">
              <p className="text-xs font-bold text-green-400 mt-1">{APP_VERSION}</p>
            </div>
          </div>

        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="min-h-screen p-6">
          <div className="mx-auto max-w-[98%]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
