# ================================================
# VERIFICAR IMPORTACION VIA PLINK
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

Write-Host "`nVerificando base de datos..." -ForegroundColor Yellow

# 1. Subir SQL
& $pscpPath -batch -pw $ServerPass "VERIFICAR-IMPORTACION.sql" "${ServerUser}@${ServerHost}:/tmp/check_import.sql"

# 2. Ejecutar SQL
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "su - postgres -c 'psql -d crm_pro -f /tmp/check_import.sql'"
