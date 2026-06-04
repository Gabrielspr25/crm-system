# Comisiones y Tango - Verdad Vigente

## Fuente oficial

Comisiones usa Tango API V2 como fuente oficial.

Legacy/POS queda solo como fallback o comparacion historica. No debe ser puerta de entrada para ventas que existen en Tango V2.

Commit de referencia:

`4703d1e7cf6dc255c575d9712d0bbf719d88f707`

## Error historico corregido

Ventas existentes en Tango V2 no aparecian en Comisiones porque el sync dependia de legacy/POS como puerta de entrada.

Caso obligatorio:

- Cliente: GRUPO CLINICO DEL NOR
- BAN: 809070837
- Ventas Tango V2: 80036, 80037, 80038, 80041

Correccion: sync V2-first hacia `subscriber_reports`.

## Regla operativa

- No tocar Sync Tango V2 sin validacion.
- No borrar datos de `subscriber_reports`.
- No usar `tango_ventaid` como telefono.
- No cambiar `subscribers.phone`.
- Distinguir siempre datos legacy de ventas V2 sincronizadas.

Actualizado: 2026-06-03.
