# ================================================
# DEPLOY Y FIX 404 - VentasPro
# ================================================

param(
    [switch]$SkipBuild = $false
)

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$RemotePath = "/opt/crmp"
$WebPath = "/var/www/crmp"
$Domain = "crmp.ss-group.cloud"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

if (!(Test-Path $plinkPath) -or !(Test-Path $pscpPath)) {
    Write-Host "ERROR: PuTTY tools no encontradas. Instala desde: https://www.putty.org/" -ForegroundColor Red
    exit 1
}

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  DEPLOY VENTASPRO - FIX 404" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# Build
if (!$SkipBuild) {
    Write-Host "`n[1/8] Construyendo frontend..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR al construir" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Build exitoso" -ForegroundColor Green
} else {
    Write-Host "`n[1/8] Omitiendo build..." -ForegroundColor Gray
}

# Autenticación
Write-Host "`n[2/8] Autenticación..." -ForegroundColor Yellow
$SecurePass = Read-Host "Contraseña SSH para $ServerUser@$ServerHost" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePass)
$ServerPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Crear y limpiar directorios
Write-Host "`n[3/8] Preparando directorios remotos..." -ForegroundColor Yellow
$setupCmd = @"
mkdir -p $RemotePath $WebPath && \
rm -rf $WebPath/* && \
mkdir -p $WebPath/dist
"@
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" $setupCmd 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Directorios preparados" -ForegroundColor Green
} else {
    Write-Host "ERROR al preparar directorios" -ForegroundColor Red
    exit 1
}

# Subir backend
Write-Host "`n[4/8] Subiendo backend..." -ForegroundColor Yellow
& $pscpPath -pw $ServerPass "server-FINAL.js" "$ServerUser@${ServerHost}:$RemotePath/" 2>&1 | Out-Null
& $pscpPath -pw $ServerPass "package.json" "$ServerUser@${ServerHost}:$RemotePath/" 2>&1 | Out-Null
& $pscpPath -pw $ServerPass ".env" "$ServerUser@${ServerHost}:$RemotePath/" 2>&1 | Out-Null
Write-Host "✓ Backend subido" -ForegroundColor Green

# Subir frontend
Write-Host "`n[5/8] Subiendo frontend..." -ForegroundColor Yellow
& $pscpPath -pw $ServerPass -r "dist\client\*" "$ServerUser@${ServerHost}:$WebPath/" 2>&1 | Out-Null
Write-Host "✓ Frontend subido" -ForegroundColor Green

# Instalar dependencias y reiniciar backend
Write-Host "`n[6/8] Configurando backend..." -ForegroundColor Yellow
$backendCmd = @"
cd $RemotePath && \
npm install --production && \
pm2 stop crmp-api 2>/dev/null || true && \
pm2 delete crmp-api 2>/dev/null || true && \
PORT=3001 pm2 start server-FINAL.js --name crmp-api --time && \
pm2 save
"@
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" $backendCmd
Write-Host "✓ Backend configurado" -ForegroundColor Green

# Configurar/Verificar Nginx
Write-Host "`n[7/8] Configurando Nginx..." -ForegroundColor Yellow
$nginxConfig = @"
server {
    listen 80;
    listen [::]:80;
    server_name $Domain;

    # Redireccionar HTTP a HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $Domain;

    # SSL configurado por Certbot (mantener certificados existentes)
    # Las líneas ssl_certificate serán manejadas por Certbot

    root $WebPath;
    index index.html;

    # Frontend - SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
"@

# Escribir config a archivo temporal local
$tempConfig = "$env:TEMP\nginx-crmp.conf"
$nginxConfig | Out-File -FilePath $tempConfig -Encoding UTF8 -NoNewline

# Subir config de Nginx
& $pscpPath -pw $ServerPass $tempConfig "$ServerUser@${ServerHost}:/tmp/nginx-crmp.conf" 2>&1 | Out-Null

# Backup de config existente y aplicar nueva
$nginxCmd = @"
cp /etc/nginx/sites-available/$Domain /etc/nginx/sites-available/${Domain}.backup.\$(date +%Y%m%d-%H%M%S) 2>/dev/null || true && \
cp /tmp/nginx-crmp.conf /etc/nginx/sites-available/$Domain && \
ln -sf /etc/nginx/sites-available/$Domain /etc/nginx/sites-enabled/ && \
nginx -t && systemctl reload nginx
"@

& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" $nginxCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Nginx configurado" -ForegroundColor Green
} else {
    Write-Host "ADVERTENCIA: Verificar config de Nginx manualmente" -ForegroundColor Yellow
}

# Permisos
Write-Host "`n[8/8] Ajustando permisos..." -ForegroundColor Yellow
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "chown -R www-data:www-data $WebPath" 2>&1 | Out-Null
Write-Host "✓ Permisos ajustados" -ForegroundColor Green

# Limpiar
Remove-Item $tempConfig -ErrorAction SilentlyContinue
$ServerPass = $null
[System.GC]::Collect()

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  ✓ DESPLIEGUE COMPLETADO" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "`nVerificar en:" -ForegroundColor Cyan
Write-Host "  Frontend: https://$Domain" -ForegroundColor White
Write-Host "  Backend:  https://$Domain/api/health" -ForegroundColor White
Write-Host "  IP:       http://$ServerHost" -ForegroundColor White
Write-Host ""
