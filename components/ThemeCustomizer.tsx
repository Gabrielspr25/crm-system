import React, { useState, useEffect } from 'react';
import { Theme } from '../types';

interface ThemeCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
  onThemeUpdate?: (theme: Theme) => void;
}

const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({ isOpen, onClose, currentUser, onThemeUpdate }) => {
  const [theme, setTheme] = useState<Theme>({
    mode: 'dark',
    primaryColor: '#10b981',
    bgColor: '#0f172a',
    textColor: '#f8fafc',
    sidebarColor: '#1e293b'
  });

  useEffect(() => {
    if (currentUser?.theme) {
      setTheme(currentUser.theme);
    }
  }, [currentUser]);

  const presetThemes = {
    dark: {
      mode: 'dark' as const,
      primaryColor: '#10b981',
      bgColor: '#0f172a',
      textColor: '#f8fafc',
      sidebarColor: '#1e293b'
    },
    light: {
      mode: 'light' as const,
      primaryColor: '#059669',
      bgColor: '#ffffff',
      textColor: '#1f2937',
      sidebarColor: '#f8fafc'
    },
    blue: {
      mode: 'dark' as const,
      primaryColor: '#3b82f6',
      bgColor: '#1e1b4b',
      textColor: '#e0e7ff',
      sidebarColor: '#312e81'
    },
    purple: {
      mode: 'dark' as const,
      primaryColor: '#8b5cf6',
      bgColor: '#2e1065',
      textColor: '#ede9fe',
      sidebarColor: '#581c87'
    },
    red: {
      mode: 'dark' as const,
      primaryColor: '#ef4444',
      bgColor: '#450a0a',
      textColor: '#fecaca',
      sidebarColor: '#7f1d1d'
    }
  };

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', newTheme.primaryColor);
    root.style.setProperty('--color-bg', newTheme.bgColor);
    root.style.setProperty('--color-text', newTheme.textColor);
    root.style.setProperty('--color-sidebar', newTheme.sidebarColor);
    
    // Apply mode class
    document.body.className = newTheme.mode === 'dark' ? 'dark-mode' : 'light-mode';
    
    setTheme(newTheme);
  };

  const handlePresetClick = (presetTheme: Theme) => {
    applyTheme(presetTheme);
  };

  const handleColorChange = (colorType: keyof Theme, value: string) => {
    const newTheme = { ...theme, [colorType]: value };
    applyTheme(newTheme);
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('No se pudo guardar: usuario no autenticado');
        return;
      }

      const response = await fetch('/api/user/theme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ theme })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Tema guardado exitosamente:', result);
        onThemeUpdate?.(theme);
        onClose();
      } else {
        alert('Error al guardar el tema');
      }
    } catch (error) {
      console.error('Error saving theme:', error);
      alert('Error al guardar el tema');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-secondary rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-text-primary">🎨 Personalizar Tema</h2>
          <button 
            onClick={onClose} 
            className="text-text-secondary hover:text-text-primary text-2xl"
          >
            ×
          </button>
        </div>

        {/* Preset Themes */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-text-primary mb-3">Temas Predefinidos</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(presetThemes).map(([name, presetTheme]) => (
              <button
                key={name}
                onClick={() => handlePresetClick(presetTheme)}
                className="p-3 rounded-lg border-2 hover:border-accent transition-colors"
                style={{
                  backgroundColor: presetTheme.sidebarColor,
                  borderColor: theme.primaryColor === presetTheme.primaryColor ? presetTheme.primaryColor : 'transparent'
                }}
              >
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: presetTheme.primaryColor }}
                  ></div>
                  <span style={{ color: presetTheme.textColor }} className="capitalize font-medium">
                    {name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Colors */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-text-primary">Personalizar Colores</h3>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Color Principal
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={theme.primaryColor}
                  onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                  className="flex-1 bg-tertiary text-text-primary p-2 rounded focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Fondo Principal
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={theme.bgColor}
                  onChange={(e) => handleColorChange('bgColor', e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={theme.bgColor}
                  onChange={(e) => handleColorChange('bgColor', e.target.value)}
                  className="flex-1 bg-tertiary text-text-primary p-2 rounded focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Color del Texto
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={theme.textColor}
                  onChange={(e) => handleColorChange('textColor', e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={theme.textColor}
                  onChange={(e) => handleColorChange('textColor', e.target.value)}
                  className="flex-1 bg-tertiary text-text-primary p-2 rounded focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Color del Menú Lateral
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={theme.sidebarColor}
                  onChange={(e) => handleColorChange('sidebarColor', e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={theme.sidebarColor}
                  onChange={(e) => handleColorChange('sidebarColor', e.target.value)}
                  className="flex-1 bg-tertiary text-text-primary p-2 rounded focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Modo
              </label>
              <div className="flex space-x-4">
                <button
                  onClick={() => handleColorChange('mode', 'dark')}
                  className={`px-4 py-2 rounded ${
                    theme.mode === 'dark' 
                      ? 'bg-accent text-primary' 
                      : 'bg-tertiary text-text-secondary'
                  }`}
                >
                  🌙 Oscuro
                </button>
                <button
                  onClick={() => handleColorChange('mode', 'light')}
                  className={`px-4 py-2 rounded ${
                    theme.mode === 'light' 
                      ? 'bg-accent text-primary' 
                      : 'bg-tertiary text-text-secondary'
                  }`}
                >
                  ☀️ Claro
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 mt-8">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-tertiary text-text-primary rounded hover:bg-opacity-80 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-accent text-primary font-medium rounded hover:bg-opacity-90 transition-colors"
          >
            Guardar Tema
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeCustomizer;