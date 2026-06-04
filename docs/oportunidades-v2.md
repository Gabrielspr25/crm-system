# Oportunidades V2

Modulo nuevo e independiente para manejar oportunidades comerciales por cliente.

No reconstruye Seguimiento viejo. No usa tablas borradas. No mezcla con `crm_deals`, `crm_deal_tasks`, `client_steps`, `category_steps` ni `follow_up_steps`.

No usar el modelo anterior `sov2_boards` / `sov2_columns` / `sov2_tasks` como fuente operativa. El modelo oficial de SOV2 es `sales_opportunities`, `opportunity_lines`, `opportunity_steps` y `opportunity_notes`.

## Migraciones oficiales

Paquete principal de esquema SOV2:

- `scripts/migraciones/2026-05-30-sov2-fase1-backend.sql`: migracion principal del modelo oficial.
- `scripts/migraciones/2026-05-31-sov2-fase4-notas.sql`: crea `opportunity_notes`.

Backfill historico:

- `scripts/migraciones/2026-05-31-sov2-backfill-seguimiento-activo.sql`: crea oportunidades faltantes desde seguimiento activo historico.
- No reejecutar este backfill sin backup, revision de duplicados y autorizacion explicita.

Plantillas opcionales, separadas del esquema principal:

- `scripts/migraciones/2026-05-26-opportunity-step-templates.sql`.
- `scripts/migraciones/2026-05-26-seed-opportunity-step-templates.sql`.

## Estado operativo SOV2 - 2026-05-31

Oportunidades V2 ya esta activo como base de SOV2 en produccion.

Uso vigente:

- SOV2 lee `sales_opportunities`, `opportunity_lines`, `opportunity_steps` y `opportunity_notes`.
- El universo inicial de SOV2 se proyecta desde `follow_up_prospects` activos.
- La migracion `scripts/migraciones/2026-05-31-sov2-backfill-seguimiento-activo.sql` crea oportunidades faltantes desde seguimiento activo.
- La migracion es idempotente: no crea otra oportunidad si el `client_id` ya tiene una oportunidad no archivada.
- Regla de salida: 1 fila por `client_id`.

Validacion produccion 2026-05-31:

- `/api/sov2/opportunities`: 23 filas.
- Clientes unicos: 23.
- Duplicados por `client_id`: 0.
- Distribucion por vendedor: Gabriel Sanchez 12, DAYANA 4, Sin asignar 7.

Backups del cambio:

- BD: `/opt/crmp/db-backups/sov2-seguimiento-fix-20260531-155846.sql`.
- Frontend: `/opt/crmp/dist/client.bak-sov2-seguimiento-fix-20260531-155846`.

## Concepto

Un cliente puede tener muchas oportunidades activas:

- Renovar 4 lineas existentes
- Agregar 2 lineas nuevas sin numero todavia
- Vender internet
- Hacer upgrade de servicio

## Flujo

```text
Cliente
  -> Oportunidades
    -> Lineas incluidas o excluidas
      -> Categoria / Producto
        -> Pasos de la oportunidad
          -> Seguimiento
```

## Tablas nuevas

### `sales_opportunities`

Cabecera de la oportunidad.

Campos clave:

- `client_id`
- `salesperson_id`
- `category_id`
- `product_id`
- `title`
- `opportunity_type`
- `status`
- `priority`
- `expected_monthly_value`
- `next_action_at`
- `closed_at`
- `archived_at`

Estados:

- `activa`
- `en_progreso`
- `ganada`
- `perdida`
- `pausada`
- `cerrada_no_trabajar`

Tipos:

- `renovacion`
- `nueva_linea`
- `internet`
- `upgrade`
- `manual`
- `mixta`

### `opportunity_lines`

Lineas incluidas o excluidas dentro de una oportunidad.

Permite dos casos:

- Linea existente: tiene `subscriber_id`
- Linea nueva: no tiene `subscriber_id`, usa `line_mode = nueva_sin_numero`

Estados:

- `incluida`
- `no_trabajar_ahora`
- `excluida`
- `ganada`
- `perdida`

### `opportunity_steps`

Pasos instanciados para una oportunidad concreta.

No son pasos legacy. Son pasos propios de Oportunidades V2.

Al crear una oportunidad, el backend debe copiar los templates activos de `opportunity_step_templates` para la categoria/producto seleccionado y guardarlos como filas fisicas en `opportunity_steps`.

Despues de copiarse, la oportunidad no depende de plantillas viejas ni tablas legacy. Los pasos quedan congelados para esa oportunidad.

Estados:

- `pendiente`
- `en_progreso`
- `completado`
- `saltado`
- `cancelado`

### `opportunity_step_templates`

Plantillas nuevas de pasos para Oportunidades V2.

No usa `category_steps`.

Relaciones opcionales:

- `category_id`
- `product_id`

Campos clave:

- `step_order`
- `name`
- `description`
- `default_due_days`
- `is_required`
- `is_active`

Al crear una oportunidad, el backend copiara los templates activos a `opportunity_steps`.

## Reglas operativas

1. Cada oportunidad pertenece a un cliente.
2. Una oportunidad puede incluir lineas existentes.
3. Una linea existente puede marcarse como `no_trabajar_ahora`.
4. Una oportunidad puede tener lineas nuevas sin numero.
5. Los pasos se copian desde `opportunity_step_templates` al crear la oportunidad.
6. Seguimiento debe leer `opportunity_steps` abiertos y mostrar la proxima accion por `due_at` cuando esa vista use pasos.
7. Cliente abre oportunidades en modal, no en tab.
8. Todo es eliminable/archivable sin tocar clientes, BANs ni suscriptores.
9. Las tablas viejas de Pasos no se recrean.

## CRUD minimo antes de oportunidades

Antes de construir el flujo de oportunidades, debe existir un CRUD minimo para `opportunity_step_templates`.

Este CRUD administra plantillas nuevas de pasos. No crea oportunidades. No crea `opportunity_steps`. No usa `category_steps`.

### Endpoint base

```text
/api/opportunity-step-templates
```

### Permisos

Solo `admin` y `supervisor` pueden crear, editar, activar, desactivar o eliminar templates.

Los vendedores solo pueden leer templates activos cuando el backend futuro cree oportunidades.

### Listar templates

```http
GET /api/opportunity-step-templates
```

Filtros permitidos:

- `category_id`
- `product_id`
- `opportunity_type`
- `is_active`

Respuesta minima:

```json
[
  {
    "id": "uuid",
    "category_id": "uuid|null",
    "product_id": "uuid|null",
    "opportunity_type": "renovacion",
    "step_order": 1,
    "name": "Llamar al cliente",
    "description": "Primer contacto comercial",
    "default_due_days": 0,
    "is_required": true,
    "is_active": true
  }
]
```

Orden obligatorio:

```text
category_id NULLS LAST, product_id NULLS LAST, opportunity_type NULLS LAST, step_order ASC
```

### Crear template

```http
POST /api/opportunity-step-templates
```

Payload minimo:

```json
{
  "category_id": null,
  "product_id": null,
  "opportunity_type": "renovacion",
  "step_order": 1,
  "name": "Llamar al cliente",
  "description": "Primer contacto comercial",
  "default_due_days": 0,
  "is_required": true,
  "is_active": true
}
```

Validaciones:

- `step_order` es requerido y debe ser mayor que `0`.
- `name` es requerido.
- `default_due_days` puede ser `null` o un numero mayor o igual que `0`.
- `opportunity_type` puede ser `null` o uno de:
  - `renovacion`
  - `nueva_linea`
  - `internet`
  - `upgrade`
  - `manual`
  - `mixta`
- `category_id` y `product_id` son opcionales.
- Si `category_id` viene informado, debe existir en `categories`.
- Si `product_id` viene informado, debe existir en `products`.

### Editar template

```http
PUT /api/opportunity-step-templates/:id
```

Permite actualizar:

- `category_id`
- `product_id`
- `opportunity_type`
- `step_order`
- `name`
- `description`
- `default_due_days`
- `is_required`
- `is_active`

Debe actualizar `updated_at = NOW()`.

### Activar / desactivar template

```http
PATCH /api/opportunity-step-templates/:id/status
```

Payload:

```json
{
  "is_active": false
}
```

Regla:

Desactivar un template no afecta oportunidades ya creadas. Las oportunidades ya tienen sus filas fisicas en `opportunity_steps`.

### Eliminar template

```http
DELETE /api/opportunity-step-templates/:id
```

Regla conservadora:

El delete puede ser fisico porque la tabla no se referencia desde oportunidades creadas. Aun asi, para operacion diaria se prefiere desactivar con `is_active = false`.

### Regla de seleccion futura

Cuando el backend cree una oportunidad, buscara templates activos en este orden de prioridad:

1. Templates con `product_id` exacto.
2. Templates con `category_id` exacto y `product_id IS NULL`.
3. Templates generales con `category_id IS NULL` y `product_id IS NULL`.

Dentro de cada grupo se ordena por `step_order ASC`.

### Lo que este CRUD no hace

- No crea oportunidades.
- No crea `opportunity_steps`.
- No toca clientes.
- No toca BANs.
- No toca subscribers.
- No usa `category_steps`.
- No revive tablas viejas de Pasos.

## Checklist antes de migrar

| Regla | Estado | Evidencia |
|---|---|---|
| Backup antes de aplicar migracion | Requerido antes de ejecutar | Ver comando abajo |
| Migracion principal | Cumple | `scripts/migraciones/2026-05-30-sov2-fase1-backend.sql` |
| Notas SOV2 | Cumple | `scripts/migraciones/2026-05-31-sov2-fase4-notas.sql` |
| Backfill historico | Restringido | `scripts/migraciones/2026-05-31-sov2-backfill-seguimiento-activo.sql`; no reejecutar sin backup/autorizacion |
| No usar modelo `sov2_boards` / `sov2_columns` | Cumple | Modelo descartado para flujo oficial |
| No usar `category_steps` | Cumple | Las plantillas opcionales usan `opportunity_step_templates` |
| Migracion solo crea tablas nuevas | Cumple | `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS` e indices `idx_opportunity_*` |
| No toca clientes, BANs, subscribers ni categorias | Cumple | Solo referencias FK; no hay `ALTER`, `UPDATE`, `INSERT` ni `DELETE` sobre esas tablas |
| Pasos se copian desde templates al crear oportunidad | Pendiente de backend | Diseno exige copiar `opportunity_step_templates` activos hacia `opportunity_steps` |
| Seguimiento lee `opportunity_steps` con proxima fecha | Pendiente de backend | Query debe tomar pasos abiertos ordenados por `due_at` si aplica |

## Backup obligatorio antes de aplicar

```bash
ssh root@143.244.191.139 "mkdir -p /opt/crmp/db-backups && sudo -u postgres pg_dump crm_pro > /opt/crmp/db-backups/pre-oportunidades-v2-$(date +%Y%m%d-%H%M%S).sql"
```

## Migraciones

Archivos del paquete principal:

- `scripts/migraciones/2026-05-30-sov2-fase1-backend.sql`
- `scripts/migraciones/2026-05-31-sov2-fase4-notas.sql`
- `scripts/migraciones/2026-05-31-sov2-backfill-seguimiento-activo.sql`

Archivos opcionales separados:

- `scripts/migraciones/2026-05-26-opportunity-step-templates.sql`
- `scripts/migraciones/2026-05-26-seed-opportunity-step-templates.sql`

El backfill es historico y escribe en `sales_opportunities` / `opportunity_lines` desde `follow_up_prospects`. No reejecutar sin backup, revision de estado real y autorizacion explicita.
