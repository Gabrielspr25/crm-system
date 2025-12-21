# ================================================
# DEPLOY SCRIPT - VentasPro (FINAL AUTO V5)
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$RemotePath = "/opt/crmp"
$WebPath = "/var/www/crmp"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

Write-Host "DEPLOY START V5"

# 1. Build
Write-Host "Building..."
npm run build
if ($LASTEXITCODE -ne 0) { exit 1 }

# 2. Backend
Write-Host "Uploading Backend..."
& $pscpPath -pw $ServerPass -r src/backend/* "$ServerUser@$ServerHost`:$RemotePath/src/backend/"
& $pscpPath -pw $ServerPass package.json "$ServerUser@$ServerHost`:$RemotePath/"
& $pscpPath -pw $ServerPass server-FINAL.js "$ServerUser@$ServerHost`:$RemotePath/"

# 3. Frontend (Clean & Upload)
Write-Host "Cleaning Remote Web Path..."
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "rm -rf $WebPath/*"

Write-Host "Uploading Frontend (dist/client)..."
# Subir el contenido de dist/client a /var/www/crmp
& $pscpPath -pw $ServerPass -r dist/client/* "$ServerUser@$ServerHost`:$WebPath/"

# 4. Nginx Config
Write-Host "Updating Nginx Config..."
& $pscpPath -pw $ServerPass nginx.conf "$ServerUser@$ServerHost`:/etc/nginx/sites-available/ventaspro"
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/"

# 5. Restart
Write-Host "Restarting Services..."
$cmd1 = "cd " + $RemotePath + "; npm install --production"
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" $cmd1
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "pm2 restart all"
& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" "systemctl restart nginx"

Write-Host "DONE V5"
