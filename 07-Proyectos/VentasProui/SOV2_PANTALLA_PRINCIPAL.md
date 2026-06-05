# SOV2 - Pantalla Principal

## Objetivo

La pantalla principal de SOV2 es una vista de gestion comercial tipo Asana + CRM.

Debe permitir que admin y vendedores vean oportunidades, lineas, dinero, pasos por producto, notas e indicadores de meta en una sola tabla densa.

No es Kanban.

## Estado operativo actualizado - 2026-05-31

La pantalla `/seguimiento` usa SOV2 activo.

Endpoints usados:

- `GET /api/sov2/products`
- `GET /api/sov2/products/:productType/steps`
- `GET /api/sov2/opportunities`
- `GET /api/sov2/metrics`
- `PATCH /api/sov2/opportunities/:id`
- `GET /api/sov2/opportunities/:id/notes`
- `POST /api/sov2/opportunities/:id/notes`

Datos base:

- SOV2 se alimenta de oportunidades creadas/proyectadas desde seguimiento activo.
- La migracion `2026-05-31-sov2-backfill-seguimiento-activo.sql` creo oportunidades faltantes sin duplicar por `client_id`.
- La validacion de produccion dejo 23 filas, 23 clientes unicos y 0 duplicados.

## Tarjetas superiores

Las tarjetas superiores son compactas. No son hero cards ni tarjetas gigantes.

Tarjetas aprobadas:

- Oportunidades
- Total Lineas
- Total $
- Meta Dinero
- Falta Dinero
- Diario Dinero
- Meta Cantidad
- Falta Cantidad
- Diario Cantidad

Reglas:

- Admin ve metricas de todo el negocio.
- El filtro por vendedor cambia las metricas.
- Las tarjetas deben ocupar poco alto vertical.
- Las tarjetas resumen, no reemplazan la tabla.

## Filtros

Filtros aprobados:

- Vendedor
- Producto
- Pasos checklist por producto
- Buscar

Reglas:

- Los filtros viven arriba de la tabla.
- El filtro por vendedor cambia tarjetas y filas.
- El filtro de producto permite enfocar una linea comercial.
- Los filtros de pasos son checklist por producto.
- Cada producto filtra usando solo sus propios pasos.
- Buscar debe permitir encontrar cliente, vendedor, notas o informacion visible de la tabla.
- Bloqueado no queda como filtro principal si no aporta valor operativo.

## Columnas de tabla

Columnas aprobadas:

- Cliente
- Vendedor
- Fijo Ren
- Fijo New
- Movil Ren
- Movil New
- Claro TV
- Cloud
- MPLS
- Total Lineas
- Total $
- Notas
- Bloqueado
- Acciones

Reglas:

- 1 fila = 1 cliente/oportunidad.
- Vendedor viene del CRM.
- No existe columna Responsable.
- La tabla no contiene columnas "Paso ...".
- No existe paso global.
- Los pasos se controlan arriba como filtros checklist por producto.
- La tabla es la vista principal.
- Maxima informacion visible.

## Modal de notas

La columna Notas debe mantenerse compacta en la tabla.

Comportamiento aprobado:

- La tabla muestra resumen de notas, contador o ultima nota.
- Al abrir Notas, aparece un modal navegable.
- El modal permite navegar por producto.
- Debe existir una seccion General.
- Cada producto debe tener su historial separado.

Tabs/secciones del modal:

- General
- Fijo Ren
- Fijo New
- Movil Ren
- Movil New
- Claro TV
- Cloud
- MPLS

Contenido del historial:

- fecha/hora
- usuario o vendedor
- nota
- producto relacionado
- paso del producto en ese momento
- eventos relevantes de cambio de paso

Reglas:

- Se pueden agregar notas sin salir del modal.
- El modal no reemplaza la tabla.
- El modal sirve para detalle historico.
- Notas generales no deben mezclarse con notas de producto sin distinguir origen.

## Reglas de dinero

Productos que cuentan como dinero:

- MPLS
- Fijo Ren
- Fijo New

Columnas relacionadas:

- Fijo Ren $
- Fijo New $
- MPLS $
- Total $

Tarjetas relacionadas:

- Total $
- Meta Dinero
- Falta Dinero
- Diario Dinero

Reglas:

- Total $ suma solo productos de dinero.
- Meta Dinero mide avance de MPLS + Fijo Ren + Fijo New.
- Falta Dinero = Meta Dinero - Total $.
- Diario Dinero = ritmo diario necesario para llegar a la meta.

## Reglas de cantidad

Productos que cuentan como cantidad:

- Movil Ren
- Movil New
- Claro TV
- Cloud

Columnas relacionadas:

- Movil Ren Cant
- Movil New Cant
- Claro TV Cant
- Cloud Cant
- Total Lineas

Tarjetas relacionadas:

- Total Lineas
- Meta Cantidad
- Falta Cantidad
- Diario Cantidad

Reglas:

- Total Lineas suma solo productos de cantidad.
- Meta Cantidad mide avance de Movil Ren + Movil New + Claro TV + Cloud.
- Falta Cantidad = Meta Cantidad - Total Lineas.
- Diario Cantidad = ritmo diario necesario para llegar a la meta.

## Reglas visuales

- Estilo Asana + CRM comercial.
- Denso.
- Profesional.
- Sin Kanban.
- Sin tarjetas gigantes.
- Maxima informacion visible.
- Acciones pequenas e inline.
- Pasos por producto como filtros checklist superiores.
- Notas resumidas en tabla y detalladas en modal.
- Dark mode.
