$ErrorActionPreference = "Stop"
$ServerHost = "143.244.191.139"
$ServerUser = "root"

Write-Host "`n=======================================" -ForegroundColor Cyan
Write-Host "  DEPLOY A PRODUCCION" -ForegroundColor Cyan
Write-Host "=======================================`n" -ForegroundColor Cyan

try {
    Write-Host "[1/4] Compilando..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build fallo" }
    Write-Host "OK Compilado`n" -ForegroundColor Green

    Write-Host "[2/4] Subiendo backend..." -ForegroundColor Yellow
    scp server-FINAL.js package.json .env ${ServerUser}@${ServerHost}:/opt/crmp/
    if ($LASTEXITCODE -ne 0) { throw "Error backend" }
    Write-Host "OK Backend`n" -ForegroundColor Green

    Write-Host "[3/4] Subiendo frontend..." -ForegroundColor Yellow
    ssh ${ServerUser}@${ServerHost} "rm -rf /var/www/crmp/* && mkdir -p /var/www/crmp"
    scp -r dist/client/* ${ServerUser}@${ServerHost}:/var/www/crmp/
    if ($LASTEXITCODE -ne 0) { throw "Error frontend" }
    Write-Host "OK Frontend`n" -ForegroundColor Green

    Write-Host "[4/4] Reiniciando..." -ForegroundColor Yellow
    ssh ${ServerUser}@${ServerHost} 'cd /opt/crmp && npm install --production && (pm2 restart crmp-api || pm2 start server-FINAL.js --name crmp-api) && pm2 save && chown -R www-data:www-data /var/www/crmp && systemctl reload nginx'
    if ($LASTEXITCODE -ne 0) { throw "Error reinicio" }
    Write-Host "OK Reiniciado`n" -ForegroundColor Green

    Write-Host "=======================================`n" -ForegroundColor Green
    Write-Host "DEPLOY EXITOSO" -ForegroundColor Green
    Write-Host "https://crmp.ss-group.cloud`n" -ForegroundColor White

} catch {
    Write-Host "`nERROR: $_" -ForegroundColor Red
    exit 1
}
