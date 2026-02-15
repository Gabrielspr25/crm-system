Write-Host "`n🚀 PREPARANDO DESPLIEGUE VERSIÓN 270..." -ForegroundColor Cyan

# 1. Actualizar archivo de versión del Frontend
$VersionFile = "src/version.ts"
$VersionContent = @"
export const APP_VERSION = "2026-270";
export const BUILD_LABEL = "v2026-270 - Despliegue Automático";
export const BUILD_TIMESTAMP = Date.now();
"@

if (Test-Path "src") {
    Set-Content -Path $VersionFile -Value $VersionContent -Encoding UTF8
    Write-Host "✅ src/version.ts actualizado a 2026-270" -ForegroundColor Green
}

# 2. Actualizar package.json (Backend)
Write-Host "📦 Actualizando package.json..." -ForegroundColor Cyan
cmd /c "npm version 5.1.270 --no-git-tag-version --allow-same-version"

# 3. Ejecutar el script de subida principal
if (Test-Path "SUBIR-AL-SERVIDOR.ps1") {
    .\SUBIR-AL-SERVIDOR.ps1
} else {
    Write-Host "❌ No se encontró SUBIR-AL-SERVIDOR.ps1" -ForegroundColor Red
}