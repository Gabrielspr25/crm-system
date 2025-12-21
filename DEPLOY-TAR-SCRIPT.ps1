# ================================================
# DEPLOY SCRIPT - VentasPro (TAR + SCRIPT METHOD)
# ================================================

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$RemotePath = "/opt/crmp"
$WebPath = "/var/www/crmp"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

Write-Host "DEPLOY START (TAR + SCRIPT)" -ForegroundColor Cyan

# 1. Build
Write-Host "Building..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { 
    Write-Host "Build Failed!" -ForegroundColor Red
    exit 1 
}

# 2. Create Tarball of Frontend
Write-Host "Creating frontend.tar.gz..." -ForegroundColor Yellow
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

# 4. Upload Frontend Tarball & Script
Write-Host "Uploading Frontend Tarball & Script..." -ForegroundColor Yellow
& $pscpPath -pw $ServerPass frontend.tar.gz "$ServerUser@$ServerHost`:/tmp/frontend.tar.gz"
& $pscpPath -pw $ServerPass deploy-remote.sh "$ServerUser@$ServerHost`:/tmp/deploy-remote.sh"

# 5. Remote Execution
Write-Host "Executing Remote Script..." -ForegroundColor Yellow
# We use sed to remove carriage returns (\r) caused by Windows file creation
# This is more robust than tr for in-place editing
$cmd = "sed -i 's/\r$//' /tmp/deploy-remote.sh && chmod +x /tmp/deploy-remote.sh && bash /tmp/deploy-remote.sh"

& $plinkPath -ssh -pw $ServerPass "$ServerUser@$ServerHost" $cmd

# 6. Cleanup Local
Remove-Item "frontend.tar.gz" -ErrorAction SilentlyContinue

Write-Host "DEPLOY DONE v5.1.52" -ForegroundColor Green
