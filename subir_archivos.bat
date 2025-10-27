@echo off
echo 🚀 SUBIENDO ARCHIVOS AL SERVIDOR
echo ==================================================

echo ✅ Verificando archivos...
if not exist "dist" (
    echo ❌ Carpeta dist no existe
    pause
    exit /b 1
)

echo ✅ Archivos encontrados:
dir dist /s /b

echo.
echo 🚀 Subiendo archivos...
echo Ejecutando: scp -r dist/* user@142.93.176.195:/var/www/dist/
scp -r dist/* user@142.93.176.195:/var/www/dist/

if %errorlevel% neq 0 (
    echo ❌ Error subiendo archivos
    pause
    exit /b 1
)

echo ✅ Archivos subidos exitosamente

echo.
echo 🔧 Configurando permisos...
echo Ejecutando: ssh user@142.93.176.195 "sudo chown -R www-data:www-data /var/www/dist && sudo chmod -R 755 /var/www/dist && sudo systemctl reload nginx"
ssh user@142.93.176.195 "sudo chown -R www-data:www-data /var/www/dist && sudo chmod -R 755 /var/www/dist && sudo systemctl reload nginx"

if %errorlevel% neq 0 (
    echo ❌ Error configurando permisos
    pause
    exit /b 1
)

echo ✅ Permisos configurados exitosamente

echo.
echo 🎉 DESPLIEGUE COMPLETADO
echo ==================================================
echo 1. Ir a https://crmp.ss-group.cloud
echo 2. Hacer login con gabriel/123456
echo 3. Navegar a "Productos"
echo 4. Deberías ver 21 productos con categorías
echo.
echo ✅ ¡NO ME RINDO! Los archivos están subidos
pause
