// 🎨 Paleta de Colores Personalizada CRM Pro
export const colors = {
  // Colores principales del tema
  primary: {
    50: '#f0fdf4',   // Verde muy claro
    100: '#dcfce7',  // Verde claro
    200: '#bbf7d0',  // Verde suave
    300: '#86efac',  // Verde medio claro
    400: '#4ade80',  // Verde medio
    500: '#22c55e',  // Verde principal
    600: '#16a34a',  // Verde fuerte
    700: '#15803d',  // Verde oscuro
    800: '#166534',  // Verde muy oscuro
    900: '#14532d',  // Verde casi negro
  },
  
  // Colores de fondo
  background: {
    primary: '#0f172a',    // Fondo principal (slate-900)
    secondary: '#1e293b',  // Fondo secundario (slate-800)
    tertiary: '#334155',   // Fondo terciario (slate-700)
    card: '#1e293b',       // Fondo de cards
    hover: '#334155',      // Fondo hover
  },
  
  // Colores de texto
  text: {
    primary: '#f8fafc',    // Texto principal (blanco)
    secondary: '#cbd5e1',  // Texto secundario (gris claro)
    muted: '#64748b',      // Texto desactivado (gris)
    accent: '#22c55e',     // Texto de acento (verde)
    error: '#ef4444',      // Texto de error (rojo)
    warning: '#f59e0b',    // Texto de advertencia (amarillo)
    success: '#10b981',    // Texto de éxito (verde)
  },
  
  // Colores de bordes
  border: {
    primary: '#475569',    // Borde principal
    secondary: '#64748b',  // Borde secundario
    accent: '#22c55e',     // Borde de acento
    error: '#ef4444',      // Borde de error
  },
  
  // Colores de botones
  button: {
    primary: {
      bg: '#22c55e',       // Fondo botón principal
      hover: '#16a34a',    // Hover botón principal
      text: '#ffffff',     // Texto botón principal
    },
    secondary: {
      bg: '#334155',       // Fondo botón secundario
      hover: '#475569',    // Hover botón secundario
      text: '#cbd5e1',     // Texto botón secundario
    },
    danger: {
      bg: '#ef4444',       // Fondo botón peligro
      hover: '#dc2626',    // Hover botón peligro
      text: '#ffffff',     // Texto botón peligro
    }
  },
  
  // Colores de inputs
  input: {
    bg: '#22c55e',         // Fondo verde para inputs
    border: '#16a34a',     // Borde verde para inputs
    text: '#ffffff',       // Texto blanco en inputs
    placeholder: '#dcfce7', // Placeholder verde claro
    focus: '#4ade80',      // Color de focus
  },
  
  // Colores por categorías de negocio
  categories: {
    claro_tv: '#3b82f6',   // Azul
    fijo: '#22c55e',       // Verde
    movil: '#a855f7',      // Púrpura
    cloud: '#6366f1',      // Índigo
    pos: '#f59e0b',        // Naranja
  },
  
  // Estados y notificaciones
  status: {
    success: '#10b981',    // Verde éxito
    warning: '#f59e0b',    // Amarillo advertencia
    error: '#ef4444',      // Rojo error
    info: '#3b82f6',       // Azul información
  }
};

// 🎨 Clases CSS predefinidas para fácil uso
export const cssClasses = {
  // Contenedores
  container: 'bg-slate-900 min-h-screen',
  card: 'bg-slate-800 border border-slate-600 rounded-lg p-6',
  cardHeader: 'border-b border-slate-700 pb-4',
  
  // Texto
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-500',
  textAccent: 'text-green-500',
  
  // Botones
  btnPrimary: 'bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md transition-colors',
  btnSecondary: 'bg-slate-700 hover:bg-slate-600 text-slate-300 px-6 py-2 rounded-md transition-colors',
  btnDanger: 'bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md transition-colors',
  
  // Inputs
  input: 'bg-green-600 border border-green-500 text-white placeholder-green-200 rounded-md focus:ring-2 focus:ring-green-400 focus:border-transparent',
  inputLabel: 'text-sm font-medium text-slate-300',
  
  // Estados
  success: 'bg-green-800 text-green-300 border-green-700',
  warning: 'bg-yellow-800 text-yellow-300 border-yellow-700',
  error: 'bg-red-800 text-red-300 border-red-700',
  info: 'bg-blue-800 text-blue-300 border-blue-700',
};
