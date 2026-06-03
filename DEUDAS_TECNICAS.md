# DEUDAS_TECNICAS.md

## FIJO_PLACEHOLDERS_CLEANUP

Estado: pendiente.

No tocar dentro del cambio V2-first de Comisiones.

Antes de limpiar cualquier dato se requiere inventario completo de:

- `subscribers.phone LIKE 'FIJO-%'`
- `subscribers.phone LIKE 'LINEA-%'`
- `subscribers.phone LIKE 'SIN-TEL-%'`
- `subscriber_reports` asociados a esos subscribers
- comisiones historicas con `company_earnings > 0` o `vendor_commission > 0`

Regla: no borrar ni modificar placeholders sin backup, inventario y decision explicita.
