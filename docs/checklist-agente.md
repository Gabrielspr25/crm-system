# Checklist del Agente - VentasProui

## Antes de cambiar

- Leer `CLAUDE.md`.
- Confirmar si el cambio toca frontend, backend, BD o documentacion.
- Si toca backend, verificar `server-FINAL.js`; es el backend productivo.
- No asumir que `src/backend/app.js` esta en produccion.
- Si toca BD, pedir autorizacion y backup antes de ejecutar nada.

## Reglas criticas

- No usar `git pull` en produccion.
- No crear ni alterar tablas desde endpoints de lectura.
- No ejecutar backfills sin backup y autorizacion.
- No revivir Mi Dia como flujo principal.
- No usar legacy/POS como fuente principal de Comisiones.
- No usar `category_steps`, `client_steps`, `crm_deal_tasks` ni workflows legacy en SOV2.

## Validacion

- Frontend/backend: `npm run build`.
- Contratos: `npm run test:vigia`.
- SOV2: `npm run qa:no-legacy-sov2`.

## Deploy

- Compilar local.
- Subir por `scp`.
- Reiniciar PM2 si cambia backend.
- Verificar endpoint y UI con datos reales.

Actualizado: 2026-06-03.
