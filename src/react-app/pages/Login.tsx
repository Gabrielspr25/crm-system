import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router";
import { login, getCurrentUser, setCurrentUser, logout } from "@/react-app/utils/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const redirectTo =
    (location.state as { from?: { pathname?: string } } | undefined)?.from?.pathname || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    // Detectar si vino de un error de sesión
    const reason = searchParams.get('reason');
    if (reason) {
      const messages: Record<string, string> = {
        'session_expired': '⏰ Tu sesión expiró. Por favor, inicia sesión nuevamente.',
        'token_invalid': '🔐 Tu token de autenticación no es válido. Por favor, inicia sesión nuevamente.',
        'no_token': '⚠️ No hay sesión activa. Por favor, inicia sesión.',
        'connection_error': '🌐 Hubo un problema de conexión. Por favor, intenta nuevamente.'
      };
      setSessionError(messages[reason] || 'Necesitas iniciar sesión nuevamente.');
    }
    
    const cachedUser = getCurrentUser();
    if (cachedUser && !reason) {
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, redirectTo, searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Debes ingresar usuario y contraseña.");
      return;
    }

    setLoading(true);
    try {
      const data = await login(username.trim(), password.trim());
      if (data?.user) {
        setCurrentUser(data.user);
      }
      // Forzar refresh completo para que todos los hooks se ejecuten con el token
      window.location.href = redirectTo;
    } catch (err) {
      console.error("Login error:", err);
      logout();
      setError(err instanceof Error ? err.message : "No fue posible iniciar sesión");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        <div className="px-8 py-10">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-white">VentasPro</h1>
            <p className="mt-2 text-sm text-slate-400">Ingresa tus credenciales para continuar</p>
          </div>

          {/* Mostrar error de sesión expirada */}
          {sessionError && (
            <div className="mb-6 rounded-xl bg-orange-900/40 border border-orange-700 px-4 py-3 text-sm text-orange-200">
              {sessionError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="username">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="tu.usuario"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-blue-500/20 ${
                loading
                  ? "bg-blue-900/60 text-blue-200 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
              }`}
            >
              {loading ? "Iniciando sesión…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
