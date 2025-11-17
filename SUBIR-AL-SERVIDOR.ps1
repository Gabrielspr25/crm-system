# ================================================
# SUBIR AL SERVIDOR - VentasPro
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$RemotePath = "/opt/crmp"
$WebPath = "/var/www/crmp"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  SUBIENDO AL SERVIDOR 143.244.191.139" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# 1. Build
Write-Host "`n[1/6] Construyendo proyecto..." -ForegroundColor Yellow
npm run build 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR en el build" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Build completado" -ForegroundColor Green

# 2. Preparar directorios
Write-Host "`n[2/6] Preparando servidor..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "bash -c 'mkdir -p $RemotePath $WebPath && rm -rf $WebPath/* $WebPath/.* 2>/dev/null; mkdir -p $WebPath && echo OK'" | Out-Host
Write-Host "✓ Servidor preparado" -ForegroundColor Green

# 3. Subir backend
Write-Host "`n[3/6] Subiendo backend..." -ForegroundColor Yellow
Write-Host "  - server-FINAL.js"
& $pscpPath -batch -pw $ServerPass "server-FINAL.js" "${ServerUser}@${ServerHost}:${RemotePath}/" | Out-Host
Write-Host "  - package.json"
& $pscpPath -batch -pw $ServerPass "package.json" "${ServerUser}@${ServerHost}:${RemotePath}/" | Out-Host
Write-Host "  - .env"
& $pscpPath -batch -pw $ServerPass ".env" "${ServerUser}@${ServerHost}:${RemotePath}/" | Out-Host
Write-Host "✓ Backend subido" -ForegroundColor Green

# 4. Subir frontend
Write-Host "`n[4/6] Subiendo frontend..." -ForegroundColor Yellow
& $pscpPath -batch -pw $ServerPass -r "dist\client\*" "${ServerUser}@${ServerHost}:${WebPath}/" | Out-Host
Write-Host "✓ Frontend subido" -ForegroundColor Green

# 5. Instalar y reiniciar
Write-Host "`n[5/6] Instalando dependencias y reiniciando..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "bash -c 'cd $RemotePath && npm install --production && pm2 stop crmp-api 2>/dev/null || true && pm2 delete crmp-api 2>/dev/null || true && PORT=3001 pm2 start server-FINAL.js --name crmp-api && pm2 save'" | Out-Host
Write-Host "✓ Servicios reiniciados" -ForegroundColor Green

# 6. Permisos y Nginx
Write-Host "`n[6/6] Ajustando permisos y Nginx..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "bash -c 'chown -R www-data:www-data $WebPath && sed -i \"s|root /var/www/crmp/dist;|root /var/www/crmp;|g\" /etc/nginx/sites-available/crmp.ss-group.cloud && systemctl reload nginx && echo OK'" | Out-Host
Write-Host "✓ Permisos y Nginx ajustados" -ForegroundColor Green

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  ✓✓✓ SUBIDA COMPLETADA ✓✓✓" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "`nVerifica tu sitio en:" -ForegroundColor Yellow
Write-Host "  https://crmp.ss-group.cloud" -ForegroundColor White
Write-Host "  https://crmp.ss-group.cloud/api/health" -ForegroundColor White
Write-Host ""
