# Reglas de Negocio: Ventas y Comisiones

## 🎯 Propósito
Documentar las reglas críticas del flujo de ventas, asignación de vendedores, y generación de comisiones en VentasPro CRM.

---

## 📋 Flujo de Cliente → Venta Completada

### 1. Creación de Cliente
- ✅ **Cliente se crea SIN vendedor asignado** (`salesperson_id = NULL`)
- ✅ Admin crea clientes desde interfaz
- ✅ Importaciones CSV/XLSX pueden crear clientes sin vendedor
- ❌ **NO validar vendedor obligatorio al crear cliente**

**Motivo:** Admin gestiona clientes hasta asignarlos a vendedores.

---

### 2. Asignación de Vendedor
- ✅ **Vendedor se asigna SOLO al ir "A Seguimiento"**
- ✅ Admin selecciona vendedor y mueve cliente a `follow_up_prospects`
- ✅ Campo `salesperson_id` se actualiza en tabla `clients`
- ❌ **NO permitir seguimiento sin vendedor asignado**

**Motivo:** Vendedor debe estar identificado para tracking de ventas.

---

### 3. Venta Completada = subscriber_reports
- ✅ **Reporte representa venta finalizada con comisión calculada**
- ✅ Tabla: `subscriber_reports`
  - `subscriber_id` (FK → subscribers)
  - `report_month` (fecha de reporte)
  - `company_earnings` (ganancia empresa)
  - `vendor_commission` (comisión vendedor) ← **ESTE ES EL DATO CLAVE**
  - `paid_amount` (monto pagado)
  - `paid_date` (fecha de pago)

**Nomenclatura:**
- ✅ "Reporte" = Venta completada con comisión
- ✅ "Comisión vendedor" = `vendor_commission`
- ✅ "Ganancia empresa" = `company_earnings`

---

## ⚠️ VALIDACIONES OBLIGATORIAS

### REGLA CRÍTICA #1: Vendedor Real en Comisiones
**Al guardar `subscriber_reports` (venta completada):**

```sql
-- VALIDACIÓN ANTES DE INSERT/UPDATE
SELECT c.name, s.role 
FROM subscribers sub
JOIN bans b ON sub.ban_id = b.id
JOIN clients c ON b.client_id = c.id
JOIN salespeople s ON c.salesperson_id = s.id
WHERE sub.id = :subscriber_id
```

**REQUISITOS:**
- ✅ Cliente DEBE tener `salesperson_id` asignado
- ✅ Salesperson DEBE tener `role = 'vendedor'` (NO 'admin')
- ❌ **RECHAZAR** si vendedor es admin
- ❌ **RECHAZAR** si cliente no tiene vendedor

**Mensaje de Error:**
```
No se puede guardar comisión. El cliente "{nombre}" debe tener un vendedor 
asignado (role='vendedor'). Actualmente: {nombre_salesperson} ({role}).
Los admins no pueden recibir comisiones.
```

**Implementado en:** `server-FINAL.js` línea ~1958 (endpoint PUT /api/subscriber-reports/:subscriber_id)

---

### REGLA CRÍTICA #2: Devolución a Admin
- ✅ Vendedor puede "Devolver" cliente desde seguimiento
- ✅ Cliente vuelve a pool de admin (`salesperson_id` puede quedar en vendedor o volver a NULL)
- ❌ **NO crear nuevas comisiones** mientras cliente esté devuelto

**Motivo:** Comisiones solo para ventas activas con vendedor asignado.

---

## 🔄 Importaciones Legacy (Tango)

### Scripts de Migración:
1. **`migrar-reportes-legacy.js`** - Análisis inicial
2. **`completar-reportes-legacy.js`** - Diagnóstico de migración
3. **`buscar-venta-legacy.js`** - Consulta puntual por BAN
4. **`diagnostico-importacion-legacy.js`** - Dashboard de estado

### Origen de Datos Legacy:
- **Base de datos:** `claropr` en 159.203.70.5
- **Tabla source:** `venta`
- **Campos clave:**
  - `ban` → BAN number
  - `comisionclaro` → company_earnings
  - `comisionvendedor` → vendor_commission
  - `numerocelularactivado` → phone
  - `fechaactivacion` → activation date

### ⚠️ VALIDACIÓN en Scripts Legacy:
**ANTES de crear `subscriber_reports` desde legacy:**
```javascript
// 1. Buscar cliente del subscriber
const clientCheck = await query(`
  SELECT c.salesperson_id, s.role
  FROM subscribers sub
  JOIN bans b ON sub.ban_id = b.id
  JOIN clients c ON b.client_id = c.id
  LEFT JOIN salespeople s ON c.salesperson_id = s.id
  WHERE sub.id = $1
`, [subscriber_id]);

// 2. Validar vendedor real
if (!clientCheck[0]?.role || clientCheck[0].role !== 'vendedor') {
  console.warn(`⚠️  SKIP: Cliente sin vendedor real`);
  skipped++;
  continue;
}

// 3. OK - crear reporte
await query(`INSERT INTO subscriber_reports ...`);
```

---

## 📊 Metas y Comisiones

### Sistema de Metas:
- **Tabla:** `product_goals`
  - `vendor_id` (INT) → vendors.id
  - `product_id` (INT) → hash de products.id (UUID)
  - `target_revenue` (DECIMAL) → meta del mes
  - `period_year`, `period_month` → periodo

### Relación Vendors ↔ Salespeople:
```sql
-- Match por nombre (case-insensitive)
JOIN salespeople s ON UPPER(v.name) = UPPER(s.name)
```

### Cálculo de Performance:
```sql
-- Metas del mes
SELECT SUM(pg.target_revenue) as total_goal
FROM product_goals pg
WHERE pg.period_year = :year 
  AND pg.period_month = :month
  AND pg.is_active = 1

-- Comisiones ganadas del mes
SELECT SUM(sr.vendor_commission) as total_earned
FROM subscriber_reports sr
JOIN subscribers sub ON sr.subscriber_id = sub.id
JOIN bans b ON sub.ban_id = b.id
JOIN clients c ON b.client_id = c.id
WHERE c.salesperson_id = :salesperson_id
  AND TO_CHAR(sr.report_month, 'YYYY-MM') = :month_param
```

**% Completado = (total_earned / total_goal) * 100**

---

## 🚨 Casos Edge Identificados

### 1. Admin con Comisiones (CORREGIDO v2026-295)
**Problema:** Admin creaba clientes y se asignaba a sí mismo, generando comisiones para admin.

**Solución:** Validación obligatoria en endpoint de reportes (role='vendedor').

**Ejemplo encontrado (ELIMINADO):**
- Cliente con BAN `5486f9e2...` → Admin Principal ($350)
- Cliente con BAN `1c09ec45...` → Gabriel Sanchez admin ($200)

---

### 2. Vendedor Duplicado en Salespeople
**Problema:** Múltiples registros con mismo nombre (ej: YARITZA x2).

**Solución:** Eliminar duplicados sin usuario en `users_auth`.

**Verificación:**
```sql
SELECT s.name, COUNT(*) 
FROM salespeople s 
GROUP BY s.name 
HAVING COUNT(*) > 1;
```

---

### 3. Cliente sin Vendedor con Ventas
**Problema:** Venta legacy importada sin vendedor asignado en CRM.

**Solución:** 
- Opción A: Asignar vendedor por defecto
- Opción B: Saltar y reportar en log
- **Recomendado:** Opción B - saltar y corregir manualmente

---

## 📝 Checklist: Crear Nueva Venta Completada

1. ✅ Verificar cliente tiene `salesperson_id` asignado
2. ✅ Verificar salesperson.role = 'vendedor'
3. ✅ Calcular `vendor_commission` (comisión vendedor)
4. ✅ Calcular `company_earnings` (ganancia empresa)
5. ✅ Especificar `report_month` (YYYY-MM-DD formato DATE)
6. ✅ INSERT en `subscriber_reports`
7. ✅ Validar que se creó correctamente
8. ✅ Actualizar metas/dashboard si es mes actual

---

## 🔧 Endpoints Relacionados

### Crear/Actualizar Reporte:
- **PUT** `/api/subscriber-reports/:subscriber_id`
- **Validación:** role='vendedor' obligatorio (v2026-295)

### Ver Metas:
- **GET** `/api/goals/performance?month=YYYY-MM`
- **GET** `/api/goals/by-period?year=X&month=Y`
- **POST** `/api/goals/save`

### Configurar Metas:
- **Página:** `/metas/configurar`
- **Versión Actual:** v2026-294 (3 columnas, 1 botón por vendedor)

---

## 📚 Referencias

### Archivos Clave:
- `server-FINAL.js` - Endpoint de reportes (línea ~1958)
- `src/backend/controllers/goalsController.js` - Lógica de metas
- `src/react-app/pages/GoalsConfig.tsx` - Configuración de metas (frontend)
- `src/react-app/pages/Metas.tsx` - Dashboard de performance

### Schema:
- `elementos_extra/sqls/schema-final.sql` - Schema autoritativo
- Tabla: `subscriber_reports` - Ventas completadas
- Tabla: `product_goals` - Metas mensuales
- Tabla: `vendors` - Vendedores legacy (INTEGER ID)
- Tabla: `salespeople` - Vendedores actuales (UUID ID)

---

## 💡 Mejoras Futuras

1. **Dashboard de Ventas Completadas**
   - Listar reportes con filtro por vendedor/mes
   - Mostrar total comisiones pendientes de pago

2. **Automatización Legacy**
   - Cron job para sync periódico desde BD Tango
   - Validación automática de vendedores

3. **Alertas**
   - Notificar cuando se intenta crear reporte sin vendedor
   - Alertar duplicados de salespeople

4. **Auditoría**
   - Log de cambios en subscriber_reports
   - Tracking de quién modificó comisiones

---

## 🎓 Glosario

| Término | Significado | Tabla/Campo |
|---------|-------------|-------------|
| **Reporte** | Venta completada con comisión calculada | `subscriber_reports` |
| **Comisión Vendedor** | Dinero que gana el vendedor | `vendor_commission` |
| **Ganancia Empresa** | Dinero que gana la empresa | `company_earnings` |
| **Meta** | Objetivo de ingresos mensual por vendedor/producto | `product_goals.target_revenue` |
| **Performance** | % de meta alcanzado | (earned/goal)*100 |
| **Vendedor Real** | Salesperson con role='vendedor' (no admin) | `salespeople.role` |
| **BAN** | Billing Account Number (Claro PR) | `bans.ban_number` |
| **Subscriber** | Línea telefónica individual | `subscribers` |

---

**Versión:** 2026-295  
**Última actualización:** 10 Febrero 2026  
**Mantenido por:** AI Agent + Gabriel
