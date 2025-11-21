# ================================================
# BUILD LIMPIO - Forzar nueva versión
# ================================================

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  BUILD LIMPIO - INVALIDAR CACHE" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# 1. Limpiar cachés locales
Write-Host "`n[1/4] Limpiando cachés locales..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "node_modules\.vite" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".vite" -ErrorAction SilentlyContinue
Write-Host "✓ Cachés eliminados" -ForegroundColor Green

# 2. Hacer build fresco
Write-Host "`n[2/4] Construyendo versión nueva..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR en el build" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Build completado" -ForegroundColor Green

# 3. Verificar archivos generados
Write-Host "`n[3/4] Archivos generados:" -ForegroundColor Yellow
Get-ChildItem "dist\client\assets\*.js" | ForEach-Object {
    Write-Host "  - $($_.Name) ($([math]::Round($_.Length/1KB, 2)) KB)" -ForegroundColor Gray
}

# 4. Mostrar próximos pasos
Write-Host "`n[4/4] Próximos pasos para desplegar:" -ForegroundColor Yellow
Write-Host "  1. Los archivos están en: dist\client\" -ForegroundColor White
Write-Host "  2. Subir al servidor con: .\SUBIR-AL-SERVIDOR.ps1" -ForegroundColor White
Write-Host "  3. O sube manualmente a: 143.244.191.139:/var/www/crmp/" -ForegroundColor White

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  ✓ BUILD LIMPIO COMPLETADO" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
