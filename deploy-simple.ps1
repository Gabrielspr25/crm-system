#!/usr/bin/env pwsh
param(
  [switch]$SkipBuild,
  [string]$ServerHost = "",
  [string]$ServerUser = "",
  [string]$RemoteRoot = "",
  [string]$RemoteClient = "",
  [string]$Pm2App = "",
  [string]$KeyPath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Resolve-Setting {
  param(
    [string]$ExplicitValue,
    [string]$EnvName,
    [string]$DefaultValue
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitValue)) {
    return $ExplicitValue
  }

  $envValue = [Environment]::GetEnvironmentVariable($EnvName)
  if (-not [string]::IsNullOrWhiteSpace($envValue)) {
    return $envValue
  }

  return $DefaultValue
}

function Resolve-KeyPath {
  param([string]$ExplicitPath)

  $candidates = @()

  if (-not [string]::IsNullOrWhiteSpace($ExplicitPath)) {
    $candidates += $ExplicitPath
  }

  $envKey = [Environment]::GetEnvironmentVariable("CRMP_DEPLOY_KEY")
  if (-not [string]::IsNullOrWhiteSpace($envKey)) {
    $candidates += $envKey
  }

  $candidates += @(
    (Join-Path $repoRoot "deploy_key"),
    (Join-Path $repoRoot "scripts\ops-deploy\deploy_key"),
    "$HOME\.ssh\id_rsa_ventaspro",
    "$HOME\.ssh\id_ed25519",
    "$HOME\.ssh\id_rsa"
  )

  foreach ($candidate in $candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }

    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  return $null
}

function Get-SshOptions {
  param([string]$ResolvedKeyPath)

  $options = @("-o", "StrictHostKeyChecking=no")
  if (-not [string]::IsNullOrWhiteSpace($ResolvedKeyPath)) {
    $options += @("-i", $ResolvedKeyPath)
  }

  return $options
}

function Invoke-RemoteCommand {
  param(
    [string]$Server,
    [string[]]$SshOptions,
    [string]$Command
  )

  & ssh @SshOptions $Server $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo el comando remoto: $Command"
  }
}

function Copy-ToRemote {
  param(
    [string]$Server,
    [string[]]$SshOptions,
    [string]$Source,
    [string]$Destination,
    [switch]$Recursive
  )

  if ($Recursive) {
    & scp @SshOptions -r $Source "${Server}:$Destination"
  } else {
    & scp @SshOptions $Source "${Server}:$Destination"
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Fallo la copia hacia ${Server}:$Destination"
  }
}

$ServerHost = Resolve-Setting -ExplicitValue $ServerHost -EnvName "CRMP_DEPLOY_HOST" -DefaultValue "143.244.191.139"
$ServerUser = Resolve-Setting -ExplicitValue $ServerUser -EnvName "CRMP_DEPLOY_USER" -DefaultValue "root"
$RemoteRoot = Resolve-Setting -ExplicitValue $RemoteRoot -EnvName "CRMP_REMOTE_ROOT" -DefaultValue "/opt/crmp"
$RemoteClient = Resolve-Setting -ExplicitValue $RemoteClient -EnvName "CRMP_REMOTE_CLIENT" -DefaultValue "/opt/crmp/dist/client"
$Pm2App = Resolve-Setting -ExplicitValue $Pm2App -EnvName "CRMP_PM2_APP" -DefaultValue "crmp-api"

$resolvedKeyPath = Resolve-KeyPath -ExplicitPath $KeyPath
$sshOptions = Get-SshOptions -ResolvedKeyPath $resolvedKeyPath
$server = "$ServerUser@$ServerHost"

Write-Host "[deploy] Iniciando deploy..." -ForegroundColor Cyan
Write-Host "[deploy] Servidor: $server" -ForegroundColor DarkCyan
Write-Host "[deploy] Frontend remoto: $RemoteClient" -ForegroundColor DarkCyan
Write-Host "[deploy] Backend remoto: $RemoteRoot" -ForegroundColor DarkCyan
Write-Host "[deploy] PM2 app: $Pm2App" -ForegroundColor DarkCyan

if ($resolvedKeyPath) {
  Write-Host "[deploy] Usando llave SSH: $resolvedKeyPath" -ForegroundColor DarkCyan
} else {
  Write-Host "[deploy] No se encontro llave dedicada. SSH pedira credenciales si hacen falta." -ForegroundColor Yellow
}

if (-not $SkipBuild) {
  Write-Host "[deploy] Ejecutando build..." -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "El build fallo."
  }
}

if (-not (Test-Path "dist/client/index.html")) {
  throw "No existe dist/client/index.html. Ejecuta npm run build primero."
}

if (-not (Test-Path "server-FINAL.js")) {
  throw "No existe server-FINAL.js en el proyecto."
}

if (-not (Test-Path "src/backend")) {
  throw "No existe src/backend en el proyecto."
}

if (-not (Test-Path "src/shared")) {
  throw "No existe src/shared en el proyecto."
}

Write-Host "[deploy] Verificando acceso SSH..." -ForegroundColor Cyan
Invoke-RemoteCommand -Server $server -SshOptions $sshOptions -Command "echo ok"

Write-Host "[deploy] Preparando rutas remotas..." -ForegroundColor Cyan
Invoke-RemoteCommand -Server $server -SshOptions $sshOptions -Command "mkdir -p $RemoteClient $RemoteRoot/src/backend $RemoteRoot/src/shared"

Write-Host "[deploy] Limpiando frontend remoto..." -ForegroundColor Cyan
Invoke-RemoteCommand -Server $server -SshOptions $sshOptions -Command "rm -rf $RemoteClient/* && mkdir -p $RemoteClient"

Write-Host "[deploy] Subiendo frontend..." -ForegroundColor Cyan
Copy-ToRemote -Server $server -SshOptions $sshOptions -Source "dist/client/." -Destination "$RemoteClient/" -Recursive

Write-Host "[deploy] Subiendo backend..." -ForegroundColor Cyan
Copy-ToRemote -Server $server -SshOptions $sshOptions -Source "server-FINAL.js" -Destination "$RemoteRoot/server-FINAL.js"
Copy-ToRemote -Server $server -SshOptions $sshOptions -Source "package.json" -Destination "$RemoteRoot/package.json"
Copy-ToRemote -Server $server -SshOptions $sshOptions -Source "src/backend/." -Destination "$RemoteRoot/src/backend/" -Recursive
Copy-ToRemote -Server $server -SshOptions $sshOptions -Source "src/shared/." -Destination "$RemoteRoot/src/shared/" -Recursive

Write-Host "[deploy] Ajustando permisos..." -ForegroundColor Cyan
Invoke-RemoteCommand -Server $server -SshOptions $sshOptions -Command "chown -R www-data:www-data $RemoteClient && chmod -R 755 $RemoteClient"

Write-Host "[deploy] Reiniciando backend..." -ForegroundColor Cyan
Invoke-RemoteCommand -Server $server -SshOptions $sshOptions -Command "pm2 restart $Pm2App || pm2 restart ventaspro-backend"
Start-Sleep -Seconds 3

Write-Host "[deploy] Verificando version backend..." -ForegroundColor Cyan
Invoke-RemoteCommand -Server $server -SshOptions $sshOptions -Command "curl -s http://localhost:3001/api/version"

Write-Host "[deploy] Verificando version publica..." -ForegroundColor Cyan
curl.exe -s https://crmp.ss-group.cloud/api/version
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo consultar la version publica."
}

Write-Host "[deploy] Deploy completado." -ForegroundColor Green
