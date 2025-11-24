# ================================================
# VERIFICAR DUPLICADOS REMOTO
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

Write-Host "`nVerificando duplicados en BD..." -ForegroundColor Yellow

# 1. Subir SQL
& $pscpPath -batch -pw $ServerPass "VERIFICAR-DUPLICADOS.sql" "${ServerUser}@${ServerHost}:/tmp/check_duplicates.sql"

# 2. Ejecutar SQL
& $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "su - postgres -c 'psql -d crm_pro -f /tmp/check_duplicates.sql'"
