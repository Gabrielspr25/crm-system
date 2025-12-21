# ================================================
# DEPLOY SCRIPT - VentasPro (TAR METHOD)
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$RemotePath = "/opt/crmp"
$WebPath = "/var/www/crmp"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

Write-Host "DEPLOY START (TAR METHOD)" -ForegroundColor Cyan

# 1. Build
Write-Host "Building..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { 
    Write-Host "Build Failed!" -ForegroundColor Red
    exit 1 
}

# 2. Create Tarball of Frontend
Write-Host "Creating frontend.tar.gz..." -ForegroundColor Yellow
# Change to dist/client so the tarball doesn't contain the path 'dist/client'
cd dist/client
tar -czf ../../frontend.tar.gz .
cd ../..

if (!(Test-Path "frontend.tar.gz")) {
    Write-Host "Failed to create frontend.tar.gz" -ForegroundColor Red
    exit 1
}

# 3. Upload Backend Files
Write-Host "Uploading Backend..." -ForegroundColor Yellow
& $pscpPath -pw $ServerPass -r src/backend/* "$ServerUser@$ServerHost`:$RemotePath/src/backend/"
& $pscpPath -pw $ServerPass package.json "$ServerUser@$ServerHost`:$RemotePath/"
& $pscpPath -pw $ServerPass server-FINAL.js "$ServerUser@$ServerHost`:$RemotePath/"

# 4. Upload Frontend Tarball
Write-Host "Uploading Frontend Tarball..." -ForegroundColor Yellow
& $pscpPath -pw $ServerPass frontend.tar.gz "$ServerUser@$ServerHost`:/tmp/frontend.tar.gz"

# 5. Remote Execution (Extract & Restart)
Write-Host "Executing Remote Commands..." -ForegroundColor Yellow
$commands = "
# Stop Nginx temporarily to release file locks if any
systemctl stop nginx

# Clean Web Directory
rm -rf $WebPath/*
mkdir -p $WebPath

# Extract Frontend
tar -xzf /tmp/frontend.tar.gz -C $WebPath
rm /tmp/frontend.tar.gz

# Set Permissions
chown -R www-data:www-data $WebPath
chmod -R 755 $WebPath

# Update Backend Deps
cd $RemotePath
npm install --production

# Restart Backend
pm2 restart all || pm2 start server-FINAL.js --name crm-backend

# Start Nginx
systemctl start nginx
"

& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" $commands

# 6. Cleanup Local
Remove-Item "frontend.tar.gz" -ErrorAction SilentlyContinue

Write-Host "DEPLOY DONE v5.1.43" -ForegroundColor Green
