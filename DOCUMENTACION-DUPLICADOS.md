# CLIENTES DUPLICADOS - REGISTRO Y VALIDACIÓN

**Fecha de análisis:** 5 de febrero de 2026
**Base de datos:** CRM crm_pro @ 143.244.191.139

---

## PROBLEMA IDENTIFICADO

El sistema tiene **110 clientes duplicados** con el mismo nombre (normalizado en mayúsculas y sin espacios extra).

### Caso Reportado: RAMIREZ & RAMIREZ APPLIANCE INC

Cliente duplicado en 2 registros:

**Registro 1:**
- ID: `d0291acc-dac2-49db-bf5c-4f74e3a34735`
- Nombre: `RAMIREZ &  RAMIREZ APPLIANCE INC` (nota: doble espacio)
- Creado: 4 de enero 2026, 21:53:44
- Vendedor: ❌ SIN ASIGNAR
- BANs: 1 (Número: `776354851`)
- Suscriptores: 7
- Valor mensual: $0.00

**Registro 2:**
- ID: `d654e41b-7e35-4fbf-9e1c-4b2651d799c9`
- Nombre: `RAMIREZ &  RAMIREZ APPLIANCE INC`
- Creado: 4 de enero 2026, 21:53:44
- Vendedor: ❌ SIN ASIGNAR
- BANs: 1 (Número: `777064578`)
- Suscriptores: 1
- Valor mensual: $0.00

---

## ANÁLISIS

### Origen de los Duplicados

Los duplicados se crearon el **4 de enero de 2026 a las 21:53:44**, probablemente durante una importación masiva desde la base de datos legacy donde:
- Un mismo cliente tenía múltiples BANs
- El importador creó un registro de cliente por cada BAN en lugar de consolidar

### Casos Más Críticos

1. **JOHANNA MOTA**: 7 duplicados
2. **MARÍA SANTIAGO**: 5 duplicados
3. **LUIS RIVERA**: 4 duplicados
4. **RAMIREZ & RAMIREZ APPLIANCE INC**: 2 duplicados (caso reportado)

Ver archivo completo: `DUPLICADOS-CLIENTES-2026-02-05.txt`

---

## RESTRICCIONES ACTUALES

**NO SE PUEDE:**
- ❌ Fusionar clientes (no existe herramienta en el sistema)
- ❌ Eliminar clientes (lógica de negocio lo impide si tienen BANs/subscribers asociados)

**PROBLEMA:**
- Al tener el mismo nombre pero diferentes IDs, el sistema permite su existencia
- No hay validación que prevenga la creación de duplicados

---

## SOLUCIÓN IMPLEMENTADA (v2026-275)

### 1. Validación en Backend

**Archivo:** `src/backend/controllers/clientController.js`

Se agregó validación en `createClient`:
```javascript
// Verificar si ya existe un cliente con el mismo nombre (case-insensitive, trimmed)
const existingClient = await query(
    'SELECT id, name FROM clients WHERE UPPER(TRIM(name)) = UPPER(TRIM($1))',
    [name]
);

if (existingClient.length > 0) {
    return badRequest(res, 
        `Ya existe un cliente con el nombre "${existingClient[0].name}". ` +
        `No se permiten nombres duplicados. ID existente: ${existingClient[0].id}`
    );
}
```

### 2. Validación en Frontend

**Archivo:** `src/react-app/components/ClientModal.tsx`

Agregada validación antes de intentar crear:
```typescript
// Verificar duplicados por nombre
const checkDuplicate = await authFetch(
    `/api/clients/check-duplicate?name=${encodeURIComponent(clientData.name)}`
);
const dupData = await checkDuplicate.json();

if (dupData.exists) {
    setFormMessage({ 
        type: 'error', 
        text: `Ya existe un cliente con el nombre "${dupData.existingName}". No se permiten duplicados.` 
    });
    return;
}
```

### 3. Nuevo Endpoint de Verificación

**Archivo:** `src/backend/routes/clientRoutes.js`

```javascript
router.get('/check-duplicate', checkDuplicateClient);
```

**Controlador:**
```javascript
export const checkDuplicateClient = async (req, res) => {
    const { name } = req.query;
    if (!name) return badRequest(res, 'name es requerido');
    
    const existing = await query(
        'SELECT id, name FROM clients WHERE UPPER(TRIM(name)) = UPPER(TRIM($1))',
        [name]
    );
    
    res.json({
        exists: existing.length > 0,
        existingName: existing[0]?.name || null,
        existingId: existing[0]?.id || null
    });
};
```

### 4. Validación en Importador

**Archivo:** `src/backend/controllers/importController.js`

El importador ya tiene lógica para evitar crear duplicados:
```javascript
const existingClient = await client.query(
    'SELECT id FROM clients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))',
    [clientName]
);

if (existingClient.rows.length > 0) {
    clientId = existingClient.rows[0].id; // Reutiliza el existente
}
```

---

## LIMPIEZA MANUAL NECESARIA

Para limpiar los 110 duplicados existentes se requiere:

1. **Identificar cliente principal** (el que tiene más datos):
   - Mayor cantidad de BANs
   - Mayor cantidad de suscriptores
   - Mayor valor mensual
   - Está en seguimiento activo

2. **Reasignar BANs** del duplicado al principal:
```sql
UPDATE bans 
SET client_id = '<id_principal>' 
WHERE client_id = '<id_duplicado>';
```

3. **Eliminar duplicados vacíos**:
```sql
DELETE FROM clients 
WHERE id = '<id_duplicado>' 
AND NOT EXISTS (SELECT 1 FROM bans WHERE client_id = '<id_duplicado>');
```

---

## SCRIPTS DE REFERENCIA

- `find-duplicates.mjs` - Lista TODOS los duplicados con detalles
- `find-ramirez.mjs` - Busca específicamente RAMIREZ & RAMIREZ APPLIANCE INC
- `DUPLICADOS-CLIENTES-2026-02-05.txt` - Reporte completo (827 líneas)

---

## PRÓXIMOS PASOS

1. ✅ Validación implementada para prevenir futuros duplicados
2. ⏳ Pendiente: Crear herramienta de fusión de clientes
3. ⏳ Pendiente: Limpiar los 110 duplicados existentes manualmente

---

**Última actualización:** 5 de febrero de 2026
**Versión del sistema:** v2026-275-PREVENIR-DUPLICADOS
