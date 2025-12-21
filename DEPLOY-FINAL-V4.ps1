# ================================================
# DEPLOY SCRIPT - VentasPro (FINAL AUTO V4)
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$RemotePath = "/opt/crmp"
$WebPath = "/var/www/crmp"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

Write-Host "DEPLOY START"

# 1. Build
Write-Host "Building..."
npm run build
if ($LASTEXITCODE -ne 0) { exit 1 }

# 2. Backend
Write-Host "Uploading Backend..."
& $pscpPath -pw $ServerPass -r src/backend/* "$ServerUser@$ServerHost`:$RemotePath/src/backend/"
& $pscpPath -pw $ServerPass package.json "$ServerUser@$ServerHost`:$RemotePath/"
& $pscpPath -pw $ServerPass server-FINAL.js "$ServerUser@$ServerHost`:$RemotePath/"

# 3. Frontend
Write-Host "Uploading Frontend..."
& $pscpPath -pw $ServerPass -r dist/* "$ServerUser@$ServerHost`:$WebPath/"

# 4. Restart
Write-Host "Restarting..."
$cmd1 = "cd " + $RemotePath + "; npm install --production"
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" $cmd1
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "pm2 restart all"
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "systemctl restart nginx"

Write-Host "DONE"
