import React, { createContext, useContext, useState, useEffect } from 'react';
import { Theme, availableThemes } from '../styles/themes';

interface ThemeContextType {
  currentTheme: Theme;
  availableThemes: Theme[];
  changeTheme: (themeId: string) => void;
  resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

// Provider que envuelve toda la aplicación
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Cargar tema guardado o usar por defecto
  const getStoredTheme = (): Theme => {
    try {
      const stored = localStorage.getItem('crm-theme');
      if (stored) {
        const themeId = JSON.parse(stored);
        return availableThemes.find(t => t.id === themeId) || availableThemes[0];
      }
    } catch (error) {
      console.warn('Error loading theme from localStorage:', error);
    }
    return availableThemes[0]; // Verde oscuro por defecto
  };

  const [currentTheme, setCurrentTheme] = useState<Theme>(getStoredTheme);

  // Función para cambiar tema
  const changeTheme = (themeId: string) => {
    const theme = availableThemes.find(t => t.id === themeId);
    if (theme) {
      setCurrentTheme(theme);
      localStorage.setItem('crm-theme', JSON.stringify(themeId));
    }
  };

  // Función para resetear al tema por defecto
  const resetToDefault = () => {
    setCurrentTheme(availableThemes[0]);
    localStorage.removeItem('crm-theme');
  };

  // Aplicar colores como CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const theme = currentTheme.colors;
    
    // Aplicar variables CSS dinámicamente
    root.style.setProperty('--bg-primary', theme.background.primary);
    root.style.setProperty('--bg-secondary', theme.background.secondary);
    root.style.setProperty('--bg-tertiary', theme.background.tertiary);
    root.style.setProperty('--bg-card', theme.background.card);
    root.style.setProperty('--bg-hover', theme.background.hover);
    
    root.style.setProperty('--text-primary', theme.text.primary);
    root.style.setProperty('--text-secondary', theme.text.secondary);
    root.style.setProperty('--text-muted', theme.text.muted);
    root.style.setProperty('--text-accent', theme.text.accent);
    
    root.style.setProperty('--input-bg', theme.input.bg);
    root.style.setProperty('--input-border', theme.input.border);
    root.style.setProperty('--input-text', theme.input.text);
    root.style.setProperty('--input-placeholder', theme.input.placeholder);
    root.style.setProperty('--input-focus', theme.input.focus);
    
    root.style.setProperty('--btn-primary', theme.button.primary);
    root.style.setProperty('--btn-primary-hover', theme.button.primaryHover);
    root.style.setProperty('--btn-secondary', theme.button.secondary);
    root.style.setProperty('--btn-secondary-hover', theme.button.secondaryHover);
    
    root.style.setProperty('--border-primary', theme.border.primary);
    root.style.setProperty('--border-secondary', theme.border.secondary);
    root.style.setProperty('--border-accent', theme.border.accent);
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{
      currentTheme,
      availableThemes,
      changeTheme,
      resetToDefault
    }}>
      <div 
        style={{
          backgroundColor: currentTheme.colors.background.primary,
          color: currentTheme.colors.text.primary,
          minHeight: '100vh'
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

// Hook para usar el tema en cualquier componente
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
