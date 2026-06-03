# CONTRATOS_ENTRE_MODULOS.md

## Comisiones <- Tango

### Entrada

El sync de Comisiones lee primero Tango API V2 y normaliza cada venta al formato interno del CRM.

### Salida

El sync escribe en:

- `subscribers`
- `subscriber_reports`

### Idempotencia

El identificador externo de venta (`ventaid`) debe mantenerse en:

- `subscribers.tango_ventaid`
- `subscriber_reports.external_sale_id`
- `subscriber_reports.raw_payload.ventaid`

Correr el sync varias veces sobre el mismo rango no debe duplicar ventas.

### Fallback

Legacy/POS solo puede completar datos faltantes o aportar ventas que todavia no existan en V2. No puede excluir ventas presentes en V2.

### Reporte final

`GET /api/subscriber-reports?month=YYYY-MM` no consulta Tango en vivo. Solo muestra lo que ya existe en `subscriber_reports`.
