# ESQUEMA FIJO: Cómo Crear Ventas en VentasPro CRM

## 📋 ESTRUCTURA DE DATOS OBLIGATORIA

### Jerarquía de Datos
```
Cliente (clients)
    └── BAN (bans) 
          └── Suscriptor (subscribers)
                └── [Productos aplicables según tipo]
```

**Regla crítica:** NO puede existir BAN sin suscriptor. NO puede existir suscriptor sin BAN.

---

## 🎯 TIPOS DE CLIENTES Y PRODUCTOS

### 1. Segmentación por Tipo de Cuenta

| Tipo BAN | Segmento | Productos Disponibles | Comisión |
|----------|----------|----------------------|----------|
| **FIJO** | PYMES / Corporativo | Fijo New<br>Fijo Ren | 330%<br>160% |
| **MOVIL** | Prepago / Consumer | Movil New<br>Movil Ren | 100%<br>50% |
| **Residencial** | Hogar | Cloud<br>Claro TV | 100%<br>100% |

### 2. Tipo de Línea (NEW vs REN)

| Tipo | Significado | Uso |
|------|-------------|-----|
| **NEW** | Nueva activación | Primera vez que el cliente contrata el servicio |
| **REN** | Renovación | Cliente renueva contrato existente |

**Campo:** `subscribers.line_type` (valores: 'NEW' o 'REN')

---

## 📝 CAMPOS REQUERIDOS POR TABLA

### A. Cliente (tabla: `clients`)

| Campo | Tipo | Obligatorio | Ejemplo |
|-------|------|-------------|---------|
| `name` | varchar(255) | ✅ SÍ | "Colegio Santa Gema" |
| `salesperson_id` | UUID | ✅ SÍ | UUID del vendedor asignado |
| `tax_id` | varchar(20) | ❌ NO | "B01234567" (RNC) |
| `phone` | varchar(20) | ❌ NO | "7877001234" |
| `email` | varchar(255) | ❌ NO | "contacto@colegio.com" |
| `address` | text | ❌ NO | "Calle Principal #123" |
| `city` | varchar(100) | ❌ NO | "San Juan" |

**Nota:** Sistema auto-asigna `id` (UUID), `created_at`, `updated_at`.

---

### B. BAN (tabla: `bans`)

| Campo | Tipo | Obligatorio | Ejemplo | Valores Permitidos |
|-------|------|-------------|---------|-------------------|
| `client_id` | UUID | ✅ SÍ | UUID del cliente | FK a `clients.id` |
| `ban_number` | varchar(20) | ✅ SÍ | "719400825" | Único en sistema |
| `account_type` | varchar(20) | ✅ SÍ | "FIJO" | FIJO, MOVIL, Residencial |
| `status` | char(1) | ✅ SÍ | "A" | A=Activo, C=Cancelado |
| `plan_id` | UUID | ❌ NO | UUID del plan | FK a `plans.id` |

**Regla:** Un cliente puede tener múltiples BANs. Un BAN pertenece a UN solo cliente.

---

### C. Suscriptor (tabla: `subscribers`)

| Campo | Tipo | Obligatorio | Ejemplo | Valores Permitidos |
|-------|------|-------------|---------|-------------------|
| `ban_id` | UUID | ✅ SÍ | UUID del BAN | FK a `bans.id` |
| `phone` | varchar(20) | ✅ SÍ | "939-777-0017" | Único en sistema |
| `line_type` | varchar(10) | ✅ SÍ | "NEW" | NEW, REN |
| `plan` | varchar(255) | ✅ SÍ | "RED3535" | Código de voz |
| `monthly_value` | numeric(10,2) | ✅ SÍ | 35.00 | Valor mensual |
| `contract_term` | integer | ✅ SÍ | 24 | Meses (12 o 24) |
| `contract_end_date` | date | ✅ SÍ | 2028-02-03 | Fecha vencimiento |

**Regla:** Un BAN puede tener múltiples suscriptores. Un suscriptor pertenece a UN solo BAN.

**Obtener datos desde base legacy:**
- `plan`: Viene de tabla `tipoplan.codigovoz` (ej: RED3535)
- `monthly_value`: Viene de tabla `tipoplan.rate` (precio mensual del plan)

---

## 🔄 PROCESO PARA CREAR VENTA

### Opción 1: Manual (UI del CRM)

**Paso 1:** Clientes → Botón "Agregar Cliente"
- Llenar nombre (obligatorio)
- Asignar vendedor (obligatorio)
- Guardar

**Paso 2:** Dentro del cliente → Botón "Agregar BAN"
- Número BAN (obligatorio)
- Tipo de cuenta: FIJO/MOVIL/Residencial
- Estado: Activo
- Guardar

**Paso 3:** Dentro del BAN → Botón "Agregar Suscriptor"
- Número de teléfono (obligatorio)
- Tipo de línea: NEW o REN
- Fecha de vencimiento (opcional)
- Guardar

**Paso 4:** Reportar comisión
- Sistema calcula automáticamente según:
  - `bans.account_type` + `subscribers.line_type`
  - Ejemplo: FIJO + NEW → Producto "Fijo New" → Comisión 330%

---

### Opción 2: Importar desde Excel/CSV

**Ubicación:** `/importar` en el CRM

**Columnas requeridas en archivo:**

| Columna Excel | Campo en BD | Obligatorio |
|---------------|-------------|-------------|
| Cliente / Nombre Cliente | `clients.name` | ✅ |
| BAN / Número BAN | `bans.ban_number` | ✅ |
| Teléfono / Phone | `subscribers.phone` | ✅ |
| Tipo Cuenta | `bans.account_type` | ❌ (default: FIJO) |
| Tipo Línea | `subscribers.line_type` | ❌ (default: NEW) |
| Vendedor | `clients.salesperson_id` | ❌ (toma el del usuario) |

**Proceso:**
1. Preparar Excel con columnas arriba
2. Ir a `/importar`
3. Arrastrar archivo (drag & drop)
4. Sistema detecta columnas automáticamente
5. Clic "Importar"
6. Sistema crea: Cliente → BAN → Suscriptor en una transacción

**Ventajas:**
- Importación masiva (100+ ventas)
- Manejo automático de duplicados (ON CONFLICT)
- Rollback si hay error (todo o nada)

---

## 📊 CONSULTAS SQL ÚTILES

### Ver todas las ventas de un vendedor

```sql
SELECT 
    c.name AS cliente,
    b.ban_number,
    b.account_type,
    s.phone,
    s.line_type,
    sp.name AS vendedor
FROM clients c
JOIN bans b ON b.client_id = c.id
JOIN subscribers s ON s.ban_id = b.id
JOIN salespeople sp ON sp.id = c.salesperson_id
WHERE sp.name = 'Admin Principal'
ORDER BY c.created_at DESC;
```

### Contar ventas NEW vs REN por vendedor

```sql
SELECT 
    sp.name AS vendedor,
    s.line_type,
    COUNT(*) AS total_ventas
FROM subscribers s
JOIN bans b ON b.id = s.ban_id
JOIN clients c ON c.id = b.client_id
JOIN salespeople sp ON sp.id = c.salesperson_id
GROUP BY sp.name, s.line_type
ORDER BY sp.name, s.line_type;
```

### Ver clientes PYMES (FIJO) con NEW

```sql
SELECT 
    c.name AS cliente,
    b.ban_number,
    COUNT(s.id) AS total_suscriptores
FROM clients c
JOIN bans b ON b.client_id = c.id
JOIN subscribers s ON s.ban_id = b.id
WHERE b.account_type = 'FIJO'
  AND s.line_type = 'NEW'
GROUP BY c.id, c.name, b.ban_number
ORDER BY c.created_at DESC;
```

---

## ⚠️ VALIDACIONES Y REGLAS

### 1. Integridad Referencial
- ❌ NO puedes eliminar un cliente si tiene BANs activos
- ❌ NO puedes eliminar un BAN si tiene suscriptores
- ✅ Puedes cambiar `status='C'` para cancelar sin eliminar

### 2. Duplicados
- `ban_number` debe ser ÚNICO en todo el sistema
- `phone` debe ser ÚNICO en todo el sistema
- Si importas duplicado, sistema:
  - Actualiza registro existente (ON CONFLICT UPDATE)
  - O rechaza (según configuración)

### 3. Cálculo de Comisiones
Sistema determina producto aplicable por esta matriz:

| account_type | line_type | Producto | Comisión |
|-------------|-----------|----------|----------|
| FIJO | NEW | Fijo New | 330% |
| FIJO | REN | Fijo Ren | 160% |
| MOVIL | NEW | Movil New | 100% |
| MOVIL | REN | Movil Ren | 50% |

---

## 🎯 EJEMPLO COMPLETO: Venta PYMES

```javascript
// Cliente
const cliente = {
  name: "Colegio Santa Gema",
  salesperson_id: "uuid-del-vendedor",
  tax_id: "B01234567",
  phone: "7877001234"
};

// BAN
const ban = {
  client_id: cliente.id,
  ban_number: "719400825",
  account_type: "FIJO",  // PYMES = FIJO
  status: "A"
};

// Suscriptor
const suscriptor = {
  ban_id: ban.id,
  phone: "7877001234",
  line_type: "NEW",  // Nueva activación
  contract_end_date: "2027-02-03"
};

// Producto aplicado automáticamente: Fijo New (330% comisión)
```

---

## 📌 CHECKLIST ANTES DE CREAR VENTA

- [ ] ¿Tengo el nombre del cliente?
- [ ] ¿Tengo el número BAN?
- [ ] ¿Sé si es FIJO (PYMES) o MOVIL (Consumer)?
- [ ] ¿Sé si es NEW (nuevo) o REN (renovación)?
- [ ] ¿Tengo al menos 1 teléfono de suscriptor?
- [ ] ¿Está asignado a un vendedor?

Si todas las respuestas son SÍ → Puedes crear la venta ✅

---

## 🔗 PANTALLAS DEL CRM

### Navegación para ver la venta creada:

1. **Clientes** (`/clients`)
   - Lista todos los clientes
   - Clic en "Colegio Santa Gema" → Ve detalles

2. **Dentro del Cliente**
   - Tab "BANs" → Ve BAN 719400825
   - Clic en BAN → Ve suscriptores

3. **Seguimiento** (`/seguimiento`)
   - Si moviste cliente a seguimiento
   - Ve pipeline de ventas

4. **Reportes** (`/reportes`)
   - Ve comisiones calculadas
   - Filtra por vendedor/fecha

---

## 📞 SOPORTE

Si necesitas modificar:
- **Productos:** Tabla `products` → Agregar/editar productos
- **Comisiones:** Campo `commission_percentage` en `products`
- **Categorías:** Tabla `categories` → Agregar/editar categorías
- **Planes:** Tabla `plans` → Agregar/editar planes de Claro PR

---

**Última actualización:** 2026-02-03  
**Versión:** 1.0  
**Autor:** Sistema VentasPro CRM
