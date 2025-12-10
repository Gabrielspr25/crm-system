# Script para limpiar TODO el caché local antes de hacer deploy

Write-Host "🧹 LIMPIANDO CACHÉ LOCAL..." -ForegroundColor Cyan

# 1. Limpiar caché de npm
Write-Host "`n[1/6] Limpiando caché de npm..." -ForegroundColor Yellow
npm cache clean --force

# 2. Limpiar node_modules y reinstalar
Write-Host "`n[2/6] Eliminando node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
}

# 3. Limpiar caché de Vite
Write-Host "`n[3/6] Limpiando caché de Vite..." -ForegroundColor Yellow
if (Test-Path ".vite") { Remove-Item -Recurse -Force ".vite" }
if (Test-Path "node_modules/.vite") { Remove-Item -Recurse -Force "node_modules/.vite" }
if (Test-Path ".cache") { Remove-Item -Recurse -Force ".cache" }

# 4. Limpiar dist
Write-Host "`n[4/6] Limpiando carpeta dist..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}

# 5. Reinstalar dependencias
Write-Host "`n[5/6] Reinstalando dependencias..." -ForegroundColor Yellow
npm install

# 6. Build limpio
Write-Host "`n[6/6] Construyendo proyecto..." -ForegroundColor Yellow
npm run build

Write-Host "`n✅ LIMPIEZA Y BUILD COMPLETADOS" -ForegroundColor Green
Write-Host "`nAhora puedes hacer:" -ForegroundColor Cyan
Write-Host "  1. git add ." -ForegroundColor White
Write-Host "  2. git commit -m 'Actualización v5.1.XX'" -ForegroundColor White
Write-Host "  3. git push" -ForegroundColor White
Write-Host "  4. npm run deploy (o node auto-deploy-fixed.js)" -ForegroundColor White
