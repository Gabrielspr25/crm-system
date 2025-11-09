# ================================================
# DEPLOY SCRIPT - VentasPro React/Vite
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$RemotePath = "/opt/crmp"
$WebPath = "/var/www/crmp"

Write-Host "Iniciando despliegue..." -ForegroundColor Green

# 1. Construir frontend React
Write-Host "Construyendo frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error al construir frontend" -ForegroundColor Red
    exit 1
}

# 2. Subir backend
Write-Host "Subiendo backend..." -ForegroundColor Yellow
$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "mkdir -p $RemotePath"

# Subir archivos del backend
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "rm -rf $RemotePath/*"
& $pscpPath -pw $ServerPass "server-FINAL.js" "$ServerUser@${ServerHost}:$RemotePath/"
& $pscpPath -pw $ServerPass "package.json" "$ServerUser@${ServerHost}:$RemotePath/"
& $pscpPath -pw $ServerPass "schema-final.sql" "$ServerUser@${ServerHost}:$RemotePath/"

# 3. Subir frontend construido
Write-Host "Subiendo frontend..." -ForegroundColor Yellow
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "mkdir -p $WebPath/dist"
& $pscpPath -pw $ServerPass -r "dist/client/*" "$ServerUser@${ServerHost}:$WebPath/dist/"

# 4. Instalar dependencias del backend en el servidor
Write-Host "Instalando dependencias..." -ForegroundColor Yellow
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "cd $RemotePath && npm install --production"

# 5. Configurar PM2
Write-Host "Configurando PM2..." -ForegroundColor Yellow
$pm2Cmd = "pm2 stop crmp-api 2>/dev/null || true; pm2 delete crmp-api 2>/dev/null || true; cd $RemotePath; pm2 start server-FINAL.js --name crmp-api; pm2 save"
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" $pm2Cmd

# 6. Configurar permisos
Write-Host "Configurando permisos..." -ForegroundColor Yellow
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "chown -R www-data:www-data $WebPath"

# 7. Verificar Nginx
Write-Host "Verificando Nginx..." -ForegroundColor Yellow
$nginxCmd = 'if ! grep -q "location /api" /etc/nginx/sites-available/crmp.ss-group.cloud; then sed -i "/location \//a\    location /api {\n        proxy_pass http://localhost:3000;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade \$http_upgrade;\n        proxy_set_header Connection \"upgrade\";\n        proxy_set_header Host \$host;\n        proxy_set_header X-Real-IP \$remote_addr;\n        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \$scheme;\n    }" /etc/nginx/sites-available/crmp.ss-group.cloud; fi; nginx -t && systemctl reload nginx'
& $plinkPath -ssh -pw $ServerPass "${ServerUser}@${ServerHost}" $nginxCmd

Write-Host "Despliegue completado!" -ForegroundColor Green
Write-Host "Aplicacion disponible en: https://crmp.ss-group.cloud" -ForegroundColor Cyan
