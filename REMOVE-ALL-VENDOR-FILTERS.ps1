# Script para eliminar TODOS los filtros de vendedor del backend

$file = "server-FINAL.js"
$content = Get-Content $file -Raw

# Comentar TODAS las validaciones de vendedor
$content = $content -replace "(\s+)if \(req\.user\?\.role === 'vendedor'\) \{[^\}]+\}", '$1// FILTRO VENDEDOR ELIMINADO'

# Guardar
$content | Set-Content $file

Write-Host "✅ Todos los filtros de vendedor eliminados" -ForegroundColor Green
