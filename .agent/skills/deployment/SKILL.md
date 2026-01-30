---
name: DEPLOYMENT
description: Instrucciones y scripts para desplegar la aplicación TangoUI en producción (DigitalOcean).
---

# Deployment Skill (TangoUI)

Esta habilidad contiene el conocimiento y los procedimientos necesarios para desplegar la aplicación en el servidor de producción.

## Información del Entorno
- **Servidor IP**: `104.236.211.88`
- **Usuario SSH**: `root`
- **Ruta Base**: `/opt/crmp`
- **Ruta Frontend**: `/opt/crmp/dist/client`
- **Ruta Backend**: `/opt/crmp` (server-FINAL.js, package.json, src/)
- **Servicio PM2**: `crm-pro-api`
- **Servidor Web**: Nginx

## Procedimiento de Despliegue (Automático)

El método PREFERIDO para desplegar es usar el script de PowerShell `DEPLOY-CON-VALIDACION.ps1`.

### Pasos:
1.  **Incrementar Versión**:
    - Edita `package.json` e incrementa la versión.
    - Edita `src/version.ts` y actualiza `APP_VERSION` y `BUILD_LABEL` con una descripción de los cambios.
    
2.  **Ejecutar Script de Despliegue**:
    Desde la terminal de PowerShell en la raíz del proyecto:
    ```powershell
    powershell -ExecutionPolicy Bypass -File DEPLOY-CON-VALIDACION.ps1
    ```

### ¿Qué hace el script?
1.  **Build Frontend**: Ejecuta `npm run build` (Vite) para generar `dist/client`.
2.  **Copiar Archivos**: Usa `scp` para subir:
    - Frontend (`dist/client`) -> `/opt/crmp/dist/client`
    - Backend (`server-FINAL.js`, `package.json`, `src/`) -> `/opt/crmp/`
    *Nota: Es crítico que se copie la carpeta `src` completa para actualizar controladores y rutas.*
3.  **Validar Permisos**: Ejecuta `chown -R www-data:www-data` y `chmod -R 755` en el servidor.
4.  **Reiniciar Servicios**: Reinicia PM2 (`pm2 restart crm-pro-api`) y Nginx (`service nginx restart`).
5.  **Validaciones Post-Despliegue**: Verifica que `index.html` exista y los servicios estén corriendo.

## Solución de Problemas Comunes

### Error 404 en API o "Empty Response"
- **Causa**: El código del backend (controladores/rutas) no se actualizó en el servidor.
- **Solución**: Verificar que el script de despliegue esté copiando la carpeta `src` (verificar línea `scp -r src ...` en `DEPLOY-CON-VALIDACION.ps1`).

### Pantalla Blanca (White Screen of Death)
- **Causa**: Error de Javascript antes de renderizar React (ej. configuración de MSAL inválida).
- **Solución**: Revisar consola del navegador. Verificar `msalConfig.ts`. Asegurar que `ErrorBoundary` esté activo.

### Error 403 Forbidden (Assets)
- **Causa**: Permisos incorrectos en archivos recién subidos (dueño root en vez de www-data).
- **Solución**: El script `DEPLOY-CON-VALIDACION.ps1` ya incluye corrección automática (`chown`). Si falla, ejecutar manualmente en servidor: `chown -R www-data:www-data /opt/crmp/dist/client`.

### "Configs duplicados detectados" (Nginx)
- **Causa**: Validación estricta en el script. Si `ls /etc/nginx/sites-enabled/` retorna algo inesperado.
- **Acción**: Si el sitio carga, ignorar. Si no, entrar por SSH y revisar enlaces simbólicos.

## Comandos Útiles (SSH)
```bash
# Ver logs del backend
pm2 logs crm-pro-api

# Reiniciar backend manualmente
pm2 restart crm-pro-api

# Verificar estado de nginx
systemctl status nginx

# Listar configuración de sitios
ls -l /etc/nginx/sites-enabled/
```
