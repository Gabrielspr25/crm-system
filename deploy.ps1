# SCRIPT DE DEPLOY AUTOMÁTICO - SOLUCIÓN DEFINITIVA
# Ejecuta: .\deploy.ps1

Write-Host "🚀 INICIANDO DEPLOY AUTOMÁTICO" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 1. BUILD
Write-Host "`n📦 Paso 1/4: Compilando frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error en compilación" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Compilación exitosa" -ForegroundColor Green

# 2. SUBIR ARCHIVOS
Write-Host "`n📤 Paso 2/4: Subiendo archivos al servidor..." -ForegroundColor Yellow
scp -r dist/client/* root@143.244.191.139:/opt/crmp/dist/client/
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error subiendo archivos frontend" -ForegroundColor Red
    exit 1
}

# 2.1. SUBIR BACKEND (server-FINAL.js y package.json)
Write-Host "📤 Subiendo backend (server-FINAL.js y package.json)..." -ForegroundColor Yellow
scp server-FINAL.js package.json root@143.244.191.139:/opt/crmp/
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error subiendo archivos backend" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Archivos subidos" -ForegroundColor Green

# 3. PERMISOS
Write-Host "`n🔐 Paso 3/4: Configurando permisos..." -ForegroundColor Yellow
ssh root@143.244.191.139 "chmod -R 755 /opt/crmp/dist/client && chown -R www-data:www-data /opt/crmp/dist/client"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error configurando permisos" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Permisos configurados" -ForegroundColor Green

# 4. VERIFICAR
Write-Host "`n🔍 Paso 4/4: Verificando deploy..." -ForegroundColor Yellow
ssh root@143.244.191.139 "pm2 restart ventaspro-backend"
Start-Sleep -Seconds 5
$version = (Get-Content package.json | ConvertFrom-Json).version
$apiVersion = ssh root@143.244.191.139 "curl -s http://localhost:3001/api/version"
Write-Host "✅ Deploy completado - Versión local: v$version" -ForegroundColor Green
Write-Host "📡 Respuesta API Server: $apiVersion" -ForegroundColor Cyan
Write-Host "`n🌐 Accede a: https://crmp.ss-group.cloud" -ForegroundColor Cyan
Write-Host "💡 Presiona Ctrl+Shift+R para forzar recarga en el navegador" -ForegroundColor Yellow
