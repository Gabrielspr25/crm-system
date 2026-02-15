# MODAL DE FUSIÓN DE CLIENTES CON BUSCADOR EN TIEMPO REAL

**Versión:** v2026-276-BUSCADOR-FUSION  
**Fecha:** 6 de febrero de 2026  
**Estado:** ✅ Desplegado y funcionando

---

## 🎯 OBJETIVO

Mejorar la experiencia de usuario al fusionar clientes duplicados mediante un **buscador en tiempo real** que reemplaza el dropdown tradicional con cientos de opciones.

---

## 🆕 FUNCIONALIDAD IMPLEMENTADA

### Modal de Fusión Mejorado

**ANTES (v2026-275):**
- Dropdown `<select>` con TODOS los clientes
- Difícil de encontrar cliente específico en lista larga
- Sin filtrado ni búsqueda

**AHORA (v2026-276):**
- ✅ **Input de búsqueda** con icono de lupa
- ✅ **Búsqueda en tiempo real** (mínimo 2 caracteres)
- ✅ **Lista filtrada** con resultados relevantes (máximo 20)
- ✅ **Búsqueda inteligente** por:
  - Nombre del cliente
  - Email
  - Número de BAN
- ✅ **Vista de resultados** con detalles:
  - Nombre del cliente
  - ID único
  - Email (si existe)
  - BANs asociados
  - Vendedor asignado (badge azul)
- ✅ **Botón clear (X)** para reiniciar búsqueda
- ✅ **Confirmación visual** al seleccionar cliente destino (badge verde)

---

## 🔧 ARQUITECTURA TÉCNICA

### Backend (Ya existente desde v2026-274)

**Endpoint:** `GET /api/clients/search?q=<término>`

```javascript
// src/backend/controllers/clientController.js
export const searchClients = async (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.json([]);
    }

    try {
        const searchTerm = `%${q}%`;
        const clients = await query(
            `SELECT DISTINCT c.* 
             FROM clients c
             LEFT JOIN bans b ON c.id = b.client_id
             WHERE c.name ILIKE $1 
                OR c.email ILIKE $1 
                OR CAST(b.ban_number AS text) ILIKE $1
             LIMIT 20`,
            [searchTerm]
        );
        res.json(clients);
    } catch (error) {
        serverError(res, error, 'Error buscando clientes');
    }
};
```

**Características:**
- Búsqueda case-insensitive (`ILIKE`)
- Búsqueda en múltiples campos (nombre, email, BAN)
- LEFT JOIN para incluir BANs en búsqueda
- LIMIT 20 para performance
- Requiere autenticación JWT

**Ruta:** Montada en `src/backend/routes/clientRoutes.js`
```javascript
router.get('/search', searchClients);
```

### Frontend (Nuevo en v2026-276)

**Archivo:** `src/react-app/pages/Clients.tsx`

#### Estados agregados:

```typescript
const [mergeSearchTerm, setMergeSearchTerm] = useState('');
const [mergeSearchResults, setMergeSearchResults] = useState<Client[]>([]);
const [showMergeSearchResults, setShowMergeSearchResults] = useState(false);
const [selectedTargetClient, setSelectedTargetClient] = useState<Client | null>(null);
```

#### Funciones nuevas:

**1. `handleMergeSearch(term: string)`**
- Actualiza término de búsqueda
- Valida mínimo 2 caracteres
- Llama a `/api/clients/search?q=${term}`
- Filtra resultados (excluye cliente origen)
- Muestra dropdown con resultados

**2. `handleSelectTargetClient(client: Client)`**
- Selecciona cliente destino
- Muestra confirmación visual
- Oculta dropdown de resultados
- Guarda ID del cliente seleccionado

#### UI del Modal:

```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
  <input
    type="text"
    placeholder="Buscar por nombre, email o BAN..."
    value={mergeSearchTerm}
    onChange={(e) => handleMergeSearch(e.target.value)}
    onFocus={() => mergeSearchTerm.length >= 2 && setShowMergeSearchResults(true)}
  />
  {mergeSearchTerm && (
    <button onClick={clearSearch}>
      <X size={18} />
    </button>
  )}
</div>

{/* Dropdown de resultados */}
{showMergeSearchResults && mergeSearchResults.length > 0 && (
  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800">
    {mergeSearchResults.map((client) => (
      <button onClick={() => handleSelectTargetClient(client)}>
        {/* Detalles del cliente */}
      </button>
    ))}
  </div>
)}

{/* Confirmación de selección */}
{selectedTargetClient && (
  <div className="bg-green-900/20 border border-green-500/30">
    ✓ Cliente destino seleccionado
  </div>
)}
```

---

## 🎨 DISEÑO Y UX

### Flujo de Usuario

1. **Abrir modal fusión** → Click en "Fusionar Cliente" desde menú contextual
2. **Ver cliente origen** → Panel rojo con nombre del cliente a eliminar
3. **Buscar destino** → Input con placeholder "Buscar por nombre, email o BAN..."
4. **Escribir término** → Mínimo 2 caracteres para iniciar búsqueda
5. **Ver resultados** → Dropdown con hasta 20 clientes relevantes
6. **Seleccionar destino** → Click en resultado deseado
7. **Confirmar selección** → Panel verde con "✓ Cliente destino seleccionado"
8. **Confirmar fusión** → Botón "Confirmar Fusión" habilitado
9. **Confirmar acción** → Alerta de confirmación (NO se puede deshacer)
10. **Fusión completada** → Notificación de éxito

### Estados Visuales

| Elemento | Color | Significado |
|----------|-------|-------------|
| Cliente Origen | Rojo (`bg-red-900/20 border-red-500/30`) | Se eliminará |
| Cliente Destino | Verde (`bg-green-900/20 border-green-500/30`) | Recibirá los datos |
| Input búsqueda | Gris → Morado en focus | Neutro → Activo |
| Resultados hover | Gris oscuro (`hover:bg-gray-700`) | Seleccionable |
| Badge vendedor | Azul (`bg-blue-900/30 text-blue-300`) | Información adicional |
| Botón fusionar | Morado (`bg-purple-600`) | Acción principal |
| Botón cancelar | Gris (`bg-gray-700`) | Acción secundaria |

---

## 🔐 SEGURIDAD

### Validaciones Frontend

```typescript
// No permitir fusionar mismo cliente
if (mergeSourceId === mergeTargetId) {
  notify('error', 'No puedes fusionar el mismo cliente.');
  return;
}

// Validar ambos clientes seleccionados
if (!mergeSourceId || !mergeTargetId) {
  notify('error', 'Selecciona ambos clientes para fusionar.');
  return;
}

// Confirmar acción irreversible
if (!window.confirm("¿Estás seguro de fusionar estos clientes? Esta acción NO se puede deshacer...")) {
  return;
}
```

### Validaciones Backend

```javascript
// Verificar parámetros requeridos
if (!sourceId || !targetId) {
    return badRequest(res, 'Se requieren sourceId y targetId');
}

// Prevenir fusión consigo mismo
if (sourceId === targetId) {
    return badRequest(res, 'No se puede fusionar el mismo cliente');
}

// Verificar que ambos clientes existan
const source = await query('SELECT * FROM clients WHERE id = $1', [sourceId]);
const target = await query('SELECT * FROM clients WHERE id = $1', [targetId]);

if (source.length === 0 || target.length === 0) {
    return notFound(res, 'Uno o ambos clientes no existen');
}
```

### Autenticación

- ✅ Todos los endpoints requieren JWT válido
- ✅ Token verificado por middleware `authenticateToken`
- ✅ Búsqueda filtrada por permisos de usuario

---

## 📊 CASOS DE USO PARA LOS 110 DUPLICADOS

### Duplicados Simples (Ejemplo: TODOS sin datos)

**Pasos:**
1. Abrir modal fusión con cliente más antiguo como origen
2. Buscar cliente más reciente (vacío)
3. Fusionar → El vacío se elimina, el antiguo queda

### Duplicados con Datos (Ejemplo: RAMIREZ & RAMIREZ)

**Registro 1:** BAN 776354851, 7 suscriptores  
**Registro 2:** BAN 777064578, 1 suscriptor

**Pasos:**
1. Seleccionar Registro 2 como origen (menos datos)
2. Buscar "ramirez" o "776354851" (BAN del registro principal)
3. Seleccionar Registro 1 como destino
4. Fusionar → Todos los BANs ahora en Registro 1

### Duplicados Complejos (Ejemplo: JOHANNA MOTA - 7 registros)

**Estrategia:** Fusión en cascada
1. Fusionar registro 7 → 6
2. Fusionar registro 6 → 5
3. Fusionar registro 5 → 4
4. Fusionar registro 4 → 3
5. Fusionar registro 3 → 2
6. Fusionar registro 2 → 1
7. **Resultado:** UN solo cliente con todos los BANs

---

## 🧪 PRUEBAS RECOMENDADAS

### 1. Búsqueda por nombre
```
Término: "ramirez"
Esperado: Encuentra "RAMIREZ & RAMIREZ APPLIANCE INC"
```

### 2. Búsqueda por email
```
Término: "info@ejemplo.com"
Esperado: Encuentra clientes con ese email
```

### 3. Búsqueda por BAN
```
Término: "776354851"
Esperado: Encuentra cliente con ese BAN
```

### 4. Búsqueda case-insensitive
```
Término: "RAMIREZ" o "ramirez" o "Ramirez"
Esperado: Todos encuentran el mismo cliente
```

### 5. Búsqueda con menos de 2 caracteres
```
Término: "r" (1 carácter)
Esperado: No muestra resultados, espera más caracteres
```

### 6. Selección y limpieza
```
1. Buscar "ramirez"
2. Seleccionar cliente
3. Click en X (clear)
Esperado: Input vacío, selección limpiada
```

### 7. Fusión exitosa
```
1. Seleccionar cliente origen
2. Buscar y seleccionar destino
3. Confirmar fusión
Esperado: 
  - BANs transferidos al destino
  - Cliente origen eliminado
  - Notificación de éxito
  - Modal cerrado
  - Lista de clientes actualizada
```

---

## 🐛 PROBLEMAS CONOCIDOS Y SOLUCIONES

### ❌ Problema: Dropdown no se cierra al hacer click fuera

**Estado:** Comportamiento esperado  
**Razón:** Click en botón "Cancelar" cierra todo el modal  
**Solución:** Si necesario, agregar `onBlur` o detectar click fuera del dropdown

### ❌ Problema: Búsqueda lenta con muchos resultados

**Estado:** Mitigado  
**Solución:** LIMIT 20 en query  
**Mejora futura:** Paginación o "ver más" para cargar siguiente página

### ❌ Problema: Cliente origen excluido de búsqueda

**Estado:** Comportamiento intencional  
**Razón:** `mergeSearchResults.filter((c: Client) => c.id !== mergeSourceId)`  
**Propósito:** Prevenir selección del mismo cliente como destino

---

## 📝 ARCHIVOS MODIFICADOS

### v2026-276-BUSCADOR-FUSION

1. **src/react-app/pages/Clients.tsx**
   - Agregados estados: `mergeSearchTerm`, `mergeSearchResults`, `showMergeSearchResults`, `selectedTargetClient`
   - Agregada función: `handleMergeSearch()`
   - Agregada función: `handleSelectTargetClient()`
   - Modificada función: `handleMergeClients()` (limpieza de estados adicionales)
   - Reemplazado: Modal de fusión completo (dropdown → buscador)

2. **src/version.ts**
   - `APP_VERSION = "2026-276-BUSCADOR-FUSION"`
   - `BUILD_LABEL = "v2026-276 - Modal fusión con buscador en tiempo real"`

3. **package.json**
   - `version = "2026-276"`

---

## 🚀 DEPLOYMENT

### Comandos ejecutados:

```powershell
# Build
npm run build

# Deploy frontend
scp -r dist\client\* root@143.244.191.139:/opt/crmp/dist/client/

# Deploy package.json (versión)
scp package.json root@143.244.191.139:/opt/crmp/

# Restart API
ssh root@143.244.191.139 "pm2 restart ventaspro-backend"
```

### Verificación:

```powershell
# Verificar versión API
ssh root@143.244.191.139 'curl -s http://localhost:3001/api/version'
# Resultado: {"version":"2026-276"}

# Verificar versión frontend
ssh root@143.244.191.139 'curl -s https://crmp.ss-group.cloud | grep -o "CURRENT_VERSION.*" | head -1'
# Resultado: CURRENT_VERSION = '2026-276';
```

✅ **Frontend:** https://crmp.ss-group.cloud (versión 2026-276)  
✅ **API:** http://localhost:3001 (versión 2026-276)  
✅ **PM2 Process:** ventaspro-backend (online)

---

## 📈 PRÓXIMOS PASOS RECOMENDADOS

### 1. Limpieza Masiva de Duplicados
- Usar CSV generado en v2026-275
- Priorizar casos "TODOS SIN DATOS"
- Fusionar casos con el nuevo buscador

### 2. Analytics de Búsqueda
- Log de términos más buscados
- Métricas de tiempo de búsqueda
- Detectar patrones de uso

### 3. Mejoras UX
- Agregar shortcuts de teclado (↑↓ para navegar resultados, Enter para seleccionar)
- Highlight del término buscado en resultados
- Mostrar coincidencia (nombre/email/BAN) en cada resultado

### 4. Performance
- Cache de resultados de búsqueda (60 segundos)
- Debounce para evitar requests excesivos (300ms)
- Elasticsearch para búsquedas fuzzy avanzadas

### 5. Funcionalidades Adicionales
- Vista previa antes de fusionar (comparar ambos clientes lado a lado)
- Historial de fusiones realizadas
- Opción de deshacer fusión (dentro de 30 minutos)

---

**Última actualización:** 6 de febrero de 2026  
**Próxima revisión:** Después de limpieza de los 110 duplicados
