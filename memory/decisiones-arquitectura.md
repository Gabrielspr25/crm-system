# Decisiones de Arquitectura - VentasProui

## Backend productivo

Decision: produccion ejecuta `server-FINAL.js`.

`src/backend/app.js` existe como refactor modular, pero no debe asumirse como entrypoint productivo.

Implicacion:

- Cambios de endpoints productivos deben verificarse en `server-FINAL.js`.
- Rutas modulares pueden existir como historico/refactor, pero no prueban comportamiento productivo por si solas.

## SOV2

Decision: `/seguimiento` es el flujo operativo oficial y usa `SeguimientoOperativo`.

Mi Dia queda legacy/retirado del flujo principal. `/mi-dia` redirige a `/clientes`.

## Comisiones

Decision: Tango API V2 es la fuente oficial de Comisiones.

Legacy/POS solo fallback/comparacion historica.

## Metas y schema

Decision: nunca crear ni alterar tablas desde endpoints de lectura.

Los cambios de schema van en migraciones explicitas y revisables.

## Deploy

Decision: deploy por `scp`, no por `git pull`.

Razon: el estado del servidor puede estar dirty y un pull puede generar conflictos.

Actualizado: 2026-06-03.
