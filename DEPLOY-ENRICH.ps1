# DEPLOY-ENRICH.ps1
$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"
$RemotePath = "/opt/crmp"

$Plink = "plink.exe"
$Pscp = "pscp.exe"

if (!(Get-Command $Plink -ErrorAction SilentlyContinue)) { $Plink = "C:\Program Files\PuTTY\plink.exe" }
if (!(Get-Command $Pscp -ErrorAction SilentlyContinue)) { $Pscp = "C:\Program Files\PuTTY\pscp.exe" }

Write-Host "🚀 Iniciando Despliegue de Enriquecimiento..." -ForegroundColor Cyan

# 1. Build Frontend
Write-Host "`n[1/4] Construyendo Frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Build falló"; exit 1 }

# 2. Upload Frontend (dist)
Write-Host "`n[2/4] Subiendo Frontend (dist)..." -ForegroundColor Yellow
# Limpiar directorio web REAL (según Nginx config: /opt/crmp/dist/client)
& $Plink -ssh -pw $ServerPass "$ServerUser@$ServerHost" "rm -rf /opt/crmp/dist/client/*"
# Asegurar que el directorio existe
& $Plink -ssh -pw $ServerPass "$ServerUser@$ServerHost" "mkdir -p /opt/crmp/dist/client"
# Subir archivos compilados al directorio correcto
& $Pscp -pw $ServerPass -r dist/client/* "$ServerUser@$ServerHost`:/opt/crmp/dist/client/"
if ($LASTEXITCODE -ne 0) { Write-Error "Subida de dist falló"; exit 1 }

# 3. Upload Backend (Controllers & Config)
Write-Host "`n[3/4] Subiendo Backend (Controllers & Config)..." -ForegroundColor Yellow
& $Pscp -pw $ServerPass package.json "$ServerUser@$ServerHost`:$RemotePath/"
& $Pscp -pw $ServerPass src/backend/controllers/importController.js "$ServerUser@$ServerHost`:$RemotePath/src/backend/controllers/"
& $Pscp -pw $ServerPass src/backend/controllers/referidosController.js "$ServerUser@$ServerHost`:$RemotePath/src/backend/controllers/"
& $Pscp -pw $ServerPass src/backend/controllers/clientController.js "$ServerUser@$ServerHost`:$RemotePath/src/backend/controllers/"
if ($LASTEXITCODE -ne 0) { Write-Error "Subida de backend falló"; exit 1 }

# 4. Restart Service
Write-Host "`n[4/4] Reiniciando Servicio..." -ForegroundColor Yellow
& $Plink -ssh -pw $ServerPass "$ServerUser@$ServerHost" "pm2 restart all"
if ($LASTEXITCODE -ne 0) { Write-Error "Reinicio falló"; exit 1 }

Write-Host "`n✅ Despliegue Completado!" -ForegroundColor Green
