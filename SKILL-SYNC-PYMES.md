# SKILL - Sync Ventas PYMES (Legacy → CRM)

## OBJETIVO

Sincronizar ventas PYMES desde base de datos Legacy (Tango) hacia CRM (subscriber_reports), validando que los vendedores tengan `role='vendedor'`.

---

## BASES DE DATOS

### Legacy (Tango - Ventas Históricas)
```javascript
{
  host: '167.99.12.125',
  port: 5432,
  database: 'claropr',
  user: 'postgres',
  password: 'fF00JIRFXc'
}
```

### CRM (Producción)
```javascript
{
  host: '143.244.191.139',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!'
}
```

---

## IDENTIFICACIÓN PYMES

**Tipos de venta PYMES en Legacy:**
```sql
ventatipoid IN (138, 139, 140, 141)
```

### Catálogo de Tipos PYMES
| ventatipoid | nombre | tipo_servicio | acción |
|-------------|--------|---------------|---------|
| 138 | PYMES Update REN | Móvil | Renovación |
| 139 | PYMES Update NEW | Móvil | Nueva |
| 140 | PYMES Fijo REN | Fijo | Renovación |
| 141 | PYMES Fijo NEW | Fijo | Nueva |

---

## PROCESO DE SYNC

### 1. Extracción de Legacy

```sql
SELECT 
  v.ventaid,
  v.fechaactivacion,
  v.ban,
  v.numerocelularactivado,
  v.comisionclaro,
  v.comisionvendedor,
  v.fijo,
  v.ventatipoid,
  vt.nombre as tipo_nombre,
  vd.nombre as vendedor_nombre,
  cc.nombre as cliente_nombre
FROM venta v
LEFT JOIN ventatipo vt ON v.ventatipoid = vt.ventatipoid
LEFT JOIN vendedor vd ON v.vendedorid = vd.vendedorid
LEFT JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
WHERE v.ventatipoid IN (138, 139, 140, 141)
  AND v.activo = true
  AND v.fechaactivacion >= $1  -- Fecha inicio parámetro
ORDER BY v.fechaactivacion DESC
```

**Campos clave:**
- `ban` - Para matching con CRM
- `numerocelularactivado` - Matching fallback
- `fechaactivacion` - report_month
- `comisionclaro` - company_earnings
- `comisionvendedor` - vendor_commission (⚠️ puede ser $0.00)

---

### 2. Matching con CRM

#### Paso A: Buscar subscriber por BAN
```sql
SELECT 
  sub.id as subscriber_id,
  sub.phone,
  s.role as salesperson_role
FROM subscribers sub
JOIN bans b ON sub.ban_id = b.id
JOIN clients c ON b.client_id = c.id
JOIN salespeople s ON c.salesperson_id = s.id
WHERE b.ban_number = $1
```

#### Paso B: Fallback por teléfono (si no encuentra BAN)
```sql
WHERE sub.phone = $1
```

#### Validaciones:
1. ✅ Subscriber existe en CRM
2. ✅ Salesperson tiene `role='vendedor'` (NO admin)
3. ✅ No existe reporte duplicado (subscriber_id + report_month)

---

### 3. Inserción en CRM

```sql
INSERT INTO subscriber_reports (
  subscriber_id,
  report_month,
  company_earnings,
  vendor_commission,
  paid_amount,
  created_at,
  updated_at
) VALUES (
  $1,  -- subscriber_id (UUID del CRM)
  $2,  -- fechaactivacion del legacy
  $3,  -- comisionclaro
  $4,  -- comisionvendedor
  NULL,  -- paid_amount (null inicialmente)
  NOW(),
  NOW()
)
ON CONFLICT (subscriber_id, report_month) DO NOTHING
```

---

## ESTADÍSTICAS DE SYNC

### Contadores a rastrear:
```javascript
const stats = {
  total_ventas_legacy: 0,        // Total encontrado en legacy
  subscriber_no_encontrado: 0,   // No hay match en CRM (BAN/phone)
  vendedor_es_admin: 0,          // Salesperson tiene role='admin' ⚠️
  reporte_duplicado: 0,          // Ya existe (subscriber + mes)
  creados_exitosos: 0,           // Insertados correctamente ✅
  errores: 0                     // Errores SQL
};
```

---

## CASOS EDGE

### 1. Venta sin BAN ni teléfono
**Acción:** Skip con contador `subscriber_no_encontrado`
**Log:** Mostrar ventaid, cliente, fecha

### 2. Vendedor es admin
**Acción:** Skip con contador `vendedor_es_admin` (v2026-295 compliance)
**Razón:** Admins no reciben comisiones

### 3. comisionvendedor = $0.00
**Acción:** Insertar igual, es dato real del legacy
**Nota:** Solo PYMES Móvil tienen comisiones, Fijo no

### 4. Reporte duplicado
**Acción:** ON CONFLICT DO NOTHING
**Log:** Incrementar contador `reporte_duplicado`

### 5. Conexión falla
**Acción:** Reintentar 3 veces, luego abortar transacción completa

---

## EJECUCIÓN

### Modo DRY RUN (Recomendado primero)
```javascript
const CONFIG = {
  FECHA_INICIO: '2025-01-01',  // Desde cuándo traer ventas
  LIMIT: 100,                  // Límite para testing
  DRY_RUN: true,              // ← No inserta en CRM
  SOLO_ACTIVOS: true          // Solo ventas activas
};
```

### Modo Producción
```javascript
const CONFIG = {
  FECHA_INICIO: '2025-01-01',
  LIMIT: null,                 // Sin límite
  DRY_RUN: false,             // ← Inserta en CRM
  SOLO_ACTIVOS: true
};
```

---

## DATOS ACTUALES (Feb 10, 2026)

### Legacy - Ventas PYMES:
- **Total:** 47 ventas activas
- **Período:** Enero 2025 - Febrero 2026
- **Comisión Claro:** $3,942.40
- **Comisión Vendedor:** Variable ($0 en Fijo)

### Desglose por tipo:
| Tipo | Ventas | Comisión |
|------|--------|----------|
| 138 - PYMES Update REN | 15 | $1,830.40 |
| 139 - PYMES Update NEW | 18 | $2,112.00 |
| 140 - PYMES Fijo REN | 11 | $0.00 |
| 141 - PYMES Fijo NEW | 3 | $0.00 |

### CRM - subscriber_reports:
- **Status:** ✅ Limpiado (0 registros)
- **Listo para:** Recibir sync de PYMES

---

## SCRIPT PRINCIPAL

**Archivo:** `sync-pymes-legacy-crm.cjs`

**Ubicación:** Raíz del proyecto VentasProui

**Ejecución:**
```powershell
node sync-pymes-legacy-crm.cjs
```

---

## VALIDACIONES POST-SYNC

### 1. Verificar conteo
```sql
-- En CRM
SELECT COUNT(*) FROM subscriber_reports;
-- Debe ser <= 47 (algunos pueden no hacer match)
```

### 2. Verificar comisiones
```sql
SELECT 
  SUM(company_earnings) as total_claro,
  SUM(vendor_commission) as total_vendedor
FROM subscriber_reports;
-- Comparar con legacy: $3,942.40 Claro
```

### 3. Verificar que no hay admins
```sql
SELECT 
  s.name, s.role, COUNT(*)
FROM subscriber_reports sr
JOIN subscribers sub ON sr.subscriber_id = sub.id
JOIN bans b ON sub.ban_id = b.id
JOIN clients c ON b.client_id = c.id
JOIN salespeople s ON c.salesperson_id = s.id
WHERE s.role = 'admin'
GROUP BY s.id, s.name, s.role;
-- Debe retornar 0 registros
```

### 4. Verificar duplicados
```sql
SELECT 
  subscriber_id, 
  report_month, 
  COUNT(*)
FROM subscriber_reports
GROUP BY subscriber_id, report_month
HAVING COUNT(*) > 1;
-- Debe retornar 0 registros
```

---

## TROUBLESHOOTING

### "subscriber_no_encontrado = 100%"
**Problema:** Todos los BANs del legacy no existen en CRM
**Causa:** Son sistemas separados, CRM solo tiene datos de Excel imports
**Solución:** Decidir si auto-crear clientes o mantener sistemas separados

### "vendedor_es_admin > 0"
**Problema:** Ventas asignadas a usuarios admin
**Causa:** Legacy permite admin como vendedor
**Solución:** Skip (correcto según v2026-295), o reasignar en legacy

### "comisionvendedor = $0.00 siempre"
**Observación:** Normal en PYMES Fijo (140, 141)
**Misterio:** ¿Por qué también en algunos móviles?
**Investigar:** Tabla `comision` u otra con comisiones reales

### Query de matching SQL muy lento
**Solución:** Crear índices:
```sql
-- En CRM
CREATE INDEX idx_bans_ban_number ON bans(ban_number);
CREATE INDEX idx_subscribers_phone ON subscribers(phone);
```

---

## HISTORIAL DE CAMBIOS

| Fecha | Versión | Cambio |
|-------|---------|--------|
| 2026-02-10 | 1.0 | Skill creado - sync inicial PYMES |
| 2026-02-10 | 1.0 | CRM limpiado (1 reporte eliminado) |

---

## PRÓXIMOS PASOS

1. ✅ Skill documentado
2. ⏳ Crear script `sync-pymes-legacy-crm.cjs`
3. ⏳ Ejecutar DRY RUN
4. ⏳ Analizar stats (% de matching)
5. ⏳ Decidir estrategia si matching bajo
6. ⏳ Ejecutar sync real
7. ⏳ Validar post-sync
8. ⏳ Automatizar (cron diario?)

---

## NOTAS IMPORTANTES

⚠️ **NO MEZCLAR IPs:**
- Legacy PYMES: 167.99.12.125
- Discrepancias: 159.203.70.5 (módulo separado)
- CRM: 143.244.191.139

⚠️ **Validación v2026-295:**
SIEMPRE verificar `role='vendedor'` antes insertar comisiones

⚠️ **Comisiones $0:**
Es dato real, no error. PYMES Fijo no generan comisión vendedor en legacy.
