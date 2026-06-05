# Diagnostico Metas - paquete descartado

Fecha: 2026-06-03

## Decision

Descartar por ahora el paquete pendiente de Metas.

## Motivo

El paquete mezclaba logica funcional de Metas, cambios visuales, tests y cambios de esquema ejecutados en runtime.

Riesgo principal: `gestionController.js` y `goalsRoutes.js` agregaban `CREATE TABLE`, `ALTER TABLE`, creacion de indices e inserts automaticos dentro de endpoints de lectura o helpers llamados por endpoints de lectura.

## Regla fijada

Nunca crear ni alterar tablas desde endpoints de lectura.

Los cambios de esquema deben ir en migraciones explicitas, revisables y ejecutadas de forma controlada.

## Archivos descartados del paquete

- `src/backend/controllers/directorController.js`
- `src/backend/controllers/gestionController.js`
- `src/backend/routes/goalsRoutes.js`
- `src/react-app/pages/Director.tsx`
- `src/react-app/pages/Gestion.tsx`
- `tests/vigia/director-goals.test.js`
- `tests/vigia/gestion-goals.test.js`

## Recomendacion futura

Separar cualquier correccion de Metas en paquetes independientes:

1. Migracion explicita de schema, si aplica.
2. Backend de lectura sin DDL runtime.
3. UI de Director/Gestion.
4. Tests del contrato real de endpoints.
