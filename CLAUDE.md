# CLAUDE.md - Memoria activa VentasProui

Leer al inicio de cada sesion. Este archivo resume las reglas vigentes del proyecto.

## Fuente productiva

- Produccion usa `server-FINAL.js`.
- `npm start` y `npm run dev:backend` ejecutan `node server-FINAL.js`.
- No asumir `src/backend/app.js` como entrypoint productivo.
- Antes de tocar endpoints, verificar si existen inline en `server-FINAL.js`.

## Reglas actuales

### SOV2 / Seguimiento

- `/seguimiento` usa `src/react-app/pages/SeguimientoOperativo.tsx`.
- SOV2/Seguimiento es el flujo operativo oficial.
- Mi Dia queda legacy/retirado del flujo principal.
- `/mi-dia` redirige a `/clientes`.
- No usar `crm_deals`, `crm_deal_tasks`, `category_steps`, `client_steps`, `follow_up_steps` ni workflow templates.

### Lifecycle de oportunidades SOV2

El ciclo de vida de una oportunidad tiene tres flujos de entrada y una sola salida:

**Flujo 1 — Cliente nuevo con prospecto:**
- Botón "Cliente nuevo" en Asana Seg.
- Crea cliente provisional (`client_pending_validation = true`) + oportunidad en un solo paso.
- Endpoint: `POST /api/sov2/opportunities`

**Flujo 2 — Cliente existente que ya está en Seguimiento:**
- Se trabaja directamente desde la tabla de Asana Seg. sin crear una nueva oportunidad.

**Flujo 3 — Cliente existente NO en Seguimiento (nueva oportunidad):**
- Botón "Importar cliente" en Asana Seg. → busca en la tabla `clients` → importa.
- Una "nueva oportunidad" = trabajar lineas adicionales a las que tiene el cliente.
- Endpoint: `POST /api/sov2/opportunities/from-client` con `{ client_id }`.
- No crea un nuevo cliente; reutiliza el cliente existente con su historial de BANs/subscribers.

**Salida — Devolver al pool:**
- Cuando el seguimiento cierra, el cliente vuelve al pool sin vendedor asignado.
- `UPDATE clients SET salesperson_id = NULL` — regla inviolable.
- `UPDATE sales_opportunities SET archived_at = NOW(), status = 'cerrada'`.
- Endpoint: `POST /api/sov2/opportunities/:id/close` (en `sov2Controller.js`).
- Implementado en `closeSov2Opportunity` — usa transaccion atomica.
- En el frontend: boton "Al pool" por fila en la columna Acciones, con modal de confirmacion.

**Reglas clave:**
- `archived_at IS NULL` = oportunidad activa.
- `clients.salesperson_id = NULL` = cliente en el pool (sin vendedor).
- Un cliente puede tener como maximo una oportunidad activa a la vez (409 si ya esta en Seguimiento).
- El sync de comisiones (Tango V2) no debe recrear ni asignar vendedores — solo actualiza datos del cliente.

### Comisiones

- Fuente única: Tango API V2 (`TANGO_API_BASE_URL` + `TANGO_API_KEY`).
- La conexión directa a la BD de Tango (legacy/POS) está desactivada. `externalPools.js` lanza error si se invoca.
- No reintroducir `getTangoPool()`, `legacyPool`, ni queries a `venta`, `tipoplan`, `comision`, `ventatipo`.
- Todos los sync y endpoints de comisiones usan exclusivamente `/api/external/ventas` y `/api/external/comisiones` de Tango V2.

### Metas

- No crear ni alterar tablas desde endpoints de lectura.
- Cambios de schema deben ir en migraciones explicitas y revisables.
- `memory/metas-diagnostico.md` documenta la deuda del paquete Metas descartado.

### Migraciones

- No ejecutar backfills sin backup y autorizacion explicita.
- El backfill SOV2 `2026-05-31-sov2-backfill-seguimiento-activo.sql` es historico/no reejecutable sin revision.

## Deploy

- No usar `git pull` en produccion.
- Compilar frontend localmente con `npm run build`.
- Subir por `scp` directo y reiniciar PM2 cuando aplique.
- Orden cuando hay BD: backup -> migracion autorizada -> backend -> frontend -> verificacion.

## Modulos retirados o legacy

- Mi Dia: retirado del flujo principal.
- Pasos/workflow legacy: no recrear.
- Importador viejo, Cognos/Discrepancias y Referidos: retirados del menu operativo.

## Validacion minima

- Para cambios frontend/backend: `npm run build`.
- Para contratos: `npm run test:vigia`.
- Para SOV2: `npm run qa:no-legacy-sov2`.

Actualizado: 2026-06-09.
