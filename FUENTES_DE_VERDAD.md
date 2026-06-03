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
