# AGENTS.md - VentasProui

Responder siempre en espanol.

Este archivo evita una segunda fuente de verdad. Para reglas del proyecto, leer `CLAUDE.md`.

Resumen obligatorio:

- Produccion usa `server-FINAL.js`, no asumir `src/backend/app.js`.
- `/seguimiento` usa `SeguimientoOperativo` y es el flujo operativo oficial SOV2.
- Mi Dia queda legacy/retirado; `/mi-dia` redirige a `/clientes`.
- Comisiones usa Tango API V2 como fuente oficial; legacy/POS solo fallback/comparacion.
- No crear ni alterar tablas desde endpoints de lectura.
- No ejecutar backfills sin backup y autorizacion.
