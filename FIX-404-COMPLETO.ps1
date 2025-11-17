# ================================================
# FIX 404 - REVISAR Y CORREGIR TODO
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$RemotePath = "/opt/crmp"
$WebPath = "/var/www/crmp"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  REVISANDO Y CORRIGIENDO SISTEMA" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# 1. Estado de PM2
Write-Host "`n[1] Estado de PM2..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "pm2 status" | Out-Host

# 2. Reiniciar servidor con puerto correcto
Write-Host "`n[2] Reiniciando servidor en puerto 3001..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "bash -c 'cd $RemotePath && pm2 stop crmp-api 2>/dev/null || true && pm2 delete crmp-api 2>/dev/null || true && PORT=3001 pm2 start server-FINAL.js --name crmp-api && pm2 save'" | Out-Host

# 3. Verificar que el servidor responde
Write-Host "`n[3] Verificando respuesta del servidor..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "bash -c 'curl -s http://localhost:3001/api/health'" | Out-Host

# 4. Verificar y corregir Nginx
Write-Host "`n[4] Verificando configuracion de Nginx..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "bash -c 'grep -A 5 \"location /api\" /etc/nginx/sites-available/crmp.ss-group.cloud || echo \"No se encontro configuracion de /api\"" | Out-Host

# 5. Corregir Nginx si es necesario
Write-Host "`n[5] Corrigiendo configuracion de Nginx..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "bash -c '
if ! grep -q \"location /api\" /etc/nginx/sites-available/crmp.ss-group.cloud; then
  sed -i \"/location \//a\\
    location /api {\\
        proxy_pass http://127.0.0.1:3001;\\
        proxy_http_version 1.1;\\
        proxy_set_header Upgrade \$http_upgrade;\\
        proxy_set_header Connection \"upgrade\";\\
        proxy_set_header Host \$host;\\
        proxy_set_header X-Real-IP \$remote_addr;\\
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\\
        proxy_set_header X-Forwarded-Proto \$scheme;\\
    }\" /etc/nginx/sites-available/crmp.ss-group.cloud
fi
if grep -q \"proxy_pass http://127.0.0.1:3000\" /etc/nginx/sites-available/crmp.ss-group.cloud; then
  sed -i \"s|proxy_pass http://127.0.0.1:3000|proxy_pass http://127.0.0.1:3001|g\" /etc/nginx/sites-available/crmp.ss-group.cloud
fi
nginx -t && systemctl reload nginx && echo \"Nginx configurado correctamente\" || echo \"ERROR en configuracion de Nginx\"
'" | Out-Host

# 6. Verificar estado final
Write-Host "`n[6] Verificando estado final..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "bash -c 'pm2 status && echo \"---\" && curl -s http://localhost:3001/api/health && echo \"\" && systemctl status nginx --no-pager | head -5'" | Out-Host

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  CORRECCION COMPLETADA" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "`nVerifica en:" -ForegroundColor Yellow
Write-Host "  https://crmp.ss-group.cloud/api/health" -ForegroundColor White
Write-Host ""

