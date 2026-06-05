# ERRORES_HISTORICOS.md

Objetivo:
Registrar cada error importante para que nunca vuelva a investigarse desde cero.

Formato obligatorio:

## FECHA

### Problema

Descripcion corta.

### Sintoma

Que veia el usuario.

### Causa raiz

Que provocaba realmente el error.

### Diagnostico correcto

Como se descubrio.

### Solucion aplicada

Que se hizo.

### Regla permanente

Que nunca debe volver a asumirse.

---

## 2026-06-03

### Problema

Ventas visibles en Tango V2 no aparecian en Comisiones.

### Sintoma

GRUPO CLINICO DEL NOR aparecia en Tango pero no en Comisiones.

Caso concreto: cliente GRUPO CLINICO DEL NOR, BAN `809070837`, ventas V2 `80036`, `80037`, `80038`, `80041`.

### Causa raiz

El sync seguia entrando por legacy/POS y usaba Tango V2 solo como enriquecimiento.

### Diagnostico correcto

Comparacion entre CARIBE TRACK (si aparece) y GRUPO CLINICO DEL NOR (no aparece).

CARIBE TRACK, venta `79989`, mayo 2026, funcionaba porque existia en legacy/POS; GRUPO CLINICO DEL NOR fallaba porque era V2-only.

### Solucion aplicada

Sync de Comisiones cambiado a Tango API V2-first. Legacy/POS queda solo como fallback/comparacion historica y para completar datos faltantes, nunca como puerta de entrada.

### Regla permanente

Tango API V2 es la fuente oficial de ventas para Comisiones. Si una venta existe en Tango API V2, debe poder entrar a Comisiones aunque no exista en legacy/POS.

---

## 2026-06-05

### Problema

Seguimiento mostraba mas clientes que la cartera comercial activa real.

### Sintoma

La vista de Seguimiento llego a mostrar 24 registros, mientras las fuentes visuales activas esperadas mostraban 9:

- `/api/seguimiento`
- `/api/clients?tab=following`
- `/api/sov2/opportunities`

### Causa raiz

Existian 15 registros stale activos en `follow_up_prospects` sin BAN, sin vendedor y sin datos comerciales validos.

IDs afectados:

```text
370,369,368,367,366,365,364,363,354,352,350,349,348,347,126
```

### Diagnostico correcto

Se compararon en produccion:

- `/api/seguimiento`
- `/api/clients?tab=following`
- `/api/sov2/opportunities`

La discrepancia venia de registros activos en `follow_up_prospects` que no cumplian la regla visual de cartera comercial activa:

- cliente valido
- seguimiento activo
- al menos un BAN asociado

### Solucion aplicada

Primero se filtro `/api/seguimiento` para no mostrar registros sin cliente valido o sin BAN.

Luego se desactivaron los 15 registros stale y, tras validacion, se eliminaron definitivamente solo esos IDs.

Backup generado antes del DELETE:

```text
/tmp/follow_up_prospects_stale_15_backup_20260605-021246.sql
```

Validacion final:

```text
/api/seguimiento = 9
/api/clients?tab=following = 9
/api/sov2/opportunities = 9
```

### Regla permanente

La vista oficial de cartera comercial activa en Seguimiento requiere:

- cliente valido
- seguimiento activo
- al menos un BAN asociado

Registros stale en `follow_up_prospects` no deben mostrarse como trabajo comercial activo.
