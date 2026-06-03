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
