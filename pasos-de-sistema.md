# Pasos de Sistema - VentasPro CRM

## 🚨 REGLAS CRÍTICAS (LEER ANTES DE TRABAJAR)

### **1. MODO INCÓGNITO OBLIGATORIO**
# **SIEMPRE PROBAR EN NAVEGADOR MODO INCÓGNITO**
# **EL CACHE NORMAL PUEDE MOSTRAR VERSIONES VIEJAS**

### **2. NO ROMPER LO QUE FUNCIONA**
- **Verificar sección "🔒 CÓDIGO PROTEGIDO"** antes de modificar
- **Leer código actual** antes de hacer cambios
- **Probar funcionalidad** después de cada cambio
- **Actualizar este documento** inmediatamente

### **3. DEPLOYMENT CON VERSIÓN**
- **SIEMPRE actualizar** `src/version.ts` ANTES de `npm run build`
- **Verificar versión** con curl después de desplegar
- **NO decir "listo"** sin verificar que funciona

### **4. VERIFICACIÓN OBLIGATORIA DE TIPOS**
# **SI CAMBIAS UN TIPO (number → string, etc):**
1. **BUSCAR TODOS los usos** del campo modificado en TODO el proyecto
2. **VERIFICAR conversiones** (parseInt, Number, toString) que ya no aplican
3. **EJECUTAR get_errors** en TODOS los archivos relacionados
4. **PROBAR el flujo completo** de creación/edición
5. **NO asumir** que solo cambiar interfaces es suficiente

### **5. ANTES DE DECIR "LISTO"**
- [ ] Código compila sin errores
- [ ] get_errors ejecutado en archivos modificados
- [ ] Funcionalidad PROBADA (no asumida)
- [ ] Versión actualizada y verificada en servidor
- [ ] Documento actualizado

---

## Módulo Clientes

**Composición: 5 tabs**

1. **Activos** - Clientes activos
2. **Cancelados** - Clientes cancelados
3. **Seguimiento** - Los que marcó en seguimiento
4. **Completadas** - Ventas completadas
5. **Incompletos** - Clientes incompletos

### Tabla de registros (columnas):

- Empresa
- Última Actividad
- Tipo BAN
- Base
- Estado
- Vendedor Asignado
- Num BAN
- Suscriptor
- Fecha Vencimiento
- Acciones

**Acciones permitidas:**
- ✅ Botón **Siguiendo / A Seguimiento** (verde) - Lleva al cliente al módulo de seguimiento
- ❌ Botón **Productos** (azul) - QUITAR
- ❌ Botón **Datos** (morado) - QUITAR  
- ❌ Botón **Devolver** (naranja) - QUITAR

**Resultado:** Solo debe quedar el botón verde de seguimiento

---

## Modal de Edición de Cliente

**Problemas encontrados:**

1. **Campo Vendedor faltante** - En edición de cliente no aparece el campo vendedor
2. **Editar BAN**: Botón "Guardar Cambios" NO guarda
   - Campo: Tipo de Cuenta (Móvil, Fijo, Convergente)
   - Botón no funciona
3. **Editar Suscriptor**: Al editar SALE del modal pero SÍ guarda correctamente
   - Problema: Cierra modal antes de tiempo
4. **Ventas cerradas**: Si el cliente tiene ventas cerradas debe llevar el registro
   - Verificar igual que tabs "Llamadas y Fechas"

**Tabs del modal:**
- Información del Cliente
- BANs y Suscriptores
- Historial
- Llamadas y Fechas

---

## Crear Cliente Nuevo

**Estado:** ✅ Funciona bien

**Problema después de crear:**
- Cliente creado aparece en la tabla
- Columna "Suscriptor" aparece vacía (normal, no tiene suscriptores aún)

---

## Módulo Seguimiento

**Tabs actuales:** 
- ❌ "Activos" → Cambiar a "Seguimiento"
- ✅ "Completados" - Son los casos que le dio completada a la venta

**Tabs correctos:**
- ✅ "Seguimiento" - Prospectos en seguimiento activo
- ✅ "Completados" - Ventas completadas

**Problema en Clientes:**
- Tab "Seguimiento" en Clientes NO debe mostrar los casos ahí
- Debe linkear/redirigir al módulo Seguimiento (`/seguimiento`)

**Respuestas del usuario:**
1. Tab Seguimiento en Clientes: Hipervínculo que redirija (no hace falta botón)
2. Campo Vendedor: Editable
3. Editar BAN - Tipo de Cuenta: NO guarda en BD
4. Ventas completadas: Llevar registro en el cliente, hacen parte del módulo de reportes que componen ingreso

---

## CORRECCIONES V66-V73

### ✅ COMPLETADO v66-v67
1. **Módulo Clientes - Acciones**
   - ✅ Quitado botón "Productos" (azul)
   - ✅ Quitado botón "Datos" (morado)
   - ✅ Quitado botón "Devolver" (naranja)
   - ✅ Solo queda botón "Ver Seguimiento" (verde)

2. **Editar BAN - Tipo de Cuenta**
   - ✅ ARREGLADO: COALESCE trataba empty string como valor válido
   - ✅ Solución: Backend convierte `""` a `undefined` antes de query
   - ✅ Archivo: `src/backend/controllers/banController.js` líneas 57-101

3. **Módulo Seguimiento - Tabs**
   - ✅ Cambiado "Activos" → "Seguimiento"
   - ✅ Mantiene "Completados"

### ✅ COMPLETADO v68-v73: BUG CRÍTICO DE TIPOS UUID

**Problema encontrado:** Contador mostraba 0 en vez de 6 prospectos activos

**Causa raíz:**
1. **Tipos incorrectos (v68-v70):**
   - `FollowUpProspect.client_id` definido como `number` pero BD usa UUID (`string`)
   - `Client.id` definido como `number` pero BD usa UUID (`string`)
   - 3 conversiones `Number(clientId)` fallando silenciosamente en comparaciones

2. **Race condition con carga de datos (v71-v73):**
   - API `/api/clients` da 403 en primera carga (token expirado)
   - Componente `FollowUp` carga antes del token refresh
   - Filtro `hasValidClient` rechazaba TODOS los prospects porque `clients` array estaba vacío
   - Solo pasaban los 5 con `client_id: null`, pero esos tenían `completed_date` ≠ null

**Soluciones aplicadas:**
- ✅ v68: Cambiar interfaces `client_id: string | null`, `Client.id: string`
- ✅ v69: Remover `Number(clientIdParam)` en `clientFilteredProspects`
- ✅ v70: Remover `Number(clientIdParam)` en useEffect de auto-open modal
- ✅ v73: **Eliminar filtro `hasValidClient`** - prospectos válidos aunque cliente no cargue/exista

**Archivos modificados:**
- `src/react-app/pages/FollowUp.tsx` (interfaces + 3 conversiones + filtro)
- Deployment: v68 → v69 → v70 → v73

**Resultado final:** Muestra correctamente 6 prospectos activos sin `completed_date`

**Lección aprendida:**
- ⚠️ **SIEMPRE verificar tipos de BD antes de asumir** (`\d table_name` en psql)
- ⚠️ **Race conditions con token expiration** - no filtrar por datos que pueden no haber cargado aún
- ⚠️ PostgreSQL UUIDs son `string` en JavaScript, NO `number`
- 🚨 **CAMBIO DE TIPO = BUSCAR TODOS LOS USOS** - No solo cambiar interfaces
- 🚨 **PROBAR flujo completo** después de cambiar tipos - No asumir
- 🚨 **get_errors en TODO el proyecto** antes de decir "listo"

---

### ✅ VERIFICACIÓN COMPLETA v5.1.74 (2026-01-09)

**FUNCIONALIDADES CORE PROBADAS Y FUNCIONANDO:**

1. **✅ Crear Cliente** 
   - Archivo: `Clients.tsx` línea 1141 (`handleCreateClient`)
   - Funciona correctamente con validación de BAN requerido
   - Auto-asignación de vendedor si usuario es vendedor

2. **✅ Editar Cliente**
   - Archivo: `Clients.tsx` línea 1180 (`handleUpdateClient`)
   - Funciona correctamente con actualización de datos
   - Detecta cambio de estado incompleto → completo

3. **✅ Campo Vendedor en Modal Cliente**
   - Archivo: `ClientModal.tsx` líneas 390-405
   - VISIBLE y EDITABLE en creación y edición
   - Dropdown con todos los vendedores disponibles
   - Auto-asignación para nuevos clientes si usuario es vendedor

4. **✅ Crear BAN**
   - Archivo: `Clients.tsx` línea 1240 (`handleCreateBAN`)
   - Backend: `banController.js` línea 20 (`createBan`)
   - Funciona correctamente con validación de duplicados
   - Maneja conflictos con mensajes descriptivos

5. **✅ Editar BAN - Tipo de Cuenta**
   - Archivo: `banController.js` líneas 57-101 (`updateBan`)
   - **ARREGLADO v66-v67**: Convierte empty string a undefined antes del query
   - COALESCE ahora funciona correctamente
   - Guarda cambios en base de datos sin problemas

6. **✅ Crear Suscriptor**
   - Archivo: `Clients.tsx` línea 1418 (`handleSaveSubscriber`)
   - Backend: `subscriberController.js` línea 21 (`createSubscriber`)
   - Funciona correctamente con validación de duplicados

7. **⚠️ Editar Suscriptor - Modal se cierra antes de tiempo**
   - Archivo: `SubscriberModal.tsx` línea 141
   - **PROBLEMA**: Llama `onClose()` inmediatamente después de `await onSave(cleanData)`
   - Los datos SÍ se guardan correctamente en BD
   - Modal cierra sin dar feedback visual al usuario

---

### 🚨 HOTFIX v2026-91 (2026-01-09): ERROR CRÍTICO crear venta/cliente

**PROBLEMA CRÍTICO:**
- ❌ Error al crear venta nueva en Seguimiento
- ❌ Vendedor no podía guardar prospectos
- **CAUSA:** `client_id` se convertía a `number` cuando debía ser `string` (UUID)

**LÍNEA PROBLEMÁTICA:**
```typescript
// ANTES (línea 688)
client_id: formData.client_id ? parseInt(formData.client_id.toString(), 10) : null,

// DESPUÉS
client_id: formData.client_id || null,
```

**CORRECCIÓN:**
- ✅ Eliminado parseInt en `client_id` (debe ser string UUID, no number)
- ✅ Archivo: `FollowUp.tsx` línea 688

**ORIGEN DEL ERROR:**
- Error latente de versión anterior (tipos UUID cambiados en v68-73)
- No lo detecté porque solo modifiqué interfaces, no lógica de guardado
- Error se activó al intentar guardar prospecto

**DEPLOYMENT URGENTE:**
- ✅ Build completado
- ✅ Desplegado inmediatamente
- ✅ Versión verificada: **v2026-91**

**Versión:** v2026-91 (HOTFIX)

---

### 🚨 FIX BACKEND v2026-93 (2026-01-09): Schema alignment importador activaciones

**PROBLEMA CRÍTICO:**
- ❌ Importador activaciones seguía dando error después de v2026-92
- ❌ Error SQL: "column is_active of relation bans does not exist"
- ❌ Error SQL: "column vendor_id of relation clients does not exist"

**CAUSA RAÍZ - ARQUITECTURA DUAL:**
1. **Sistema NUEVO**: `salespeople` (id UUID) ← `clients.salesperson_id` (UUID)
2. **Sistema LEGACY**: `vendors` (id INTEGER) ← `follow_up_prospects.vendor_id` (INTEGER)
3. **Conflicto**: Frontend envía `Clientes.salesperson_id` (UUID) pero backend intentaba usar `vendor_id` (INTEGER)

**CORRECCIONES APLICADAS:**

1. **✅ Línea 62 - Lectura de payload:**
   ```javascript
   // ANTES: clientData.vendor_id
   // DESPUÉS: clientData.salesperson_id
   const vendorName = String(clientData.salesperson_id || '').trim();
   ```

2. **✅ Línea 146 - UPDATE clients:**
   ```javascript
   // ANTES: vendor_id = $X
   // DESPUÉS: salesperson_id = $X
   updateFields.push(`salesperson_id = $${paramCount++}`);
   ```

3. **✅ Línea 160 - Eliminado UPDATE bans is_active:**
   ```javascript
   // ELIMINADO: UPDATE bans SET is_active = $1
   // RAZÓN: Campo is_active NO existe en tabla bans (solo existe status: 'A'/'C')
   ```

4. **✅ Línea 210 - INSERT clients:**
   ```javascript
   // ANTES: INSERT INTO clients (name, vendor_id, is_active, base, ...)
   // DESPUÉS: INSERT INTO clients (name, salesperson_id, ...)
   // ELIMINADO: is_active, base (campos no existen en schema)
   ```

5. **✅ Línea 239 - clientSalesStats Map:**
   ```javascript
   // ANTES: vendor_id: finalVendorId
   // DESPUÉS: salesperson_id: finalVendorId
   ```

6. **✅ Línea 322 - UPDATE clients SET NULL:**
   ```javascript
   // ANTES: UPDATE clients SET vendor_id = NULL
   // DESPUÉS: UPDATE clients SET salesperson_id = NULL
   ```

7. **⚠️ Líneas 288-332 - follow_up_prospects DESHABILITADO:**
   ```javascript
   // COMENTADO: Sección completa de INSERT/UPDATE follow_up_prospects
   // RAZÓN: follow_up_prospects.vendor_id es INTEGER (refs vendors.id)
   //        pero importador recibe salesperson_id UUID (refs salespeople.id)
   // TODO: Crear mapeo vendors<->salespeople o migrar schema
   ```

**SCHEMA REAL VERIFICADO:**

| Tabla | Columna | Tipo | Referencias |
|-------|---------|------|-------------|
| `clients` | `salesperson_id` | UUID | `salespeople.id` |
| `clients` | NO `vendor_id` | - | ❌ NO EXISTE |
| `clients` | NO `is_active` | - | ❌ NO EXISTE |
| `bans` | `status` | CHAR | 'A' o 'C' |
| `bans` | NO `is_active` | - | ❌ NO EXISTE |
| `follow_up_prospects` | `vendor_id` | INTEGER | `vendors.id` ⚠️ LEGACY |

**DECISIÓN TÉCNICA:**
- Importador activaciones ahora crea/actualiza SOLO:
  - ✅ `clients` (con salesperson_id UUID)
  - ✅ `bans` (con status)
  - ✅ `subscribers`
- ❌ NO crea `follow_up_prospects` (requiere vendor_id INTEGER que no tenemos)
- 📋 TODO: Migrar `follow_up_prospects.vendor_id` → `salesperson_id UUID` en futuro

**Archivos modificados:**
- `src/backend/controllers/importController.js` (5 correcciones + 1 sección comentada)
- `src/version.ts` (v2026-93)

**DEPLOYMENT:**
- ✅ Backend: importController.js copiado y PM2 reiniciado
- ✅ Frontend: dist/client/* actualizado (versión visible en pantalla)
- ✅ Cambios verificados en servidor

**Versión:** v2026-93

---

### ✅ CORRECCIÓN v2026-90 (2026-01-09): Tab Completadas redirige a Seguimiento

**PROBLEMA:**
- Tab "Completadas" en módulo Clientes no redirigía a /seguimiento
- Usuario esperaba ver ventas completadas en módulo Seguimiento

**SOLUCIÓN APLICADA:**
- ✅ Tab "Completadas" ahora es link (no cambia tab local)
- ✅ onClick: `navigate('/seguimiento?tab=completed')`
- ✅ Tooltip agregado: "Ver ventas completadas en módulo Seguimiento"
- ✅ Estilos actualizados: hover indigo, sin estado activo

**Archivo modificado:**
- `src/react-app/pages/Clients.tsx` (líneas 1847-1856)

**Verificación de NO afectación:**
- ✅ Módulo FollowUp NO modificado (protegido)
- ✅ Backend NO modificado
- ✅ Otros tabs Clientes NO afectados
- ✅ No hay errores de compilación

**Versión:** v2026-90

---

### ✅ CORRECCIÓN v2026-89 (2026-01-09): Errores TypeScript en ImportadorVisual

**PROBLEMA DETECTADO:**
- Errores de compilación en tabla de activaciones (ImportadorVisual.tsx)
- **CAUSA:** Cambios previos en otros módulos generaron inconsistencias de tipos

**ERRORES CORREGIDOS:**

1. **Tipo `PreviewData.simulation` incompleto**
   - ❌ Faltaban propiedades: `disponibles`, `incompletos`, `cancelados`
   - ✅ Agregadas como propiedades opcionales (líneas 8-28)

2. **Variable `isChecking` declarada pero no usada**
   - ❌ Se seteaba pero no se mostraba en UI
   - ✅ Eliminada completamente (líneas 55, 183, 204)

3. **Parámetro `phones` no usado en `checkSubscribersExistence`**
   - ✅ Renombrado a `_phones` (prefijo convención TypeScript)

4. **Variables no usadas en loops**
   - `idx` en forEach (línea 544) → `_idx`
   - `sim` declarada pero no usada (línea 1695) → eliminada

**Archivo modificado:**
- ✅ `src/react-app/pages/ImportadorVisual.tsx`

**Versión:** v2026-89

**Lección aprendida:**
- ⚠️ **Los cambios en un módulo PUEDEN afectar otros módulos**
- ⚠️ **SIEMPRE verificar errores de compilación** después de modificar tipos
- ⚠️ **ACTUALIZAR versión** inmediatamente después de corregir

---

### ✅ FIX COMPLETADO v2026-94 (2026-01-09): Importador activaciones → follow_up_prospects automático

**REQUERIMIENTO IMPLEMENTADO:**
1. ✅ Importar Excel → Crea Cliente + BANs + Suscriptores
2. ✅ Sistema crea automáticamente follow_up_prospects
3. ✅ Marca como "completado" con fecha de hoy
4. ✅ Aparece en Seguimiento tab "Completadas"

**PROBLEMA RESUELTO:**
- Frontend enviaba `vendor.name` (STRING "GABRIEL") en vez de `vendor.id` (INTEGER 12)
- Backend esperaba `vendor_id` INTEGER para crear `follow_up_prospects`
- Sección estaba comentada por incompatibilidad de tipos

**CAMBIOS APLICADOS:**

1. **Frontend - `ImportadorVisual.tsx`:**
   - Línea 1947: Dropdown envía `v.id` en vez de `v.name`
   - Línea 1074: Validación compara con `v.id.toString()`
   - Línea 1103: Payload envía `vendor_id: parseInt(...)` en vez de `salesperson_id`

2. **Backend - `importController.js`:**
   - Descomentada sección `follow_up_prospects` (líneas 288-332)
   - INSERT usa `vendor_id` INTEGER (refs `vendors.id`)
   - Crea/actualiza ventas completadas del día automáticamente

**FLUJO FUNCIONAL RESTAURADO:**
```
1. Usuario selecciona GABRIEL en dropdown
2. Frontend envía vendor_id = 12
3. Backend crea follow_up_prospects con:
   - vendor_id = 12
   - is_completed = true
   - completed_date = HOY
   - is_active = true
4. Venta aparece en Seguimiento → tab "Completadas"
5. Contador mes vigente incluye esta venta
6. Reportes acumula todas las completadas
```

**VERIFICACIÓN:**
- ✅ Build exitoso sin errores
- ✅ Backend desplegado y PM2 reiniciado
- ✅ Frontend actualizado con cache-busting
- ✅ Sistema listo para probar con importación real

**Versión:** v2026-94

---

### ✅ FIX MODAL v2026-96 (2026-01-09): Editar Prospecto - Campo eliminado y guardado corregido

**PROBLEMAS REPORTADOS:**
1. ❌ Modal NO guarda vendedor seleccionado
2. ❌ Campo "Cliente Existente" confuso (si está editando, el cliente ya existe)
3. ❌ Productos Negociados (Fijo Ren, Móvil Nueva, etc) NO se guardaban
4. ❌ Checkbox "Marcar como completado" NO se guardaba

**CORRECCIONES APLICADAS:**

1. **Campo "Cliente Existente" eliminado:**
   - Archivo: `FollowUp.tsx` líneas 729-744
   - Razón: Redundante - si está en Seguimiento, el prospecto ya tiene cliente asociado
   - Simplifica UI del modal

2. **Productos Negociados se guardan correctamente:**
   - Archivo: `FollowUp.tsx` línea 233 (handleSaveProspect)
   - Agregados explícitamente al payload: `fijo_ren`, `fijo_new`, `movil_nueva`, `movil_renovacion`, `claro_tv`, `cloud`, `mpls`
   - Valores por defecto: 0 si no están presentes

3. **Completado se guarda correctamente:**
   - Ya funcionaba: convierte `is_completed` → `completed_date` con timestamp
   - Payload incluye: `completed_date: data.is_completed ? new Date().toISOString() : null`

4. **Vendedor ya se guardaba correctamente:**
   - Lógica existente funcional: `vendor_id` se envía en payload
   - Para vendedores normales: usa el seleccionado
   - Para admins: permite cambiar vendedor

**INTERFAZ SIMPLIFICADA:**
```
Antes:
- Empresa *
- Cliente Existente (dropdown confuso)
- Prioridad
- Vendedor
...

Después:
- Empresa *
- Prioridad
- Vendedor
...
```

**VERIFICACIÓN:**
- ✅ Build exitoso
- ✅ Modal muestra campos correctos
- ✅ Guardar prospecto incluye todos los datos
- ✅ Productos negociados persisten después de editar

**Archivos modificados:**
- `src/react-app/pages/FollowUp.tsx` (2 cambios)
- `src/version.ts` (v2026-96)

**Versión:** v2026-96

---

### ✅ SIMPLIFICACIÓN UI v2026-97 (2026-01-09): Modal Editar Prospecto - Campos eliminados

**REQUERIMIENTO:**
- Eliminar campos redundantes del modal Editar Prospecto
- Campos ahora gestionados en módulo "Llamadas y Tareas"

**CAMPOS ELIMINADOS:**

1. **Paso** (dropdown)
   - Movido a módulo Llamadas y Tareas
   - Gestión de pasos ahora independiente del prospecto

2. **Teléfono** (input text)
   - Dato redundante con información de cliente/suscriptor

3. **Email** (input email)
   - Dato redundante con información de cliente

4. **Base de Datos** (input text)
   - Campo legacy sin uso actual

**MODAL SIMPLIFICADO:**
```
Antes:
- Empresa *
- Prioridad
- Vendedor
- Paso          ← ELIMINADO
- Teléfono      ← ELIMINADO
- Email         ← ELIMINADO
- Base de Datos ← ELIMINADO
- Productos Negociados (7 campos)
- Notas
- Completado

Después:
- Empresa *
- Prioridad
- Vendedor
- Productos Negociados (7 campos)
- Notas
- Completado
```

**IMPACTO:**
- ✅ Modal más limpio y rápido
- ✅ Menos campos para llenar
- ✅ Enfoque en información esencial
- ⚠️ step_id, contact_phone, contact_email y base se mantienen en BD (NULL permitido)

**Archivos modificados:**
- `src/react-app/pages/FollowUp.tsx` (eliminadas líneas 777-829)
- `src/version.ts` (v2026-97)

**Versión:** v2026-97

---

### ⏳ PENDIENTE

**P1. Editar Suscriptor - Comportamiento del Modal**
   - ❌ Modal cierra antes de tiempo (aunque guarda bien)
   - Archivo: `SubscriberModal.tsx` línea 141
   - Solución: Esperar respuesta del servidor antes de cerrar
   - O agregar delay/confirmación visual

**P2. Bloqueo de edición concurrente de prospectos**
   - 📋 **REQUERIMIENTO NUEVO** - Solicitado 2026-01-09
   - **Problema:** Múltiples usuarios pueden editar el mismo prospecto simultáneamente
   - **Error esperado:** Mensaje "Alguien más está trabajando en este prospecto"
   - **Solución propuesta:**
     1. Tabla `prospect_locks` (prospect_id, user_id, locked_at)
     2. Al abrir modal editar: INSERT lock con TTL 5 minutos
     3. Si lock existe y es de otro usuario: mostrar error
     4. Al cerrar modal o guardar: DELETE lock
     5. Cronjob limpia locks vencidos (>5 min)
   - **Archivos a crear:**
     - `migrations/19/up.sql` - Tabla prospect_locks
     - `src/backend/controllers/prospectLockController.js`
     - `src/backend/routes/prospectLockRoutes.js`
   - **Archivos a modificar:**
     - `FollowUp.tsx` - Verificar lock al abrir modal
     - `server-FINAL.js` - Montar ruta locks

**P3. Mensaje "Muchas peticiones" (429 Too Many Requests)**
   - 🔴 **PRIORIDAD MEDIA** - Reportado 2026-01-09
   - **Síntoma:** API responde con 429 en operaciones normales
   - **Causa probable:** Rate limiting agresivo en nginx o middleware
   - **Investigar:**
     - Configuración nginx: `/etc/nginx/sites-available/crmp`
     - Middleware rate limit en `server-FINAL.js`
   - **Solución temporal:** Aumentar límite de requests/segundo
   - **Solución permanente:** Implementar rate limiting por usuario (no por IP)

~~**P2. Importador Activaciones - Restaurar creación automática de follow_up_prospects**~~
   - ✅ **COMPLETADO v2026-94** - Flujo automático Excel → Seguimiento Completadas

~~**P3. Tab Seguimiento en Clientes**~~
   - ✅ **COMPLETADO v2026-94** - Flujo automático Excel → Seguimiento Completadas

~~**P3. Tab Seguimiento en Clientes**~~
   - ✅ **COMPLETADO v2026-90** - Redirige a `/seguimiento?tab=completed`

---

## 🔒 CÓDIGO PROTEGIDO - NO MODIFICAR SIN REVISIÓN

**ESTOS ARCHIVOS YA FUNCIONAN CORRECTAMENTE:**

### Frontend
- ✅ `src/react-app/pages/Clients.tsx` (v5.1.37)
  - `handleCreateClient` (línea 1141)
  - `handleUpdateClient` (línea 1180) 
  - `handleCreateBAN` (línea 1240)
  - `handleUpdateBAN` (línea 1362)
  - `handleSaveSubscriber` (línea 1418)

- ✅ `src/react-app/components/ClientModal.tsx`
  - Campo Vendedor (líneas 390-405) - VISIBLE Y EDITABLE
  - Lógica de auto-asignación (líneas 80-90)
  - availableVendors (línea 84-87)

- ✅ `src/react-app/pages/FollowUp.tsx` (v73)
  - Interfaces con tipos UUID corregidos
  - Sin conversiones `Number(clientId)` erróneas
  - Sin filtro `hasValidClient` que causaba race conditions
  - Contadores de tabs funcionando correctamente

### Backend
- ✅ `src/backend/controllers/banController.js`
  - `updateBan` (líneas 57-101) - Empty string → undefined fix
  - `createBan` (línea 20)

- ✅ `src/backend/controllers/subscriberController.js`
  - `createSubscriber` (línea 21)
  - `updateSubscriber` (línea 58)

- ✅ `src/backend/controllers/clientController.js`
  - CRUD operations completas y funcionando

---

## ⚠️ REGLAS OBLIGATORIAS ANTES DE MODIFICAR CÓDIGO

1. **VERIFICAR que el archivo NO esté en la lista protegida arriba**
2. **LEER el código actual** antes de hacer cambios
3. **PROBAR en incógnito** después de cada cambio
4. **ACTUALIZAR versión** en `src/version.ts` ANTES de desplegar
5. **DOCUMENTAR** cambios en este archivo inmediatamente

---

## ✅ CHECKLIST PRE-MODIFICACIÓN

**Antes de tocar cualquier código, responde:**

- [ ] ¿El archivo está en la lista de "🔒 CÓDIGO PROTEGIDO"?
- [ ] ¿Leí el código actual completo?
- [ ] ¿Entiendo por qué funciona como funciona?
- [ ] ¿Mi cambio puede afectar otras funcionalidades?
- [ ] ¿Tengo claro qué voy a modificar?

**Si respondiste SÍ a la primera pregunta, DETENTE y pregunta primero.**

---

## 📋 CHECKLIST POST-MODIFICACIÓN

**Después de cada cambio:**

- [ ] Código modificado guarda sin errores
- [ ] `npm run build` ejecutado exitosamente
- [ ] Versión actualizada en `src/version.ts`
- [ ] Deployment ejecutado (frontend y/o backend)
- [ ] Versión verificada en servidor con `curl`
- [ ] Funcionalidad probada en modo incógnito
- [ ] Funcionalidad anterior NO se rompió
- [ ] Documento `pasos-de-sistema.md` actualizado

**Solo después de cumplir TODO lo anterior puedes decir "listo".**

---

## 🎯 PRÓXIMOS PASOS

**Ahora trabajaremos en:**

1. **Reportes y Ventas Cerradas**
   - Módulo de reportes
   - Tracking de ventas completadas
   - Cálculo de ingresos
   - Histórico de ventas por cliente

2. **Pendientes menores**
   - P1: Modal suscriptor cierre prematuro
   - P2: Tab Seguimiento como hipervínculo

**No tocar:** Todo lo protegido arriba hasta terminar reportes.

---
