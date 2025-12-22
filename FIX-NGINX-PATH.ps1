# FIX-NGINX-PATH.ps1
$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"

$Plink = "plink.exe"
$Pscp = "pscp.exe"

if (!(Get-Command $Plink -ErrorAction SilentlyContinue)) { $Plink = "C:\Program Files\PuTTY\plink.exe" }
if (!(Get-Command $Pscp -ErrorAction SilentlyContinue)) { $Pscp = "C:\Program Files\PuTTY\pscp.exe" }

Write-Host "Corrigiendo ruta de NGINX..." -ForegroundColor Cyan

# 1. Upload new config
Write-Host "Subiendo configuracion..."
& $Pscp -pw $ServerPass nginx-fix.conf "$ServerUser@$ServerHost`:/etc/nginx/sites-available/ventaspro"

# 2. Reload Nginx
Write-Host "Reiniciando Nginx..."
& $Plink -ssh -pw $ServerPass "$ServerUser@$ServerHost" "nginx -t; systemctl reload nginx"

Write-Host "NGINX actualizado a /opt/crmp/dist" -ForegroundColor Green
