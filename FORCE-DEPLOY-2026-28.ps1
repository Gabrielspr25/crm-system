#!/usr/bin/env pwsh
# FORCE DEPLOY v2026-28

Write-Host "`n🚀 FORCE DEPLOY v2026-28" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

# 1. Subir package.json
Write-Host "`n1️⃣ Subiendo package.json..." -ForegroundColor Yellow
scp package.json root@143.244.191.139:/opt/crmp/package.json
if ($LASTEXITCODE -eq 0) { Write-Host "   ✅ OK" -ForegroundColor Green } 
else { Write-Host "   ❌ ERROR" -ForegroundColor Red; exit 1 }

# 2. Subir server-FINAL.js
Write-Host "`n2️⃣ Subiendo server-FINAL.js..." -ForegroundColor Yellow
scp server-FINAL.js root@143.244.191.139:/opt/crmp/server-FINAL.js
if ($LASTEXITCODE -eq 0) { Write-Host "   ✅ OK" -ForegroundColor Green } 
else { Write-Host "   ❌ ERROR" -ForegroundColor Red; exit 1 }

# 3. Subir importController
Write-Host "`n3️⃣ Subiendo importController.js..." -ForegroundColor Yellow
scp src/backend/controllers/importController.js root@143.244.191.139:/opt/crmp/src/backend/controllers/importController.js
if ($LASTEXITCODE -eq 0) { Write-Host "   ✅ OK" -ForegroundColor Green } 
else { Write-Host "   ❌ ERROR" -ForegroundColor Red; exit 1 }

# 4. Verificar archivos subidos
Write-Host "`n4️⃣ Verificando archivos en servidor..." -ForegroundColor Yellow
ssh root@143.244.191.139 "grep '\"version\"' /opt/crmp/package.json"

# 5. Reiniciar PM2
Write-Host "`n5️⃣ Reiniciando PM2..." -ForegroundColor Yellow
ssh root@143.244.191.139 "pm2 restart crmp-api"
if ($LASTEXITCODE -eq 0) { Write-Host "   ✅ OK" -ForegroundColor Green } 
else { Write-Host "   ❌ ERROR" -ForegroundColor Red; exit 1 }

# 6. Esperar y verificar
Write-Host "`n6️⃣ Esperando 4 segundos..." -ForegroundColor Yellow
Start-Sleep -Seconds 4

Write-Host "`n7️⃣ Verificando versión API..." -ForegroundColor Yellow
$version = Invoke-RestMethod -Uri "http://143.244.191.139:3001/api/version" -Method Get
Write-Host "   Versión reportada: $($version.version)" -ForegroundColor Cyan

if ($version.version -eq "2026-28") {
    Write-Host "`n✅ DEPLOY EXITOSO - v2026-28" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Versión incorrecta: $($version.version)" -ForegroundColor Yellow
    Write-Host "   Esperaba: 2026-28" -ForegroundColor Yellow
}

# 8. Subir frontend
Write-Host "`n8️⃣ Subiendo frontend..." -ForegroundColor Yellow
scp -r dist/client/* root@143.244.191.139:/var/www/crmp/
if ($LASTEXITCODE -eq 0) { Write-Host "   ✅ OK" -ForegroundColor Green } 
else { Write-Host "   ❌ ERROR" -ForegroundColor Red }

Write-Host "`n🎉 Deploy completado" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Cyan
