# =========================================================================
# verify-secrets.ps1
# Chequea si en el historial de git se commitearon secretos, y si
# Configuration.properties / .env siguen tracked.
# Ejecutar desde la raiz del repo:
#   powershell -ExecutionPolicy Bypass -File ./scripts/security/verify-secrets.ps1
# =========================================================================

$ErrorActionPreference = 'Stop'

function Write-Section($title) {
    Write-Host ""
    Write-Host "=== $title ===" -ForegroundColor Cyan
}

Write-Section "1) Archivos actualmente tracked que NO deberian estar"
$bad = git ls-files | Select-String -Pattern '(^\.env$|/\.env$|Configuration\.properties$|context\.xml$)'
if ($bad) {
    Write-Host "ATENCION: los siguientes archivos estan tracked en git:" -ForegroundColor Red
    $bad | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Para sacarlos del indice (sin borrarlos del disco):" -ForegroundColor Yellow
    Write-Host "  git rm --cached <ruta>" -ForegroundColor Yellow
    Write-Host "  git commit -m 'chore: untrack archivos con secretos'" -ForegroundColor Yellow
} else {
    Write-Host "OK: no hay .env ni Configuration.properties tracked." -ForegroundColor Green
}

Write-Section "2) Commits historicos que tocaron archivos sensibles"
$paths = @('.env', '.env.local', 'temp_claropr_extract/ROOT/WEB-INF/classes/Configuration.properties')
foreach ($p in $paths) {
    Write-Host ""
    Write-Host "- Historial de $p :" -ForegroundColor Yellow
    git log --all --full-history --pretty=format:'%h %ad %s' --date=short -- $p 2>$null
}

Write-Section "3) Buscar secretos literales en el historial"
# Ajustar los patrones segun los secretos a rotar.
$patterns = @(
    'fF00JIRFXc',              # password postgres externa
    'Sscomm.70049',            # password SMTP
    'tango_secret_key_2024',   # jwt fallback
    'p0stmu7t1'                # password discrepancias
)
foreach ($pat in $patterns) {
    Write-Host ""
    Write-Host "- Buscando '$pat' en el historial..." -ForegroundColor Yellow
    $hits = git log --all -S "$pat" --pretty=format:'%h %ad %s' --date=short 2>$null
    if ($hits) {
        Write-Host $hits -ForegroundColor Red
    } else {
        Write-Host "  No encontrado en el historial." -ForegroundColor Green
    }
}

Write-Section "4) Checklist de rotacion"
Write-Host @"
Si alguno de los secretos aparece en el historial, considerar que YA ESTA
COMPROMETIDO y hay que ROTARLO aunque se reescriba el historial:

  [ ] Rotar password PostgreSQL de BD 'claropr' (167.99.12.125)
  [ ] Rotar password PostgreSQL de BD discrepancias (159.203.70.5)
  [ ] Rotar password SMTP de alertas@sscommcorp.com
  [ ] Generar nuevo JWT_SECRET (string aleatorio largo, min 64 chars)
  [ ] Actualizar .env local y del servidor con los nuevos valores
  [ ] Redeploy del backend Node (y del WAR ClaroPR si aplica)
  [ ] Opcional: limpiar historial con 'git filter-repo' si el repo es privado
       (NO usar filter-branch; requiere force-push y coordinar con el equipo)
"@
