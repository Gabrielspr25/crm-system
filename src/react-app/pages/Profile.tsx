import { useState } from "react";
import { Shield, LockKeyhole, Loader2 } from "lucide-react";
import { useApi } from "@/react-app/hooks/useApi";
import { authFetch } from "@/react-app/utils/auth";

type MeResponse = {
  userId: string;
  username: string;
  salespersonId: string | number | null;
  salespersonName: string | null;
  role: string;
};

export default function ProfilePage() {
  const { data: me, loading } = useApi<MeResponse>("/api/me");
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (!form.currentPassword.trim() || !form.newPassword.trim()) {
      setStatus({ type: "error", message: "Debes completar todos los campos." });
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setStatus({ type: "error", message: "La confirmación no coincide." });
      return;
    }

    if (form.newPassword.length < 8) {
      setStatus({ type: "error", message: "La nueva contraseña debe tener al menos 8 caracteres." });
      return;
    }

    try {
      setSubmitting(true);
      const response = await authFetch("/api/me/password", {
        method: "PUT",
        json: {
          current_password: form.currentPassword,
          new_password: form.newPassword,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "No fue posible actualizar la contraseña.");
      }

      setStatus({ type: "success", message: "Contraseña actualizada correctamente." });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error actualizando contraseña.";
      setStatus({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex items-center space-x-4">
        <div className="p-3 rounded-full bg-blue-500/20 text-blue-300">
          <Shield className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Mi perfil</h1>
          <p className="text-slate-400">Gestiona tus credenciales y revisa tu rol en el sistema.</p>
        </div>
      </header>

      <section className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Información del usuario</h2>
        {loading ? (
          <div className="flex items-center space-x-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Cargando...</span>
          </div>
        ) : me ? (
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div>
              <dt className="text-slate-400">Usuario</dt>
              <dd className="font-medium text-white">{me.username}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Nombre</dt>
              <dd className="font-medium text-white">{me.salespersonName ?? "Sin registrar"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Rol</dt>
              <dd className="font-medium text-white capitalize">{me.role}</dd>
            </div>
            <div>
              <dt className="text-slate-400">ID vendedor</dt>
              <dd className="font-medium text-white text-xs break-words">
                {me.salespersonId ?? "-"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-slate-400">No se pudo cargar la información del usuario.</p>
        )}
      </section>

      <section className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
          <LockKeyhole className="w-5 h-5 text-blue-300" />
          <span>Actualizar contraseña</span>
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña actual</label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
              required
            />
            <p className="text-xs text-slate-500 mt-1">Mínimo 8 caracteres. Usa letras, números y símbolos para mayor seguridad.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Confirmar nueva contraseña</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {status && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                status.type === "success"
                  ? "border-green-500/40 bg-green-900/30 text-green-200"
                  : "border-red-500/40 bg-red-900/30 text-red-200"
              }`}
            >
              {status.message}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-5 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold shadow-lg shadow-blue-500/20 hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...
                </>
              ) : (
                "Actualizar contraseña"
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
