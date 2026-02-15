$ErrorActionPreference = "Stop"
$Url = "https://crmp.ss-group.cloud/api/version"

Write-Host "🔍 Verificando versión en $Url ..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $Url -Method Get -ErrorAction Stop
    $serverVersion = $response.version
    
    Write-Host "`n✅ RESPUESTA DEL SERVIDOR:" -ForegroundColor Green
    Write-Host "   Versión activa: $serverVersion" -ForegroundColor Yellow
    
    if ($serverVersion -match "270") {
        Write-Host "   🎉 ¡La versión 270 está activa!" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ La versión 270 NO parece estar activa aún." -ForegroundColor Red
    }
} catch {
    Write-Host "`n❌ Error al conectar con el servidor:" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Gray
}