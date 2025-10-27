Write-Host "🚀 SUBIENDO ARCHIVOS AL SERVIDOR" -ForegroundColor Green
Write-Host "=================================================="

# Verificar carpeta dist
if (Test-Path "dist") {
    Write-Host "✅ Carpeta dist encontrada" -ForegroundColor Green
} else {
    Write-Host "❌ Carpeta dist no existe" -ForegroundColor Red
    exit 1
}

# Mostrar archivos
Write-Host "`n📁 Archivos a subir:" -ForegroundColor Yellow
Get-ChildItem -Path "dist" -Recurse | ForEach-Object {
    $size = [math]::Round($_.Length / 1KB, 2)
    Write-Host "   - $($_.Name) ($size KB)"
}

Write-Host "`n🚀 COMANDOS PARA SUBIR:" -ForegroundColor Cyan
Write-Host "1. Abrir PowerShell como Administrador"
Write-Host "2. Navegar a esta carpeta"
Write-Host "3. Ejecutar estos comandos:"
Write-Host ""
Write-Host "scp -r dist/* user@142.93.176.195:/var/www/dist/" -ForegroundColor Yellow
Write-Host "ssh user@142.93.176.195 'sudo chown -R www-data:www-data /var/www/dist && sudo chmod -R 755 /var/www/dist && sudo systemctl reload nginx'" -ForegroundColor Yellow
Write-Host ""

Write-Host "🎯 DESPUÉS DE SUBIR:" -ForegroundColor Green
Write-Host "1. Ir a https://crmp.ss-group.cloud"
Write-Host "2. Hacer login con gabriel/123456"
Write-Host "3. Navegar a 'Productos'"
Write-Host "4. Deberías ver 21 productos con categorías"

Write-Host "`n✅ Archivos listos para subir" -ForegroundColor Green
