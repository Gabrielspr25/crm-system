# MASTER_CONTEXT_VENTASPROUI.md

## Regla critica de Comisiones

Desde 2026-06-03, Comisiones usa Tango API V2 como fuente principal de ventas.

Flujo correcto:

```text
Tango API V2
-> sync principal
-> subscriber_reports
-> Comisiones
```

Flujo prohibido:

```text
legacy/POS venta
-> sync principal
-> Tango API V2 solo enriquece
-> subscriber_reports
-> Comisiones
```

Legacy/POS queda como fallback y comparacion historica.

Caso centinela obligatorio:

- Cliente: GRUPO CLINICO DEL NOR
- BAN: `809070837`
- Ventas: `80036`, `80037`, `80038`, `80041`
- Mes: mayo 2026

Estas ventas deben aparecer en Comisiones despues de ejecutar sync del rango mayo 2026.
