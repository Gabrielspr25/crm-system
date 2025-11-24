# ================================================
# AUMENTAR TIMEOUT NGINX
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"

Write-Host "`nConfigurando Nginx Timeouts..." -ForegroundColor Yellow

# Script para actualizar la configuración de Nginx
$nginxConfigScript = @'
#!/bin/bash
CONFIG_FILE="/etc/nginx/sites-available/crmp.ss-group.cloud"

# Verificar si el archivo existe
if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: Archivo de configuración no encontrado en $CONFIG_FILE"
    exit 1
fi

# Backup
cp "$CONFIG_FILE" "${CONFIG_FILE}.bak"

# Función para agregar o actualizar directiva dentro de location /api
update_nginx_directive() {
    local directive=$1
    local value=$2
    local file=$3
    
    # Verificar si ya existe la directiva
    if grep -q "$directive" "$file"; then
        # Actualizar
        sed -i "s/$directive .*/$directive $value;/" "$file"
    else
        # Insertar después de "location /api {"
        sed -i "/location \/api {/a \ \ \ \ $directive $value;" "$file"
    fi
}

# Aumentar timeouts a 600 segundos (10 minutos)
echo "Aumentando timeouts..."
update_nginx_directive "proxy_connect_timeout" "600" "$CONFIG_FILE"
update_nginx_directive "proxy_send_timeout" "600" "$CONFIG_FILE"
update_nginx_directive "proxy_read_timeout" "600" "$CONFIG_FILE"
update_nginx_directive "send_timeout" "600" "$CONFIG_FILE"

# Aumentar tamaño máximo de cuerpo (para subidas grandes)
if ! grep -q "client_max_body_size" "$CONFIG_FILE"; then
    sed -i "/server_name/a \ \ \ \ client_max_body_size 50M;" "$CONFIG_FILE"
fi

# Verificar configuración
echo "Verificando configuración..."
if nginx -t; then
    echo "Recargando Nginx..."
    systemctl reload nginx
    echo "✅ Nginx actualizado correctamente con timeouts de 600s"
else
    echo "❌ Error en la configuración de Nginx. Restaurando backup..."
    cp "${CONFIG_FILE}.bak" "$CONFIG_FILE"
    systemctl reload nginx
    exit 1
fi
'@

# Ejecutar en el servidor
$command = "echo '$nginxConfigScript' > /tmp/update_nginx_timeout.sh && chmod +x /tmp/update_nginx_timeout.sh && /tmp/update_nginx_timeout.sh"

& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" $command

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Proceso completado exitosamente." -ForegroundColor Green
} else {
    Write-Host "`n❌ Error al ejecutar el script remoto." -ForegroundColor Red
}
