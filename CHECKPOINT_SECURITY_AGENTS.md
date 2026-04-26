# CHECKPOINT — Seguridad de `/api/agents/*`

**Fecha:** 2026-04-26
**Servidor de producción:** 143.244.191.139
**Rama:** `main` (`origin/main`)
**Repo:** https://github.com/Gabrielspr25/crm-system

---

## Commits aplicados

| Commit | Mensaje | Alcance |
|---|---|---|
| `c4dfb1d` | feat(agents): asignar tarea al vendedor del cliente al crear desde Top 10 | Schema: nueva columna `agent_tasks.assigned_salesperson_id` (TEXT, sin FK). Sienta la base para los filtros por rol. |
| `f6d3fb4` | fix(security): backend filtra GET /api/agents/tasks por rol del usuario | Filtro server-side en `getAgentTasks` según `req.user`. |
| `3eacc2c` | fix(security): protege PATCH de tareas por dueño o admin | Pre-check 404/403 en `updateAgentTask` antes del UPDATE. |
| `1bed196` | fix(security): restringe endpoints de agentes por rol | `requireRole(['admin','supervisor'])` en memory/decisions/runs. Cross-assign bloqueado en `createAgentTask` para vendedores. |

Todos pusheados a `origin/main`.

---

## Endpoints protegidos

| Endpoint | Acceso | Mecanismo |
|---|---|---|
| `GET /api/agents/memory` | admin / supervisor | `requireRole(['admin','supervisor'])` en route |
| `POST /api/agents/memory` | admin / supervisor | `requireRole(['admin','supervisor'])` en route |
| `GET /api/agents/decisions` | admin / supervisor | `requireRole(['admin','supervisor'])` en route |
| `POST /api/agents/decisions` | admin / supervisor | `requireRole(['admin','supervisor'])` en route |
| `GET /api/agents/runs` | admin / supervisor | `requireRole(['admin','supervisor'])` en route |
| `POST /api/agents/runs` | admin / supervisor | `requireRole(['admin','supervisor'])` en route |
| `GET /api/agents/tasks` | admin: todas; vendedor: solo asignadas a su `salespersonId` | Filtro `WHERE` en `getAgentTasks` |
| `POST /api/agents/tasks` | admin/supervisor: asigna libre; vendedor: se autoasigna (ignorando body) | Override de `assigned_salesperson_id` en `createAgentTask` |
| `PATCH /api/agents/tasks/:id` | admin: cualquier; vendedor: solo si `assigned_salesperson_id === su salespersonId` | Pre-check (`SELECT` antes del `UPDATE`) en `updateAgentTask` |

(No hay rutas DELETE expuestas en `agentRoutes.js`.)

---

## Reglas por rol

### admin / supervisor
- Acceso completo a memory, decisions, runs (lectura y escritura).
- En tasks: ve todas (incluidas las que tienen `assigned_salesperson_id NULL`), puede crear con cualquier `assigned_salesperson_id` (o NULL), puede modificar cualquier tarea por id.

### vendedor
- Sin acceso a memory, decisions, runs (HTTP 403).
- En tasks:
  - GET devuelve solo las tareas con `assigned_salesperson_id === req.user.salespersonId`. Las tareas sin vendedor quedan ocultas.
  - POST: cualquier `assigned_salesperson_id` enviado por el cliente se ignora; el backend persiste `req.user.salespersonId`.
  - PATCH: si la tarea no le pertenece, HTTP 403 con `{"error":"No autorizado para modificar esta tarea"}`. Si el id no existe, HTTP 404.
- Vendedor sin `salespersonId` mapeado en BD recibe array vacío en GET tasks (estricto, no fail-open).

### Identificación del usuario
`req.user` se hidrata en cada request por el middleware `authenticateToken` ([src/backend/middlewares/auth.js:11-48](src/backend/middlewares/auth.js#L11-L48)) con datos reales de `users_auth` JOIN `salespeople`. El JWT solo provee `userId`/`username`; el `role` y `salespersonId` se derivan de BD, no del token.

---

## Pruebas E2E realizadas en producción

Todas ejecutadas vía `curl` autenticado contra `localhost:3001` desde el server, con tokens forjados (admin / vendedor X / vendedor Y).

### Filtro de lectura — GET /api/agents/tasks (commit `f6d3fb4`)

| Token | Tareas visibles | Esperado | Resultado |
|---|---|---|---|
| Admin | A (asignada a X), B (asignada a Y), C (sin vendedor) | Las 3 | OK |
| Vendedor X (Admin Principal) | Solo A | Solo A | OK |
| Vendedor Y (María González) | Solo B | Solo B | OK |

### Pre-check de modificación — PATCH /api/agents/tasks/:id (commit `3eacc2c`)

| # | Escenario | Status | Esperado |
|---|---|:---:|:---:|
| 1 | Admin PATCH tarea de vendedor X | 200 | 200 |
| 2 | Admin PATCH tarea sin asignar (NULL) | 200 | 200 |
| 3 | Vendedor X PATCH su propia tarea | 200 | 200 |
| 4 | Vendedor X PATCH tarea de vendedor Y | 403 | 403 |
| 5 | Vendedor X PATCH tarea sin asignar (NULL) | 403 | 403 |
| 6 | Vendedor X PATCH id inexistente | 404 | 404 |

Body del 403 verificado: `{"error":"No autorizado para modificar esta tarea"}`.

### Restricción por rol — memory / decisions / runs (commit `1bed196`)

| Endpoint | Vendedor X | Admin |
|---|:---:|:---:|
| GET /memory | 403 | 200 |
| POST /memory | 403 | 201 |
| GET /decisions | 403 | 200 |
| POST /decisions | 403 | 201 |
| GET /runs | 403 | 200 |
| POST /runs | 403 | 201 |

### Cross-assign en POST /api/agents/tasks (commit `1bed196`)

| Quien envía | `assigned_salesperson_id` enviado | `assigned_salesperson_id` persistido |
|---|---|---|
| Vendedor X | `SP_Y` (intento de asignar a otro) | `SP_X` (forzado al propio) |
| Admin | `SP_Y` | `SP_Y` (respetado) |

---

## Resultado del agente de sistema

Tras cada commit se ejecutó `POST /api/system-test/full` con token admin:

| Tras commit | total | passed | failed |
|---|:---:|:---:|:---:|
| `f6d3fb4` | 52 | 52 | 0 |
| `3eacc2c` | 52 | 52 | 0 |
| `1bed196` | 52 | 52 | 0 |

`overallStatus: SISTEMA OK` en cada corrida. El agente firma como admin y crea/modifica memorias/decisiones/tareas/runs durante su ejecución; sigue pasando porque admin está exento de los nuevos checks.

---

## Riesgos restantes conocidos

### Bajo

- **`agent_name` libre en POST /api/agents/tasks**: vendedor puede crear tareas con cualquier valor de `agent_name` (etiqueta). No expone ni modifica datos de otros, solo contamina ese campo descriptivo. Mitigación futura: forzar `agent_name` a un valor derivado (`req.user.username` o similar) o validar contra whitelist.

- **`related_client_id` y `related_ban` no validados**: vendedor puede crear una tarea (asignada a sí mismo, por el override) y referenciar un `related_client_id` que no le pertenece. Solo afecta la metadata visible al propio vendedor — no expone información de ese cliente. Mitigación futura: en `createAgentTask`, si vendedor envía `related_client_id`, verificar que el cliente esté asignado a su `salespersonId`.

### Medio

- **JWT con `ignoreExpiration: true`** ([auth.js:62](src/backend/middlewares/auth.js#L62)): los tokens emitidos no expiran efectivamente. Si un token se filtra (ej. log, navegador comprometido, ex-empleado), sigue siendo válido indefinidamente. Mitigación: quitar `ignoreExpiration: true` y manejar el flujo de refresh; o invalidar tokens vía blacklist. Fuera del alcance de esta serie de cambios — anotado para otra ronda.

- **Sin Row Level Security en PostgreSQL**: las protecciones viven en los handlers Node. Si un módulo futuro consulta directamente la tabla `agent_tasks`/`agent_memory`/etc., bypassea los checks. Mitigación: políticas RLS en PostgreSQL como defensa en profundidad. Cambio mayor — fuera de alcance.

### Operativo (no técnico)

- **Admin/supervisor pueden asignar tareas a cualquier vendedor sin límite**: comportamiento esperado, no es vulnerabilidad. Si en el futuro se quiere limitar (ej. supervisor solo puede asignar a vendedores de su zona), requeriría tabla de relaciones supervisor↔vendedores y nuevo check.

- **Frontend (Home.tsx) mantiene filtro de UX por usuario**: redundante con el filtro server-side, pero no estorba. Si en el futuro alguien remueve el filtro del frontend, el backend sigue devolviendo solo lo permitido — defensa en profundidad confirmada.

---

## Referencias rápidas

- Routes: [src/backend/routes/agentRoutes.js](src/backend/routes/agentRoutes.js)
- Controllers: [src/backend/controllers/agentController.js](src/backend/controllers/agentController.js)
- Auth middleware: [src/backend/middlewares/auth.js](src/backend/middlewares/auth.js)
- Schema: tabla `agent_tasks` ahora con 11 columnas (incluye `assigned_salesperson_id TEXT`).
