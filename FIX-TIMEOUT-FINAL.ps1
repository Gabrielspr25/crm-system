# ================================================
# FIX TIMEOUT FINAL
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

Write-Host "`nSubiendo script de corrección de Nginx..." -ForegroundColor Yellow

# 1. Subir el script bash
& $pscpPath -batch -pw $ServerPass "update-nginx-final.sh" "${ServerUser}@${ServerHost}:/tmp/update-nginx-final.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al subir el script." -ForegroundColor Red
    exit 1
}

# 2. Ejecutar el script
Write-Host "Ejecutando script en el servidor..." -ForegroundColor Yellow
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "chmod +x /tmp/update-nginx-final.sh && /tmp/update-nginx-final.sh"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Nginx actualizado correctamente." -ForegroundColor Green
} else {
    Write-Host "`n❌ Error al ejecutar el script." -ForegroundColor Red
}
