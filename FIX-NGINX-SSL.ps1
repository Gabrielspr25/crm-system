# FIX-NGINX-SSL.ps1
$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"

$Plink = "plink.exe"
$Pscp = "pscp.exe"

if (!(Get-Command $Plink -ErrorAction SilentlyContinue)) { $Plink = "C:\Program Files\PuTTY\plink.exe" }
if (!(Get-Command $Pscp -ErrorAction SilentlyContinue)) { $Pscp = "C:\Program Files\PuTTY\pscp.exe" }

Write-Host "Corrigiendo configuracion SSL de NGINX..." -ForegroundColor Cyan

# 1. Upload new config
Write-Host "Subiendo configuracion SSL..."
& $Pscp -pw $ServerPass nginx-ssl-fix.conf "$ServerUser@$ServerHost`:/etc/nginx/sites-available/crmp.ss-group.cloud"

# 2. Disable conflicting sites and enable correct one
Write-Host "Limpiando sitios conflictivos..."
$commands = @(
    "rm -f /etc/nginx/sites-enabled/crmp",
    "rm -f /etc/nginx/sites-enabled/ventaspro",
    "ln -sf /etc/nginx/sites-available/crmp.ss-group.cloud /etc/nginx/sites-enabled/crmp.ss-group.cloud",
    "nginx -t",
    "systemctl reload nginx"
)
$cmdString = $commands -join "; "

& $Plink -ssh -pw $ServerPass "$ServerUser@$ServerHost" $cmdString

Write-Host "NGINX Reiniciado y Corregido!" -ForegroundColor Green
