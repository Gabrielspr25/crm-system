# FUENTES_DE_VERDAD.md

## Comisiones

### Fuente oficial

Tango API V2 es la fuente oficial de ventas para Comisiones.

Endpoints usados:

- `GET /api/external/ventas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
- `GET /api/external/comisiones?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`

### Regla permanente

Una venta que existe en Tango API V2 debe poder entrar a `subscriber_reports` aunque no exista en legacy/POS.

### Rol de legacy/POS

Legacy/POS puede usarse solo como fallback o comparacion historica. No puede ser puerta de entrada para decidir si una venta existe.

Flujo correcto:

```text
Tango API V2
-> sync
-> subscriber_reports
-> Comisiones
```

Flujo prohibido:

```text
legacy/POS venta
-> sync
-> Tango V2 enrich
-> subscriber_reports
-> Comisiones
```

### Caso centinela

Mayo 2026 debe incluir las ventas V2-only de GRUPO CLINICO DEL NOR, BAN `809070837`:

- `80036`
- `80037`
- `80038`
- `80041`

El caso legacy que debe mantenerse funcionando es CARIBE TRACK, venta `79989`, mayo 2026.

## Clientes

### Fuente oficial

La fuente oficial de clientes es la tabla `clients`.

### Regla permanente

El CRM es dueno de la identidad del cliente.

Tango API V2 no crea, reemplaza ni corrige clientes.

### Quien puede crear/modificar

Los clientes pueden ser creados o modificados solo por:

- importacion/control CRM autorizado
- pantallas administrativas autorizadas
- procesos internos aprobados del CRM

### Pantallas consumidoras

Consumen clientes:

- Clientes
- Seguimiento
- SOV2
- Mi Dia
- Comisiones, solo como referencia local cruzada

## BANs

### Fuente oficial

La fuente oficial de BANs es la tabla `bans`.

### Relacion cliente -> BAN

Todo BAN debe pertenecer a un cliente.

La relacion oficial es:

```text
clients.id
-> bans.client_id
```

Un cliente puede tener uno o varios BANs.

Un BAN no debe tratarse como cartera comercial activa si no pertenece a un cliente valido.

## Suscriptores

### Fuente oficial

La fuente oficial de suscriptores es la tabla `subscribers`.

### Telefono oficial

`subscribers.phone` es el telefono oficial del suscriptor.

Las pantallas deben mostrar el telefono real guardado en `subscribers.phone`.

### Prohibicion FIJO-*

Esta prohibido usar valores `FIJO-*` como telefono o suscriptor.

`FIJO-*` no es telefono.

`FIJO-*` no es suscriptor.

`tango_ventaid` no es telefono.

Si una linea no tiene telefono real, debe mostrarse como:

```text
Sin numero registrado
```

Nunca debe inventarse un telefono.

## Seguimiento

### Fuente oficial

La fuente oficial de seguimiento es la tabla `follow_up_prospects`.

### Cliente en seguimiento

Un cliente en seguimiento requiere:

- cliente valido
- seguimiento activo
- al menos un BAN asociado

La vista visual oficial de clientes en seguimiento requiere esas tres condiciones.

Esta regla aplica a pantallas que representan cartera comercial activa.

### Incidente documentado

Junio 2026:

Se detectaron 15 registros stale activos en `follow_up_prospects` sin BAN, sin vendedor y sin datos comerciales validos.

La vista oficial de seguimiento debe aplicar:

- cliente valido
- seguimiento activo
- BAN existente

para evitar discrepancias entre seguimiento y cartera comercial activa.

### Regla permanente

Seguimiento no crea clientes.

Seguimiento no crea BANs.

Seguimiento no crea suscriptores.

Seguimiento no redefine datos maestros del CRM.

Registros stale, vacios o sin BAN no deben mostrarse como cartera comercial activa.

## SOV2

### Fuente oficial

La fuente oficial de SOV2 es la tabla `sales_opportunities`.

Entidades relacionadas:

- `opportunity_lines`
- `opportunity_steps`
- `opportunity_notes`, si aplica

### Definicion de oportunidad

Una oportunidad representa una intencion comercial.

Una oportunidad no es un cliente.

Una oportunidad puede existir o no para un cliente.

### Regla de pasos

Los pasos de una oportunidad pertenecen al tipo de venta o producto definido.

SOV2 no puede inventar pasos globales.

Los pasos deben provenir de la configuracion oficial del producto o tipo de venta.

### Regla permanente

SOV2 no reemplaza clientes.

SOV2 no reemplaza BANs.

SOV2 no reemplaza suscriptores.

SOV2 consume datos maestros del CRM y representa trabajo comercial sobre esos datos.

## Tango API V2

### Fuente oficial para

Tango API V2 es fuente oficial para:

- ventas
- comisiones
- informacion comercial de ventas
- codigos de plan usados en ventas/comisiones

### No es fuente oficial para

Tango API V2 no es fuente oficial para:

- clientes
- BANs
- suscriptores
- telefonos
- seguimiento
- SOV2

### Regla permanente

Cuando exista conflicto entre Tango API V2 y CRM:

- Para ventas y comisiones manda Tango API V2.
- Para clientes, BANs, suscriptores, seguimiento y SOV2 manda el CRM.

Tango API V2 no crea, reemplaza, inventa ni actualiza telefonos de suscriptores.

## Reglas de precedencia

Cuando dos modulos discrepan:

1. Manda la fuente oficial definida en este documento.

2. Ninguna pantalla puede redefinir una fuente de verdad.

3. Los reportes deben consumir la fuente oficial y no crear copias paralelas.

4. Si existe discrepancia entre modulos, debe corregirse el modulo consumidor y no la fuente oficial.

5. Toda excepcion debe documentarse en `CONTRATOS_ENTRE_MODULOS.md`.
