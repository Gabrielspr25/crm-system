# SKILL - Bases de Datos del Sistema

## BASES DE DATOS SEPARADAS (NO MEZCLAR)

### 1. BD LEGACY TANGO (Ventas Históricas)
**IP:** `167.99.12.125`
**Puerto:** `5432`
**Base de datos:** `claropr`
**Usuario:** `postgres`
**Password:** `p0stmu7t1`

**Propósito:** Ventas históricas de Claro PR (Tango system)

**Tablas principales:**
- `venta` - 61,976 registros (60,082 activos)
- `ventatipo` - 49 tipos de venta
- `vendedor` - 241 vendedores
- `clientecredito` - 9,892 clientes
- `tipoplan` - 2,683 planes

**PYMES en Legacy:**
- Identificar por: `ventatipoid IN (138, 139, 140, 141)`
  - 138: PYMES Update REN
  - 139: PYMES Update NEW
  - 140: PYMES Fijo REN
  - 141: PYMES Fijo NEW

---

### 2. BD CRM PRODUCCIÓN (Sistema Actual)
**IP:** `143.244.191.139`
**Puerto:** `5432`
**Base de datos:** `crm_pro`
**Usuario:** `crm_user`
**Password:** `CRM_Seguro_2025!`

**Propósito:** CRM actual de VentasPro

**Tablas principales:**
- `clients` - Clientes actuales
- `bans` - Números BAN
- `subscribers` - Suscriptores
- `subscriber_reports` - Reportes/comisiones
- `salespeople` - Vendedores (con role='vendedor' validation)

**Validación crítica:** `role='vendedor'` (NO admin)

---

### 3. BD DISCREPANCIAS (Módulo Independiente)
**IP:** `159.203.70.5` ⚠️
**Puerto:** `5432`
**Base de datos:** `???`
**Usuario:** `???`
**Password:** `???`

**Propósito:** Módulo de discrepancias que se comunica con varios IPs

**⚠️ NO MEZCLAR CON LEGACY O CRM**

---

## FLUJO DE TRABAJO

### Para consultas LEGACY (ventas históricas Tango):
```javascript
const legacyPool = new Pool({
  host: '167.99.12.125',  // ← CORRECTO
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'p0stmu7t1'
});
```

### Para consultas CRM (producción):
```javascript
const crmPool = new Pool({
  host: '143.244.191.139',  // ← CORRECTO
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
});
```

### Para módulo DISCREPANCIAS:
**NO TOCAR** a menos que el usuario específicamente pida trabajar con discrepancias

---

## REGLAS DE ORGANIZACIÓN

1. **SIEMPRE verificar** qué BD pide el usuario antes de crear script
2. **NO asumir IP** - preguntar si no está claro
3. **Separar scripts** por BD (nombrar: `*-legacy.cjs`, `*-crm.cjs`, `*-discrepancias.cjs`)
4. **Documentar en nombre** del script qué BD usa
5. **Si dice "legacy"** → 167.99.12.125
6. **Si dice "CRM"** → 143.244.191.139
7. **Si dice "discrepancias"** → Es módulo separado, preguntar IP

---

## CORRECCIÓN APLICADA

**ERROR ANTERIOR:** Usé 159.203.70.5 para legacy
**CORRECCIÓN:** Legacy real es 167.99.12.125

**Archivos a recrear con IP correcto:**
- ver-tabla-venta.cjs
- ver-ventatipo.cjs
- explorar-pymes.cjs
- sync-ventas-tango-crm.cjs
- Todos los scripts de análisis legacy

---

## PRÓXIMOS PASOS

1. ✅ Skill creado
2. ⏳ Reconectar a legacy CORRECTO (167.99.12.125)
3. ⏳ Verificar que IDs 138-141 EXISTEN en legacy correcto
4. ⏳ Extraer ventas PYMES del legacy correcto
5. ⏳ Sync a CRM con validación role='vendedor'
