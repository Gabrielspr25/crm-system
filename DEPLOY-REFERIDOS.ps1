# DEPLOY-REFERIDOS.ps1
$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$RemotePath = "/opt/crmp"

# Path to PuTTY tools (adjust if necessary, or use standard ssh/scp if keys are set)
$Plink = "plink.exe"
$Pscp = "pscp.exe"

# Check if plink/pscp are in path, otherwise try standard paths
if (!(Get-Command $Plink -ErrorAction SilentlyContinue)) {
    $Plink = "C:\Program Files\PuTTY\plink.exe"
}
if (!(Get-Command $Pscp -ErrorAction SilentlyContinue)) {
    $Pscp = "C:\Program Files\PuTTY\pscp.exe"
}

Write-Host "🚀 Iniciando Despliegue de Referidos..." -ForegroundColor Cyan

# 1. Build Frontend
Write-Host "`n[1/4] Construyendo Frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Build falló"; exit 1 }

# 2. Upload Frontend (dist)
Write-Host "`n[2/4] Subiendo Frontend (dist)..." -ForegroundColor Yellow
# Ensure directory exists
& $Plink -ssh -pw $ServerPass "$ServerUser@$ServerHost" "mkdir -p $RemotePath/dist"
# Upload
& $Pscp -pw $ServerPass -r dist/* "$ServerUser@$ServerHost`:$RemotePath/dist/"
if ($LASTEXITCODE -ne 0) { Write-Error "Subida de dist falló"; exit 1 }

# 3. Upload Backend (Controllers)
Write-Host "`n[3/4] Subiendo Backend (Controllers)..." -ForegroundColor Yellow
& $Pscp -pw $ServerPass src/backend/controllers/referidosController.js "$ServerUser@$ServerHost`:$RemotePath/src/backend/controllers/"
if ($LASTEXITCODE -ne 0) { Write-Error "Subida de controller falló"; exit 1 }

# 4. Restart Service
Write-Host "`n[4/4] Reiniciando Servicio..." -ForegroundColor Yellow
& $Plink -ssh -pw $ServerPass "$ServerUser@$ServerHost" "pm2 restart all"
if ($LASTEXITCODE -ne 0) { Write-Error "Reinicio falló"; exit 1 }

Write-Host "`n✅ Despliegue Completado!" -ForegroundColor Green
