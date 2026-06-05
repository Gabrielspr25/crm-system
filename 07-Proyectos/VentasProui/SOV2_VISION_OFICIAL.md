# SOV2 - Vision Oficial

## Definicion

SOV2 es la vista operativa de seguimiento comercial de VentasProui.

La vision aprobada es:

- SOV2 = Asana + CRM.
- La tabla principal es la vista principal.
- No Kanban.
- Maxima informacion visible sin convertir la pantalla en un tablero.
- Interfaz densa, profesional y comercial.
- Dark mode operativo.

## Estado operativo actualizado - 2026-05-31

SOV2 ya no es solo vision. Quedo activo sobre Oportunidades V2.

Fuente de datos:

- Universo inicial: clientes activos de `follow_up_prospects`.
- Persistencia operativa: `sales_opportunities`.
- Productos/valores: `opportunity_lines`.
- Pasos por producto: `opportunity_steps`.
- Notas por producto: `opportunity_notes`.

Reglas de datos vigentes:

- El backfill crea oportunidades faltantes desde seguimiento activo.
- No duplicar por `client_id`.
- `GET /api/sov2/opportunities` debe devolver 1 fila por cliente activo de seguimiento proyectado a SOV2.
- Si un cliente ya tiene una oportunidad no archivada, no se crea otra.
- El vendedor viene del CRM, principalmente `clients.salesperson_id` / `salespeople`.
- Si no hay vendedor, se muestra como "Sin asignar".

Validacion de produccion 2026-05-31:

- 23 filas visibles en `/api/sov2/opportunities`.
- 23 clientes unicos.
- 0 duplicados por cliente.
- Gabriel Sanchez: 12.
- DAYANA: 4.
- Sin asignar: 7.
- Migracion aplicada: `scripts/migraciones/2026-05-31-sov2-backfill-seguimiento-activo.sql`.

## Unidad de trabajo

- 1 fila = 1 cliente/oportunidad.
- La fila representa la gestion comercial activa de ese cliente.
- El vendedor viene del CRM.
- No existe columna Responsable.
- Admin ve todo el negocio.
- El filtro por vendedor cambia metricas y tabla.

## Oportunidad

Oportunidad significa:

- dinero
- lineas por cliente

La oportunidad no es un paso global. Es el contexto comercial del cliente y sus productos/lineas.

## Metas

### Meta dinero

Los productos que cuentan para meta de dinero son:

- MPLS
- Fijo Ren
- Fijo New

### Meta cantidad

Los productos que cuentan para meta de cantidad son:

- Movil Ren
- Movil New
- Claro TV
- Cloud

## Vista superior

- Arriba van tarjetas pequenas.
- Las tarjetas resumen el negocio.
- No son tarjetas gigantes.
- Las tarjetas deben permitir entender rapido:
  - oportunidades
  - lineas
  - dinero
  - avance contra meta
  - faltante
  - ritmo diario necesario

## Productos y pasos

- Cada producto tiene sus propios pasos.
- Los pasos vienen de Gestion -> Productos.
- No existe paso global.
- La tabla principal no muestra columnas separadas de "Paso ...".
- Los pasos van arriba como filtros checklist por producto.
- Cada producto filtra por sus propios pasos.
- El filtro de paso se interpreta siempre dentro del producto correspondiente.

## Notas e historial

- La columna Notas en la tabla principal debe ser compacta.
- Notas no debe ocupar mucho espacio en la tabla.
- Notas abre un modal navegable.
- El modal permite navegar por producto:
  - General
  - Fijo Ren
  - Fijo New
  - Movil Ren
  - Movil New
  - Claro TV
  - Cloud
  - MPLS
- Cada producto tiene su historial propio.
- El historial debe mostrar notas, cambios de paso y contexto comercial del producto.
- Se pueden agregar notas sin salir del modal.

## Vista principal

- La tabla principal es la vista principal.
- La experiencia debe sentirse como gestion comercial directa: CRM + seguimiento operativo.
- No se debe convertir en Kanban.
- No usar tarjetas grandes como vista principal.
- No esconder informacion critica detras de vistas secundarias.
- Columnas actuales de tabla:
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
