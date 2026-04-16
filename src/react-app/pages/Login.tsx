import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import {
  getCurrentUser,
  login,
  logout,
  setAuthToken,
  setCurrentUser,
} from "@/react-app/utils/auth";

const SESSION_REASON_MESSAGES: Record<string, string> = {
  session_expired: "Tu sesion expiro. Inicia sesion nuevamente.",
  token_invalid: "La sesion ya no es valida. Inicia sesion nuevamente.",
  no_token: "No hay sesion activa. Inicia sesion.",
  connection_error: "Hubo un problema de conexion. Intenta nuevamente.",
};

const normalizeLoginError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : "No fue posible iniciar sesion";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("token no proporcionado") ||
    normalized.includes("token requerido") ||
    normalized.includes("mal configurado")
  ) {
    return "El acceso no esta disponible por un problema interno de configuracion.";
  }

  return message;
};

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
    const tokenParam = searchParams.get("token");

    if (tokenParam) {
      setAuthToken(tokenParam);
      window.location.href = redirectTo;
      return;
    }

    const reason = searchParams.get("reason");
    if (reason) {
      setSessionError(SESSION_REASON_MESSAGES[reason] || "Necesitas iniciar sesion nuevamente.");
    }

    const cachedUser = getCurrentUser();
    if (cachedUser && !reason && !tokenParam) {
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, redirectTo, searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Debes ingresar usuario y contrasena.");
      return;
    }

    setLoading(true);
    try {
      const data = await login(username.trim(), password.trim());
      if (data?.user) {
        setCurrentUser(data.user);
      }
      window.location.href = redirectTo;
      return;
    } catch (err) {
      console.error("Login error:", err);
      logout();
      setError(normalizeLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
        <div className="px-8 py-10">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-white">VentasPro</h1>
            <p className="mt-2 text-sm text-slate-400">Ingresa tus credenciales para continuar</p>
          </div>

          {sessionError && (
            <div className="mb-6 rounded-xl border border-orange-700 bg-orange-900/40 px-4 py-3 text-sm text-orange-200">
              {sessionError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="username">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="tu.usuario"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="password">
                Contrasena
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="........"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-700 bg-red-900/40 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-xl py-3 font-semibold shadow-lg shadow-blue-500/20 transition-all duration-200 ${
                loading
                  ? "cursor-not-allowed bg-blue-900/60 text-blue-200"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
              }`}
            >
              {loading ? "Iniciando sesion..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
