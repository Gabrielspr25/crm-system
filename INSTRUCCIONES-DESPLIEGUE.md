# 🚀 INSTRUCCIONES PARA DESPLEGAR FRONTEND CON AUTENTICACIÓN

## ✅ BUILD COMPLETADO

El build se ha generado correctamente con el nuevo código que incluye autenticación.

### 📁 Archivos Generados

**Ubicación:** `dist/client/`

**Archivos principales:**
- `index.html` - Página principal
- `assets/index-DFrC2xuA.js` - **NUEVO BUNDLE** (902 KB) - **Incluye autenticación**
- `assets/index-OhS04qER.css` - Estilos (54 KB)

### 🔑 DIFERENCIAS CON EL BUILD VIEJO

| Aspecto | Build Viejo | Build Nuevo |
|---------|-------------|-------------|
| Bundle JS | `index-B-HjrQ6x.js` | `index-DFrC2xuA.js` |
| Autenticación | ❌ No tiene | ✅ Incluida |
| Login | ❌ No existe | ✅ Incluido |
| authFetch | ❌ No existe | ✅ Incluido |
| Errores 401 | ❌ Ocurren | ✅ Se resuelven |

### 📋 PASOS PARA DESPLEGAR

#### Opción 1: Subir Archivos Manualmente

1. **Conectarse al servidor:**
   ```bash
   ssh usuario@143.244.191.139
   ```

2. **Hacer backup del directorio actual:**
   ```bash
   cd /var/www/crmp/
   sudo cp -r client client_backup_$(date +%Y%m%d_%H%M%S)
   ```

3. **Subir los nuevos archivos:**
   - Subir TODOS los archivos de `dist/client/` a `/var/www/crmp/client/`
   - Reemplazar todos los archivos existentes

4. **Verificar permisos:**
   ```bash
   sudo chown -R www-data:www-data /var/www/crmp/client
   sudo chmod -R 755 /var/www/crmp/client
   ```

#### Opción 2: Usar Script de Despliegue (si existe)

Si existe un script `SUBIR-AL-SERVIDOR.ps1`, ejecutarlo después de este build.

### ✅ VERIFICACIÓN POST-DESPLIEGUE

Después de subir los archivos, verificar:

1. **Abrir el navegador en modo incógnito**
2. **Ir a la URL de producción**
3. **Deberías ver:**
   - ✅ Página de Login (no errores 401)
   - ✅ Al ingresar credenciales, te lleva al dashboard
   - ✅ Las peticiones incluyen tokens de autenticación
   - ✅ No hay errores 401 en la consola

4. **Verificar en DevTools (F12):**
   - Network → Ver que las peticiones tienen header `Authorization: Bearer ...`
   - Console → No debería haber errores 401
   - El nuevo bundle `index-DFrC2xuA.js` se está cargando

### ⚠️ IMPORTANTE

- **Este build reemplaza completamente el frontend viejo**
- **Los usuarios que tengan el sitio abierto necesitarán recargar la página (Ctrl+Shift+R)**
- **El nuevo bundle tiene un hash diferente, por lo que los navegadores descargarán la nueva versión automáticamente**

### 🔄 SI ALGO SALE MAL

1. **Restaurar el backup:**
   ```bash
   sudo rm -rf /var/www/crmp/client
   sudo cp -r client_backup_YYYYMMDD_HHMMSS /var/www/crmp/client
   ```

2. **Verificar logs del servidor**
3. **Verificar que los archivos se subieron correctamente**

---

**Fecha del build:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Bundle nuevo:** `index-DFrC2xuA.js` (incluye autenticación completa)
