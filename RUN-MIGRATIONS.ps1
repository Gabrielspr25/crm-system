$ErrorActionPreference = "Stop"
$ServerHost = "143.244.191.139"
$ServerUser = "root"

Write-Host "Subiendo migraciones..." -ForegroundColor Yellow
scp migration-add-step-tracking.sql migration-step-history.sql ${ServerUser}@${ServerHost}:/tmp/

Write-Host "Ejecutando migraciones..." -ForegroundColor Yellow
ssh ${ServerUser}@${ServerHost} "sudo -u postgres psql -d crm_pro -f /tmp/migration-add-step-tracking.sql && sudo -u postgres psql -d crm_pro -f /tmp/migration-step-history.sql"

Write-Host "Migraciones completadas." -ForegroundColor Green