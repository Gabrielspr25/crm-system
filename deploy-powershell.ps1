# Deploy script usando PowerShell nativo sin sshpass

$SERVER = "143.244.191.139"
$USER = "root"
$PASSWORD = ConvertTo-SecureString "CL@70049ro" -AsPlainText -Force
$CREDENTIAL = New-Object System.Management.Automation.PSCredential($USER, $PASSWORD)
$PROJECT_PATH = "/var/www/VentasProui"

Write-Host "🚀 INICIANDO DEPLOY AUTOMÁTICO CON LIMPIEZA TOTAL DE CACHÉ..." -ForegroundColor Cyan
Write-Host ""

# Script que se ejecutará en el servidor
$deployCommands = @"
cd $PROJECT_PATH

echo "🧹 [1/7] Deteniendo servicios..."
pm2 stop all

echo "🗑️ [2/7] Limpiando caché de NGINX..."
rm -rf /var/cache/nginx/*
rm -rf /var/lib/nginx/cache/*

echo "🗑️ [3/7] Limpiando caché de Node y Vite..."
rm -rf dist node_modules/.vite .vite .cache

echo "🔄 [4/7] Actualizando código desde Git..."
git pull origin main

echo "📦 [5/7] Reinstalando dependencias..."
npm ci --force

echo "🏗️ [6/7] Construyendo con hash único..."
export VITE_BUILD_ID=`$(date +%s)
npm run build

echo "✅ [7/7] Verificando versión compilada..."
grep -o "V5\\.1\\.[0-9]*" dist/assets/*.js | head -n 5

echo "🔧 Configurando NGINX sin caché..."
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root $PROJECT_PATH/dist;
    index index.html;

    # Deshabilitar completamente el caché
    add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, proxy-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # ETag único por build
    etag on;
    if_modified_since off;

    location / {
        try_files `$uri `$uri/ /index.html;
    }

    location ~* \.(js|css|json|woff|woff2|ttf|svg|png|jpg|jpeg|gif|ico)`$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
        expires -1;
    }
}
EOFNGINX

ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default

echo "🔄 Recargando NGINX..."
nginx -t && systemctl reload nginx

echo "🚀 Reiniciando aplicación..."
pm2 restart all
pm2 save

echo ""
echo "✅ DEPLOY COMPLETADO"
echo "📌 Versión desplegada:"
cat $PROJECT_PATH/package.json | grep '"version"'
echo ""
echo "🌐 URL: http://$SERVER"
"@

Write-Host "[1/2] Conectando al servidor via SSH..." -ForegroundColor Yellow

try {
    # Intentar con SSH nativo de Windows (OpenSSH)
    Write-Host "[2/2] Ejecutando comandos de deploy..." -ForegroundColor Yellow
    Write-Host ""
    
    # Guardar comandos en archivo temporal
    $tempScript = "$env:TEMP\deploy-commands.sh"
    $deployCommands | Out-File -FilePath $tempScript -Encoding UTF8
    
    # Ejecutar SSH con password via stdin
    $sshCommand = "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $USER@$SERVER 'bash -s'"
    
    # Nota: PowerShell no puede pasar password automáticamente a SSH sin módulos adicionales
    Write-Host "⚠️  Por limitaciones de PowerShell, necesitas ejecutar manualmente:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "ssh $USER@$SERVER" -ForegroundColor Cyan
    Write-Host "Contraseña: CL@70049ro" -ForegroundColor Green
    Write-Host ""
    Write-Host "Luego copia y pega estos comandos:" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host $deployCommands -ForegroundColor White
    Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "💡 ALTERNATIVA RÁPIDA:" -ForegroundColor Cyan
    Write-Host "   Guarda estos comandos en 'deploy-temp.sh' y ejecuta:" -ForegroundColor White
    Write-Host "   ssh $USER@$SERVER < deploy-temp.sh" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ ERROR: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 PASOS POST-DEPLOY:" -ForegroundColor Cyan
Write-Host "  1. Abre http://$SERVER en modo INCÓGNITO (Ctrl+Shift+N)" -ForegroundColor White
Write-Host "  2. O presiona Ctrl+Shift+R para forzar recarga" -ForegroundColor White
Write-Host "  3. Verifica en consola F12 que diga V5.1.29 o superior" -ForegroundColor White
