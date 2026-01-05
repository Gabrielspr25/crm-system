#!/usr/bin/env pwsh
# Script de Deployment con Validación Automática
# Versión: 1.0.0

param(
    [switch]$SkipBuild,
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$SERVER = "root@143.244.191.139"
$FRONTEND_PATH = "/var/www/crmp"
$BACKEND_PATH = "/opt/crmp"
$NGINX_CONFIG = "/etc/nginx/sites-available/crmp.ss-group.cloud"
$DOMAIN = "https://crmp.ss-group.cloud"

Write-Host "`nDEPLOYMENT CON VALIDACION AUTOMATICA" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Función para ejecutar comandos SSH y capturar errores
function Invoke-SSHCommand {
    param([string]$Command)
    $cmd = "ssh $SERVER `"$Command`""
    $result = Invoke-Expression $cmd 2>&1
    return $result
}

# Función para validar paso
function Test-Step {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [string]$SuccessMessage,
        [string]$ErrorMessage
    )
    
    Write-Host "Validando: $Name..." -NoNewline
    try {
        $result = & $Test
        if ($result) {
            Write-Host " OK $SuccessMessage" -ForegroundColor Green
            return $true
        } else {
            Write-Host " ERROR $ErrorMessage" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host " ERROR $_" -ForegroundColor Red
        return $false
    }
}

# 1. BUILD
if (-not $SkipBuild) {
    Write-Host "`nPASO 1: BUILD DEL FRONTEND" -ForegroundColor Yellow
    Write-Host "==============================`n" -ForegroundColor Yellow
    
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "Build falló"
        }
        Write-Host "OK Build completado" -ForegroundColor Green
    } catch {
        Write-Host "ERROR en build: $_" -ForegroundColor Red
        exit 1
    }
    
    # Validar que dist/client existe
    if (-not (Test-Path "dist/client")) {
        Write-Host "ERROR: dist/client no existe después del build" -ForegroundColor Red
        exit 1
    }
    
    $buildFiles = Get-ChildItem "dist/client" -Recurse | Measure-Object
    Write-Host "Archivos generados: $($buildFiles.Count)" -ForegroundColor Cyan
} else {
    Write-Host "`nPASO 1: SKIP BUILD (usando build existente)" -ForegroundColor Yellow
}

# 2. COPIAR ARCHIVOS AL SERVIDOR
Write-Host "`nPASO 2: COPIAR ARCHIVOS AL SERVIDOR" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Yellow

try {
    # Copiar frontend
    Write-Host "Copiando archivos frontend..." -NoNewline
    scp -r dist/client/* "${SERVER}:${FRONTEND_PATH}/" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Error copiando frontend"
    }
    Write-Host " OK" -ForegroundColor Green
    
    # Copiar backend (solo server-FINAL.js y package.json)
    Write-Host "Copiando backend..." -NoNewline
    scp server-FINAL.js package.json "${SERVER}:${BACKEND_PATH}/" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Error copiando backend"
    }
    Write-Host " OK" -ForegroundColor Green
    
} catch {
    Write-Host "ERROR copiando archivos: $_" -ForegroundColor Red
    exit 1
}

# 3. VALIDACIONES EN EL SERVIDOR
Write-Host "`nPASO 3: VALIDACIONES EN EL SERVIDOR" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Yellow

$allValid = $true

# 3.1 Validar archivos frontend
$allValid = $allValid -and (Test-Step `
    -Name "Archivos frontend copiados" `
    -Test { 
        $result = Invoke-SSHCommand "ls ${FRONTEND_PATH}/index.html ${FRONTEND_PATH}/assets/ 2>&1"
        return $result -notlike "*No such file*"
    } `
    -SuccessMessage "index.html y assets/ presentes" `
    -ErrorMessage "Archivos faltantes en ${FRONTEND_PATH}"
)

# 3.2 Validar permisos
$allValid = $allValid -and (Test-Step `
    -Name "Permisos correctos" `
    -Test {
        $result = Invoke-SSHCommand "stat -c '%U:%G %a' ${FRONTEND_PATH}"
        return $result -match "www-data:www-data 755"
    } `
    -SuccessMessage "www-data:www-data 755" `
    -ErrorMessage "Permisos incorrectos"
)

# Si permisos incorrectos, corregir
if (-not $allValid) {
    Write-Host "Corrigiendo permisos..." -NoNewline
    ssh $SERVER "chown -R www-data:www-data ${FRONTEND_PATH}" 2>&1 | Out-Null
    ssh $SERVER "chmod -R 755 ${FRONTEND_PATH}" 2>&1 | Out-Null
    Write-Host " OK" -ForegroundColor Green
    $allValid = $true
}

# 3.3 Validar nginx config
$allValid = $allValid -and (Test-Step `
    -Name "Nginx config correcto" `
    -Test {
        $result = Invoke-SSHCommand "grep 'root ${FRONTEND_PATH}' ${NGINX_CONFIG}"
        return $result -like "*root ${FRONTEND_PATH}*"
    } `
    -SuccessMessage "root ${FRONTEND_PATH}" `
    -ErrorMessage "Config apunta a ruta incorrecta"
)

# 3.4 Validar solo 1 config activo
$allValid = $allValid -and (Test-Step `
    -Name "Solo 1 config activo" `
    -Test {
        $result = Invoke-SSHCommand "ls /etc/nginx/sites-enabled/ | grep -E 'crm|ventaspro' | wc -l"
        return [int]$result -eq 2  # crmp.ss-group.cloud + ventaspro
    } `
    -SuccessMessage "crmp.ss-group.cloud + ventaspro" `
    -ErrorMessage "Configs duplicados detectados"
)

# 3.5 Reiniciar servicios
Write-Host "`nReiniciando servicios..." -ForegroundColor Yellow

Write-Host "PM2 restart..." -NoNewline
ssh $SERVER "pm2 restart crmp-api" 2>&1 | Out-Null
Start-Sleep -Seconds 3
Write-Host " OK" -ForegroundColor Green

Write-Host "Nginx restart..." -NoNewline
ssh $SERVER "nginx -t 2>&1 >/dev/null && systemctl restart nginx" 2>&1 | Out-Null
Start-Sleep -Seconds 2
Write-Host " OK" -ForegroundColor Green

# 4. TESTS FUNCIONALES
if (-not $SkipTests) {
    Write-Host "`nPASO 4: TESTS FUNCIONALES" -ForegroundColor Yellow
    Write-Host "============================`n" -ForegroundColor Yellow
    
    # 4.1 Backend health
    $allValid = $allValid -and (Test-Step `
        -Name "Backend API responde" `
        -Test {
            $result = Invoke-SSHCommand "curl -s http://localhost:3001/api/version"
            return $result -like "*version*"
        } `
        -SuccessMessage "API responde correctamente" `
        -ErrorMessage "Backend no responde"
    )
    
    # 4.2 HTML carga
    $allValid = $allValid -and (Test-Step `
        -Name "HTML carga (200 OK)" `
        -Test {
            $result = Invoke-SSHCommand "curl -I ${DOMAIN}/ 2>&1 | head -1"
            return $result -like "*200 OK*"
        } `
        -SuccessMessage "HTML carga correctamente" `
        -ErrorMessage "HTML retorna error"
    )
    
    # 4.3 Assets cargan
    $allValid = $allValid -and (Test-Step `
        -Name "Assets cargan (CSS)" `
        -Test {
            $cssFile = Invoke-SSHCommand "ls ${FRONTEND_PATH}/assets/*.css | head -1"
            $cssName = Split-Path $cssFile -Leaf
            $result = Invoke-SSHCommand "curl -I ${DOMAIN}/assets/${cssName} 2>&1 | head -1"
            return $result -like "*200 OK*"
        } `
        -SuccessMessage "Assets cargan correctamente" `
        -ErrorMessage "Assets retornan 403/404"
    )
    
    # 4.4 Assets JS cargan
    $allValid = $allValid -and (Test-Step `
        -Name "Assets cargan (JS)" `
        -Test {
            $jsFile = Invoke-SSHCommand "ls ${FRONTEND_PATH}/assets/*.js | grep -v map | head -1"
            $jsName = Split-Path $jsFile -Leaf
            $result = Invoke-SSHCommand "curl -I ${DOMAIN}/assets/${jsName} 2>&1 | head -1"
            return $result -like "*200 OK*"
        } `
        -SuccessMessage "JS carga correctamente" `
        -ErrorMessage "JS retorna error"
    )
}

# 5. RESULTADO FINAL
Write-Host "`n" -NoNewline
if ($allValid) {
    Write-Host "OK DEPLOYMENT EXITOSO!" -ForegroundColor Green
    Write-Host "========================`n" -ForegroundColor Green
    
    # Obtener versión
    $version = Invoke-SSHCommand "curl -s http://localhost:3001/api/version"
    Write-Host "Version: $version" -ForegroundColor Cyan
    Write-Host "URL: ${DOMAIN}" -ForegroundColor Cyan
    Write-Host "Backend: ${BACKEND_PATH}" -ForegroundColor Cyan
    Write-Host "Frontend: ${FRONTEND_PATH}" -ForegroundColor Cyan
    
    Write-Host "`nOK Sitio verificado y funcionando correctamente" -ForegroundColor Green
    
    # Abrir en navegador
    Write-Host "`nAbriendo en navegador..." -ForegroundColor Cyan
    Start-Process $DOMAIN
    
    exit 0
} else {
    Write-Host "ERROR DEPLOYMENT CON ERRORES" -ForegroundColor Red
    Write-Host "=========================`n" -ForegroundColor Red
    Write-Host "Revisa los errores arriba y vuelve a intentar" -ForegroundColor Yellow
    exit 1
}
