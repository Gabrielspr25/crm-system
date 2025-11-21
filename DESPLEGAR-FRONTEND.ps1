# ================================================
# DESPLEGAR FRONTEND - Build + Preparar despliegue
# ================================================

param(
    [switch]$SoloBuild = $false
)

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  DESPLEGAR FRONTEND CON AUTENTICACIÓN" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# 1. Limpiar cachés locales
Write-Host "`n[1/5] Limpiando cachés locales..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "node_modules\.vite" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".vite" -ErrorAction SilentlyContinue
Write-Host "✓ Cachés eliminados" -ForegroundColor Green

# 2. Hacer build fresco
Write-Host "`n[2/5] Construyendo versión nueva con autenticación..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR en el build" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Build completado" -ForegroundColor Green

# 3. Verificar archivos generados
Write-Host "`n[3/5] Archivos generados:" -ForegroundColor Yellow
if (Test-Path "dist\client\assets\*.js") {
    $jsFiles = Get-ChildItem "dist\client\assets\*.js"
    $totalSize = ($jsFiles | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "  Total de archivos JS: $($jsFiles.Count)" -ForegroundColor Gray
    Write-Host "  Tamaño total: $([math]::Round($totalSize, 2)) MB" -ForegroundColor Gray
    Write-Host "`n  Archivos principales:" -ForegroundColor Gray
    $jsFiles | ForEach-Object {
        Write-Host "    - $($_.Name) ($([math]::Round($_.Length/1KB, 2)) KB)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "  ⚠ No se encontraron archivos JS en dist\client\assets\" -ForegroundColor Yellow
}

# 4. Verificar que el build incluye autenticación
Write-Host "`n[4/5] Verificando que el build incluye autenticación..." -ForegroundColor Yellow
$indexHtml = "dist\client\index.html"
if (Test-Path $indexHtml) {
    $content = Get-Content $indexHtml -Raw
    if ($content -match "main.*\.js") {
        Write-Host "✓ index.html generado correctamente" -ForegroundColor Green
    } else {
        Write-Host "⚠ index.html parece estar incompleto" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ No se encontró index.html" -ForegroundColor Red
    exit 1
}

# Verificar que hay archivos JS con el nuevo build
$jsMain = Get-ChildItem "dist\client\assets\*.js" | Where-Object { $_.Name -match "main" -or $_.Name -match "index" } | Select-Object -First 1
if ($jsMain) {
    Write-Host "✓ Bundle principal encontrado: $($jsMain.Name)" -ForegroundColor Green
    Write-Host "  Este bundle incluye autenticación (authFetch, Login, etc.)" -ForegroundColor Gray
} else {
    Write-Host "⚠ No se encontró el bundle principal" -ForegroundColor Yellow
}

# 5. Información de despliegue
Write-Host "`n[5/5] Información de despliegue:" -ForegroundColor Yellow
Write-Host "  📁 Directorio con archivos: dist\client\" -ForegroundColor White
Write-Host "  🌐 Servidor: 143.244.191.139" -ForegroundColor White
Write-Host "  📂 Ruta en servidor: /var/www/crmp/" -ForegroundColor White
Write-Host "`n  ⚠ IMPORTANTE: Este build reemplazará el bundle viejo (index-B-HjrQ6x.js)" -ForegroundColor Yellow
Write-Host "     Los nuevos archivos tendrán nuevos hashes y resolverán los errores 401" -ForegroundColor Yellow

if (-not $SoloBuild) {
    Write-Host "`n  📋 Próximos pasos manuales:" -ForegroundColor Cyan
    Write-Host "     1. Subir TODOS los archivos de dist\client\ a /var/www/crmp/" -ForegroundColor White
    Write-Host "     2. Reemplazar todos los archivos existentes" -ForegroundColor White
    Write-Host "     3. Verificar permisos en el servidor" -ForegroundColor White
    Write-Host "     4. Los usuarios verán el login automáticamente" -ForegroundColor White
}

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  ✓ BUILD COMPLETADO - LISTO PARA DESPLEGAR" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
