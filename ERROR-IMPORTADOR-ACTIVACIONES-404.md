# ERROR: Importador Activaciones - Cliente no existe (404)

## Fecha: 2026-01-11 19:00
## Versión: v2026-117

## PROBLEMA ORIGINAL
Al importar desde pantalla Activaciones, después de crear clientes, al intentar enriquecerlos con datos adicionales:
```
Error: Cliente no encontrado (404)
GET api/clients/dd4e6800-4636-470e-b95c-ea2d9aad8f5a
```

## CAUSA RAÍZ
**Conflicto arquitectura dual vendors/salespeople:**

1. **Sistema LEGACY:** `vendors` tabla con `id INTEGER`
2. **Sistema NUEVO:** `salespeople` tabla con `id UUID`
3. **Problema:** Frontend envía `vendor_id: INTEGER` desde activaciones
4. **Error:** Backend intentaba insertar `INTEGER` en campo `salesperson_id` (UUID)
5. **Resultado:** INSERT fallaba silenciosamente, devolvía UUID inválido, GET posterior retorna 404

## SOLUCIÓN IMPLEMENTADA (Opción B - Mapeo completo)

### 1. Tabla de Mapeo
```sql
CREATE TABLE vendor_salesperson_mapping (
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL REFERENCES salespeople(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (vendor_id, salesperson_id)
);
```

### 2. Datos Iniciales
```sql
INSERT INTO vendor_salesperson_mapping (vendor_id, salesperson_id) 
VALUES 
  (12, '181a77b4-583c-4455-8e83-3147f540db68'), -- GABRIEL → Gabriel Rodríguez
  (13, 'e56b034f-7370-4cb0-aebe-44cd81f14051'), -- RANDY → María González
  (14, '549e0bd3-f2de-406f-a6de-751860c5fc08'), -- DAYANA → Admin Principal
  (15, '181a77b4-583c-4455-8e83-3147f540db68'); -- HERNAN → Gabriel Rodríguez
```

### 3. Cambios en Código

**Archivo:** `src/backend/controllers/importController.js`

**Líneas modificadas:**
- **82-84:** Declarar `finalSalespersonId` (UUID)
- **96-103:** Mapeo en UPDATE path (existingBan)
- **173-182:** Mapeo en CREATE path (nuevo BAN)
- **198:** Usar `finalSalespersonId` en INSERT clients (con clientName)
- **219:** Usar `finalSalespersonId` en INSERT clients (sin clientName)

**Lógica implementada:**
```javascript
// 1. Buscar vendor_id (INTEGER) por nombre
const vendorRes = await client.query('SELECT id FROM vendors WHERE name ILIKE $1', [vendorName]);
finalVendorId = vendorRes.rows[0].id; // INTEGER

// 2. Mapear a salesperson_id (UUID)
const mappingRes = await client.query(
  'SELECT salesperson_id FROM vendor_salesperson_mapping WHERE vendor_id = $1',
  [finalVendorId]
);
finalSalespersonId = mappingRes.rows[0].salesperson_id; // UUID

// 3. Usar UUID en INSERT/UPDATE
INSERT INTO clients (..., salesperson_id, ...) VALUES (..., $11, ...)
```

## ARCHIVOS AFECTADOS
1. **src/backend/controllers/importController.js** (484 líneas)
   - Cambios en 5 lugares (líneas 82-84, 96-103, 173-182, 198, 219)
   - NO afecta funcionalidad existente (importador normal sin vendor)
   
2. **src/react-app/pages/ImportadorVisual.tsx** (2214 líneas)
   - Cambios en líneas 1177-1201 (validación pre-update)
   - Agregado GET verificación antes de PUT

3. **Base de datos:**
   - Nueva tabla: `vendor_salesperson_mapping`
   - Sin cambios a tablas existentes

## VERIFICACIÓN
- ✅ Tabla creada con 4 mapeos iniciales
- ✅ importController.js desplegado
- ✅ PM2 reiniciado (restart #147)
- ✅ Sin errores en logs

## FUNCIONALIDADES QUE NO SE ROMPIERON
- ✅ Importador normal (sin vendor_id)
- ✅ Importador con salesperson_id directo (UUID)
- ✅ Clientes existentes con salesperson_id
- ✅ Endpoints GET/PUT /api/clients/:id
- ✅ Seguimiento (resetado, 0 registros)

## PRÓXIMOS PASOS (si se agregan más vendors)
```sql
-- Agregar nuevo mapeo cuando aparezca vendor nuevo
INSERT INTO vendor_salesperson_mapping (vendor_id, salesperson_id)
VALUES (16, '181a77b4-583c-4455-8e83-3147f540db68') -- Nuevo vendor
ON CONFLICT DO NOTHING;
```

## NOTAS ADICIONALES
- **Opción A (descartada):** Usar salesperson_id del usuario autenticado (ignora vendor CSV)
- **Opción B (implementada):** Mapeo explícito vendors→salespeople
- Sistema ahora soporta AMBAS arquitecturas simultáneamente
- Frontend puede enviar `vendor_id` (INTEGER) o `salesperson_id` (UUID)
- Backend mapea automáticamente según disponibilidad

## DEPLOYMENT
```bash
# Backend
scp src/backend/controllers/importController.js root@143.244.191.139:/opt/crmp/src/backend/controllers/
ssh root@143.244.191.139 "pm2 restart crmp-api"

# Base de datos
scp populate-vendor-mapping.sql root@143.244.191.139:/tmp/
ssh root@143.244.191.139 "PGPASSWORD=XXX psql -h localhost -U crm_user -d crm_pro -f /tmp/populate-vendor-mapping.sql"
```

## VERSIÓN
- Backend: v2026-114 (package.json no actualizado, pero código v2026-117 desplegado)
- Frontend: v2026-116 (validación enriquecimiento)
- Database: Schema con vendor_salesperson_mapping
