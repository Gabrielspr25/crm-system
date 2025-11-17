# ================================================
# DEPLOY SCRIPT - VentasPro (FIXED VERSION)
# ================================================

param(
    [switch]$SkipBuild = $false
)

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$RemotePath = "/opt/crmp"
$WebPath = "/var/www/crmp"

# Verificar que existen PuTTY tools
$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

if (!(Test-Path $plinkPath) -or !(Test-Path $pscpPath)) {
    Write-Host "ERROR: PuTTY tools no encontradas. Instala PuTTY desde: https://www.putty.org/" -ForegroundColor Red
    exit 1
}

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  DEPLOY VENTASPRO - FIXED" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# 1. Construir frontend React
if (!$SkipBuild) {
    Write-Host "`n[1/7] Construyendo frontend..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR al construir frontend" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Frontend construido exitosamente" -ForegroundColor Green
} else {
    Write-Host "`n[1/7] Omitiendo build (usando dist existente)..." -ForegroundColor Gray
}

# Solicitar contraseña de forma segura
Write-Host "`n[2/7] Autenticación..." -ForegroundColor Yellow
$SecurePass = Read-Host "Ingrese la contraseña SSH para $ServerUser@$ServerHost" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePass)
$ServerPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# 3. Crear directorios remotos
Write-Host "`n[3/7] Creando directorios remotos..." -ForegroundColor Yellow
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "mkdir -p $RemotePath $WebPath/dist" 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Directorios creados" -ForegroundColor Green
} else {
    Write-Host "ERROR al crear directorios" -ForegroundColor Red
    exit 1
}

# 4. Subir backend
Write-Host "`n[4/7] Subiendo archivos del backend..." -ForegroundColor Yellow
& $pscpPath -pw $ServerPass "server-FINAL.js" "$ServerUser@${ServerHost}:$RemotePath/" 2>&1 | Out-Null
& $pscpPath -pw $ServerPass "package.json" "$ServerUser@${ServerHost}:$RemotePath/" 2>&1 | Out-Null
& $pscpPath -pw $ServerPass ".env" "$ServerUser@${ServerHost}:$RemotePath/" 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Backend subido" -ForegroundColor Green
} else {
    Write-Host "ERROR al subir backend" -ForegroundColor Red
    exit 1
}

# 5. Subir frontend construido
Write-Host "`n[5/7] Subiendo frontend..." -ForegroundColor Yellow
& $pscpPath -pw $ServerPass -r "dist\client\*" "$ServerUser@${ServerHost}:$WebPath/dist/" 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Frontend subido" -ForegroundColor Green
} else {
    Write-Host "ERROR al subir frontend" -ForegroundColor Red
    exit 1
}

# 6. Instalar dependencias y reiniciar backend
Write-Host "`n[6/7] Instalando dependencias y reiniciando backend..." -ForegroundColor Yellow
$backendCmd = @"
cd $RemotePath && \
npm install --production && \
pm2 stop crmp-api 2>/dev/null || true && \
pm2 delete crmp-api 2>/dev/null || true && \
pm2 start server-FINAL.js --name crmp-api --time && \
pm2 save
"@

& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" $backendCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Backend reiniciado con PM2" -ForegroundColor Green
} else {
    Write-Host "ADVERTENCIA: Posible error al reiniciar PM2" -ForegroundColor Yellow
}

# 7. Configurar permisos y Nginx
Write-Host "`n[7/7] Configurando permisos y Nginx..." -ForegroundColor Yellow
$finalCmd = @"
chown -R www-data:www-data $WebPath && \
nginx -t && systemctl reload nginx
"@

& $plinkPath -ssh -pw $ServerPass "$ServerUser@${ServerHost}" $finalCmd 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Nginx reconfigurado" -ForegroundColor Green
} else {
    Write-Host "ADVERTENCIA: Verifica manualmente la configuración de Nginx" -ForegroundColor Yellow
}

# Limpiar contraseña de memoria
$ServerPass = $null
[System.GC]::Collect()

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  ✓ DESPLIEGUE COMPLETADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "`nAplicación disponible en: https://crmp.ss-group.cloud" -ForegroundColor Cyan
Write-Host "Backend API: https://crmp.ss-group.cloud/api/health" -ForegroundColor Cyan
Write-Host "`nPara verificar logs del backend:" -ForegroundColor Gray
Write-Host "  ssh $ServerUser@$ServerHost 'pm2 logs crmp-api'" -ForegroundColor Gray
Write-Host ""
