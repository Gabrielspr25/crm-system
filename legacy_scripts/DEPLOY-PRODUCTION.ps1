# DEPLOY-PRODUCTION.ps1
# Script estandarizado para despliegue completo (Frontend + Backend)

$ErrorActionPreference = "Stop"

Write-Host "🚀 INICIANDO DESPLIEGUE A PRODUCCION..." -ForegroundColor Cyan

# 1. Construir Frontend
Write-Host "📦 Construyendo Frontend..." -ForegroundColor Yellow
cmd /c "npm run build"
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Error en build de frontend"
}

# 2. Subir Archivos (Backend y Frontend)
Write-Host "📤 Subiendo archivos al servidor..." -ForegroundColor Yellow

# Backend (excluyendo node_modules y otros)
plink -batch -i "C:\Users\Gabriel\.ssh\id_rsa" root@145.223.18.251 "mkdir -p /var/www/crm-pro-backend"
pscp -r -i "C:\Users\Gabriel\.ssh\id_rsa" src package.json package-lock.json root@145.223.18.251:/var/www/crm-pro-backend/

# Frontend (contenido de dist)
plink -batch -i "C:\Users\Gabriel\.ssh\id_rsa" root@145.223.18.251 "mkdir -p /var/www/crm-pro-frontend"
pscp -r -i "C:\Users\Gabriel\.ssh\id_rsa" dist/* root@145.223.18.251:/var/www/crm-pro-frontend/

# 3. Reiniciar Servicios
Write-Host "🔄 Reiniciando servicios..." -ForegroundColor Yellow
plink -batch -i "C:\Users\Gabriel\.ssh\id_rsa" root@145.223.18.251 "cd /var/www/crm-pro-backend && npm install --production && pm2 restart server && pm2 save"

Write-Host "✅ DESPLIEGUE COMPLETADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "⚠️  Recuerda hacer Hard Refresh (Ctrl + F5) en el navegador." -ForegroundColor Magenta
