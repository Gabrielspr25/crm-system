# =========================================================================
# commit-and-deploy-security.ps1
#
# Commitea los cambios de seguridad hechos por Claude (quitar fallback
# hardcoded, .env.example, .gitignore endurecido, docs RPC, verify-secrets)
# y dispara el deploy.
#
# Uso (desde la raiz del repo):
#   powershell -ExecutionPolicy Bypass -File ./scripts/security/commit-and-deploy-security.ps1
#
# Flags:
#   -SkipDeploy   : solo commitea, no deploya.
#   -DryRun       : muestra que haria, no toca nada.
#   -Message "x"  : override del mensaje de commit.
# =========================================================================

param(
    [switch]$SkipDeploy,
    [switch]$DryRun,
    [string]$Message = "chore(security): remove hardcoded db fallback, add .env.example, document RPC contracts"
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) {
    Write-Host ""
    Write-Host ">> $msg" -ForegroundColor Cyan
}

# Posicionarse en la raiz del repo (este script vive en scripts/security/)
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repoRoot
Write-Host "Repo root: $repoRoot" -ForegroundColor DarkGray

# 1) Sanity check: estar en una working copy de git
if (-not (Test-Path (Join-Path $repoRoot '.git'))) {
    Write-Host "ERROR: no se encontro .git en $repoRoot" -ForegroundColor Red
    exit 1
}

# 2) Lista exacta de archivos a commitear (solo los tocados hoy)
$files = @(
    '.env.example',
    '.gitignore',
    'src/backend/database/externalPools.js',
    'docs/RPC-CONTRACTS.md',
    'scripts/security/verify-secrets.ps1',
    'scripts/security/commit-and-deploy-security.ps1',
    'package.json'
)

Write-Step "git status (preview)"
git status --short

Write-Step "Archivos a incluir en el commit"
$files | ForEach-Object { Write-Host "  $_" }

# 3) Validar que .env NO este en stage (defensive)
$envStaged = git diff --cached --name-only 2>$null | Select-String -Pattern '(^\.env$|/\.env$)'
if ($envStaged) {
    Write-Host "ATENCION: hay un .env en el stage. Abortando." -ForegroundColor Red
    Write-Host "  $envStaged" -ForegroundColor Red
    Write-Host "Ejecutar: git reset HEAD .env" -ForegroundColor Yellow
    exit 1
}

if ($DryRun) {
    Write-Step "DryRun: no se ejecutan cambios. Salida."
    exit 0
}

# 4) Add + commit
Write-Step "git add (solo los archivos listados)"
foreach ($f in $files) {
    if (Test-Path $f) {
        git add -- $f
        Write-Host "  added: $f"
    } else {
        Write-Host "  skipped (no existe): $f" -ForegroundColor Yellow
    }
}

Write-Step "git diff --cached --stat"
git diff --cached --stat

Write-Step "git commit"
$commitOutput = git commit -m $Message 2>&1
Write-Host $commitOutput
if ($LASTEXITCODE -ne 0) {
    if ($commitOutput -match 'nothing to commit') {
        Write-Host "Nada que commitear. Continuando." -ForegroundColor Yellow
    } else {
        Write-Host "ERROR en git commit." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

# 5) Push (asumiendo remote origin / main)
Write-Step "git push origin main"
try {
    git push origin main
} catch {
    Write-Host "Push fallo. Reviselo manualmente antes de deployar." -ForegroundColor Red
    exit 1
}

# 6) Deploy
if ($SkipDeploy) {
    Write-Step "SkipDeploy: listo sin deployar."
    exit 0
}

Write-Step "npm run deploy (ejecuta deploy-simple.ps1)"
npm run deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "El deploy fallo (exit $LASTEXITCODE). Revisar logs." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Step "Deploy OK."
Write-Host "Recorda correr verify-secrets.ps1 para chequear si hay que rotar credenciales." -ForegroundColor Green
