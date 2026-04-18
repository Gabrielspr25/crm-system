/**
 * CATÁLOGO DE PERMISOS — VentasProui CRM
 *
 * Estructura jerárquica de 3 niveles:
 *   módulo → submodule (grupo virtual) → permiso individual
 *
 * Campos por permiso:
 *   key          — identificador único dotted  (ej: "clients.bans.view")
 *   module       — módulo raíz                (ej: "clients")
 *   submodule    — grupo funcional dentro del módulo, null si está en la raíz del módulo
 *   parent       — key del nodo-grupo padre   (ej: "clients.bans"), null si raíz del módulo
 *   label        — nombre legible en UI
 *   kind         — "nav" | "view" | "action"
 *   testKey      — fase del Probar Sistema que cubre esta funcionalidad
 *   defaultRoles — roles con este permiso por defecto
 *
 * IMPORTANTE: PERMISSION_GROUPS es solo para construir el árbol visual en la UI.
 * Los grupos NO son permisos reales: no se guardan en BD ni se evalúan al
 * resolver acceso. El código de negocio siempre usa PERMISSION_CATALOG.
 */

// ─────────────────────────────────────────────────────────────────────────────
// GRUPOS VIRTUALES  (solo para UI — no tocar en permissionService.js)
// ─────────────────────────────────────────────────────────────────────────────
export const PERMISSION_GROUPS = [
  // tasks
  { key: "tasks.personal",             module: "tasks",      label: "Tareas personales",        kind: "group", testKey: "TAREAS",       defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "tasks.pending",              module: "tasks",      label: "Pendientes de clientes",   kind: "group", testKey: "TAREAS",       defaultRoles: ["admin", "supervisor", "vendedor"] },
  // clients
  { key: "clients.bans",               module: "clients",    label: "BANs",                     kind: "group", testKey: "BANS",         defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.subscribers",        module: "clients",    label: "Suscriptores",             kind: "group", testKey: "SUSCRIPTORES", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.steps",              module: "clients",    label: "Pasos de cliente",         kind: "group", testKey: "PASOS",        defaultRoles: ["admin", "supervisor", "vendedor"] },
  // followup
  { key: "followup.calls",             module: "followup",   label: "Llamadas",                 kind: "group", testKey: "SEGUIMIENTOS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "followup.steps",             module: "followup",   label: "Pasos de seguimiento",     kind: "group", testKey: "SEGUIMIENTOS", defaultRoles: ["admin", "supervisor"] },
  { key: "followup.priorities",        module: "followup",   label: "Prioridades",              kind: "group", testKey: "SEGUIMIENTOS", defaultRoles: ["admin", "supervisor"] },
  // products
  { key: "products.tiers",             module: "products",   label: "Tiers / Comisiones",       kind: "group", testKey: "PRODUCTOS",    defaultRoles: ["admin", "supervisor"] },
  // categories
  { key: "categories.steps",           module: "categories", label: "Pasos de categoria",       kind: "group", testKey: "CATEGORIAS",   defaultRoles: ["admin", "supervisor"] },
  // users
  { key: "users.permissions",          module: "users",      label: "Gestion de permisos",      kind: "group", testKey: "USUARIOS",     defaultRoles: ["admin"] },
  // security sub-groups
  { key: "security.sessions",          module: "security",   label: "Sesiones",                 kind: "group", testKey: "SEGURIDAD",    defaultRoles: ["admin", "supervisor"] },
  { key: "security.audit",             module: "security",   label: "Auditoria de seguridad",   kind: "group", testKey: "SEGURIDAD",    defaultRoles: ["admin", "supervisor"] },
  { key: "security.alerts",            module: "security",   label: "Alertas",                  kind: "group", testKey: "SEGURIDAD",    defaultRoles: ["admin", "supervisor"] },
  { key: "security.rate_limits",       module: "security",   label: "Rate Limits",              kind: "group", testKey: "SEGURIDAD",    defaultRoles: ["admin", "supervisor"] },
  { key: "security.backups",           module: "security",   label: "Backups",                  kind: "group", testKey: "SEGURIDAD",    defaultRoles: ["admin", "supervisor"] },
  { key: "security.integrity",         module: "security",   label: "Integridad",               kind: "group", testKey: "SEGURIDAD",    defaultRoles: ["admin", "supervisor"] },
  { key: "security.system_checks",     module: "security",   label: "Chequeos del sistema",     kind: "group", testKey: "SEGURIDAD",    defaultRoles: ["admin", "supervisor"] },
  { key: "security.incidents",         module: "security",   label: "Incidentes",               kind: "group", testKey: "SEGURIDAD",    defaultRoles: ["admin", "supervisor"] },
];

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO PRINCIPAL DE PERMISOS
// ─────────────────────────────────────────────────────────────────────────────
export const PERMISSION_CATALOG = [
  // ── NAVEGACION ─────────────────────────────────────────────────────────────
  { key: "nav.dashboard",         module: "navigation", submodule: null, parent: null, label: "Panel General",          kind: "nav",    testKey: "AUTH",         defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.tasks",             module: "navigation", submodule: null, parent: null, label: "Tareas",                 kind: "nav",    testKey: "TAREAS",       defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.clients",           module: "navigation", submodule: null, parent: null, label: "Clientes",               kind: "nav",    testKey: "CLIENTES",     defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.followup",          module: "navigation", submodule: null, parent: null, label: "Seguimiento",            kind: "nav",    testKey: "SEGUIMIENTOS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.emails",            module: "navigation", submodule: null, parent: null, label: "Correos",                kind: "nav",    testKey: "CORREOS",      defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.campaigns",         module: "navigation", submodule: null, parent: null, label: "Campanas",               kind: "nav",    testKey: "CAMPAÑAS",     defaultRoles: ["admin"] },
  { key: "nav.vendors",           module: "navigation", submodule: null, parent: null, label: "Vendedores",             kind: "nav",    testKey: "VENDEDORES",   defaultRoles: ["admin", "supervisor"] },
  { key: "nav.products",          module: "navigation", submodule: null, parent: null, label: "Productos",              kind: "nav",    testKey: "PRODUCTOS",    defaultRoles: ["admin", "supervisor"] },
  { key: "nav.categories",        module: "navigation", submodule: null, parent: null, label: "Categorias",             kind: "nav",    testKey: "CATEGORIAS",   defaultRoles: ["admin"] },
  { key: "nav.goals",             module: "navigation", submodule: null, parent: null, label: "Metas",                  kind: "nav",    testKey: "METAS",        defaultRoles: ["admin", "supervisor"] },
  { key: "nav.reports",           module: "navigation", submodule: null, parent: null, label: "Comisiones",             kind: "nav",    testKey: "COMISIONES",   defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.cognos",            module: "navigation", submodule: null, parent: null, label: "Cognos",                 kind: "nav",    testKey: "COGNOS",       defaultRoles: ["admin", "supervisor"] },
  { key: "nav.audit",             module: "navigation", submodule: null, parent: null, label: "Historial",              kind: "nav",    testKey: "HISTORIAL",    defaultRoles: ["admin"] },
  { key: "nav.importer",          module: "navigation", submodule: null, parent: null, label: "Importador",             kind: "nav",    testKey: "IMPORTADOR",   defaultRoles: ["admin", "supervisor"] },
  { key: "nav.tango",             module: "navigation", submodule: null, parent: null, label: "Tango",                  kind: "nav",    testKey: "TANGO",        defaultRoles: ["admin"] },
  { key: "nav.profile",           module: "navigation", submodule: null, parent: null, label: "Perfil",                 kind: "nav",    testKey: "PERFIL",       defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "nav.control_security",  module: "navigation", submodule: null, parent: null, label: "Control y Seguridad",    kind: "nav",    testKey: "SEGURIDAD",    defaultRoles: ["admin", "supervisor"] },
  { key: "nav.users_permissions", module: "navigation", submodule: null, parent: null, label: "Usuarios y Permisos",    kind: "nav",    testKey: "USUARIOS",     defaultRoles: ["admin", "supervisor"] },

  // ── TAREAS ─────────────────────────────────────────────────────────────────
  { key: "tasks.personal.view",        module: "tasks", submodule: "personal", parent: "tasks.personal", label: "Ver tareas personales",          kind: "view",   testKey: "TAREAS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "tasks.personal.create",      module: "tasks", submodule: "personal", parent: "tasks.personal", label: "Crear tarea personal",           kind: "action", testKey: "TAREAS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "tasks.personal.edit",        module: "tasks", submodule: "personal", parent: "tasks.personal", label: "Editar tarea personal",          kind: "action", testKey: "TAREAS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "tasks.personal.delete",      module: "tasks", submodule: "personal", parent: "tasks.personal", label: "Eliminar tarea personal",        kind: "action", testKey: "TAREAS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "tasks.personal.assign",      module: "tasks", submodule: "personal", parent: "tasks.personal", label: "Asignar tareas personales",      kind: "action", testKey: "TAREAS", defaultRoles: ["admin", "supervisor"] },
  { key: "tasks.personal.import",      module: "tasks", submodule: "personal", parent: "tasks.personal", label: "Importar tareas personales",     kind: "action", testKey: "TAREAS", defaultRoles: ["admin", "supervisor"] },
  { key: "tasks.personal.export",      module: "tasks", submodule: "personal", parent: "tasks.personal", label: "Exportar tareas personales",     kind: "action", testKey: "TAREAS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "tasks.pending.view",         module: "tasks", submodule: "pending",  parent: "tasks.pending",  label: "Ver pendientes de clientes",     kind: "view",   testKey: "TAREAS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "tasks.pending.open_client",  module: "tasks", submodule: "pending",  parent: "tasks.pending",  label: "Abrir cliente desde pendientes", kind: "action", testKey: "TAREAS", defaultRoles: ["admin", "supervisor", "vendedor"] },

  // ── CLIENTES — base ────────────────────────────────────────────────────────
  { key: "clients.view",          module: "clients", submodule: null, parent: null, label: "Ver clientes",                kind: "view",   testKey: "CLIENTES", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.create",        module: "clients", submodule: null, parent: null, label: "Crear cliente",               kind: "action", testKey: "CLIENTES", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.edit",          module: "clients", submodule: null, parent: null, label: "Editar cliente",              kind: "action", testKey: "CLIENTES", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.delete",        module: "clients", submodule: null, parent: null, label: "Eliminar cliente",            kind: "action", testKey: "CLIENTES", defaultRoles: ["admin", "supervisor"] },
  { key: "clients.export",        module: "clients", submodule: null, parent: null, label: "Exportar clientes",           kind: "action", testKey: "CLIENTES", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.send_followup", module: "clients", submodule: null, parent: null, label: "Enviar cliente a seguimiento",kind: "action", testKey: "CLIENTES", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.send_email",    module: "clients", submodule: null, parent: null, label: "Enviar correo a cliente",     kind: "action", testKey: "CLIENTES", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.send_pos",      module: "clients", submodule: null, parent: null, label: "Enviar cliente a POS",        kind: "action", testKey: "CLIENTES", defaultRoles: ["admin", "supervisor"] },

  // ── CLIENTES — BANs ────────────────────────────────────────────────────────
  { key: "clients.bans.view",   module: "clients", submodule: "bans", parent: "clients.bans", label: "Ver BANs",      kind: "view",   testKey: "BANS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.bans.create", module: "clients", submodule: "bans", parent: "clients.bans", label: "Crear BAN",     kind: "action", testKey: "BANS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.bans.edit",   module: "clients", submodule: "bans", parent: "clients.bans", label: "Editar BAN",    kind: "action", testKey: "BANS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.bans.delete", module: "clients", submodule: "bans", parent: "clients.bans", label: "Eliminar BAN",  kind: "action", testKey: "BANS", defaultRoles: ["admin", "supervisor"] },

  // ── CLIENTES — Suscriptores ────────────────────────────────────────────────
  { key: "clients.subscribers.view",       module: "clients", submodule: "subscribers", parent: "clients.subscribers", label: "Ver suscriptores",        kind: "view",   testKey: "SUSCRIPTORES", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.subscribers.create",     module: "clients", submodule: "subscribers", parent: "clients.subscribers", label: "Crear suscriptor",        kind: "action", testKey: "SUSCRIPTORES", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.subscribers.edit",       module: "clients", submodule: "subscribers", parent: "clients.subscribers", label: "Editar suscriptor",       kind: "action", testKey: "SUSCRIPTORES", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.subscribers.cancel",     module: "clients", submodule: "subscribers", parent: "clients.subscribers", label: "Cancelar suscriptor",     kind: "action", testKey: "SUSCRIPTORES", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.subscribers.reactivate", module: "clients", submodule: "subscribers", parent: "clients.subscribers", label: "Reactivar suscriptor",    kind: "action", testKey: "SUSCRIPTORES", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.subscribers.delete",     module: "clients", submodule: "subscribers", parent: "clients.subscribers", label: "Eliminar suscriptor",     kind: "action", testKey: "SUSCRIPTORES", defaultRoles: ["admin", "supervisor"] },
  { key: "clients.subscribers.sync",       module: "clients", submodule: "subscribers", parent: "clients.subscribers", label: "Sincronizar suscriptores",kind: "action", testKey: "SUSCRIPTORES", defaultRoles: ["admin", "supervisor"] },
  { key: "clients.subscribers.ocr",        module: "clients", submodule: "subscribers", parent: "clients.subscribers", label: "Usar OCR de suscriptores",kind: "action", testKey: "SUSCRIPTORES", defaultRoles: ["admin", "supervisor", "vendedor"] },

  // ── CLIENTES — Pasos ───────────────────────────────────────────────────────
  { key: "clients.steps.view",            module: "clients", submodule: "steps", parent: "clients.steps", label: "Ver pasos de clientes",           kind: "view",   testKey: "PASOS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.steps.check",           module: "clients", submodule: "steps", parent: "clients.steps", label: "Marcar pasos de clientes",        kind: "action", testKey: "PASOS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "clients.steps.reorder",         module: "clients", submodule: "steps", parent: "clients.steps", label: "Reordenar pasos de clientes",     kind: "action", testKey: "PASOS", defaultRoles: ["admin", "supervisor"] },
  { key: "clients.steps.admin_templates", module: "clients", submodule: "steps", parent: "clients.steps", label: "Administrar plantillas de pasos", kind: "action", testKey: "PASOS", defaultRoles: ["admin", "supervisor"] },

  // ── SEGUIMIENTO — base ─────────────────────────────────────────────────────
  { key: "followup.view",     module: "followup", submodule: null, parent: null, label: "Ver seguimiento",   kind: "view",   testKey: "SEGUIMIENTOS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "followup.create",   module: "followup", submodule: null, parent: null, label: "Crear prospecto",   kind: "action", testKey: "SEGUIMIENTOS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "followup.edit",     module: "followup", submodule: null, parent: null, label: "Editar prospecto",  kind: "action", testKey: "SEGUIMIENTOS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "followup.complete", module: "followup", submodule: null, parent: null, label: "Completar prospecto",kind: "action",testKey: "SEGUIMIENTOS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "followup.return",   module: "followup", submodule: null, parent: null, label: "Devolver prospecto", kind: "action", testKey: "SEGUIMIENTOS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "followup.delete",   module: "followup", submodule: null, parent: null, label: "Eliminar prospecto", kind: "action", testKey: "SEGUIMIENTOS", defaultRoles: ["admin", "supervisor"] },

  // ── SEGUIMIENTO — sub-grupos ───────────────────────────────────────────────
  { key: "followup.calls.manage",      module: "followup", submodule: "calls",      parent: "followup.calls",      label: "Gestionar llamadas",    kind: "action", testKey: "SEGUIMIENTOS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "followup.steps.manage",      module: "followup", submodule: "steps",      parent: "followup.steps",      label: "Gestionar pasos",       kind: "action", testKey: "SEGUIMIENTOS", defaultRoles: ["admin", "supervisor"] },
  { key: "followup.priorities.manage", module: "followup", submodule: "priorities", parent: "followup.priorities", label: "Gestionar prioridades", kind: "action", testKey: "SEGUIMIENTOS", defaultRoles: ["admin", "supervisor"] },

  // ── CORREOS ────────────────────────────────────────────────────────────────
  { key: "emails.view", module: "emails", submodule: null, parent: null, label: "Ver correos",    kind: "view",   testKey: "CORREOS", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "emails.send", module: "emails", submodule: null, parent: null, label: "Enviar correos", kind: "action", testKey: "CORREOS", defaultRoles: ["admin", "supervisor", "vendedor"] },

  // ── CAMPANAS ───────────────────────────────────────────────────────────────
  { key: "campaigns.view",   module: "campaigns", submodule: null, parent: null, label: "Ver campanas",     kind: "view",   testKey: "CAMPAÑAS", defaultRoles: ["admin"] },
  { key: "campaigns.create", module: "campaigns", submodule: null, parent: null, label: "Crear campana",    kind: "action", testKey: "CAMPAÑAS", defaultRoles: ["admin"] },
  { key: "campaigns.edit",   module: "campaigns", submodule: null, parent: null, label: "Editar campana",   kind: "action", testKey: "CAMPAÑAS", defaultRoles: ["admin"] },
  { key: "campaigns.delete", module: "campaigns", submodule: null, parent: null, label: "Eliminar campana", kind: "action", testKey: "CAMPAÑAS", defaultRoles: ["admin"] },
  { key: "campaigns.send",   module: "campaigns", submodule: null, parent: null, label: "Enviar campana",   kind: "action", testKey: "CAMPAÑAS", defaultRoles: ["admin"] },

  // ── VENDEDORES ─────────────────────────────────────────────────────────────
  { key: "vendors.view",   module: "vendors", submodule: null, parent: null, label: "Ver vendedores",    kind: "view",   testKey: "VENDEDORES", defaultRoles: ["admin", "supervisor"] },
  { key: "vendors.create", module: "vendors", submodule: null, parent: null, label: "Crear vendedor",    kind: "action", testKey: "VENDEDORES", defaultRoles: ["admin", "supervisor"] },
  { key: "vendors.edit",   module: "vendors", submodule: null, parent: null, label: "Editar vendedor",   kind: "action", testKey: "VENDEDORES", defaultRoles: ["admin", "supervisor"] },
  { key: "vendors.delete", module: "vendors", submodule: null, parent: null, label: "Eliminar vendedor", kind: "action", testKey: "VENDEDORES", defaultRoles: ["admin"] },

  // ── PRODUCTOS — base ───────────────────────────────────────────────────────
  { key: "products.view",   module: "products", submodule: null, parent: null, label: "Ver productos",    kind: "view",   testKey: "PRODUCTOS", defaultRoles: ["admin", "supervisor"] },
  { key: "products.create", module: "products", submodule: null, parent: null, label: "Crear producto",   kind: "action", testKey: "PRODUCTOS", defaultRoles: ["admin", "supervisor"] },
  { key: "products.edit",   module: "products", submodule: null, parent: null, label: "Editar producto",  kind: "action", testKey: "PRODUCTOS", defaultRoles: ["admin", "supervisor"] },
  { key: "products.delete", module: "products", submodule: null, parent: null, label: "Eliminar producto",kind: "action", testKey: "PRODUCTOS", defaultRoles: ["admin"] },

  // ── PRODUCTOS — Tiers ──────────────────────────────────────────────────────
  { key: "products.tiers.create", module: "products", submodule: "tiers", parent: "products.tiers", label: "Crear tier",    kind: "action", testKey: "PRODUCTOS", defaultRoles: ["admin", "supervisor"] },
  { key: "products.tiers.edit",   module: "products", submodule: "tiers", parent: "products.tiers", label: "Editar tier",   kind: "action", testKey: "PRODUCTOS", defaultRoles: ["admin", "supervisor"] },
  { key: "products.tiers.delete", module: "products", submodule: "tiers", parent: "products.tiers", label: "Eliminar tier", kind: "action", testKey: "PRODUCTOS", defaultRoles: ["admin"] },

  // ── CATEGORIAS — base ──────────────────────────────────────────────────────
  { key: "categories.view",   module: "categories", submodule: null, parent: null, label: "Ver categorias",    kind: "view",   testKey: "CATEGORIAS", defaultRoles: ["admin", "supervisor"] },
  { key: "categories.create", module: "categories", submodule: null, parent: null, label: "Crear categoria",   kind: "action", testKey: "CATEGORIAS", defaultRoles: ["admin", "supervisor"] },
  { key: "categories.edit",   module: "categories", submodule: null, parent: null, label: "Editar categoria",  kind: "action", testKey: "CATEGORIAS", defaultRoles: ["admin", "supervisor"] },
  { key: "categories.delete", module: "categories", submodule: null, parent: null, label: "Eliminar categoria",kind: "action", testKey: "CATEGORIAS", defaultRoles: ["admin", "supervisor"] },

  // ── CATEGORIAS — Pasos ────────────────────────────────────────────────────
  { key: "categories.steps.create",  module: "categories", submodule: "steps", parent: "categories.steps", label: "Crear paso de categoria",     kind: "action", testKey: "CATEGORIAS", defaultRoles: ["admin", "supervisor"] },
  { key: "categories.steps.edit",    module: "categories", submodule: "steps", parent: "categories.steps", label: "Editar paso de categoria",    kind: "action", testKey: "CATEGORIAS", defaultRoles: ["admin", "supervisor"] },
  { key: "categories.steps.delete",  module: "categories", submodule: "steps", parent: "categories.steps", label: "Eliminar paso de categoria",  kind: "action", testKey: "CATEGORIAS", defaultRoles: ["admin", "supervisor"] },
  { key: "categories.steps.reorder", module: "categories", submodule: "steps", parent: "categories.steps", label: "Reordenar pasos de categoria",kind: "action", testKey: "CATEGORIAS", defaultRoles: ["admin", "supervisor"] },

  // ── METAS ──────────────────────────────────────────────────────────────────
  { key: "goals.view",      module: "goals", submodule: null, parent: null, label: "Ver metas",        kind: "view",   testKey: "METAS", defaultRoles: ["admin", "supervisor"] },
  { key: "goals.configure", module: "goals", submodule: null, parent: null, label: "Configurar metas", kind: "action", testKey: "METAS", defaultRoles: ["admin", "supervisor"] },
  { key: "goals.create",    module: "goals", submodule: null, parent: null, label: "Crear meta",       kind: "action", testKey: "METAS", defaultRoles: ["admin", "supervisor"] },
  { key: "goals.edit",      module: "goals", submodule: null, parent: null, label: "Editar meta",      kind: "action", testKey: "METAS", defaultRoles: ["admin", "supervisor"] },
  { key: "goals.delete",    module: "goals", submodule: null, parent: null, label: "Eliminar meta",    kind: "action", testKey: "METAS", defaultRoles: ["admin", "supervisor"] },

  // ── COMISIONES / REPORTES ──────────────────────────────────────────────────
  { key: "reports.view",       module: "reports", submodule: null, parent: null, label: "Ver comisiones",               kind: "view",   testKey: "COMISIONES", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "reports.admin_view", module: "reports", submodule: null, parent: null, label: "Vista avanzada de comisiones", kind: "view",   testKey: "COMISIONES", defaultRoles: ["admin", "supervisor"] },
  { key: "reports.edit",       module: "reports", submodule: null, parent: null, label: "Editar desde comisiones",      kind: "action", testKey: "COMISIONES", defaultRoles: ["admin", "supervisor"] },
  { key: "reports.export",     module: "reports", submodule: null, parent: null, label: "Exportar comisiones",          kind: "action", testKey: "COMISIONES", defaultRoles: ["admin", "supervisor", "vendedor"] },

  // ── COGNOS ─────────────────────────────────────────────────────────────────
  { key: "cognos.view",   module: "cognos", submodule: null, parent: null, label: "Ver cognos",          kind: "view",   testKey: "COGNOS", defaultRoles: ["admin", "supervisor"] },
  { key: "cognos.sync",   module: "cognos", submodule: null, parent: null, label: "Sincronizar cognos",  kind: "action", testKey: "COGNOS", defaultRoles: ["admin", "supervisor"] },
  { key: "cognos.update", module: "cognos", submodule: null, parent: null, label: "Actualizar cognos",   kind: "action", testKey: "COGNOS", defaultRoles: ["admin", "supervisor"] },

  // ── IMPORTADOR ─────────────────────────────────────────────────────────────
  { key: "importer.view", module: "importer", submodule: null, parent: null, label: "Ver importador",      kind: "view",   testKey: "IMPORTADOR", defaultRoles: ["admin", "supervisor"] },
  { key: "importer.run",  module: "importer", submodule: null, parent: null, label: "Usar importador",     kind: "action", testKey: "IMPORTADOR", defaultRoles: ["admin", "supervisor"] },
  { key: "importer.save", module: "importer", submodule: null, parent: null, label: "Guardar importacion", kind: "action", testKey: "IMPORTADOR", defaultRoles: ["admin", "supervisor"] },

  // ── TANGO ──────────────────────────────────────────────────────────────────
  { key: "tango.view", module: "tango", submodule: null, parent: null, label: "Ver tango",         kind: "view",   testKey: "TANGO", defaultRoles: ["admin"] },
  { key: "tango.sync", module: "tango", submodule: null, parent: null, label: "Sincronizar tango", kind: "action", testKey: "TANGO", defaultRoles: ["admin", "supervisor"] },

  // ── HISTORIAL ──────────────────────────────────────────────────────────────
  { key: "audit.view", module: "audit", submodule: null, parent: null, label: "Ver historial", kind: "view", testKey: "HISTORIAL", defaultRoles: ["admin"] },

  // ── PERFIL ─────────────────────────────────────────────────────────────────
  { key: "profile.view",            module: "profile", submodule: null, parent: null, label: "Ver perfil",        kind: "view",   testKey: "PERFIL", defaultRoles: ["admin", "supervisor", "vendedor"] },
  { key: "profile.change_password", module: "profile", submodule: null, parent: null, label: "Cambiar contrasena",kind: "action", testKey: "PERFIL", defaultRoles: ["admin", "supervisor", "vendedor"] },

  // ── USUARIOS — base ────────────────────────────────────────────────────────
  { key: "users.view",   module: "users", submodule: null, parent: null, label: "Ver usuarios",    kind: "view",   testKey: "USUARIOS", defaultRoles: ["admin", "supervisor"] },
  { key: "users.create", module: "users", submodule: null, parent: null, label: "Crear usuario",   kind: "action", testKey: "USUARIOS", defaultRoles: ["admin", "supervisor"] },
  { key: "users.edit",   module: "users", submodule: null, parent: null, label: "Editar usuario",  kind: "action", testKey: "USUARIOS", defaultRoles: ["admin", "supervisor"] },
  { key: "users.delete", module: "users", submodule: null, parent: null, label: "Eliminar usuario",kind: "action", testKey: "USUARIOS", defaultRoles: ["admin"] },

  // ── USUARIOS — Permisos ───────────────────────────────────────────────────
  { key: "users.permissions.manage", module: "users", submodule: "permissions", parent: "users.permissions", label: "Gestionar permisos por usuario", kind: "action", testKey: "USUARIOS", defaultRoles: ["admin"] },

  // ── CONTROL Y SEGURIDAD ────────────────────────────────────────────────────
  { key: "security.view",              module: "security", submodule: null,           parent: null,                     label: "Ver control y seguridad",        kind: "view",   testKey: "SEGURIDAD", defaultRoles: ["admin", "supervisor"] },
  { key: "security.dashboard.view",    module: "security", submodule: null,           parent: null,                     label: "Ver dashboard de seguridad",     kind: "view",   testKey: "SEGURIDAD", defaultRoles: ["admin", "supervisor"] },
  { key: "security.sessions.view",     module: "security", submodule: "sessions",     parent: "security.sessions",      label: "Ver sesiones",                   kind: "view",   testKey: "SEGURIDAD", defaultRoles: ["admin", "supervisor"] },
  { key: "security.permissions.view",  module: "security", submodule: null,           parent: null,                     label: "Ver permisos",                   kind: "view",   testKey: "SEGURIDAD", defaultRoles: ["admin", "supervisor"] },
  { key: "security.audit.view",        module: "security", submodule: "audit",        parent: "security.audit",         label: "Ver auditoria de seguridad",     kind: "view",   testKey: "SEGURIDAD", defaultRoles: ["admin", "supervisor"] },
  { key: "security.alerts.view",       module: "security", submodule: "alerts",       parent: "security.alerts",        label: "Ver alertas",                    kind: "view",   testKey: "SEGURIDAD", defaultRoles: ["admin", "supervisor"] },
  { key: "security.alerts.manage",     module: "security", submodule: "alerts",       parent: "security.alerts",        label: "Gestionar alertas",              kind: "action", testKey: "SEGURIDAD", defaultRoles: ["admin"] },
  { key: "security.rate_limits.view",  module: "security", submodule: "rate_limits",  parent: "security.rate_limits",   label: "Ver rate limits",                kind: "view",   testKey: "SEGURIDAD", defaultRoles: ["admin", "supervisor"] },
  { key: "security.rate_limits.manage",module: "security", submodule: "rate_limits",  parent: "security.rate_limits",   label: "Gestionar rate limits",          kind: "action", testKey: "SEGURIDAD", defaultRoles: ["admin"] },
  { key: "security.backups.view",      module: "security", submodule: "backups",      parent: "security.backups",       label: "Ver backups",                    kind: "view",   testKey: "SEGURIDAD", defaultRoles: ["admin", "supervisor"] },
  { key: "security.backups.run",       module: "security", submodule: "backups",      parent: "security.backups",       label: "Ejecutar backups",               kind: "action", testKey: "SEGURIDAD", defaultRoles: ["admin"] },
  { key: "security.integrity.view",    module: "security", submodule: "integrity",    parent: "security.integrity",     label: "Ver integridad",                 kind: "view",   testKey: "SEGURIDAD", defaultRoles: ["admin", "supervisor"] },
  { key: "security.system_checks.run", module: "security", submodule: "system_checks",parent: "security.system_checks", label: "Ejecutar chequeos de seguridad", kind: "action", testKey: "SEGURIDAD", defaultRoles: ["admin", "supervisor"] },
  { key: "security.incidents.view",    module: "security", submodule: "incidents",    parent: "security.incidents",     label: "Ver incidentes",                 kind: "view",   testKey: "SEGURIDAD", defaultRoles: ["admin", "supervisor"] },
  { key: "security.incidents.manage",  module: "security", submodule: "incidents",    parent: "security.incidents",     label: "Gestionar incidentes",           kind: "action", testKey: "SEGURIDAD", defaultRoles: ["admin"] },
  { key: "security.policy.edit",       module: "security", submodule: null,           parent: null,                     label: "Editar politicas de seguridad",  kind: "action", testKey: "SEGURIDAD", defaultRoles: ["admin"] },
];

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES EXISTENTES  (sin cambios — mantienen compatibilidad)
// ─────────────────────────────────────────────────────────────────────────────

/** Set de keys reales (sin grupos). Usado por permissionService para validar. */
export const PERMISSION_KEYS = new Set(PERMISSION_CATALOG.map((p) => p.key));

export function normalizePermissionKey(value) {
  return String(value || "").trim();
}

export function normalizeRoleName(value) {
  return String(value || "").trim().toLowerCase();
}

export function roleHasDefaultPermission(role, permissionKey) {
  const normalizedRole = normalizeRoleName(role);
  const normalizedKey  = normalizePermissionKey(permissionKey);
  const permission = PERMISSION_CATALOG.find((entry) => entry.key === normalizedKey);
  if (!permission) return false;
  return permission.defaultRoles.includes(normalizedRole);
}

/** Agrupa PERMISSION_CATALOG por módulo (igual que antes). */
export function groupPermissionCatalog() {
  return PERMISSION_CATALOG.reduce((acc, permission) => {
    if (!acc[permission.module]) acc[permission.module] = [];
    acc[permission.module].push(permission);
    return acc;
  }, {});
}

// ─────────────────────────────────────────────────────────────────────────────
// NUEVAS UTILIDADES DE ÁRBOL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildPermissionTree()
 *
 * Devuelve el árbol completo combinando PERMISSION_GROUPS + PERMISSION_CATALOG.
 * Útil para renderizar el panel de administración de permisos.
 *
 * Estructura devuelta:
 *   [
 *     {
 *       module: "clients",
 *       children: [
 *         { ...permiso_raiz, children: [] },          // ej: clients.view
 *         { ...grupo_bans,   children: [              // ej: clients.bans (GROUP)
 *             { ...clients.bans.view, children: [] },
 *             ...
 *           ]
 *         },
 *         ...
 *       ]
 *     },
 *     ...
 *   ]
 */
export function buildPermissionTree() {
  // Nodos combinados (grupos + permisos reales), excluyendo nav
  const allNodes = [
    ...PERMISSION_GROUPS,
    ...PERMISSION_CATALOG.filter((p) => p.kind !== "nav"),
  ];

  // Módulos únicos preservando orden de aparición
  const moduleOrder = [];
  const seenModules = new Set();
  for (const node of allNodes) {
    if (!seenModules.has(node.module)) {
      moduleOrder.push(node.module);
      seenModules.add(node.module);
    }
  }

  // Índice de hijos por parent key
  const childrenOf = {};
  for (const node of allNodes) {
    if (node.parent) {
      if (!childrenOf[node.parent]) childrenOf[node.parent] = [];
      childrenOf[node.parent].push(node);
    }
  }

  const buildNode = (node) => ({
    ...node,
    children: (childrenOf[node.key] || []).map(buildNode),
  });

  return moduleOrder.map((module) => {
    // Raíces del módulo = nodos sin parent
    const roots = allNodes
      .filter((n) => n.module === module && !n.parent)
      .map(buildNode);
    return { module, children: roots };
  });
}

/**
 * resolveWithCascade(grantedKeys)
 *
 * Dado un array/Set de keys (pueden incluir keys de grupos o de permisos reales),
 * devuelve un Set con todos los permisos reales que quedan cubiertos, siguiendo
 * la herencia padre → hijos.
 *
 * Ejemplo: si grantedKeys incluye "clients.bans", el resultado incluirá
 *   clients.bans.view, clients.bans.create, clients.bans.edit, clients.bans.delete
 */
export function resolveWithCascade(grantedKeys) {
  const granted = new Set(Array.isArray(grantedKeys) ? grantedKeys : [...grantedKeys]);
  const result  = new Set();

  for (const perm of PERMISSION_CATALOG) {
    // Concesión directa
    if (granted.has(perm.key)) {
      result.add(perm.key);
      continue;
    }
    // Concesión por grupo padre
    if (perm.parent && granted.has(perm.parent)) {
      result.add(perm.key);
      continue;
    }
    // Concesión por módulo completo (ej: alguien otorgó "clients" en bulk)
    if (granted.has(perm.module)) {
      result.add(perm.key);
    }
  }

  return result;
}

/**
 * getPermissionsByTestKey(testKey)
 *
 * Devuelve todos los permisos del catálogo cuyo testKey coincide.
 * Usado por el Probar Sistema para saber qué permisos cubre cada fase de prueba.
 *
 * Ejemplo: getPermissionsByTestKey("BANS")
 *   → [clients.bans.view, clients.bans.create, clients.bans.edit, clients.bans.delete]
 */
export function getPermissionsByTestKey(testKey) {
  return PERMISSION_CATALOG.filter((p) => p.testKey === testKey);
}

/**
 * getTestKeyCoverage()
 *
 * Devuelve un mapa { testKey → [permissionKeys] } con la cobertura completa.
 * Útil para mostrar en el resultado del Probar Sistema qué permisos fueron
 * verificados por cada fase.
 */
export function getTestKeyCoverage() {
  return PERMISSION_CATALOG.reduce((acc, perm) => {
    if (!acc[perm.testKey]) acc[perm.testKey] = [];
    acc[perm.testKey].push(perm.key);
    return acc;
  }, {});
}
