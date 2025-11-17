# ================================================
# DIAGNÓSTICO DEL SERVIDOR - VentasPro
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  DIAGNÓSTICO DEL SERVIDOR" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# Solicitar contraseña
Write-Host "`nIngrese credenciales de acceso..." -ForegroundColor Yellow
$SecurePass = Read-Host "Contraseña SSH para $ServerUser@$ServerHost" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePass)
$ServerPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$plinkPath = "C:\Program Files\PuTTY\plink.exe"

if (!(Test-Path $plinkPath)) {
    Write-Host "ERROR: PuTTY plink no encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/6] Verificando estado de PM2..." -ForegroundColor Yellow
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "pm2 list"

Write-Host "`n[2/6] Verificando logs del backend..." -ForegroundColor Yellow
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "pm2 logs crmp-api --lines 20 --nostream"

Write-Host "`n[3/6] Verificando estado de Nginx..." -ForegroundColor Yellow
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "systemctl status nginx --no-pager | head -20"

Write-Host "`n[4/6] Verificando puertos en uso..." -ForegroundColor Yellow
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "netstat -tlnp | grep -E ':(80|443|3000|3001)'"

Write-Host "`n[5/6] Verificando archivos del backend..." -ForegroundColor Yellow
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "ls -lh /opt/crmp/"

Write-Host "`n[6/6] Verificando archivos del frontend..." -ForegroundColor Yellow
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "ls -lh /var/www/crmp/dist/ 2>&1 | head -10"

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  DIAGNÓSTICO COMPLETADO" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# Limpiar contraseña
$ServerPass = $null
[System.GC]::Collect()
