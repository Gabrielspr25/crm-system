# 🚀 DEPLOY - DOCUMENTACIÓN OFICIAL

## Una única forma de desplegar

**Comando:**
```powershell
.\DEPLOY.ps1
```

---

## ¿Qué hace?

El script `DEPLOY.ps1` ejecuta 4 pasos automáticamente:

### 1️⃣ **Compilación Frontend**
```
npm run build
```
- Construye la aplicación React/Vite
- Genera archivos optimizados en `dist/client/`

### 2️⃣ **Subir archivos al servidor**
```
scp -r dist/client/* root@143.244.191.139:/opt/crmp/dist/client/
```
- Transfiere los archivos compilados al servidor de producción
- IP: `143.244.191.139`
- Ruta: `/opt/crmp/dist/client/`

### 3️⃣ **Configurar permisos**
```
ssh root@143.244.191.139 "chmod -R 755 /opt/crmp/dist/client && chown -R www-data:www-data /opt/crmp/dist/client"
```
- Establece permisos correctos para nginx
- Usuario: `www-data`

### 4️⃣ **Validación**
- Lee la versión de `package.json`
- Confirma que el deploy fue exitoso
- Muestra la URL de acceso

---

## Requisitos previos

1. ✅ **SSH configurado** - Acceso a `root@143.244.191.139`
2. ✅ **Node.js instalado** - Para ejecutar `npm run build`
3. ✅ **Git Bash o SSH client** - Para `scp` y `ssh`
4. ✅ **package.json actualizado** - Con la versión correcta

---

## Flujo de desarrollo

### Cambios locales → Deploy

1. **Editar código** en `src/react-app/`
2. **Actualizar versión** en `package.json`:
   ```json
   "version": "2025-5"
   ```
3. **Ejecutar deploy:**
   ```powershell
   .\DEPLOY.ps1
   ```
4. **Verificar en navegador:**
   - URL: https://crmp.ss-group.cloud
   - Presionar: `Ctrl+Shift+R` (forzar recarga)

---

## Historial de versiones

| Versión | Cambio | Fecha |
|---------|--------|-------|
| 2025-4  | Fix: Removido JOIN a tabla vendors que no existe | 2025-12-30 |
| 2025-3  | Importación Excel: 1,682 clientes + 1,681 BANs | 2025-12-30 |

---

## ⚠️ NOTAS IMPORTANTES

- ✅ **DEPLOY.ps1 es el ÚNICO script valido** - Todos los demás fueron eliminados
- ✅ **Script confiable** - Probado y funcionando
- ✅ **Sin pasos manuales** - Todo es automático
- ❌ **No uses scripts viejos** - DEPLOY-FINAL-V5, DESPLEGAR-FRONTEND, etc. están archivados

---

## En caso de error

```
❌ Error en compilación
```
→ Revisar `npm run build` localmente

```
❌ Error subiendo archivos
```
→ Verificar conexión SSH: `ssh root@143.244.191.139`

```
❌ Error configurando permisos
```
→ Revisar permisos en servidor: `/opt/crmp/dist/client/`

---

**Responsable:** Gabriel (Decisión de usar UN script único)
**Estatus:** ✅ ACTIVO Y FUNCIONAL
**Última actualización:** 2025-12-31
