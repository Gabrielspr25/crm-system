import { useState, useEffect } from 'react';
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

  const execute = async (customUrl?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await authFetch(customUrl || url);
      
      if (!response.ok) {
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
  };

  const post = async (data: any, customUrl?: string) => {
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
  };

  const put = async (data: any, customUrl?: string) => {
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
  };

  const del = async (customUrl?: string) => {
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
  };

  useEffect(() => {
    if (options.immediate) {
      execute();
    }
  }, [url]);

  return {
    ...state,
    execute,
    post,
    put,
    delete: del,
    refetch: () => execute(),
  };
}
