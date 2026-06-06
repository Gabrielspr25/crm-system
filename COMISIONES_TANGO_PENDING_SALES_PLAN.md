# COMISIONES TANGO V2 - Pending Sales

## Objetivo

Crear una bandeja oficial para ventas Tango V2 con comision real que no pueden entrar todavia a `subscriber_reports` porque no son PYMES confirmadas, son ambiguas o faltan datos minimos para crear relacion CRM completa:

`client -> BAN -> subscriber`

La tabla propuesta es:

`tango_commission_pending_sales`

Esta tabla no reemplaza Comisiones. Retiene ventas pendientes para revision manual futura y evita perder ventas con comision real cuando no corresponde auto-crear la relacion operativa CRM.

## Fuente Oficial

- Tango V2 `/api/external/ventas`
- Tango V2 `/api/external/comisiones`

## Regla Principal

Si Tango V2 trae una venta con comision real mayor a cero, no debe perderse.

Regla actualizada:

- Si la venta es PYMES confirmada, el sync debe crear Cliente -> BAN -> Suscriptor si faltan y luego crear `subscriber_reports`.
- Si la venta no es PYMES, no entra a pending activo: se ignora por regla `tipo_no_pymes`.
- Si la venta PYMES es ambigua o no tiene datos minimos para crear la relacion CRM, se guarda en `tango_commission_pending_sales` con estado `needs_review`.

## Reglas De Datos

- No crear `clients` automaticamente para ventas no PYMES.
- No crear `bans` automaticamente para ventas no PYMES.
- No crear `subscribers` automaticamente para ventas no PYMES.
- Para ventas PYMES confirmadas, la auto-creacion esta permitida y es la regla correcta de negocio.
- No duplicar por `ventaid`.
- Permitir revision manual futura.
- `subscriber_reports` sigue siendo la tabla de comisiones vinculadas y listas para calculo.
- `tango_commission_pending_sales` solo guarda ventas pendientes, vinculadas o ignoradas.
- BYOP, Prepago, Accesorios y otros tipos fuera de PYMES quedan `ignored` con motivo `tipo_no_pymes` si ya existen en la tabla.

## Estados

### needs_review

Venta Tango con comision real que no puede auto-crearse ni vincularse de forma segura.

Casos esperados:

- Venta sin BAN.
- Cliente Tango no existe o no es confiable para match automatico.
- Venta PYMES ambigua.
- Venta PYMES sin datos minimos para crear cliente/BAN/suscriptor.

### linked

Venta ya revisada y vinculada manualmente a:

- `linked_client_id`
- `linked_ban_id`
- `linked_subscriber_id`

Una venta `linked` puede pasar al flujo de `subscriber_reports` sin duplicar.

### ignored

Venta excluida manualmente o por regla aprobada.

Ejemplos posibles:

- Tipo no comisionable para SS-Group.
- Venta duplicada confirmada por operacion.
- Venta de prueba.
- BYOP, Prepago, Accesorios u otros tipos fuera de PYMES: motivo `tipo_no_pymes`.

## Campos Requeridos

- `ventaid`
- `ban_tango`
- `cliente_tango`
- `telefono_tango`
- `ventatipo_id`
- `ventatipo_nombre`
- `fecha_activacion`
- `company_earnings`
- `vendor_commission`
- `raw_payload`
- `motivo`
- `status`
- `linked_client_id`
- `linked_ban_id`
- `linked_subscriber_id`
- `created_at`
- `updated_at`

## DDL Propuesto

```sql
CREATE TABLE IF NOT EXISTS tango_commission_pending_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  ventaid BIGINT NOT NULL UNIQUE,

  ban_tango TEXT NULL,
  cliente_tango TEXT NULL,
  telefono_tango TEXT NULL,

  ventatipo_id INTEGER NULL,
  ventatipo_nombre TEXT NULL,
  fecha_activacion DATE NULL,

  company_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
  vendor_commission NUMERIC(12,2) NOT NULL DEFAULT 0,

  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  motivo TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('needs_review', 'linked', 'ignored')),

  linked_client_id UUID NULL REFERENCES clients(id),
  linked_ban_id UUID NULL REFERENCES bans(id),
  linked_subscriber_id UUID NULL REFERENCES subscribers(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tango_pending_status
  ON tango_commission_pending_sales(status);

CREATE INDEX IF NOT EXISTS idx_tango_pending_ban_tango
  ON tango_commission_pending_sales(ban_tango);

CREATE INDEX IF NOT EXISTS idx_tango_pending_fecha_activacion
  ON tango_commission_pending_sales(fecha_activacion);

CREATE INDEX IF NOT EXISTS idx_tango_pending_ventatipo
  ON tango_commission_pending_sales(ventatipo_id);
```

## Integracion Con El Sync

Flujo anterior:

1. Tango V2 trae venta y comision.
2. El mapper decide si existe comision real.
3. Si el BAN existe en CRM, el sync resuelve BAN, suscriptor y crea/actualiza `subscriber_reports`.
4. Si el BAN no existe y `AUTO_CREATE_FROM_TANGO=false`, la venta queda en `externalSales` con `motivo = ban_no_existe_en_crm`.

Flujo actualizado:

1. Clasificar la venta Tango V2.
2. Si es PYMES confirmada y tiene comision real:
   - crear cliente si no existe;
   - crear BAN si no existe;
   - crear suscriptor si no existe y Tango trae telefono/linea;
   - crear `subscriber_reports`;
   - marcar origen Tango V2.
3. Si no es PYMES:
   - no crear datos maestros;
   - no crear `subscriber_reports`;
   - no hacer upsert activo en pending.
4. Si es PYMES ambigua o no tiene datos minimos:
   - hacer upsert en `tango_commission_pending_sales`;
   - usar `ventaid` como llave unica.
5. Si la venta ya existe en pending y esta `needs_review`, refrescar datos Tango.
6. Si la venta ya esta `linked` o `ignored`, no reabrir automaticamente.
7. No insertar desde pending en `subscriber_reports` hasta que exista `linked_subscriber_id`.

## Upsert Propuesto

```sql
INSERT INTO tango_commission_pending_sales (
  ventaid,
  ban_tango,
  cliente_tango,
  telefono_tango,
  ventatipo_id,
  ventatipo_nombre,
  fecha_activacion,
  company_earnings,
  vendor_commission,
  raw_payload,
  motivo,
  status,
  created_at,
  updated_at
)
VALUES (...)
ON CONFLICT (ventaid)
DO UPDATE SET
  ban_tango = EXCLUDED.ban_tango,
  cliente_tango = EXCLUDED.cliente_tango,
  telefono_tango = EXCLUDED.telefono_tango,
  ventatipo_id = EXCLUDED.ventatipo_id,
  ventatipo_nombre = EXCLUDED.ventatipo_nombre,
  fecha_activacion = EXCLUDED.fecha_activacion,
  company_earnings = EXCLUDED.company_earnings,
  vendor_commission = EXCLUDED.vendor_commission,
  raw_payload = EXCLUDED.raw_payload,
  motivo = EXCLUDED.motivo,
  updated_at = NOW()
WHERE tango_commission_pending_sales.status = 'needs_review';
```

## Validacion Con Rango 2026-06-01 A 2026-06-05

Diagnostico actual del rango:

- Tango V2 trae 21 ventas.
- 1 venta entra a `subscriber_reports`: `80090`.
- 20 ventas quedan externas por `ban_no_existe_en_crm`.

Resultado obtenido con la fase pending anterior:

- `subscriber_reports`: mantiene la venta confirmada `80090`.
- `tango_commission_pending_sales`: recibe 20 filas.
- `COUNT(DISTINCT ventaid) = 20`.
- `status = needs_review`: 20 inicialmente.
- `motivo = ban_no_existe_en_crm`: 20.
- Clientes creados automaticamente: 0.
- BANs creados automaticamente: 0.
- Suscriptores creados automaticamente por estas ventas: 0.

Resultado esperado despues de implementar regla PYMES:

- Las ventas PYMES confirmadas de este rango ya no deben quedar en pending por falta de BAN.
- Deben crear cliente/BAN/suscriptor cuando aplique.
- Deben crear `subscriber_reports`.
- `tango_commission_pending_sales` debe conservar solo ventas PYMES ambiguas o vinculadas/ignoradas historicas.

Ventas esperadas en pending para ese rango:

- `80080`
- `80081`
- `80082`
- `80083`
- `80084`
- `80085`
- `80086`
- `80087`
- `80088`
- `80089`
- `80091`
- `80092`
- `80093`
- `80094`
- `80095`
- `80096`
- `80097`
- `80098`
- `80099`
- `80100`

## Riesgos

- BYOP, Prepago y Accesorios quedan fuera por regla final de negocio.
- Si Tango cambia nombres/IDs PYMES, el contrato debe actualizarse antes de sincronizar rangos grandes.
- Si una venta `linked` vuelve en otro sync, no debe duplicarse ni cambiar a `needs_review`.
- Si se vincula una venta al suscriptor incorrecto, Comisiones puede sumar mal.
- La pantalla de Comisiones no debe sumar pendientes hasta que esten vinculadas.
- No debe activarse `AUTO_CREATE_FROM_TANGO` como solucion general para todos los tipos.
- La auto-creacion debe estar limitada a tipos PYMES confirmados.

## Proximo Paso

Preparar cambio de backend para:

1. Clasificar tipos PYMES confirmados.
2. Auto-crear CRM solo para ventas PYMES con comision real.
3. Mantener pending solo para PYMES ambiguas.
4. Marcar pending no PYMES existente como `ignored` / `tipo_no_pymes`.
5. Validar con sync corto `2026-06-01` a `2026-06-05`.
