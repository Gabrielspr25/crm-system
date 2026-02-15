Write-Host "🔍 Buscando llaves públicas SSH..." -ForegroundColor Cyan

# 1. Buscar en el directorio actual (Workspace)
$localPub = Get-ChildItem -Path . -Filter "*.pub" -Recurse -ErrorAction SilentlyContinue

if ($localPub) {
    Write-Host "`n✅ LLAVES ENCONTRADAS EN EL WORKSPACE:" -ForegroundColor Green
    $localPub | ForEach-Object { Write-Host "   📂 $($_.FullName)" -ForegroundColor White }
} else {
    Write-Host "`n❌ No se encontraron archivos .pub en este proyecto." -ForegroundColor Yellow
}

# 2. Buscar en la carpeta .ssh del usuario
$sshDir = "$env:USERPROFILE\.ssh"
if (Test-Path $sshDir) {
    $globalPub = Get-ChildItem -Path $sshDir -Filter "*.pub" -ErrorAction SilentlyContinue
    if ($globalPub) {
        Write-Host "`nℹ️  Llaves en tu carpeta personal ($sshDir):" -ForegroundColor Cyan
        $globalPub | ForEach-Object { Write-Host "   🔑 $($_.Name)" -ForegroundColor Gray }
    }
}