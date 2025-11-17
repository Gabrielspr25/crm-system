# 📋 ARCHIVOS PARA REVISAR - PROBLEMA CON METAS

## 🔴 PROBLEMA
Las metas (goals) no funcionan correctamente.

## 📁 ARCHIVOS CRÍTICOS PARA REVISAR

### 1. **BACKEND - Rutas de Product Goals (Metas del Negocio)**
**Archivo:** `server-FINAL.js`

#### GET - Obtener metas del negocio
- **Línea 744:** `app.get('/api/product-goals', ...)`
- **Verificar:** Que devuelva las metas correctamente

#### POST - Crear meta del negocio
- **Línea 786:** `app.post('/api/product-goals', ...)`
- **Verificar:** Que acepte los parámetros correctos:
  - `product_id`
  - `period_year`
  - `period_month`
  - `total_target_amount`
  - `description` (opcional)

#### PUT - Actualizar meta del negocio
- **Línea 860:** `app.put('/api/product-goals/:id', ...)`
- **Verificar:** Que actualice correctamente

#### DELETE - Eliminar meta del negocio
- **Línea 953:** `app.delete('/api/product-goals/:id', ...)`
- **Verificar:** Que elimine correctamente

#### POST - Bulk (Crear múltiples metas)
- **Línea 974:** `app.post('/api/product-goals/bulk', ...)`
- **Verificar:** Que procese el array de metas correctamente

### 2. **BACKEND - Rutas de Goals (Metas de Vendedores)**
**Archivo:** `server-FINAL.js`

#### GET - Obtener metas de vendedores
- **Línea 1086:** `app.get('/api/goals', ...)`
- **Verificar:** Que devuelva las metas de vendedores

#### POST - Crear meta de vendedor
- **Línea 1144:** `app.post('/api/goals', ...)`
- **Verificar:** Que acepte los parámetros correctos:
  - `vendor_id`
  - `product_id`
  - `period_year`
  - `period_month`
  - `target_amount`
  - `description` (opcional)

#### PUT - Actualizar meta de vendedor
- **Línea 1225:** `app.put('/api/goals/:id', ...)`
- **Verificar:** Que actualice correctamente

#### DELETE - Eliminar meta de vendedor
- **Línea 1326:** `app.delete('/api/goals/:id', ...)`
- **Verificar:** Que elimine correctamente

### 3. **FRONTEND - Componente de Metas**
**Archivo:** `src/react-app/pages/Goals.tsx`

#### Carga de datos
- **Línea 176:** `useApi<Goal[]>("/api/goals")` - Metas de vendedores
- **Línea 177:** `useApi<ProductGoal[]>("/api/product-goals")` - Metas del negocio
- **Línea 179:** `useApi<Product[]>("/api/products")` - Productos
- **Línea 178:** `useApi<Vendor[]>("/api/vendors")` - Vendedores

#### Crear/Editar Meta del Negocio
- **Línea 442:** `PUT /api/product-goals/${id}` - Editar
- **Línea 447:** `POST /api/product-goals` - Crear
- **Línea 399-435:** `handleSubmitBusiness` - Función que envía los datos

#### Crear/Editar Meta de Vendedor
- **Línea 483:** `PUT /api/goals/${id}` - Editar
- **Línea 488:** `POST /api/goals` - Crear
- **Línea 437-476:** `handleSubmitVendor` - Función que envía los datos

#### Eliminar Metas
- **Línea 507:** `DELETE /api/product-goals/${id}` - Eliminar meta del negocio
- **Línea 518:** `DELETE /api/goals/${id}` - Eliminar meta de vendedor

#### Guardar Metas en Bulk (Modal de configuración)
- **Línea 681:** `POST /api/product-goals/bulk` - Guardar múltiples metas del negocio
- **Línea 721:** `PUT /api/goals/${id}` - Actualizar meta de vendedor existente
- **Línea 726:** `POST /api/goals` - Crear nueva meta de vendedor
- **Línea 605-721:** `handleSaveBulk` - Función que procesa el guardado masivo

### 4. **FRONTEND - Utilidades de Autenticación**
**Archivo:** `src/react-app/utils/auth.ts`
- **Línea 159-221:** `authFetch` - Función que envía requests con token
- **Verificar:** Que el token se esté enviando correctamente

### 5. **FRONTEND - Hook de API**
**Archivo:** `src/react-app/hooks/useApi.ts`
- **Línea 14:** `useApi` - Hook que usa `authFetch`
- **Verificar:** Que esté manejando errores correctamente

## 🔍 CHECKLIST DE VERIFICACIÓN

### En el navegador (F12 → Console):
1. ✅ Verificar que hay un token: `localStorage.getItem('crm_token')`
2. ✅ Ver en Network tab las peticiones a `/api/goals` y `/api/product-goals`:
   - ¿Qué status code devuelven?
   - ¿Tienen el header `Authorization: Bearer ...`?
   - ¿Qué respuesta devuelven?

### Errores comunes a verificar:

1. **401 Unauthorized**
   - Token no está siendo enviado
   - Token expirado
   - Token inválido

2. **404 Not Found**
   - Ruta incorrecta en el frontend
   - Ruta no existe en el backend
   - Nginx no está redirigiendo correctamente

3. **400 Bad Request**
   - Parámetros faltantes o incorrectos
   - Validación fallando en el backend

4. **500 Internal Server Error**
   - Error en la base de datos
   - Error en la lógica del backend

## 📝 PRUEBAS RÁPIDAS EN CONSOLA

```javascript
// 1. Verificar token
console.log('Token:', localStorage.getItem('crm_token'));

// 2. Probar GET de metas del negocio
fetch('/api/product-goals', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
  }
}).then(r => {
  console.log('Product Goals Status:', r.status);
  return r.json();
}).then(data => console.log('Product Goals:', data));

// 3. Probar GET de metas de vendedores
fetch('/api/goals', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
  }
}).then(r => {
  console.log('Goals Status:', r.status);
  return r.json();
}).then(data => console.log('Goals:', data));

// 4. Probar GET de productos
fetch('/api/products', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
  }
}).then(r => {
  console.log('Products Status:', r.status);
  return r.json();
}).then(data => console.log('Products:', data));

// 5. Probar GET de vendedores
fetch('/api/vendors', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
  }
}).then(r => {
  console.log('Vendors Status:', r.status);
  return r.json();
}).then(data => console.log('Vendors:', data));
```

## 🐛 POSIBLES PROBLEMAS ESPECÍFICOS

### Si el modal de configuración no carga productos/vendedores:
- Verificar que `/api/products` y `/api/vendors` respondan correctamente
- Verificar los logs en la consola del navegador

### Si no se pueden guardar metas:
- Verificar que el payload que se envía sea correcto
- Verificar los logs del servidor: `pm2 logs crmp-api`
- Verificar que los campos requeridos estén presentes

### Si las metas no se muestran en la tabla:
- Verificar que `aggregatedMetas` se esté calculando correctamente
- Verificar que los datos de `goals` y `productGoals` estén llegando

## 📂 ARCHIVOS PARA MOSTRAR AL DIRECTOR

1. **`server-FINAL.js`**
   - Líneas 744-1095: Rutas de product-goals
   - Líneas 1086-1400: Rutas de goals

2. **`src/react-app/pages/Goals.tsx`**
   - Líneas 176-179: Carga de datos
   - Líneas 399-476: Funciones de submit
   - Líneas 605-721: Función de guardado masivo

3. **`src/react-app/utils/auth.ts`**
   - Líneas 159-221: Función authFetch

4. **`src/react-app/hooks/useApi.ts`**
   - Completo

5. **Logs del servidor** (en el servidor):
   - `pm2 logs crmp-api --lines 100`

