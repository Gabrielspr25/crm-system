# ================================================
# SUBIR AL SERVIDOR - VentasPro
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$KeyFile = "deploy_key"

$RemotePath = "/opt/crmp"
$WebPath = "/var/www/crmp"

# Usamos SSH nativo de Windows en lugar de PuTTY para usar la llave generada fácilmente
$SshOpts = "-i $KeyFile -o StrictHostKeyChecking=no"

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
ssh $SshOpts "$ServerUser@$ServerHost" "bash -c 'mkdir -p $RemotePath $WebPath && rm -rf $WebPath/* $WebPath/.* 2>/dev/null; mkdir -p $WebPath && echo OK'" | Out-Host
Write-Host "✓ Servidor preparado" -ForegroundColor Green

# 3. Subir backend
Write-Host "`n[3/6] Subiendo backend..." -ForegroundColor Yellow
Write-Host "  - server-FINAL.js"
scp $SshOpts "server-FINAL.js" "${ServerUser}@${ServerHost}:${RemotePath}/" | Out-Host
Write-Host "  - package.json"
scp $SshOpts "package.json" "${ServerUser}@${ServerHost}:${RemotePath}/" | Out-Host
Write-Host "  - .env"
scp $SshOpts ".env" "${ServerUser}@${ServerHost}:${RemotePath}/" | Out-Host
Write-Host "✓ Backend subido" -ForegroundColor Green

# 4. Subir frontend
Write-Host "`n[4/6] Subiendo frontend..." -ForegroundColor Yellow

# Limpiar cualquier subida previa en tmp
Write-Host "  - Limpiando temporales..."
ssh $SshOpts "$ServerUser@$ServerHost" "rm -rf /tmp/client" | Out-Host

# Subir la carpeta client a /tmp/client
Write-Host "  - Subiendo archivos a /tmp/client..."
scp $SshOpts -r "dist\client" "${ServerUser}@${ServerHost}:/tmp/" | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Host "Error subiendo frontend" -ForegroundColor Red; exit 1 }

# Limpiar destino y mover archivos
Write-Host "  - Limpiando destino y moviendo archivos a $WebPath..."
ssh $SshOpts "$ServerUser@$ServerHost" "bash -c 'rm -rf $WebPath/* && cp -r /tmp/client/* $WebPath/ && rm -rf /tmp/client'" | Out-Host

Write-Host "✓ Frontend subido" -ForegroundColor Green

# 5. Instalar y reiniciar
Write-Host "`n[5/6] Instalando dependencias y reiniciando..." -ForegroundColor Yellow
ssh $SshOpts "$ServerUser@$ServerHost" "bash -c 'cd $RemotePath && npm install --production && pm2 stop crmp-api 2>/dev/null || true && pm2 delete crmp-api 2>/dev/null || true && PORT=3001 pm2 start server-FINAL.js --name crmp-api && pm2 save'" | Out-Host
Write-Host "✓ Servicios reiniciados" -ForegroundColor Green

# 6. Permisos y Nginx
Write-Host "`n[6/6] Ajustando permisos y Nginx..." -ForegroundColor Yellow

# Subir nueva configuración de Nginx
Write-Host "  - Actualizando configuracion Nginx NO-CACHE..."
scp $SshOpts "nginx-crmp-no-cache.conf" "${ServerUser}@${ServerHost}:/tmp/crmp.conf" | Out-Host
ssh $SshOpts "$ServerUser@$ServerHost" "bash -c 'mv /tmp/crmp.conf /etc/nginx/sites-available/crmp.ss-group.cloud && ln -sf /etc/nginx/sites-available/crmp.ss-group.cloud /etc/nginx/sites-enabled/ && nginx -t && systemctl restart nginx'" | Out-Host

ssh $SshOpts "$ServerUser@$ServerHost" "bash -c 'chown -R www-data:www-data $WebPath && echo OK'" | Out-Host
Write-Host "✓ Permisos y Nginx ajustados" -ForegroundColor Green

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  ✓✓✓ SUBIDA COMPLETADA ✓✓✓" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "`nVerifica tu sitio en:" -ForegroundColor Yellow
Write-Host "  https://crmp.ss-group.cloud" -ForegroundColor White
Write-Host "  https://crmp.ss-group.cloud/api/health" -ForegroundColor White
Write-Host ""
