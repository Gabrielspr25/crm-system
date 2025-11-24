
$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$RemotePath = "/opt/crmp"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

Write-Host "Subiendo backend..." -ForegroundColor Yellow
& $pscpPath -pw $ServerPass "server-FINAL.js" "$ServerUser@${ServerHost}:$RemotePath/"

Write-Host "Reiniciando servidor..." -ForegroundColor Yellow
$pm2Cmd = "cd $RemotePath; pm2 restart crmp-api"
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" $pm2Cmd

Write-Host "Backend actualizado y reiniciado." -ForegroundColor Green
