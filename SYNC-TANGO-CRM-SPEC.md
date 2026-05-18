# SYNC TANGO → CRM — Especificación Técnica v1.0

**Fecha:** 2026-02-18  
**Estado:** En implementación  
**Autor:** Gabriel + Agente

---

## 1. Principio Fundamental

> **TANGO ES SOURCE OF TRUTH. Si hay conflicto, gana Tango.**  
> Todo conflicto genera una **alerta** para revisión humana, pero Tango se aplica siempre.

---

## 2. Arquitectura del CRM (3 niveles)

```
clients (nombre, salesperson_id)
  └─ bans (ban_number, account_type, status)
       └─ subscribers (phone, plan, line_type, monthly_value, tango_ventaid)
            └─ subscriber_reports (report_month, company_earnings, vendor_commission)
```

---

## 3. Migración Requerida

```sql
-- Columna para prevenir duplicados al re-correr sync
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS tango_ventaid INTEGER UNIQUE;

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_subscribers_tango_ventaid ON subscribers(tango_ventaid) WHERE tango_ventaid IS NOT NULL;
```

---

## 4. Fuente de Datos: Tango

### Query principal
```sql
SELECT DISTINCT
  v.ventaid,
  v.ban::text AS ban,
  NULLIF(TRIM(v.status), '') AS phone,
  v.codigovoz AS plan_code,
  v.ventatipoid,
  tp.rate AS mensualidad,
  COALESCE(v.comisionclaro, 0)::numeric(12,2) AS com_empresa,
  COALESCE(v.comisionvendedor, 0)::numeric(12,2) AS com_vendedor,
  v.fechaactivacion,
  cc.nombre AS cliente,
  vd.nombre AS vendedor
FROM venta v
LEFT JOIN clientecredito cc ON v.clientecreditoid = cc.clientecreditoid
LEFT JOIN tipoplan tp ON v.codigovoz = tp.codigovoz
LEFT JOIN vendedor vd ON v.vendedorid = vd.vendedorid
WHERE v.ventatipoid IN (138, 139, 140, 141)
  AND v.activo = true
ORDER BY cc.nombre, v.ban::text, v.ventaid
```

### Tipos de venta
| ventatipoid | Nombre | line_type CRM | Categoría |
|---|---|---|---|
| 138 | Update Renovación | REN | movil_renovacion |
| 139 | Update Nueva | NEW | movil_nueva |
| 140 | Fijo Renovación | REN | fijo_ren |
| 141 | Fijo Nueva | NEW | fijo_new |

---

## 5. Flujo por Venta

```
POR CADA venta de Tango (activo=true, ventatipoid IN 138-141):

┌─────────────────────────────────────────────────────────┐
│ PASO 1: RESOLVER CLIENTE                                │
│                                                         │
│ 1a. SELECT ban_id, client_id FROM bans                  │
│     WHERE ban_number = venta.ban                        │
│                                                         │
│ 1b. SI BAN no existe:                                   │
│     - Buscar cliente por nombre (ILIKE TRIM)            │
│     - SI cliente no existe → CREATE client              │
│     - CREATE ban bajo ese client_id                     │
│     - ALERTA: "Cliente/BAN creado: {nombre} {ban}"      │
│                                                         │
│ RESULTADO: client_id + ban_id                           │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ PASO 2: RESOLVER SUBSCRIBER                             │
│                                                         │
│ 2a. SELECT id FROM subscribers                          │
│     WHERE tango_ventaid = venta.ventaid                 │
│                                                         │
│ 2b. SI no existe:                                       │
│     INSERT subscriber (ban_id, phone, plan,             │
│       line_type, monthly_value, tango_ventaid)          │
│                                                         │
│ 2c. SI existe Y datos cambiaron:                        │
│     UPDATE subscriber                                   │
│     ALERTA: "Datos actualizados: {campo} {viejo}→{new}" │
│                                                         │
│ RESULTADO: subscriber_id                                │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ PASO 3: RESOLVER SUBSCRIBER_REPORT                      │
│                                                         │
│ report_month = PRIMER DÍA del mes de fechaactivacion    │
│ Ej: 2026-02-15 → 2026-02-01                            │
│                                                         │
│ UPSERT subscriber_reports:                              │
│   ON CONFLICT (subscriber_id, report_month)             │
│   DO UPDATE SET company_earnings, vendor_commission     │
│                                                         │
│ SI comisión cambió → ALERTA: "Comisión modificada"      │
│                                                         │
│ RESULTADO: reporte registrado                           │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Mapeo de Campos

| Campo Tango | → Campo CRM | Tabla | Notas |
|---|---|---|---|
| `venta.ban` | `bans.ban_number` | bans | Clave de búsqueda principal |
| `clientecredito.nombre` | `clients.name` | clients | TRIM, se usa tal cual de Tango |
| `vendedor.nombre` | `clients.salesperson_id` | clients | Match por nombre → salespeople.id. Si no matchea → NULL + alerta |
| `venta.status` | `subscribers.phone` | subscribers | Si vacío → NULL (NUNCA inventar teléfonos) + alerta |
| `venta.codigovoz` | `subscribers.plan` | subscribers | Código tal cual de Tango |
| `tipoplan.rate` | `subscribers.monthly_value` | subscribers | Si NULL en tipoplan → 0 + alerta "Plan sin rate" |
| `ventatipoid` | `subscribers.line_type` | subscribers | 138/140=REN, 139/141=NEW |
| `venta.comisionclaro` | `subscriber_reports.company_earnings` | subscriber_reports | COALESCE a 0 |
| `venta.comisionvendedor` | `subscriber_reports.vendor_commission` | subscriber_reports | COALESCE a 0 |
| `venta.fechaactivacion` | `subscriber_reports.report_month` | subscriber_reports | Truncar al 1ro del mes |
| `venta.ventaid` | `subscribers.tango_ventaid` | subscribers | Clave anti-duplicado, UNIQUE |

---

## 7. Mapeo Vendedor → Salesperson

```sql
SELECT id FROM salespeople 
WHERE LOWER(TRIM(name)) LIKE LOWER(TRIM($vendedor_tango)) || '%'
LIMIT 1
```

| Vendedor Tango | Salesperson CRM esperado |
|---|---|
| Gabriel / Gabriel Sanchez | Gabriel Sánchez |
| Dayana | Dayana |
| Yaritza | Yaritza |
| Hernan Sanchez | Hernán Sánchez |

Si no matchea → `salesperson_id = NULL` + alerta 🔴 "Vendedor sin asignar"

---

## 8. Idempotencia (Anti-Duplicados)

El sync se puede correr **N veces** sin crear duplicados:

| Tabla | Clave única | Estrategia |
|---|---|---|
| `subscribers` | `tango_ventaid` (UNIQUE) | Si existe → UPDATE, no INSERT |
| `subscriber_reports` | `(subscriber_id, report_month)` PK | UPSERT con ON CONFLICT |
| `bans` | `ban_number` (UNIQUE) | Si existe → usar existente |
| `clients` | Búsqueda por nombre ILIKE | Si existe → usar existente |

---

## 9. Ventas Canceladas

Si una venta cambia a `activo = false` en Tango:
- El `subscriber_report` se **actualiza con `company_earnings = 0`** (no se borra, se mantiene historial)
- El `subscriber` se mantiene (historial)
- ALERTA: "Venta cancelada: ventaid {id}"

---

## 10. follow_up_prospects

> **El sync NO toca follow_up_prospects.**

Los conteos de productos (fijo_ren, fijo_new, movil_renovacion, movil_nueva) y la gestión de seguimiento se manejan manualmente desde el módulo de Seguimiento.

---

## 11. Sistema de Alertas

Cada ejecución del sync genera alertas clasificadas por severidad:

### Niveles
| Nivel | Icono | Significado | Ejemplo |
|---|---|---|---|
| 🔴 error | Requiere acción manual | Vendedor sin asignar, plan sin rate |
| 🟡 warn | Tango ganó pero algo cambió | Nombre actualizado, comisión modificada, teléfono vacío |
| 🟢 info | Creación nueva, todo OK | Cliente creado, subscriber creado |

### Response JSON
```json
{
  "success": true,
  "stats": {
    "tango_ventas": 41,
    "clients_created": 0,
    "clients_updated": 2,
    "bans_created": 0,
    "subscribers_created": 3,
    "subscribers_updated": 38,
    "reports_upserted": 41,
    "errors": 0
  },
  "alerts": [
    { "level": "info", "ban": "800243429", "msg": "Subscriber creado: ventaid 79636 plan A886" },
    { "level": "warn", "ban": "718429246", "msg": "5 líneas sin teléfono (TARTAK IMPORTS)" },
    { "level": "warn", "ban": "719400825", "msg": "Nombre actualizado: 'Colegio Santa Gema' → 'COLEGIO SANTA GEMA'" },
    { "level": "error", "ban": "841786385", "msg": "Vendedor 'Gabriel' sin match en salespeople" },
    { "level": "warn", "ban": "718429246", "msg": "Plan 7033 sin rate en tipoplan ($0)" }
  ]
}
```

---

## 12. UI — Botón Sync en Reportes

1. Botón "Sync Tango" en la barra de acciones de Comisiones y Ventas
2. Al presionar → spinner + `POST /api/sync-tango`
3. Al completar → banner con stats + alertas coloreadas
4. Botón X para cerrar banner
5. Auto-refresca tabla de reportes

### Alertas en UI
- 🔴 **error** → Fondo rojo, requiere acción
- 🟡 **warn** → Fondo ámbar, informativo pero cambió algo  
- 🟢 **info** → Fondo verde, creaciones normales

---

## 13. Endpoint

```
POST /api/sync-tango
Authorization: Bearer {token}
```

- Solo usuarios autenticados
- Sin parámetros (sincroniza TODO lo activo de Tango)
- Retorna JSON con stats + alerts

---

## 14. Archivos Involucrados

| Archivo | Cambio |
|---|---|
| `src/backend/controllers/syncController.js` | **NUEVO** — Lógica principal del sync |
| `src/backend/routes/syncRoutes.js` | **NUEVO** — POST /api/sync-tango |
| `server-FINAL.js` | Montar syncRoutes |
| `src/react-app/pages/Reports.tsx` | Botón Sync + banner de resultado |
| `elementos_extra/sqls/schema-final.sql` | ALTER TABLE subscribers ADD tango_ventaid |

---

## 15. Pendientes / Mejoras Futuras

- [ ] Modo `--dry-run` que muestra qué haría sin aplicar
- [ ] Filtro por mes en el endpoint (`?month=2026-03`)
- [ ] Mapeo vendedor automático con tabla `vendor_salesperson_mapping`
- [ ] Detección de ventas canceladas (activo=false → marcar $0)
- [ ] Dashboard de historial de syncs (tabla sync_logs ya existe)
- [ ] Notificación cuando hay alertas 🔴 pendientes

---

## 16. Historial de Cambios

| Versión | Fecha | Cambio |
|---|---|---|
| v1.0 | 2026-02-18 | Spec inicial basada en lecciones aprendidas del sync anterior |
