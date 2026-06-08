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

Actualizado: 2026-06-06.
