@echo off
echo 🔄 REINICIANDO SERVICIOS CRM PRO...
echo.

echo 1. Matando procesos anteriores...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM chrome.exe 2>nul
taskkill /F /IM firefox.exe 2>nul

echo.
echo 2. Limpiando cache y build...
cd /d "C:\Users\Gabriel\Documentos\Programas\VentasProui"
if exist dist rmdir /s /q dist
if exist node_modules\.vite rmdir /s /q node_modules\.vite

echo.
echo 3. Reconstruyendo frontend...
call npm run build

echo.
echo 4. Reiniciando servidor...
start "CRM PRO SERVER" cmd /c "npm run dev:backend"

echo.
echo 5. Esperando que el servidor inicie...
timeout /t 5 /nobreak >nul

echo.
echo 6. Abriendo navegador en modo incógnito...
start chrome --incognito "http://localhost:3001" 2>nul
start firefox --private-window "http://localhost:3001" 2>nul

echo.
echo ✅ SERVICIOS REINICIADOS
echo 📝 Abre http://localhost:3001 en modo incógnito
echo 🔄 Si aún da problemas, presiona Ctrl+F5 en la página
pause