
# 🚀 INSTRUCCIONES DE DESPLIEGUE - CRM PRODUCTOS

## 📋 Pasos para subir los archivos al servidor:

### 1. Conectar al servidor
```bash
ssh user@142.93.176.195
```

### 2. Navegar al directorio de la aplicación
```bash
cd /var/www
```

### 3. Hacer backup de la versión actual
```bash
cp -r dist dist_backup_$(date +%Y%m%d_%H%M%S)
```

### 4. Subir los nuevos archivos
Subir toda la carpeta `dist` desde tu máquina local al servidor:
```bash
# Desde tu máquina local:
scp -r dist/* user@142.93.176.195:/var/www/dist/
```

### 5. Verificar permisos
```bash
sudo chown -R www-data:www-data /var/www/dist
sudo chmod -R 755 /var/www/dist
```

### 6. Reiniciar Nginx
```bash
sudo systemctl reload nginx
```

### 7. Verificar que funciona
- Ir a https://crmp.ss-group.cloud
- Navegar a la sección "Productos"
- Deberías ver 21 productos con sus categorías

## 🎯 Archivos que se van a subir:
- assets
- index.html
- assets\charts-BqIooSrg.js
- assets\index-7m2nURYE.js
- assets\index-iCVETPkP.css
- assets\utils-l0sNRNKZ.js
- assets\vendor-Bzgz95E1.js

## ✅ Resultado esperado:
- Página de productos completamente funcional
- 21 productos mostrados
- 10 categorías disponibles
- Búsqueda y filtros funcionando
- Diseño profesional con tema oscuro
