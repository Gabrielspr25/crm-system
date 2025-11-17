# 📋 ARCHIVOS CLAVE PARA REVISAR - ERRORES 401 y 404

## 🔴 PROBLEMA ACTUAL (RESUELTO)
- ✅ **401 Unauthorized**: Error de autenticación - Verificar token en localStorage
- ✅ **404 Not Found**: Ruta `/api/categories` POST/PUT/DELETE no existían - **CORREGIDO**: Se agregaron las rutas faltantes

## 📁 ARCHIVOS CRÍTICOS PARA REVISAR

### 1. **BACKEND - Rutas de API**
**Archivo:** `server-FINAL.js`
- **Línea 316:** `app.use(authenticateRequest);` - Middleware de autenticación
- **Línea 597:** `app.get('/api/categories', ...)` - Ruta de categorías
- **Verificar:** Que la ruta esté DESPUÉS del middleware de autenticación (correcto)
- **Verificar:** Que el servidor esté escuchando en puerto 3001

### 2. **FRONTEND - Autenticación**
**Archivo:** `src/react-app/utils/auth.ts`
- **Línea 6-9:** `API_BASE_URL` - URL base de la API
- **Línea 159-221:** `authFetch` - Función que envía requests con token
- **Línea 188-214:** Manejo de errores 401
- **Verificar:** Que el token se esté guardando en localStorage
- **Verificar:** Que el token se esté enviando en el header Authorization

### 3. **FRONTEND - Hook de API**
**Archivo:** `src/react-app/hooks/useApi.ts`
- **Línea 14:** `useApi` - Hook que usa `authFetch`
- **Línea 24-43:** `execute` - Función que hace las peticiones
- **Verificar:** Que esté usando `authFetch` correctamente

### 4. **FRONTEND - Página de Categorías**
**Archivo:** `src/react-app/pages/Categories.tsx`
- **Línea 26:** `useApi<Category[]>("/api/categories")` - Llamada a la API
- **Verificar:** Que la ruta sea correcta `/api/categories`

### 5. **CONFIGURACIÓN NGINX (SERVIDOR)**
**Archivo en servidor:** `/etc/nginx/sites-available/crmp.ss-group.cloud`
- **Verificar:** Que tenga `location /api { proxy_pass http://127.0.0.1:3001; }`
- **Verificar:** Que NO tenga barra al final en `proxy_pass` (debe ser `3001;` no `3001/;`)

### 6. **VARIABLES DE ENTORNO**
**Archivo:** `.env`
- **Verificar:** `PORT=3001` (o que PM2 lo esté pasando)
- **Verificar:** Variables de base de datos correctas

## 🔍 CHECKLIST DE VERIFICACIÓN

### En el navegador (F12 → Console):
1. ✅ Verificar que hay un token en localStorage: `localStorage.getItem('crm_token')`
2. ✅ Verificar la URL base: `localStorage` o ver en Network tab
3. ✅ Ver en Network tab la petición a `/api/categories`:
   - ¿Qué status code devuelve?
   - ¿Tiene el header `Authorization: Bearer ...`?
   - ¿A qué URL está haciendo la petición?

### En el servidor:
1. ✅ Verificar que PM2 está corriendo: `pm2 status`
2. ✅ Verificar que el servidor responde: `curl http://localhost:3001/api/health`
3. ✅ Verificar logs: `pm2 logs crmp-api --lines 50`
4. ✅ Verificar Nginx: `nginx -t && systemctl status nginx`

## 🐛 POSIBLES CAUSAS

1. **Token no se está guardando** → Revisar `auth.ts` línea 42-48
2. **Token expirado** → Revisar `auth.ts` línea 188-214 (refresh token)
3. **Nginx no está redirigiendo** → Revisar configuración de Nginx
4. **Backend no está corriendo** → Verificar PM2
5. **Ruta incorrecta** → Verificar que sea `/api/categories` y no `/api/categories/`

## 📝 ARCHIVOS PARA MOSTRAR AL DIRECTOR

1. `server-FINAL.js` (líneas 316, 597-609)
2. `src/react-app/utils/auth.ts` (completo)
3. `src/react-app/hooks/useApi.ts` (completo)
4. `src/react-app/pages/Categories.tsx` (línea 26)
5. Configuración de Nginx del servidor
6. Logs de PM2 del servidor

## ✅ VERIFICACIÓN RÁPIDA

Ejecutar en la consola del navegador:
```javascript
// Verificar token
console.log('Token:', localStorage.getItem('crm_token'));

// Verificar usuario
console.log('User:', localStorage.getItem('crm_user'));

// Probar petición manual
fetch('/api/categories', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
  }
}).then(r => console.log('Status:', r.status, r.statusText));
```

