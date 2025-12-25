# ================================================
# DEPLOY SCRIPT - VentasPro (FIXED VERSION)
# ================================================

param(
    [switch]$SkipBuild = $false,
    [switch]$SkipVersionUpdate = $false
)

$PW = "CL@70049ro"
$MyRemoteServer = "root@143.244.191.139"
$REMOTE_PATH = "/opt/crmp"
$WEB_PATH = "/opt/crmp/dist/client"

Write-Host "DEBUG: Server is $MyRemoteServer"

# Verificar que existen PuTTY tools
$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

if (!(Test-Path $plinkPath) -or !(Test-Path $pscpPath)) {
    Write-Host "ERROR: PuTTY tools no encontradas." -ForegroundColor Red
    exit 1
}

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  DEPLOY VENTASPRO - FIXED" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# 0. Actualizar versión automáticamente
if (!$SkipVersionUpdate) {
    Write-Host "`n[0/7] Actualizando versión..." -ForegroundColor Yellow
    node update-version.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ADVERTENCIA: No se pudo actualizar la versión" -ForegroundColor Red
    }
} else {
    Write-Host "`n[0/7] Saltando actualización de versión (Manejado por Agente)" -ForegroundColor Gray
}

# 1. Construir frontend React
if (!$SkipBuild) {
    Write-Host "`n[1/7] Construyendo frontend..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR al construir frontend" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Frontend construido exitosamente" -ForegroundColor Green
}

# 3. Crear directorios remotos y AJUSTAR PERMISOS (CRITICO)
Write-Host "`n[3/7] Creando directorios y ajustando permisos..." -ForegroundColor Yellow
# Aseguramos que root pueda escribir en la carpeta de destino antes de subir
& $plinkPath -batch -ssh -pw $PW $MyRemoteServer "mkdir -p $REMOTE_PATH/src/backend $WEB_PATH"
& $plinkPath -batch -ssh -pw $PW $MyRemoteServer "chmod -R 777 $WEB_PATH"
if ($LASTEXITCODE -eq 0) { Write-Host "✓ Directorios creados y permisos ajustados" -ForegroundColor Green }

# 4. Subir backend
Write-Host "`n[4/7] Subiendo archivos del backend..." -ForegroundColor Yellow
$DestRoot = "${MyRemoteServer}:${REMOTE_PATH}/"
$DestSrc = "${MyRemoteServer}:${REMOTE_PATH}/src/"
Write-Host "DestRoot: $DestRoot"

& $pscpPath -batch -pw $PW "server-FINAL.js" $DestRoot
& $pscpPath -batch -pw $PW "package.json" $DestRoot
& $pscpPath -batch -pw $PW ".env" $DestRoot
# Subir todo el backend recursivamente
& $pscpPath -batch -r -pw $PW "src/backend" $DestSrc

if ($LASTEXITCODE -eq 0) { Write-Host "✓ Backend subido" -ForegroundColor Green }

# 5. Subir frontend construido
Write-Host "`n[5/7] Subiendo frontend..." -ForegroundColor Yellow
$DestWeb = "${MyRemoteServer}:${WEB_PATH}/"
Write-Host "DestWeb: $DestWeb"
& $pscpPath -batch -pw $PW -r "dist\client\*" $DestWeb
if ($LASTEXITCODE -eq 0) { Write-Host "✓ Frontend subido" -ForegroundColor Green }

# 6. Instalar dependencias y reiniciar backend
Write-Host "`n[6/7] Instalando dependencias y reiniciando backend..." -ForegroundColor Yellow
$backendCmd = "cd $REMOTE_PATH && npm install --production && pm2 stop crmp-api 2>/dev/null || true && pm2 delete crmp-api 2>/dev/null || true && pm2 start server-FINAL.js --name crmp-api --time && pm2 save"
& $plinkPath -batch -ssh -pw $PW $MyRemoteServer $backendCmd

# 7. Configurar permisos y Nginx
Write-Host "`n[7/7] Configurando permisos y Nginx..." -ForegroundColor Yellow
$finalCmd = "chown -R www-data:www-data $WEB_PATH && nginx -t && systemctl reload nginx"
& $plinkPath -batch -ssh -pw $PW $MyRemoteServer $finalCmd

# 8. VERIFICACIÓN EXHAUSTIVA (Agente Funcional)
Write-Host "`n[8/8] Ejecutando Agente de Verificación Exhaustiva..." -ForegroundColor Magenta
# Subir el agente actualizado
& $pscpPath -batch -pw $PW "agent-functional.js" $DestRoot
# Ejecutarlo
& $plinkPath -batch -ssh -pw $PW $MyRemoteServer "cd $REMOTE_PATH && node agent-functional.js"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[OK] DEPLOY Y VERIFICACION COMPLETADOS CON EXITO" -ForegroundColor Green
} else {
    Write-Host "`n[WARN] DEPLOY COMPLETADO PERO LA VERIFICACION FALLO" -ForegroundColor Red
}
