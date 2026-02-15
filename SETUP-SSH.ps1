# ==========================================
# CONFIGURACIÓN AUTOMÁTICA DE LLAVES SSH
# ==========================================
$ServerHost = "143.244.191.139"
$ServerUser = "root"
$KeyFile = "$PSScriptRoot\deploy_key"

Write-Host "`n🚀 CONFIGURACIÓN DE LLAVES SSH" -ForegroundColor Cyan

# 1. Generar llave si no existe
if (-not (Test-Path $KeyFile)) {
    Write-Host "1️⃣  Generando par de llaves (Ed25519)..." -ForegroundColor Yellow
    # Genera llave sin passphrase (-N "")
    ssh-keygen -t ed25519 -f $KeyFile -N "" -q
    Write-Host "✅ Llave generada: $KeyFile" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Usando llave existente: $KeyFile" -ForegroundColor Gray
}

# 2. Obtener contraseña para subir la llave (una última vez)
$ServerPass = $env:CRMP_SERVER_PASS
if ([string]::IsNullOrEmpty($ServerPass)) {
    Write-Host "`n🔑 Necesitamos la contraseña UNA ÚLTIMA VEZ para instalar la llave." -ForegroundColor Yellow
    $SecurePass = Read-Host "   Contraseña del servidor" -AsSecureString
    $ServerPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePass))
}

# 3. Subir llave pública usando PuTTY (plink)
$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$PubKey = Get-Content "$KeyFile.pub"

if (Test-Path $plinkPath) {
    Write-Host "`n2️⃣  Instalando llave en el servidor..." -ForegroundColor Yellow
    $Cmd = "mkdir -p ~/.ssh && echo `"$PubKey`" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
    
    & $plinkPath -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" $Cmd
    
    Write-Host "`n🎉 LISTO! Ahora los scripts usarán 'deploy_key' sin pedir contraseña." -ForegroundColor Cyan
} else {
    Write-Host "❌ No se encontró plink.exe. Sube el contenido de deploy_key.pub manualmente." -ForegroundColor Red
}