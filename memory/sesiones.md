# Registro de Sesiones - VentasProui

## 2026-04-29

- Retirados del menu: Importador viejo, Cognos/Discrepancias, Referidos.
- Import New conserva uso de `/api/importador`.

## 2026-05-19

- Creada estructura inicial de documentacion en `docs/` y `memory/`.
- Detectada necesidad de limpiar Git y separar paquetes pequenos.

## 2026-06-03

- Confirmado que produccion usa `server-FINAL.js`.
- SOV2/Seguimiento queda como flujo operativo oficial en `/seguimiento`.
- Mi Dia queda legacy/retirado; `/mi-dia` redirige a `/clientes`.
- Comisiones queda V2-first con Tango API V2 como fuente oficial.
- Se retiro Mi Dia legacy del arbol activo.
- Se retiraron rutas modulares legacy de Comisiones.
- Se documento que no debe haber DDL en endpoints de lectura.
- Backfills quedan restringidos: no ejecutar sin backup y autorizacion.

Actualizar este archivo al cierre de sesiones relevantes.
