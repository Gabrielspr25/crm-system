# CONTRATOS ENTRE MODULOS - VentasProUI

Este documento define los contratos oficiales entre modulos del CRM.

Regla base:
- Cada dato tiene un unico modulo dueno.
- Otros modulos pueden consumir datos, pero no deben reinterpretarlos ni duplicar su fuente.
- Los endpoints de lectura no crean, modifican ni migran datos.
- Produccion usa `server-FINAL.js`.
- SOV2 operativo vive en `/seguimiento`.
- Mi Dia queda legacy/retirado y no debe revivirse como flujo principal.
- Comisiones usa Tango API V2 como fuente oficial.

---

## 1. Clientes -> BANs -> Suscriptores

### Objetivo

Representar la estructura comercial real del cliente:

```text
Cliente
  -> BANs
      -> Suscriptores / lineas
```

### Dueno de datos

| Dato | Modulo dueno |
|---|---|
| Cliente | Clientes / CRM |
| Nombre cliente | Clientes / CRM |
| Telefono cliente | Clientes / CRM |
| Vendedor asignado | Clientes / CRM |
| BAN | Clientes / BANs |
| Suscriptor | Clientes / Suscriptores |
| Estado de suscriptor | Clientes / Suscriptores / Tango cuando aplique |
| Producto contratado | Productos / Suscriptores |
| Base / origen del dato | Clientes / Importaciones |
| Estado operativo del cliente en seguimiento | Seguimiento |

### Modulos consumidores

| Modulo | Consume |
|---|---|
| Seguimiento | Clientes activos con follow_up activo, BANs y vendedor |
| SOV2 | Clientes validos de seguimiento, BANs, suscriptores y vendedor |
| Mi Dia | Legacy, no fuente oficial |
| Comisiones | Suscriptores, ventas y datos Tango |
| Panel Director | Metas, ventas, ganancia y vendedores |

### Contrato oficial

Un cliente es valido para seguimiento operativo cuando cumple:

```text
cliente con nombre visible
follow_up_prospects activo
completed_date IS NULL
is_active = true
debe tener al menos 1 BAN
```

SOV2 no debe mostrar clientes:
- sin nombre
- sin BAN
- sin vendedor cuando el flujo requiera vendedor visible
- con seguimiento completado
- inactivos
- duplicados por `client_id`

### Endpoint principal

```http
GET /api/clients?tab=following
```

Uso:
- Pantalla operativa de Clientes / Seguimiento base.
- Referencia para validar que SOV2 muestra el mismo universo de clientes.

---

## 2. Seguimiento -> SOV2

### Objetivo

SOV2 es la evolucion operativa de seguimiento comercial.

Regla oficial:

```text
Seguimiento define el universo de clientes.
SOV2 gestiona la oportunidad comercial.
```

### Dueno de datos

| Dato | Modulo dueno |
|---|---|
| Cliente valido para seguimiento | Seguimiento |
| Follow up activo | Seguimiento |
| Oportunidad SOV2 | SOV2 |
| Lineas por producto | SOV2 |
| Dinero por producto | SOV2 |
| Bloqueo operativo | SOV2 |
| Notas operativas | SOV2 |
| Avance por producto | SOV2 |
| Paso actual por producto | SOV2 |
| Plantillas de pasos | SOV2 / Plantillas |

### Tablas reutilizadas

```text
clients
follow_up_prospects
client_bans / BANs equivalentes
subscribers / suscriptores equivalentes
vendors
sales_opportunities
opportunity_lines
opportunity_steps
crm_product_task_templates
```

### Regla de oportunidad

```text
1 fila = 1 cliente / oportunidad
```

No se permite duplicar oportunidades por `client_id`.

Si un cliente valido de seguimiento no tiene oportunidad SOV2:
- puede proyectarse o crearse por proceso controlado
- no debe duplicarse
- no debe modificar `clients`
- no debe modificar `follow_up_prospects`
- no debe borrar datos CRM

### Endpoint principal SOV2

```http
GET /api/sov2/opportunities
```

Debe devolver:
- una fila por cliente valido
- vendedor visible
- productos del cliente
- cantidades por producto
- dinero por producto
- total lineas
- total dinero
- notas compactas
- estado de bloqueo
- acciones operativas

### Endpoint de actualizacion SOV2

```http
PATCH /api/sov2/opportunities/:id
```

Puede actualizar:
- bloqueo
- valores operativos permitidos
- pasos por producto, si aplica
- campos SOV2, no datos maestros del CRM

No debe actualizar:
- cliente maestro
- vendedor maestro
- BAN maestro
- suscriptor maestro
- comisiones
- Tango

---

## 3. SOV2 -> Mi Dia

### Estado oficial

Mi Dia queda legacy/retirado.

Contrato:

```text
SOV2 no depende de Mi Dia.
Mi Dia no es fuente oficial de seguimiento.
Mi Dia no debe revivirse como flujo operativo.
```

### Regla

Si existe ruta `/mi-dia`, debe redirigir o quedar fuera del flujo principal.

```text
/mi-dia -> /clientes
```

### Dueno de datos

| Dato | Modulo dueno |
|---|---|
| Tareas operativas SOV2 | SOV2 |
| Notas comerciales | SOV2 |
| Bloqueos | SOV2 |
| Pasos por producto | SOV2 |
| Vista diaria legacy | Mi Dia legacy, no oficial |

### Modulos consumidores

Mi Dia no debe consumir ni alterar datos SOV2 sin una nueva definicion aprobada.

---

## 4. Tango -> Comisiones

### Objetivo

Comisiones calcula pagos y ganancias usando Tango como fuente oficial.

### Fuente oficial

```text
Tango API V2
```

Legacy/POS solo puede usarse como:
- fallback
- comparacion
- auditoria
- diagnostico

No debe reemplazar Tango V2 como fuente principal.

### Dueno de datos

| Dato | Modulo dueno |
|---|---|
| Venta validada | Tango |
| Estado de venta | Tango |
| Datos de suscriptor para venta | Tango / Suscriptores |
| Ganancia empresa | Comisiones calculando sobre Tango |
| Pago vendedor | Comisiones |
| Reglas de comision | Comisiones |
| Sync Tango | Tango service |

### Modulos consumidores

| Modulo | Consume |
|---|---|
| Comisiones | Tango V2, reglas de comision, vendedores |
| Panel Director | Totales de vendido / ganancia |
| SOV2 | No consume comisiones salvo metricas aprobadas |
| Productos | No debe contener comisiones operativas si fueron retiradas |

### Endpoints esperados

```http
GET /api/commissions
GET /api/commissions/summary
GET /api/tango/*
```

La pantalla de Comisiones debe consumir el API de comisiones, no recalcular desde frontend.

### Regla critica

No tocar Comisiones desde cambios SOV2, Seguimiento, Categorias o Productos salvo autorizacion explicita.

---

## 5. Productos -> Plantillas SOV2

### Objetivo

Separar catalogo comercial de flujo operativo.

Regla oficial:

```text
Productos/Categorias = catalogo.
SOV2 = pasos, avance, bloqueo, notas y flujo operativo.
```

### Categorias oficiales

```text
movil
fijo
tv
cloud
```

### Productos oficiales

| Producto | Categoria |
|---|---|
| Movil Ren | movil |
| Movil New | movil |
| Fijo Ren | fijo |
| Fijo New | fijo |
| MPLS | fijo |
| Claro TV | tv |
| Cloud | cloud |

### Dueno de datos

| Dato | Modulo dueno |
|---|---|
| Categoria | Productos / Categorias |
| Producto | Productos |
| Precio catalogo si aplica | Productos |
| Comision producto | No debe estar en Productos si fue retirada |
| Pasos operativos | SOV2 |
| Plantillas de pasos | SOV2 / `crm_product_task_templates` |
| Paso aplicado a cliente | SOV2 / `opportunity_steps` |

### Fuente oficial de pasos SOV2

```text
crm_product_task_templates
```

No crear:

```text
category_steps
```

No revivir:

```text
pasos legacy
workflow legacy
categorySteps legacy
```

### Contrato

Productos solo informa que productos existen.

SOV2 toma esos productos y administra:
- pasos por producto
- orden de pasos
- activo/inactivo
- avance por cliente
- notas por producto
- bloqueo

---

## 6. Pantallas y endpoints que consumen

### Clientes

| Pantalla | Endpoint |
|---|---|
| `/clientes` | `GET /api/clients` |
| `/clientes?tab=following` | `GET /api/clients?tab=following` |
| Detalle cliente | `GET /api/clients/:id` |
| BANs cliente | endpoint de BANs asociado a cliente |
| Suscriptores cliente | endpoint de suscriptores asociado a cliente |

### Seguimiento / SOV2

| Pantalla | Endpoint |
|---|---|
| `/seguimiento` | `GET /api/sov2/opportunities` |
| Productos SOV2 | `GET /api/sov2/products` |
| Pasos por producto | `GET /api/sov2/products/:productType/steps` |
| Actualizar oportunidad | `PATCH /api/sov2/opportunities/:id` |
| Notas oportunidad | `GET /api/sov2/opportunities/:id/notes` |
| Crear nota | `POST /api/sov2/opportunities/:id/notes` |
| Configurar pasos SOV2 | endpoints sobre `crm_product_task_templates` |

### Productos / Categorias

| Pantalla | Endpoint |
|---|---|
| `/productos` | endpoint de productos |
| `/categorias` | endpoint de categorias |
| Crear producto | endpoint de productos |
| Editar producto | endpoint de productos |
| Crear categoria | endpoint de categorias |
| Editar categoria | endpoint de categorias |

Productos/Categorias no deben exponer ni administrar pasos SOV2.

### Comisiones

| Pantalla | Endpoint |
|---|---|
| `/comisiones` | API de comisiones |
| Sync Tango | API Tango / sync |
| Resumen comisiones | API resumen comisiones |

### Panel Director

| Pantalla | Endpoint |
|---|---|
| `/panel-general` o Panel Director | endpoints de metas, comisiones/resumen, vendedores y alertas |
| Metas negocio | endpoint de metas |
| Metas por vendedor | endpoint de metas por vendedor |
| Vendido / ganancia | endpoint de comisiones o resumen validado |
| Alertas | endpoint de actividad / ventas / seguimiento |

---

## 7. Dueno de cada dato

| Dato | Dueno oficial |
|---|---|
| Cliente | Clientes |
| Nombre cliente | Clientes |
| Telefono cliente | Clientes |
| Vendedor asignado | Clientes |
| BAN | Clientes / BANs |
| Suscriptor | Clientes / Suscriptores |
| Producto catalogo | Productos |
| Categoria producto | Categorias |
| Follow up activo | Seguimiento |
| Cliente visible en seguimiento | Seguimiento |
| Oportunidad comercial | SOV2 |
| Lineas por producto | SOV2 |
| Dinero por producto | SOV2 |
| Total lineas SOV2 | SOV2 |
| Total dinero SOV2 | SOV2 |
| Paso por producto | SOV2 |
| Plantilla de pasos | SOV2 / `crm_product_task_templates` |
| Notas por producto | SOV2 |
| Bloqueado | SOV2 |
| Meta negocio | Metas |
| Meta por vendedor | Metas |
| Venta validada | Tango |
| Ganancia empresa | Comisiones |
| Pago vendedor | Comisiones |
| Estado Tango | Tango |
| Tareas Mi Dia | Legacy, no oficial |

---

## 8. Modulos que solo consumen datos

### SOV2 consume

```text
clients
vendors
BANs
subscribers
products
crm_product_task_templates
metas si aplica para tarjetas
```

SOV2 no es dueno de:
- cliente maestro
- BAN maestro
- vendedor maestro
- comisiones
- Tango
- metas

### Panel Director consume

```text
metas
ventas / ganancia
vendedores
alertas
tareas atrasadas
Tango revision
```

Panel Director no debe ser dueno de:
- comisiones
- Tango
- clientes
- productos
- SOV2

### Comisiones consume

```text
Tango V2
vendedores
reglas de comision
ventas validadas
```

Comisiones no debe ser dueno de:
- productos catalogo
- pasos SOV2
- seguimiento operativo

### Productos consume

Puede consumir categorias.

Productos no debe consumir:
- SOV2 avances
- notas
- pasos operativos
- comisiones si fueron eliminadas del catalogo

### Categorias consume

No debe consumir SOV2.

Categorias solo agrupa productos.

---

## 9. Reglas de dinero y cantidad SOV2

### Meta dinero

Productos de dinero:

```text
MPLS
Fijo Ren
Fijo New
```

Formula:

```text
Total $ = MPLS + Fijo Ren + Fijo New
```

### Meta cantidad

Productos de cantidad:

```text
Movil Ren
Movil New
Claro TV
Cloud
```

Formula:

```text
Total lineas = Movil Ren + Movil New + Claro TV + Cloud
```

### Reglas de visualizacion

Admin:

```text
ve todo el negocio por defecto
```

Vendedor:

```text
ve solo sus oportunidades y metricas
```

Filtro por vendedor:

```text
cambia tabla y metricas
```

---

## 10. Reglas de integridad

### No duplicados

SOV2 debe mantener:

```text
1 oportunidad por client_id
```

### Vendedor

El vendedor visible debe venir del CRM.

Orden recomendado:

```text
cliente.vendor_id
follow_up_prospects.vendor_id como fallback si aplica
"Sin asignar" solo si no hay vendedor
```

### Clientes invalidos

SOV2 debe excluir visualmente:
- clientes sin nombre
- clientes sin BAN
- clientes inactivos
- follow ups completados
- follow ups inactivos

No debe borrar esos registros.

---

## 11. Reglas prohibidas

No hacer:

```text
No crear tablas sov2_* sin aprobacion
No crear category_steps
No revivir pasos legacy
No revivir workflow legacy
No usar Mi Dia como flujo principal
No tocar Comisiones desde SOV2
No tocar Tango desde SOV2
No crear datos desde endpoints GET
No hacer backfills sin backup y autorizacion
No duplicar oportunidades por client_id
No poner pasos como columnas en la tabla principal
No usar Kanban
```

---

## 12. Contrato visual SOV2

Pantalla oficial:

```text
/seguimiento
```

Debe mostrar tabla principal densa, estilo Asana + CRM comercial.

Columnas oficiales:

```text
CLIENTE
VENDEDOR
FIJO REN
FIJO NEW
MOVIL REN
MOVIL NEW
CLARO TV
CLOUD
MPLS
TOTAL LINEAS
TOTAL $
NOTAS
ACCIONES
```

No mostrar:

```text
Paso Fijo Ren
Paso Fijo New
Paso Movil Ren
Paso Movil New
Paso Claro TV
Paso Cloud
Paso MPLS
```

Los pasos se administran desde SOV2, no como columnas por fila.

Notas:
- compactas en tabla
- modal navegable
- tabs por producto y General
- historial cronologico
- agregar nota sin cerrar modal

---

## 13. Contrato final resumido

```text
Clientes define quien es el cliente.
BANs y Suscriptores definen que tiene el cliente.
Seguimiento define que clientes estan activos para gestion.
SOV2 gestiona la oportunidad, pasos, notas y bloqueo.
Productos/Categorias definen catalogo, no flujo.
crm_product_task_templates define plantillas de pasos SOV2.
Tango define ventas validadas.
Comisiones calcula ganancia y pagos desde Tango.
Metas define objetivos del negocio y vendedores.
Panel Director consume todo, no es dueno de datos operativos.
Mi Dia queda legacy/retirado.
```
