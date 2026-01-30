# Plan de Hardening de Seguridad - Versión Simple

## Cambios a Aplicar (Mínimos y Críticos)

### 1. Proteger Rutas API en server-FINAL.js
- Mover `app.use(authenticateRequest)` ANTES de montar las rutas
- Esto protege automáticamente todas las rutas `/api/*` excepto las públicas

### 2. Agregar pdf-parse a package.json
- Añadir `"pdf-parse": "^1.1.1"` a dependencies
- Esto resuelve el crash del backend

### 3. Incrementar Versión
- Cambiar a `2026-177` para tracking

### 4. Deploy Limpio
- npm install
- npm run build  
- pm2 restart

## NO TOCAR:
- vite.config.ts (dejar como está en GitHub)
- Cloudflare plugin (dejar como está)
- Estructura de carpetas dist/
- Configuración de NGINX (usar la que ya funciona en el servidor)
