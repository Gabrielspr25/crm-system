import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({ isOpen, onClose }) => {
  const { currentTheme, availableThemes, changeTheme, resetToDefault } = useTheme();
  const [previewTheme, setPreviewTheme] = useState(currentTheme.id);

  if (!isOpen) return null;

  const handleThemeSelect = (themeId: string) => {
    changeTheme(themeId);
    setPreviewTheme(themeId);
  };

  const handleReset = () => {
    resetToDefault();
    setPreviewTheme(availableThemes[0].id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div 
        className="w-full max-w-4xl mx-4 rounded-lg shadow-xl overflow-hidden"
        style={{
          backgroundColor: currentTheme.colors.background.secondary,
          border: `1px solid ${currentTheme.colors.border.primary}`,
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div 
          className="p-6 border-b"
          style={{ 
            borderColor: currentTheme.colors.border.primary,
            backgroundColor: currentTheme.colors.background.card 
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 
                className="text-2xl font-bold"
                style={{ color: currentTheme.colors.text.primary }}
              >
                🎨 Personalizar Tema
              </h2>
              <p 
                className="text-sm mt-1"
                style={{ color: currentTheme.colors.text.secondary }}
              >
                Elige el color y estilo que más te guste para tu CRM
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full transition-colors"
              style={{ 
                backgroundColor: currentTheme.colors.background.hover,
                color: currentTheme.colors.text.secondary
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tema Actual */}
        <div className="p-6">
          <div 
            className="p-4 rounded-lg mb-6"
            style={{ backgroundColor: currentTheme.colors.background.tertiary }}
          >
            <h3 
              className="font-semibold mb-2"
              style={{ color: currentTheme.colors.text.primary }}
            >
              📌 Tema Actual
            </h3>
            <div className="flex items-center space-x-3">
              <div 
                className="w-8 h-8 rounded-full border-2"
                style={{ 
                  backgroundColor: currentTheme.preview,
                  borderColor: currentTheme.colors.border.accent 
                }}
              ></div>
              <div>
                <p 
                  className="font-medium"
                  style={{ color: currentTheme.colors.text.primary }}
                >
                  {currentTheme.name}
                </p>
                <p 
                  className="text-sm"
                  style={{ color: currentTheme.colors.text.secondary }}
                >
                  {currentTheme.description}
                </p>
              </div>
            </div>
          </div>

          {/* Grid de Temas Disponibles */}
          <div className="mb-6">
            <h3 
              className="text-lg font-semibold mb-4"
              style={{ color: currentTheme.colors.text.primary }}
            >
              🌈 Temas Disponibles
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableThemes.map((theme) => (
                <div
                  key={theme.id}
                  onClick={() => handleThemeSelect(theme.id)}
                  className={`p-4 rounded-lg cursor-pointer transition-all border-2 ${
                    currentTheme.id === theme.id ? 'ring-2' : ''
                  }`}
                  style={{
                    backgroundColor: theme.colors.background.card,
                    borderColor: currentTheme.id === theme.id 
                      ? currentTheme.colors.border.accent 
                      : currentTheme.colors.border.primary,
                    boxShadow: currentTheme.id === theme.id 
                      ? `0 0 0 2px ${currentTheme.colors.border.accent}40` 
                      : 'none'
                  }}
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <div 
                      className="w-10 h-10 rounded-lg border"
                      style={{ 
                        backgroundColor: theme.preview,
                        borderColor: theme.colors.border.primary 
                      }}
                    ></div>
                    <div>
                      <h4 
                        className="font-semibold text-sm"
                        style={{ color: theme.colors.text.primary }}
                      >
                        {theme.name}
                      </h4>
                      <p 
                        className="text-xs"
                        style={{ color: theme.colors.text.secondary }}
                      >
                        {theme.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Preview de colores */}
                  <div className="flex space-x-1">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: theme.colors.background.primary }}
                      title="Fondo principal"
                    ></div>
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: theme.colors.background.secondary }}
                      title="Fondo secundario"
                    ></div>
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: theme.colors.input.bg }}
                      title="Color de inputs"
                    ></div>
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: theme.colors.text.accent }}
                      title="Color de acento"
                    ></div>
                  </div>
                  
                  {currentTheme.id === theme.id && (
                    <div 
                      className="mt-2 text-xs font-medium flex items-center"
                      style={{ color: currentTheme.colors.text.accent }}
                    >
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Activo
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Vista Previa */}
          <div className="mb-6">
            <h3 
              className="text-lg font-semibold mb-4"
              style={{ color: currentTheme.colors.text.primary }}
            >
              👀 Vista Previa
            </h3>
            <div 
              className="p-4 rounded-lg border"
              style={{ 
                backgroundColor: currentTheme.colors.background.card,
                borderColor: currentTheme.colors.border.primary 
              }}
            >
              <p 
                className="mb-3"
                style={{ color: currentTheme.colors.text.primary }}
              >
                Así se verá tu CRM:
              </p>
              <div className="space-y-3">
                {/* Ejemplo de input */}
                <input
                  type="text"
                  placeholder="Campo de ejemplo"
                  className="w-full px-3 py-2 rounded"
                  style={{
                    backgroundColor: currentTheme.colors.input.bg,
                    border: `1px solid ${currentTheme.colors.input.border}`,
                    color: currentTheme.colors.input.text
                  }}
                />
                {/* Ejemplo de botón */}
                <button
                  className="px-4 py-2 rounded font-medium"
                  style={{
                    backgroundColor: currentTheme.colors.button.primary,
                    color: currentTheme.colors.input.text
                  }}
                >
                  Botón de Ejemplo
                </button>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded transition-colors"
              style={{
                backgroundColor: currentTheme.colors.background.tertiary,
                color: currentTheme.colors.text.secondary,
                border: `1px solid ${currentTheme.colors.border.primary}`
              }}
            >
              🔄 Restaurar por Defecto
            </button>
            
            <div className="space-x-3">
              <button
                onClick={onClose}
                className="px-6 py-2 rounded transition-colors"
                style={{
                  backgroundColor: currentTheme.colors.background.tertiary,
                  color: currentTheme.colors.text.secondary,
                  border: `1px solid ${currentTheme.colors.border.primary}`
                }}
              >
                Cancelar
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 rounded font-medium transition-colors"
                style={{
                  backgroundColor: currentTheme.colors.button.primary,
                  color: currentTheme.colors.input.text
                }}
              >
                ✨ Aplicar Tema
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeCustomizer;
