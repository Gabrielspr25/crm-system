export const PERMISSION_CATALOG = [
  // Navegacion
  { key: "nav.dashboard", module: "navigation", label: "Panel General", kind: "nav", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.tasks", module: "navigation", label: "Tareas", kind: "nav", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.clients", module: "navigation", label: "Clientes", kind: "nav", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.followup", module: "navigation", label: "Seguimiento", kind: "nav", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.emails", module: "navigation", label: "Correos", kind: "nav", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.campaigns", module: "navigation", label: "Campanas", kind: "nav", defaultRoles: ["admin"] },
  { key: "nav.vendors", module: "navigation", label: "Vendedores", kind: "nav", defaultRoles: ["admin", "supervisor"] },
  { key: "nav.products", module: "navigation", label: "Productos", kind: "nav", defaultRoles: ["admin", "supervisor"] },
  { key: "nav.categories", module: "navigation", label: "Categorias", kind: "nav", defaultRoles: ["admin"] },
  { key: "nav.goals", module: "navigation", label: "Metas", kind: "nav", defaultRoles: ["admin", "supervisor"] },
  { key: "nav.reports", module: "navigation", label: "Comisiones", kind: "nav", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.cognos", module: "navigation", label: "Cognos", kind: "nav", defaultRoles: ["admin", "supervisor"] },
  { key: "nav.audit", module: "navigation", label: "Historial", kind: "nav", defaultRoles: ["admin"] },
  { key: "nav.importer", module: "navigation", label: "Importador", kind: "nav", defaultRoles: ["admin", "supervisor"] },
  { key: "nav.tango", module: "navigation", label: "Tango", kind: "nav", defaultRoles: ["admin"] },
  { key: "nav.profile", module: "navigation", label: "Perfil", kind: "nav", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.control_security", module: "navigation", label: "Control y Seguridad", kind: "nav", defaultRoles: ["admin", "supervisor"] },
  { key: "nav.users_permissions", module: "navigation", label: "Usuarios y Permisos", kind: "nav", defaultRoles: ["admin", "supervisor"] },

  // Tareas
  { key: "tasks.personal.view", module: "tasks", label: "Ver tareas personales", kind: "view", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "tasks.personal.create", module: "tasks", label: "Crear tarea personal", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "tasks.personal.edit", module: "tasks", label: "Editar tarea personal", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "tasks.personal.delete", module: "tasks", label: "Eliminar tarea personal", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "tasks.personal.assign", module: "tasks", label: "Asignar tareas personales", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "tasks.personal.import", module: "tasks", label: "Importar tareas personales", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "tasks.personal.export", module: "tasks", label: "Exportar tareas personales", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "tasks.pending.view", module: "tasks", label: "Ver pendientes de clientes", kind: "view", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "tasks.pending.open_client", module: "tasks", label: "Abrir cliente desde pendientes", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },

  // Clientes
  { key: "clients.view", module: "clients", label: "Ver clientes", kind: "view", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.create", module: "clients", label: "Crear cliente", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.edit", module: "clients", label: "Editar cliente", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.delete", module: "clients", label: "Eliminar cliente", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "clients.export", module: "clients", label: "Exportar clientes", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.send_followup", module: "clients", label: "Enviar cliente a seguimiento", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.send_email", module: "clients", label: "Enviar correo a cliente", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.send_pos", module: "clients", label: "Enviar cliente a POS", kind: "action", defaultRoles: ["admin", "supervisor"] },

  // BANs y suscriptores
  { key: "clients.bans.view", module: "clients", label: "Ver BANs", kind: "view", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.bans.create", module: "clients", label: "Crear BAN", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.bans.edit", module: "clients", label: "Editar BAN", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.bans.delete", module: "clients", label: "Eliminar BAN", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "clients.subscribers.view", module: "clients", label: "Ver suscriptores", kind: "view", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.subscribers.create", module: "clients", label: "Crear suscriptor", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.subscribers.edit", module: "clients", label: "Editar suscriptor", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.subscribers.cancel", module: "clients", label: "Cancelar suscriptor", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.subscribers.reactivate", module: "clients", label: "Reactivar suscriptor", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.subscribers.delete", module: "clients", label: "Eliminar suscriptor", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "clients.subscribers.sync", module: "clients", label: "Sincronizar suscriptores", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "clients.subscribers.ocr", module: "clients", label: "Usar OCR de suscriptores", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },

  // Pasos de clientes
  { key: "clients.steps.view", module: "clients", label: "Ver pasos de clientes", kind: "view", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.steps.check", module: "clients", label: "Marcar pasos de clientes", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.steps.reorder", module: "clients", label: "Reordenar pasos de clientes", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "clients.steps.admin_templates", module: "clients", label: "Administrar plantillas de pasos", kind: "action", defaultRoles: ["admin", "supervisor"] },

  // Seguimiento
  { key: "followup.view", module: "followup", label: "Ver seguimiento", kind: "view", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "followup.create", module: "followup", label: "Crear prospecto", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "followup.edit", module: "followup", label: "Editar prospecto", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "followup.complete", module: "followup", label: "Completar prospecto", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "followup.return", module: "followup", label: "Devolver prospecto", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "followup.delete", module: "followup", label: "Eliminar prospecto", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "followup.calls.manage", module: "followup", label: "Gestionar llamadas", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "followup.steps.manage", module: "followup", label: "Gestionar pasos de seguimiento", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "followup.priorities.manage", module: "followup", label: "Gestionar prioridades", kind: "action", defaultRoles: ["admin", "supervisor"] },

  // Correos, campanas
  { key: "emails.view", module: "emails", label: "Ver correos", kind: "view", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "emails.send", module: "emails", label: "Enviar correos", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "campaigns.view", module: "campaigns", label: "Ver campanas", kind: "view", defaultRoles: ["admin"] },
  { key: "campaigns.create", module: "campaigns", label: "Crear campana", kind: "action", defaultRoles: ["admin"] },
  { key: "campaigns.edit", module: "campaigns", label: "Editar campana", kind: "action", defaultRoles: ["admin"] },
  { key: "campaigns.delete", module: "campaigns", label: "Eliminar campana", kind: "action", defaultRoles: ["admin"] },
  { key: "campaigns.send", module: "campaigns", label: "Enviar campana", kind: "action", defaultRoles: ["admin"] },

  // Vendedores, productos, categorias
  { key: "vendors.view", module: "vendors", label: "Ver vendedores", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "vendors.create", module: "vendors", label: "Crear vendedor", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "vendors.edit", module: "vendors", label: "Editar vendedor", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "vendors.delete", module: "vendors", label: "Eliminar vendedor", kind: "action", defaultRoles: ["admin"] },
  { key: "products.view", module: "products", label: "Ver productos", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "products.create", module: "products", label: "Crear producto", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "products.edit", module: "products", label: "Editar producto", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "products.delete", module: "products", label: "Eliminar producto", kind: "action", defaultRoles: ["admin"] },
  { key: "products.tiers.create", module: "products", label: "Crear tier", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "products.tiers.edit", module: "products", label: "Editar tier", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "products.tiers.delete", module: "products", label: "Eliminar tier", kind: "action", defaultRoles: ["admin"] },
  { key: "categories.view", module: "categories", label: "Ver categorias", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "categories.create", module: "categories", label: "Crear categoria", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "categories.edit", module: "categories", label: "Editar categoria", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "categories.delete", module: "categories", label: "Eliminar categoria", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "categories.steps.create", module: "categories", label: "Crear paso de categoria", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "categories.steps.edit", module: "categories", label: "Editar paso de categoria", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "categories.steps.delete", module: "categories", label: "Eliminar paso de categoria", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "categories.steps.reorder", module: "categories", label: "Reordenar pasos de categoria", kind: "action", defaultRoles: ["admin", "supervisor"] },

  // Metas, reportes, cognos, importador, tango
  { key: "goals.view", module: "goals", label: "Ver metas", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "goals.configure", module: "goals", label: "Configurar metas", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "goals.create", module: "goals", label: "Crear meta", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "goals.edit", module: "goals", label: "Editar meta", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "goals.delete", module: "goals", label: "Eliminar meta", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "reports.view", module: "reports", label: "Ver comisiones", kind: "view", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "reports.admin_view", module: "reports", label: "Vista avanzada de comisiones", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "reports.edit", module: "reports", label: "Editar desde comisiones", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "reports.export", module: "reports", label: "Exportar comisiones", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "cognos.view", module: "cognos", label: "Ver cognos", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "cognos.sync", module: "cognos", label: "Sincronizar cognos", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "cognos.update", module: "cognos", label: "Actualizar cognos", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "importer.view", module: "importer", label: "Ver importador", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "importer.run", module: "importer", label: "Usar importador", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "importer.save", module: "importer", label: "Guardar importacion", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "tango.view", module: "tango", label: "Ver tango", kind: "view", defaultRoles: ["admin"] },
  { key: "tango.sync", module: "tango", label: "Sincronizar tango", kind: "action", defaultRoles: ["admin", "supervisor"] },

  // Historial, perfil, usuarios
  { key: "audit.view", module: "audit", label: "Ver historial", kind: "view", defaultRoles: ["admin"] },
  { key: "profile.view", module: "profile", label: "Ver perfil", kind: "view", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "profile.change_password", module: "profile", label: "Cambiar contrasena", kind: "action", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "users.view", module: "users", label: "Ver usuarios", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "users.create", module: "users", label: "Crear usuario", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "users.edit", module: "users", label: "Editar usuario", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "users.delete", module: "users", label: "Eliminar usuario", kind: "action", defaultRoles: ["admin"] },
  { key: "users.permissions.manage", module: "users", label: "Gestionar permisos por usuario", kind: "action", defaultRoles: ["admin"] },

  // Control y seguridad
  { key: "security.view", module: "security", label: "Ver control y seguridad", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "security.dashboard.view", module: "security", label: "Ver dashboard de seguridad", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "security.sessions.view", module: "security", label: "Ver sesiones", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "security.permissions.view", module: "security", label: "Ver permisos", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "security.audit.view", module: "security", label: "Ver auditoria de seguridad", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "security.alerts.view", module: "security", label: "Ver alertas", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "security.alerts.manage", module: "security", label: "Gestionar alertas", kind: "action", defaultRoles: ["admin"] },
  { key: "security.rate_limits.view", module: "security", label: "Ver rate limits", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "security.rate_limits.manage", module: "security", label: "Gestionar rate limits", kind: "action", defaultRoles: ["admin"] },
  { key: "security.backups.view", module: "security", label: "Ver backups", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "security.backups.run", module: "security", label: "Ejecutar backups", kind: "action", defaultRoles: ["admin"] },
  { key: "security.integrity.view", module: "security", label: "Ver integridad", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "security.system_checks.run", module: "security", label: "Ejecutar chequeos de seguridad", kind: "action", defaultRoles: ["admin", "supervisor"] },
  { key: "security.incidents.view", module: "security", label: "Ver incidentes", kind: "view", defaultRoles: ["admin", "supervisor"] },
  { key: "security.incidents.manage", module: "security", label: "Gestionar incidentes", kind: "action", defaultRoles: ["admin"] },
  { key: "security.policy.edit", module: "security", label: "Editar politicas de seguridad", kind: "action", defaultRoles: ["admin"] }
];

export const PERMISSION_KEYS = new Set(PERMISSION_CATALOG.map((permission) => permission.key));

export function normalizePermissionKey(value) {
  return String(value || "").trim();
}

export function normalizeRoleName(value) {
  return String(value || "").trim().toLowerCase();
}

export function roleHasDefaultPermission(role, permissionKey) {
  const normalizedRole = normalizeRoleName(role);
  const normalizedKey = normalizePermissionKey(permissionKey);
  const permission = PERMISSION_CATALOG.find((entry) => entry.key === normalizedKey);
  if (!permission) return false;
  return permission.defaultRoles.includes(normalizedRole);
}

export function groupPermissionCatalog() {
  return PERMISSION_CATALOG.reduce((accumulator, permission) => {
    if (!accumulator[permission.module]) {
      accumulator[permission.module] = [];
    }
    accumulator[permission.module].push(permission);
    return accumulator;
  }, {});
}
