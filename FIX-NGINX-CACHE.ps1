# Script para corregir problemas de cache en Nginx
# Evita que el HTML se cachee, permitiendo que nuevas versiones se carguen correctamente

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$NginxSite = '/etc/nginx/sites-available/crmp.ss-group.cloud'

Write-Host "[*] Corrigiendo configuracion de cache de Nginx..." -ForegroundColor Cyan

# Crear configuración corregida de Nginx
$NginxConfig = @"
server {
    listen 80;
    server_name crmp.ss-group.cloud;
    root /var/www/crmp;
    index index.html;

    # NO CACHEAR HTML - crítico para actualizaciones
    location / {
        try_files `$uri `$uri/ /index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        expires -1;
    }

    # Cachear assets estáticos (JS, CSS) por poco tiempo
    # Los hashes de Vite manejan la invalidación
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        add_header Cache-Control "public, max-age=3600";  # 1 hora en lugar de 1 año
        expires 1h;
    }
}
"@

# Guardar temporalmente en el servidor
$TempFile = '/tmp/nginx-crmp-fixed.conf'

Write-Host "[+] Subiendo nueva configuracion al servidor..." -ForegroundColor Yellow

# Crear archivo temporal con la configuración
$NginxConfig | ssh ${ServerUser}@${ServerHost} "cat > $TempFile"

# Reemplazar configuración actual
ssh ${ServerUser}@${ServerHost} @"
    # Backup de configuración anterior
    cp $NginxSite ${NginxSite}.backup_`$(date +%Y%m%d_%H%M%S)
    
    # Aplicar nueva configuración
    mv $TempFile $NginxSite
    
    # Crear enlace simbólico si no existe
    ln -sf $NginxSite /etc/nginx/sites-enabled/
    
    # Verificar configuración de Nginx
    nginx -t
    
    # Recargar Nginx
    systemctl reload nginx
    
    echo "[OK] Configuracion aplicada correctamente"
"@

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Cache de Nginx corregido correctamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "[*] Cambios aplicados:" -ForegroundColor Cyan
    Write-Host "   - HTML: NO se cachea (max-age=0)" -ForegroundColor White
    Write-Host "   - Assets (JS/CSS): Cache de 1 hora (suficiente gracias a hashes de Vite)" -ForegroundColor White
    Write-Host ""
    Write-Host "[>] Ahora ejecuta: .\DEPLOY.ps1 para publicar v5.1.0" -ForegroundColor Yellow
} else {
    Write-Host "[ERROR] Error al aplicar configuracion" -ForegroundColor Red
    exit 1
}
