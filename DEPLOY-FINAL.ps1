# ================================================
# DEPLOY SCRIPT - VentasPro (FINAL AUTO)
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$RemotePath = "/opt/crmp"
$WebPath = "/var/www/crmp"

# Verificar que existen PuTTY tools
$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

if (!(Test-Path $plinkPath) -or !(Test-Path $pscpPath)) {
    Write-Host "ERROR: PuTTY tools no encontradas." -ForegroundColor Red
    exit 1
}

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  DEPLOY VENTASPRO - FINAL AUTO" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# 1. Construir frontend React
Write-Host "`n[1/5] Construyendo frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR al construir frontend" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Frontend construido exitosamente" -ForegroundColor Green

# 2. Subir archivos del Backend
Write-Host "`n[2/5] Subiendo Backend..." -ForegroundColor Yellow
& $pscpPath -pw $ServerPass -r src/backend/* "$ServerUser@$ServerHost`:$RemotePath/src/backend/"
& $pscpPath -pw $ServerPass package.json "$ServerUser@$ServerHost`:$RemotePath/"
& $pscpPath -pw $ServerPass server-FINAL.js "$ServerUser@$ServerHost`:$RemotePath/"
Write-Host "✓ Backend subido" -ForegroundColor Green

# 3. Subir archivos del Frontend (dist)
Write-Host "`n[3/5] Subiendo Frontend (dist)..." -ForegroundColor Yellow
& $pscpPath -pw $ServerPass -r dist/* "$ServerUser@$ServerHost`:$WebPath/"
Write-Host "✓ Frontend subido" -ForegroundColor Green

# 4. Instalar dependencias y reiniciar
Write-Host "`n[4/5] Reiniciando servicios..." -ForegroundColor Yellow
$commands = "
cd $RemotePath
npm install --production
pm2 restart all || pm2 start server-FINAL.js --name crm-backend
systemctl restart nginx
"
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" $commands

Write-Host "`n[5/5] DEPLOY COMPLETADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "Versión v5.1.41 desplegada." -ForegroundColor Green
