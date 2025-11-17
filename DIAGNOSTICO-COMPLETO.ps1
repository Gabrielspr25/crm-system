# ================================================
# DIAGNÓSTICO COMPLETO DEL SISTEMA
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$RemotePath = "/opt/crmp"
$WebPath = "/var/www/crmp"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  DIAGNÓSTICO COMPLETO DEL SISTEMA" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# 1. Estado de PM2
Write-Host "`n[1/7] Estado de PM2..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "pm2 status" | Out-Host

# 2. Logs recientes del servidor
Write-Host "`n[2/7] Últimos logs del servidor (últimas 20 líneas)..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "pm2 logs crmp-api --lines 20 --nostream" | Out-Host

# 3. Verificar puerto 3001
Write-Host "`n[3/7] Verificando puerto 3001..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "bash -c 'netstat -tlnp | grep 3001 || echo \"Puerto 3001 no está en uso\"'" | Out-Host

# 4. Probar endpoint de salud
Write-Host "`n[4/7] Probando endpoint de salud..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "bash -c 'curl -s http://localhost:3001/api/health || echo \"ERROR: Backend no responde\"'" | Out-Host

# 5. Verificar configuración de Nginx
Write-Host "`n[5/7] Verificando configuración de Nginx..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "cat /etc/nginx/sites-available/crmp.ss-group.cloud | grep -A 10 'location /api'" | Out-Host

# 6. Verificar estado de Nginx
Write-Host "`n[6/7] Estado de Nginx..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -ssh -pw $ServerPass "$ServerUser@$ServerHost" "systemctl status nginx --no-pager -l | head -20" | Out-Host

# 7. Verificar archivos del frontend
Write-Host "`n[7/7] Verificando archivos del frontend..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "ls -lah $WebPath | head -10" | Out-Host

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  DIAGNÓSTICO COMPLETADO" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

