# ================================================
# CORREGIR NGINX
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"

Write-Host "`nCorrigiendo Nginx..." -ForegroundColor Yellow

# Crear script temporal en el servidor
$nginxFixScript = @'
#!/bin/bash
CONFIG_FILE="/etc/nginx/sites-available/crmp.ss-group.cloud"

# Verificar si existe la configuracion de /api
if ! grep -q "location /api" "$CONFIG_FILE"; then
  echo "Agregando configuracion de /api..."
  sed -i '/location \//a\
    location /api {\
        proxy_pass http://127.0.0.1:3001;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
    }' "$CONFIG_FILE"
fi

# Corregir puerto si esta en 3000
if grep -q "proxy_pass http://127.0.0.1:3000" "$CONFIG_FILE"; then
  echo "Corrigiendo puerto de 3000 a 3001..."
  sed -i 's|proxy_pass http://127.0.0.1:3000|proxy_pass http://127.0.0.1:3001|g' "$CONFIG_FILE"
fi

# Verificar configuracion
if nginx -t; then
  systemctl reload nginx
  echo "Nginx configurado correctamente"
else
  echo "ERROR: Configuracion de Nginx invalida"
  exit 1
fi
'@

# Subir y ejecutar script
$tempScript = [System.IO.Path]::GetTempFileName()
$nginxFixScript | Out-File -FilePath $tempScript -Encoding UTF8

& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "bash -s" < $tempScript | Out-Host

Remove-Item $tempScript

Write-Host "`nVerificando configuracion final..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "grep -A 5 'location /api' /etc/nginx/sites-available/crmp.ss-group.cloud" | Out-Host

Write-Host "`nListo! Prueba: https://crmp.ss-group.cloud/api/health" -ForegroundColor Green

