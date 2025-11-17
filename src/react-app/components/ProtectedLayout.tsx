import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import Layout from "@/react-app/components/Layout";
import {
  authFetch,
  clearAuthToken,
  getAuthToken,
  getCurrentUser,
  setCurrentUser,
  type AuthUser
} from "@/react-app/utils/auth";

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

interface AuthState {
  loading: boolean;
  user: AuthUser | null;
}

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const location = useLocation();
  const [state, setState] = useState<AuthState>(() => ({
    loading: true,
    user: getCurrentUser(),
  }));

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const token = getAuthToken();
      const cachedUser = getCurrentUser();

      if (!token) {
        if (!cancelled) setState({ loading: false, user: null });
        return;
      }

      if (cachedUser) {
        if (!cancelled) setState({ loading: false, user: cachedUser });
        return;
      }

      try {
        const response = await authFetch("/api/me");
        if (!response.ok) {
          throw new Error("No autorizado");
        }
        const data: AuthUser = await response.json();
        setCurrentUser(data);
        if (!cancelled) setState({ loading: false, user: data });
      } catch (error) {
        console.warn("Fallo al recuperar sesión:", error);
        clearAuthToken();
        if (!cancelled) setState({ loading: false, user: null });
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-200">
        <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
        <p className="text-sm uppercase tracking-wide text-slate-400">Verificando sesión…</p>
      </div>
    );
  }

  if (!state.user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Layout>{children}</Layout>;
}
