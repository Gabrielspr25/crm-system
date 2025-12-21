$ErrorActionPreference = "Stop"
$ServerHost = "143.244.191.139"
$ServerUser = "root"

Write-Host "`n=======================================" -ForegroundColor Cyan
Write-Host "  DEPLOY A PRODUCCION" -ForegroundColor Cyan
Write-Host "=======================================`n" -ForegroundColor Cyan

try {
    Write-Host "[1/4] Compilando..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build fallo" }
    Write-Host "OK Compilado`n" -ForegroundColor Green

    Write-Host "[2/4] Subiendo backend..." -ForegroundColor Yellow
    scp server-FINAL.js package.json .env ${ServerUser}@${ServerHost}:/opt/crmp/
    if ($LASTEXITCODE -ne 0) { throw "Error backend" }
    Write-Host "OK Backend`n" -ForegroundColor Green

    Write-Host "[3/4] Subiendo frontend..." -ForegroundColor Yellow
    ssh ${ServerUser}@${ServerHost} "rm -rf /var/www/crmp/* && mkdir -p /var/www/crmp"
    scp -r dist/client/* ${ServerUser}@${ServerHost}:/var/www/crmp/
    if ($LASTEXITCODE -ne 0) { throw "Error frontend" }
    Write-Host "OK Frontend`n" -ForegroundColor Green

    Write-Host "[3.5/4] Configurando Nginx..." -ForegroundColor Yellow
    $NginxConfig = @'
server {
    listen 80;
    server_name crmp.ss-group.cloud;
    root /var/www/crmp;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
'@
    # Escapar $ para que PowerShell no intente interpolar variables de Nginx
    $NginxConfig = $NginxConfig.Replace('$uri', '\$uri').Replace('$http_upgrade', '\$http_upgrade').Replace('$host', '\$host')
    
    # Usar scp para subir el archivo de config temporalmente y luego moverlo
    $NginxConfig | Out-File -Encoding ascii nginx-temp.conf
    scp nginx-temp.conf ${ServerUser}@${ServerHost}:/tmp/crmp.conf
    ssh ${ServerUser}@${ServerHost} "mv /tmp/crmp.conf /etc/nginx/sites-available/crmp && ln -sf /etc/nginx/sites-available/crmp /etc/nginx/sites-enabled/crmp && rm -f /etc/nginx/sites-enabled/default"
    Remove-Item nginx-temp.conf
    Write-Host "OK Nginx`n" -ForegroundColor Green

    Write-Host "[4/4] Reiniciando..." -ForegroundColor Yellow
    ssh ${ServerUser}@${ServerHost} 'cd /opt/crmp && npm install --production && (pm2 restart crmp-api || pm2 start server-FINAL.js --name crmp-api) && pm2 save && chown -R www-data:www-data /var/www/crmp && systemctl reload nginx'
    if ($LASTEXITCODE -ne 0) { throw "Error reinicio" }
    Write-Host "OK Reiniciado`n" -ForegroundColor Green

    Write-Host "=======================================`n" -ForegroundColor Green
    Write-Host "DEPLOY EXITOSO" -ForegroundColor Green
    Write-Host "https://crmp.ss-group.cloud`n" -ForegroundColor White

} catch {
    Write-Host "`nERROR: $_" -ForegroundColor Red
    exit 1
}
