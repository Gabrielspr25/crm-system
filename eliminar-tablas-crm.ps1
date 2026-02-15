# Script para eliminar TODAS las tablas que empiezan con 'crm' del documento BD Legacy

$file = "BD Legacy\BD-LEGACY-CLAROPR.md"
$content = Get-Content $file -Raw

# Contar cuántas tablas crm hay
$crmCount = ([regex]::Matches($content, '^\| \d+ \| \*\*crm', [System.Text.RegularExpressions.RegexOptions]::Multiline)).Count

Write-Host "📊 Encontradas $crmCount tablas CRM para eliminar" -ForegroundColor Yellow

# 1. Eliminar líneas del resumen (tabla) que contienen **crm
$lines = $content -split "`n"
$newLines = @()
$removed = 0

foreach ($line in $lines) {
    # Si es una línea de tabla con **crm, omitirla
    if ($line -match '^\|\s*\d+\s*\|\s*\*\*crm') {
        $removed++
        continue
    }
    $newLines += $line
}

$content = $newLines -join "`n"
Write-Host "✅ Eliminadas $removed líneas del resumen" -ForegroundColor Green

# 2. Eliminar secciones completas ### 📁 crm*
# Patrón: desde ### 📁 crm hasta la siguiente sección ### o fin
$beforeSections = $content.Length
$content = $content -replace '(?s)### 📁 crm[^\n]+.*?(?=### 📁 |\z)', ''
$afterSections = $content.Length
Write-Host "✅ Eliminados $($beforeSections - $afterSections) bytes de secciones detalladas" -ForegroundColor Green

# 3. Actualizar el total de tablas
$totalOriginal = 328
$totalNuevo = $totalOriginal - $crmCount
$content = $content -replace 'Total Tablas:\*\* 328', "Total Tablas:** $totalNuevo"

# Guardar
$content | Set-Content $file -NoNewline

Write-Host "`n✨ COMPLETADO:" -ForegroundColor Cyan
Write-Host "   Tablas CRM eliminadas: $crmCount" -ForegroundColor White
Write-Host "   Total tablas: $totalOriginal → $totalNuevo" -ForegroundColor White
