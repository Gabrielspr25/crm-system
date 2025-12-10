# Deploy usando plink (PuTTY) como alternativa a sshpass

$SERVER = "143.244.191.139"
$USER = "root"
$PASSWORD = "CL@70049ro"
$PROJECT_PATH = "/var/www/VentasProui"

Write-Host "🚀 DEPLOY CON PLINK (PuTTY)..." -ForegroundColor Cyan

# Verificar si plink está instalado
$plinkPath = Get-Command plink -ErrorAction SilentlyContinue

if (-not $plinkPath) {
    Write-Host "❌ plink no encontrado. Instalando PuTTY..." -ForegroundColor Yellow
    choco install putty -y
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Script de deploy
$deployScript = @'
cd /var/www/VentasProui
pm2 stop all
rm -rf /var/cache/nginx/* /var/lib/nginx/cache/*
rm -rf dist node_modules/.vite .vite .cache
git pull origin main
npm ci --force
export VITE_BUILD_ID=$(date +%s)
npm run build
grep -o "V5\.1\.[0-9]*" dist/assets/*.js | head -n 5
cat > /etc/nginx/sites-available/ventaspro << 'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/VentasProui/dist;
    index index.html;
    add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    location / { try_files $uri $uri/ /index.html; }
    location ~* \.(js|css|json|woff|woff2|ttf|svg|png|jpg|jpeg|gif|ico)$ {
        add_header Cache-Control "no-cache" always;
        expires -1;
    }
}
EOF
ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
pm2 restart all
pm2 save
cat /var/www/VentasProui/package.json | grep '"version"'
'@

Write-Host "Ejecutando deploy..." -ForegroundColor Yellow

# Ejecutar con plink
echo y | plink -ssh -pw $PASSWORD $USER@$SERVER $deployScript

Write-Host "`n✅ DEPLOY COMPLETADO" -ForegroundColor Green
Write-Host "🌐 Abre http://143.244.191.139 en modo INCÓGNITO" -ForegroundColor Cyan
