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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryStatus = (status: number) => status === 502 || status === 503 || status === 504;

const normalizeApiError = (status: number, fallback: string) => {
  if (shouldRetryStatus(status)) {
    return 'Servidor temporalmente no disponible';
  }
  return fallback;
};

export function useApi<T>(url: string, options: UseApiOptions = { immediate: true }) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const execute = useCallback(async (customUrl?: string) => {
    const token = localStorage.getItem('crm_token');
    if (!token) {
      console.warn('No hay token. No se puede hacer la peticion.');
      setState({ data: null, loading: false, error: 'No hay token de autenticacion' });
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      return null;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await authFetch(customUrl || url);

        if (!response.ok) {
          if (response.status === 401) {
            setState({ data: null, loading: false, error: 'Token invalido o expirado' });
            return null;
          }

          const errorData = await response.json().catch(() => ({ error: 'Network error' }));
          const errorMessage = normalizeApiError(response.status, errorData.error || `HTTP ${response.status}`);

          if (shouldRetryStatus(response.status) && attempt < 2) {
            await wait(450 * (attempt + 1));
            continue;
          }

          throw new Error(errorMessage);
        }

        const data = await response.json();
        setState({ data, loading: false, error: null });
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('An error occurred');
        const message = String(lastError.message || '').toLowerCase();
        const retryable = message.includes('network error') || message.includes('failed to fetch');

        if (retryable && attempt < 2) {
          await wait(450 * (attempt + 1));
          continue;
        }

        setState({ data: null, loading: false, error: lastError.message });
        throw lastError;
      }
    }

    setState({ data: null, loading: false, error: lastError?.message || 'An error occurred' });
    throw lastError || new Error('An error occurred');
  }, [url]);

  const post = useCallback(async (data: any, customUrl?: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

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
      setState((prev) => ({ ...prev, loading: false }));
      return responseData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
      throw error;
    }
  }, [url]);

  const put = useCallback(async (data: any, customUrl?: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

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
      setState((prev) => ({ ...prev, loading: false }));
      return responseData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
      throw error;
    }
  }, [url]);

  const del = useCallback(async (customUrl?: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await authFetch(customUrl || url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const responseData = await response.json();
      setState((prev) => ({ ...prev, loading: false }));
      return responseData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
      throw error;
    }
  }, [url]);

  useEffect(() => {
    if (!optionsRef.current.immediate) {
      return;
    }

    const checkAndExecute = () => {
      const token = localStorage.getItem('crm_token');
      if (token) {
        void execute();
      } else {
        setState({ data: null, loading: false, error: 'No hay token de autenticacion' });
      }
    };

    checkAndExecute();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'crm_token' && event.newValue) {
        checkAndExecute();
      }
    };

    const handleTokenUpdate = () => {
      checkAndExecute();
    };

    const handleModalRefresh = () => {
      checkAndExecute();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('token-updated', handleTokenUpdate);
    window.addEventListener('modal-refresh', handleModalRefresh);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('token-updated', handleTokenUpdate);
      window.removeEventListener('modal-refresh', handleModalRefresh);
    };
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
