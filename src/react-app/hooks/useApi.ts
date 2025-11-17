import { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '@/react-app/utils/auth';

interface UseApiOptions {
  immediate?: boolean;
}

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(url: string, options: UseApiOptions = { immediate: true }) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const execute = useCallback(async (customUrl?: string) => {
    // Verificar token antes de hacer la petición
    const token = localStorage.getItem('crm_token');
    if (!token) {
      console.warn("⚠️ No hay token. No se puede hacer la petición.");
      setState({ data: null, loading: false, error: 'No hay token de autenticación' });
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      return null;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await authFetch(customUrl || url);
      
      if (!response.ok) {
        // Si es 401, authFetch ya maneja la redirección
        if (response.status === 401) {
          setState({ data: null, loading: false, error: 'Token inválido o expirado' });
          return null;
        }
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState({ data: null, loading: false, error: errorMessage });
      throw error;
    }
  }, [url]);

  const post = useCallback(async (data: any, customUrl?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await authFetch(customUrl || url, {
        method: 'POST',
        json: data,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const responseData = await response.json();
      setState(prev => ({ ...prev, loading: false }));
      return responseData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      throw error;
    }
  }, [url]);

  const put = useCallback(async (data: any, customUrl?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await authFetch(customUrl || url, {
        method: 'PUT',
        json: data,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const responseData = await response.json();
      setState(prev => ({ ...prev, loading: false }));
      return responseData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      throw error;
    }
  }, [url]);

  const del = useCallback(async (customUrl?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await authFetch(customUrl || url, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const responseData = await response.json();
      setState(prev => ({ ...prev, loading: false }));
      return responseData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      throw error;
    }
  }, [url]);

  useEffect(() => {
    if (optionsRef.current.immediate) {
      const checkAndExecute = () => {
        const token = localStorage.getItem('crm_token');
        if (token) {
          execute();
        } else {
          setState({ data: null, loading: false, error: 'No hay token de autenticación' });
        }
      };

      // Ejecutar inmediatamente
      checkAndExecute();

      // Escuchar cambios en localStorage (cuando se guarda el token después del login)
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'crm_token' && e.newValue) {
          checkAndExecute();
        }
      };

      // También escuchar eventos personalizados
      const handleTokenUpdate = () => {
        checkAndExecute();
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('token-updated', handleTokenUpdate);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('token-updated', handleTokenUpdate);
      };
    }
  }, [execute]);

  return {
    ...state,
    execute,
    post,
    put,
    delete: del,
    refetch: () => execute(),
  };
}
