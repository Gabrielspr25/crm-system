import { colors, cssClasses } from '../styles/colors';

// Hook personalizado para acceder fácilmente al tema
export const useTheme = () => {
  return {
    colors,
    classes: cssClasses,
    
    // Funciones helper para generar clases dinámicamente
    getStatusClass: (status: 'success' | 'warning' | 'error' | 'info') => {
      const statusMap = {
        success: cssClasses.success,
        warning: cssClasses.warning,
        error: cssClasses.error,
        info: cssClasses.info,
      };
      return statusMap[status] || cssClasses.info;
    },
    
    getCategoryColor: (category: string) => {
      const categoryKey = category.toLowerCase().replace(' ', '_') as keyof typeof colors.categories;
      return colors.categories[categoryKey] || colors.primary[500];
    },
    
    // Aplicar tema a un componente completo
    applyTheme: (element: 'card' | 'button' | 'input' | 'container') => {
      const themeMap = {
        card: cssClasses.card,
        button: cssClasses.btnPrimary,
        input: cssClasses.input,
        container: cssClasses.container,
      };
      return themeMap[element] || '';
    }
  };
};
