# MAPEO DE CAMPOS - DISCREPANCIAS

## COMPARACIÓN: EXCEL vs BD MULTICELLULAR

| # | CAMPO ESPERADO | COLUMNA EXCEL (Frontend) | COLUMNA BD MULTICELLULAR (Tabla `venta`) | TIPO BD | NOTAS |
|---|----------------|--------------------------|------------------------------------------|---------|-------|
| 1 | **FECHA** | `activation_date` | `fechaactivacion` | `date` | ✅ OK |
| 2 | **BAN** | `ban` | `ban` | `character varying` | ✅ OK |
| 3 | **SUSCRIBER** | `phone` | `numerocelularactivado` | `bigint` | ✅ OK (cast a text) |
| 4 | **NOMBRE** | `nombre` | `clientecredito.nombre` (JOIN) | `character varying` | ✅ OK (requiere JOIN) |
| 5 | **CODIGO VOZ** | `codigo_voz` | `codigovoz` | `character varying` | ✅ OK |
| 6 | **VALOR** | `valor` | `cobroequipo` | `numeric(20,2)` | ✅ OK |
| 7 | **SIMCARD** | `imsi` | `simcard` | `character varying` | ✅ OK |
| 8 | **IMEI** | `imei` | `emai` | `character varying` | ✅ OK |
| 9 | **PAPER** | `product_type` | `nota` | `character varying` | ⚠️ **PROBLEMA** |
| 10 | **SEGURO** | `product_type` | ??? | ??? | ❌ **NO EXISTE** |
| 11 | **PRICE CODE** | `plan` | `pricecode` | `character varying` | ✅ OK |

---

## PROBLEMAS IDENTIFICADOS:

### ❌ PROBLEMA 1: SEGURO
- **Excel:** `product_type`
- **BD Multicellular:** **NO EXISTE columna "seguro"**
- **Opciones disponibles en BD:**
  - `celuseguroexistente` (boolean)
  - Ninguna columna tiene datos de tipo de seguro

### ⚠️ PROBLEMA 2: PAPER
- **Excel:** `product_type` (mismo que SEGURO)
- **BD Multicellular:** Mapeado a `nota` (character varying)
- **Problema:** Estamos usando el mismo campo del Excel (`product_type`) para DOS columnas diferentes (PAPER y SEGURO)

### ⚠️ PROBLEMA 3: PRICE CODE
- **Excel:** `plan`
- **BD Multicellular:** `pricecode` (no `price_code` con guión bajo)

---

## QUERY ACTUAL EN EL BACKEND:

```sql
SELECT 
    v.fechaactivacion as fecha,
    v.ban,
    CAST(v.numerocelularactivado AS text) as suscriber,
    c.nombre,
    v.codigovoz as codigo_voz,
    v.cobroequipo as valor,
    v.simcard,
    v.emai as imei,
    v.nota as paper,
    'N/A' as seguro,  -- ❌ HARDCODED porque no existe
    v.codigovoz as price_code  -- ⚠️ DUPLICADO (debería ser pricecode)
FROM venta v
LEFT JOIN clientecredito c ON v.clientecreditoid = c.clientecreditoid
WHERE CAST(v.numerocelularactivado AS text) LIKE '%' || $1
```

---

## CORRECCIONES NECESARIAS:

1. **SEGURO:** Decidir qué columna usar o dejar como N/A
2. **PRICE CODE:** Cambiar de `codigovoz` a `pricecode`
3. **PAPER:** Confirmar si `nota` es correcto o usar otra columna

---

## COLUMNAS DISPONIBLES EN `venta` QUE PODRÍAN SER ÚTILES:

- `papper` (boolean) - ¿Es esto "paper"?
- `papperexistente` (boolean)
- `referenciapapper` (character varying)
- `celuseguroexistente` (boolean) - ¿Es esto "seguro"?
- `pricecode` (character varying) - **ESTE es el price code correcto**
- `nota` (character varying) - Actualmente mapeado a "paper"

