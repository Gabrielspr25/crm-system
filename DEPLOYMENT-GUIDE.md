# Guía de Deployment - VentasPro CRM

## Script de Deployment con Validación Automática

### Uso

```powershell
# Deployment completo (build + copy + validaciones + tests)
.\DEPLOY-CON-VALIDACION.ps1

# Skip build (usa el build existente en dist/client)
.\DEPLOY-CON-VALIDACION.ps1 -SkipBuild

# Skip tests funcionales (solo validaciones de archivos/config)
.\DEPLOY-CON-VALIDACION.ps1 -SkipTests

# Deployment rápido (sin build ni tests)
.\DEPLOY-CON-VALIDACION.ps1 -SkipBuild -SkipTests
```

### ¿Qué hace el script?

El script realiza deployment automático con validaciones en cada paso:

#### PASO 1: Build del Frontend
- Ejecuta `npm run build`
- Valida que `dist/client/` existe
- Cuenta archivos generados

#### PASO 2: Copiar Archivos
- Frontend → `/var/www/crmp/` (dist/client/*)
- Backend → `/opt/crmp/` (server-FINAL.js, package.json)

#### PASO 3: Validaciones en el Servidor
- ✅ **Archivos copiados**: Verifica index.html y assets/ existen
- ✅ **Permisos correctos**: www-data:www-data 755
  - Si están mal → Los corrige automáticamente
- ✅ **Nginx config**: Verifica root apunta a `/var/www/crmp`
  - Si está mal → **ERROR** (debes corregir manualmente)
- ✅ **Sin configs duplicados**: Solo 1 config activo
  - Si hay duplicados → **ERROR** (elimina los extras)
- 🔄 **Reinicio de servicios**: PM2 (crmp-api) + Nginx

#### PASO 4: Tests Funcionales (si no usas -SkipTests)
- ✅ **Backend responde**: curl localhost:3001/api/version
- ✅ **HTML carga**: curl https://crmp.ss-group.cloud/ → 200 OK
- ✅ **Assets CSS cargan**: curl .../assets/*.css → 200 OK
- ✅ **Assets JS cargan**: curl .../assets/*.js → 200 OK

### Resultado

Si todo pasa:
```
OK DEPLOYMENT EXITOSO!
========================

Version: {"version":"2026-37"}
URL: https://crmp.ss-group.cloud
Backend: /opt/crmp
Frontend: /var/www/crmp

OK Sitio verificado y funcionando correctamente
```

El script abre automáticamente el sitio en tu navegador.

Si algo falla:
```
ERROR DEPLOYMENT CON ERRORES
=========================

Revisa los errores arriba y vuelve a intentar
```

### Problemas Comunes

#### 1. Permisos incorrectos
**Síntoma**: Assets retornan 403 Forbidden  
**Solución**: El script los corrige automáticamente

#### 2. Nginx config apunta a ruta vieja
**Síntoma**: Validación "Nginx config correcto" falla  
**Solución Manual**:
```bash
ssh root@143.244.191.139 "sed -i 's|root /opt/crmp/dist/client|root /var/www/crmp|' /etc/nginx/sites-available/crmp.ss-group.cloud"
```

#### 3. Configs duplicados
**Síntoma**: Validación "Solo 1 config activo" falla  
**Solución Manual**:
```bash
# Ver qué configs hay
ssh root@143.244.191.139 "ls -la /etc/nginx/sites-enabled/"

# Eliminar duplicados (deja solo crmp.ss-group.cloud y ventaspro)
ssh root@143.244.191.139 "rm /etc/nginx/sites-enabled/crmp"
```

#### 4. Backend no responde
**Síntoma**: Test "Backend API responde" falla  
**Diagnóstico**:
```bash
ssh root@143.244.191.139 "pm2 list && pm2 logs crmp-api --lines 20"
```

#### 5. HTML/Assets retornan 403/404
**Síntoma**: Tests de carga fallan  
**Diagnóstico**:
```bash
# Ver logs de nginx
ssh root@143.244.191.139 "tail -20 /var/log/nginx/error.log"

# Verificar archivos existen
ssh root@143.244.191.139 "ls -la /var/www/crmp/"
```

### Mantenimiento del Servidor

#### Limpiar configs viejos de nginx
```bash
# Ver todos los configs
ssh root@143.244.191.139 "ls -la /etc/nginx/sites-available/ | grep crm"

# Mover configs viejos a backup
ssh root@143.244.191.139 "cd /etc/nginx/sites-available && mkdir -p OLD_CONFIGS && mv crmp-* crm-* OLD_CONFIGS/ 2>/dev/null"

# Dejar solo el activo
# /etc/nginx/sites-available/crmp.ss-group.cloud
# /etc/nginx/sites-enabled/crmp.ss-group.cloud (symlink)
```

#### Verificar estado del servidor
```bash
# RAM y procesos
ssh root@143.244.191.139 "free -m && pm2 list"

# Espacio en disco
ssh root@143.244.191.139 "df -h"

# Logs de errores nginx
ssh root@143.244.191.139 "tail -50 /var/log/nginx/error.log"

# Logs de backend
ssh root@143.244.191.139 "pm2 logs crmp-api --lines 50"
```

### Rutas Importantes

| Componente | Ruta | Descripción |
|------------|------|-------------|
| Frontend | `/var/www/crmp/` | Archivos estáticos (HTML, CSS, JS) |
| Backend | `/opt/crmp/` | Node.js app (server-FINAL.js) |
| Nginx config | `/etc/nginx/sites-available/crmp.ss-group.cloud` | Config principal |
| Nginx enabled | `/etc/nginx/sites-enabled/crmp.ss-group.cloud` | Symlink al config |
| Nginx logs | `/var/log/nginx/error.log` | Errores de nginx |
| PM2 app name | `crmp-api` | Nombre del proceso |
| Domain | `https://crmp.ss-group.cloud` | URL pública |

### Checklist Manual (si no usas el script)

1. ✅ Build: `npm run build`
2. ✅ Copy frontend: `scp -r dist/client/* root@143.244.191.139:/var/www/crmp/`
3. ✅ Copy backend: `scp server-FINAL.js package.json root@143.244.191.139:/opt/crmp/`
4. ✅ Fix permissions: `ssh root@143.244.191.139 "chown -R www-data:www-data /var/www/crmp && chmod -R 755 /var/www/crmp"`
5. ✅ Verify nginx config: `ssh root@143.244.191.139 "grep 'root /var/www/crmp' /etc/nginx/sites-available/crmp.ss-group.cloud"`
6. ✅ Restart PM2: `ssh root@143.244.191.139 "pm2 restart crmp-api"`
7. ✅ Restart nginx: `ssh root@143.244.191.139 "systemctl restart nginx"`
8. ✅ Test backend: `curl -s http://143.244.191.139:3001/api/version`
9. ✅ Test frontend: Abrir `https://crmp.ss-group.cloud` en navegador
10. ✅ Verify assets: Abrir DevTools → Network → Verificar que CSS/JS cargan (200 OK)

### Ventajas del Script

| Sin Script | Con Script |
|------------|------------|
| 10 comandos manuales | 1 comando |
| No detecta errores hasta el final | Valida cada paso |
| Configs duplicados causan 403 | Detecta y advierte |
| Permisos incorrectos → blank screen | Corrige automáticamente |
| "¿Funcionó?" → Prueba manual | Tests automáticos |
| Deploy toma 10 minutos | Deploy toma 2 minutos |
| Fallos silenciosos | Reporta exactamente qué falló |

### Notas de Seguridad

- El script usa SSH sin password (requiere SSH key configurado)
- Nunca commitear claves SSH al repo
- El script NO hace backup - siempre puedes re-deploy
- PM2 mantiene logs en `/root/.pm2/logs/`
