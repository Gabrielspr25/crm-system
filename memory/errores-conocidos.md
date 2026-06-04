# Errores Conocidos - VentasProui

## Error: asumir que `src/backend/app.js` es produccion

Sintoma: cambios en controllers/routes modulares no afectan produccion.

Causa: produccion ejecuta `server-FINAL.js`.

Solucion: verificar el endpoint en `server-FINAL.js` y confirmar PM2 antes de modificar.

## Error: Comisiones dependia de legacy/POS

Sintoma: ventas existentes en Tango V2 no aparecian en Comisiones.

Causa: sync usaba legacy/POS como puerta de entrada.

Caso: GRUPO CLINICO DEL NOR, BAN 809070837, ventas 80036, 80037, 80038, 80041.

Solucion: sync V2-first. Referencia: `4703d1e7cf6dc255c575d9712d0bbf719d88f707`.

## Error: DDL en endpoints de lectura

Sintoma: endpoints de lectura crean o alteran tablas al ejecutarse.

Causa: helpers de schema dentro de controllers/rutas.

Solucion: mover schema a migraciones explicitas. Ver `memory/metas-diagnostico.md`.

## Error: reejecutar backfill sin control

Sintoma: riesgo de duplicados o datos historicos reinsertados.

Causa: backfill ejecutado sin backup/revision.

Solucion: no ejecutar backfills sin backup, validacion de estado y autorizacion explicita.

Actualizado: 2026-06-03.
