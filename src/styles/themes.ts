// 🎨 Múltiples temas disponibles
export interface Theme {
  id: string;
  name: string;
  description: string;
  preview: string; // Color de preview
  colors: {
    // Colores de fondo
    background: {
      primary: string;
      secondary: string;
      tertiary: string;
      card: string;
      hover: string;
    };
    // Colores de texto
    text: {
      primary: string;
      secondary: string;
      muted: string;
      accent: string;
    };
    // Colores de inputs
    input: {
      bg: string;
      border: string;
      text: string;
      placeholder: string;
      focus: string;
    };
    // Colores de botones
    button: {
      primary: string;
      primaryHover: string;
      secondary: string;
      secondaryHover: string;
    };
    // Bordes
    border: {
      primary: string;
      secondary: string;
      accent: string;
    };
  };
}

// 🌟 Temas disponibles
export const availableThemes: Theme[] = [
  {
    id: 'green-dark',
    name: '🌲 Verde Oscuro',
    description: 'Tema oscuro con acentos verdes (actual)',
    preview: '#22c55e',
    colors: {
      background: {
        primary: '#0f172a',
        secondary: '#1e293b',
        tertiary: '#334155',
        card: '#1e293b',
        hover: '#334155',
      },
      text: {
        primary: '#f8fafc',
        secondary: '#cbd5e1',
        muted: '#64748b',
        accent: '#22c55e',
      },
      input: {
        bg: '#22c55e',
        border: '#16a34a',
        text: '#ffffff',
        placeholder: '#dcfce7',
        focus: '#4ade80',
      },
      button: {
        primary: '#22c55e',
        primaryHover: '#16a34a',
        secondary: '#334155',
        secondaryHover: '#475569',
      },
      border: {
        primary: '#475569',
        secondary: '#64748b',
        accent: '#22c55e',
      },
    },
  },
  {
    id: 'blue-dark',
    name: '💙 Azul Oscuro',
    description: 'Tema oscuro con acentos azules',
    preview: '#3b82f6',
    colors: {
      background: {
        primary: '#0f172a',
        secondary: '#1e293b',
        tertiary: '#334155',
        card: '#1e293b',
        hover: '#334155',
      },
      text: {
        primary: '#f8fafc',
        secondary: '#cbd5e1',
        muted: '#64748b',
        accent: '#3b82f6',
      },
      input: {
        bg: '#3b82f6',
        border: '#2563eb',
        text: '#ffffff',
        placeholder: '#dbeafe',
        focus: '#60a5fa',
      },
      button: {
        primary: '#3b82f6',
        primaryHover: '#2563eb',
        secondary: '#334155',
        secondaryHover: '#475569',
      },
      border: {
        primary: '#475569',
        secondary: '#64748b',
        accent: '#3b82f6',
      },
    },
  },
  {
    id: 'purple-dark',
    name: '💜 Púrpura Oscuro',
    description: 'Tema oscuro con acentos púrpura',
    preview: '#a855f7',
    colors: {
      background: {
        primary: '#0f172a',
        secondary: '#1e293b',
        tertiary: '#334155',
        card: '#1e293b',
        hover: '#334155',
      },
      text: {
        primary: '#f8fafc',
        secondary: '#cbd5e1',
        muted: '#64748b',
        accent: '#a855f7',
      },
      input: {
        bg: '#a855f7',
        border: '#9333ea',
        text: '#ffffff',
        placeholder: '#e9d5ff',
        focus: '#c084fc',
      },
      button: {
        primary: '#a855f7',
        primaryHover: '#9333ea',
        secondary: '#334155',
        secondaryHover: '#475569',
      },
      border: {
        primary: '#475569',
        secondary: '#64748b',
        accent: '#a855f7',
      },
    },
  },
  {
    id: 'orange-dark',
    name: '🧡 Naranja Oscuro',
    description: 'Tema oscuro con acentos naranja',
    preview: '#f59e0b',
    colors: {
      background: {
        primary: '#0f172a',
        secondary: '#1e293b',
        tertiary: '#334155',
        card: '#1e293b',
        hover: '#334155',
      },
      text: {
        primary: '#f8fafc',
        secondary: '#cbd5e1',
        muted: '#64748b',
        accent: '#f59e0b',
      },
      input: {
        bg: '#f59e0b',
        border: '#d97706',
        text: '#ffffff',
        placeholder: '#fef3c7',
        focus: '#fbbf24',
      },
      button: {
        primary: '#f59e0b',
        primaryHover: '#d97706',
        secondary: '#334155',
        secondaryHover: '#475569',
      },
      border: {
        primary: '#475569',
        secondary: '#64748b',
        accent: '#f59e0b',
      },
    },
  },
  {
    id: 'red-dark',
    name: '❤️ Rojo Oscuro',
    description: 'Tema oscuro con acentos rojos',
    preview: '#ef4444',
    colors: {
      background: {
        primary: '#0f172a',
        secondary: '#1e293b',
        tertiary: '#334155',
        card: '#1e293b',
        hover: '#334155',
      },
      text: {
        primary: '#f8fafc',
        secondary: '#cbd5e1',
        muted: '#64748b',
        accent: '#ef4444',
      },
      input: {
        bg: '#ef4444',
        border: '#dc2626',
        text: '#ffffff',
        placeholder: '#fecaca',
        focus: '#f87171',
      },
      button: {
        primary: '#ef4444',
        primaryHover: '#dc2626',
        secondary: '#334155',
        secondaryHover: '#475569',
      },
      border: {
        primary: '#475569',
        secondary: '#64748b',
        accent: '#ef4444',
      },
    },
  },
  {
    id: 'light-theme',
    name: '☀️ Tema Claro',
    description: 'Tema claro tradicional',
    preview: '#ffffff',
    colors: {
      background: {
        primary: '#ffffff',
        secondary: '#f8fafc',
        tertiary: '#e2e8f0',
        card: '#ffffff',
        hover: '#f1f5f9',
      },
      text: {
        primary: '#0f172a',
        secondary: '#475569',
        muted: '#64748b',
        accent: '#22c55e',
      },
      input: {
        bg: '#ffffff',
        border: '#d1d5db',
        text: '#0f172a',
        placeholder: '#9ca3af',
        focus: '#22c55e',
      },
      button: {
        primary: '#22c55e',
        primaryHover: '#16a34a',
        secondary: '#e2e8f0',
        secondaryHover: '#cbd5e1',
      },
      border: {
        primary: '#e2e8f0',
        secondary: '#cbd5e1',
        accent: '#22c55e',
      },
    },
  },
];
