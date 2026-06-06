# COMISIONES TANGO V2 - Auto-creacion PYMES

## Objetivo

Implementar la regla definitiva de negocio:

```text
Las ventas Tango V2 de negocio PYMES con comision real deben crear automaticamente Cliente -> BAN -> Suscriptor si no existen en CRM, y luego crear subscriber_reports.
```

No deben ir a `tango_commission_pending_sales` solo porque el BAN no existe.

Pendientes queda solo para ventas PYMES ambiguas o ventas PYMES sin datos minimos.
Tipos fuera de PYMES no entran a pending activo: se ignoran con motivo `tipo_no_pymes`.

## Tipos PYMES Confirmados

| Nombre Tango | Producto CRM | Movimiento | Negocio |
|---|---|---|---|
| BA CORP NEW | Movil | Nueva | PYMES |
| BA CORP REN | Movil | Renovacion | PYMES |
| Corp Update New | Movil | Nueva | PYMES |
| Corp Update Ren | Movil | Renovacion | PYMES |
| PYMES Update NEW | Movil | Nueva | PYMES |
| PYMES Update REN | Movil | Renovacion | PYMES |
| Telemetria NEW | Movil | Nueva | PYMES |
| Telemetria REN | Movil | Renovacion | PYMES |
| PYMES Fijo NEW | Fijo | Nueva | PYMES |
| PYMES Fijo REN | Fijo | Renovacion | PYMES |
| Cloud Negocios | Cloud | Nueva | PYMES |
| Office 365 Negocios | Cloud | Nueva | PYMES |

## Regla De Entrada

Una venta entra al flujo automatico si cumple:

1. Existe en Tango V2 ventas.
2. Existe en Tango V2 comisiones.
3. `company_earnings > 0`.
4. `ventatipo.nombre` corresponde a un tipo PYMES confirmado.
5. Tiene datos minimos para crear la relacion CRM:
   - cliente Tango;
   - BAN Tango;
   - fecha de activacion;
   - `ventaid`;
   - telefono/linea cuando aplique para suscriptor.

Si falta telefono en una venta que requiere suscriptor, la venta no debe perderse: queda en pending con motivo especifico.

## Flujo De Sync

### 1. Clasificar venta Tango V2

Crear clasificador tecnico:

```text
is_pymes = true/false
producto_crm = movil | fijo | cloud
movimiento = new | ren
```

La clasificacion puede vivir en codigo inicialmente, pero debe migrarse luego a configuracion CRM auditable de tipos Tango.

### 2. Resolver cliente

Buscar cliente por:

1. BAN existente.
2. Nombre exacto normalizado.
3. Si no existe, crear cliente con datos Tango.

Cliente auto-creado:

- `name = cliente_tango`
- `owner_name = cliente_tango`
- `source = tango_v2_autocreate`
- `pendiente_validacion = true`
- `notes` con `ventaid`, fecha y origen
- campos faltantes quedan para completar luego en modal de cliente

### 3. Resolver BAN

Buscar BAN por numero exacto/normalizado.

Si no existe:

- crear BAN con `ban_number = ban_tango`
- asociar a cliente resuelto
- `account_type` segun producto:
  - movil -> `PYMES` o `MOVIL`
  - fijo -> `FIJO`
  - cloud -> `PYMES`
- `status = A`
- `source = tango_v2_autocreate`

### 4. Resolver suscriptor

Si Tango trae telefono/linea:

1. Buscar suscriptor por `tango_ventaid`.
2. Buscar suscriptor por telefono dentro del BAN.
3. Si no existe, crear suscriptor:
   - `ban_id`
   - `phone`
   - `status = activo`
   - `tango_ventaid`
   - `plan` si Tango trae plan
   - `monthly_value` si Tango trae mensualidad
   - `created_at`, `updated_at`

Si no hay telefono:

- no crear suscriptor inventado;
- mandar a pending con motivo `pymes_sin_telefono`.

### 5. Crear subscriber_report

Crear o actualizar `subscriber_reports`:

- `subscriber_id`
- `report_month`
- `source = tango_v2_autocreate`
- `external_sale_id = ventaid`
- `source_activation_date`
- `source_report_month`
- `raw_payload`
- `validation_status = confirmed` si datos criticos completos
- `company_earnings`
- `vendor_commission`
- `portability_bonus` si aplica

No duplicar:

- por `external_sale_id` / `tango_ventaid`;
- por `subscriber_id + report_month`.

Si ya existe reporte:

- no duplicar;
- completar solo campos faltantes;
- no pisar pagos manuales.

### 6. Pending

Enviar a `tango_commission_pending_sales` solo si:

- es PYMES confirmado pero ambiguo;
- falta BAN en una venta PYMES;
- falta cliente en una venta PYMES;
- falta telefono cuando el producto PYMES requiere suscriptor;
- conflicto de match PYMES;
- posible duplicado PYMES no resoluble.

Motivos sugeridos:

- `tipo_ambiguo`
- `pymes_sin_ban`
- `pymes_sin_cliente`
- `pymes_sin_telefono`
- `conflicto_cliente_ban`
- `duplicado_no_resuelto`

Tipos no PYMES:

- no crean cliente;
- no crean BAN;
- no crean suscriptor;
- no crean `subscriber_reports`;
- no quedan `needs_review`;
- si ya existen en pending, quedan `ignored` con motivo `tipo_no_pymes`.

## Impacto Sobre Las 20 Pendientes Actuales

Rango `2026-06-01` a `2026-06-05`:

- antes: `1 confirmed`, `20 pending`
- esperado despues de regla PYMES:
  - ventas PYMES confirmadas pasan a CRM/subscriber_reports;
  - BYOP/Prepago queda `ignored` con motivo `tipo_no_pymes`;
  - solo PYMES ambiguas quedan pending.

Ejemplo:

- `80099 SONIA ARROYO`, tipo `Claro Update REN`, debe evaluarse si corresponde a `Corp Update Ren` / PYMES segun nombre real de Tango. Si es PYMES confirmado, debe auto-crear CRM y crear reporte.

## Validacion

Antes:

- backup BD.
- snapshot de `subscriber_reports`.
- snapshot de `tango_commission_pending_sales`.
- confirmar `AUTO_CREATE_FROM_TANGO` no se usa como bandera global.

Prueba corta:

1. Ejecutar sync solo `2026-06-01` a `2026-06-05`.
2. Confirmar no hay duplicados por `ventaid`.
3. Confirmar ventas PYMES con BAN inexistente ya no quedan pending por `ban_no_existe_en_crm`.
4. Confirmar se crean clientes/BANs/suscriptores solo para PYMES.
5. Confirmar `subscriber_reports` sube segun ventas PYMES creadas.
6. Confirmar BYOP/Accesorios/no PYMES quedan ignored y no activos en pending.
7. Confirmar Comisiones muestra solo `subscriber_reports`, no pending.

## Riesgos

- Crear cliente duplicado por nombre parecido.
- Crear BAN bajo cliente equivocado si el match por nombre es agresivo.
- Crear suscriptor incorrecto si telefono viene mal de Tango.
- Duplicar comision si no se valida `ventaid`.
- Clasificar mal un tipo Tango si solo se usa texto.
- Mezclar no PYMES en auto-creacion.

Mitigacion:

- match automatico fuerte solo por BAN;
- si no hay BAN existente, crear cliente nuevo con `pendiente_validacion = true`;
- no fusionar por nombre parecido;
- usar `ventaid` como llave de idempotencia;
- guardar `raw_payload`;
- dejar auditoria clara de origen Tango V2.

## Proximo Paso

Antes de programar:

1. Mantener el contrato PYMES como fuente oficial.
2. No sincronizar meses anteriores sin backup y autorizacion.
3. Validar nuevos tipos Tango contra la lista PYMES antes de incluirlos.
4. Usar la pantalla de pendientes solo para PYMES ambiguas.
