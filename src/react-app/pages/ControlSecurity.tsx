import { Link } from "react-router";
import { Activity, ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/react-app/utils/auth";
import { isPermissionAllowed } from "@/react-app/utils/permissions";

const cards = [
  {
    title: "Diagnostico del sistema",
    description: "Revisa base de datos, integridad de endpoints y salud general del backend.",
    href: "/system-status",
    cta: "Abrir diagnostico",
    permissionKey: "security.system_checks.run",
    accent: "from-cyan-500/20 to-blue-500/10 border-cyan-400/20",
  },
  {
    title: "Usuarios y permisos",
    description: "Configura overrides por usuario con fallback al rol actual del sistema.",
    href: "/usuarios-permisos",
    cta: "Administrar permisos",
    permissionKey: "security.permissions.view",
    accent: "from-emerald-500/20 to-teal-500/10 border-emerald-400/20",
  },
];

export default function ControlSecurityPage() {
  const currentUser = getCurrentUser();
  const canViewPage =
    isPermissionAllowed("nav.control_security", currentUser) ||
    isPermissionAllowed("security.view", currentUser);

  if (!canViewPage) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
          No tienes acceso a Control y Seguridad.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 text-slate-100">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
          <ShieldCheck className="h-4 w-4" />
          Control y seguridad
        </div>
        <h1 className="mt-3 text-3xl font-bold">Centro de control</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Primera etapa observacional: diagnostico, permisos por usuario y consistencia. Sin meter bloqueos agresivos al sistema.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {cards.map((card) => {
          const allowed = isPermissionAllowed(card.permissionKey, currentUser);
          return (
            <div
              key={card.title}
              className={`rounded-3xl border bg-gradient-to-br p-5 ${card.accent} ${
                allowed ? "opacity-100" : "opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">{card.title}</h2>
                  <p className="mt-2 text-sm text-slate-300">{card.description}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-cyan-200">
                  {card.title.includes("Diagnostico") ? <Activity className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
                  {allowed ? "Disponible" : "Sin permiso"}
                </span>
                <Link
                  to={card.href}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    allowed
                      ? "bg-white text-slate-950 hover:bg-slate-200"
                      : "pointer-events-none bg-slate-800 text-slate-500"
                  }`}
                >
                  {card.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
