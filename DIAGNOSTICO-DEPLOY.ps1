Write-Host "🔍 INICIANDO DIAGNÓSTICO DE DESPLIEGUE..." -ForegroundColor Cyan

$ServerHost = "143.244.191.139"
$ServerUser = "root"
$KeyFile = "$PSScriptRoot\deploy_key"

# 1. Verificación de Archivos Locales
Write-Host "`n1️⃣  Verificando archivos locales..." -ForegroundColor Yellow
if (Test-Path $KeyFile) {
    Write-Host "   ✅ Llave privada encontrada: $KeyFile" -ForegroundColor Green
    if ((Get-Item $KeyFile).Length -eq 0) {
        Write-Host "   ❌ ALERTA: El archivo de llave está vacío (0 bytes). Regenera con .\SETUP-SSH.ps1" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Llave privada NO encontrada ($KeyFile)" -ForegroundColor Red
    Write-Host "      -> Ejecuta .\SETUP-SSH.ps1 primero para generar las llaves." -ForegroundColor Gray
}

if (Test-Path "$PSScriptRoot\package.json") {
    Write-Host "   ✅ package.json encontrado" -ForegroundColor Green
} else {
    Write-Host "   ❌ package.json NO encontrado en el directorio actual" -ForegroundColor Red
}

# 2. Verificación de Conectividad
Write-Host "`n2️⃣  Verificando conectividad con $ServerHost..." -ForegroundColor Yellow
try {
    $ping = Test-Connection -ComputerName $ServerHost -Count 1 -ErrorAction Stop
    Write-Host "   ✅ Servidor responde al Ping ($($ping.ResponseTime)ms)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ No se puede conectar al servidor (Ping falló). Revisa tu internet." -ForegroundColor Red
}

# 3. Verificación de SSH
Write-Host "`n3️⃣  Probando conexión SSH..." -ForegroundColor Yellow
if (Test-Path $KeyFile) {
    try {
        # Intentar conectar y obtener el hostname
        $sshCommand = "ssh -i `"$KeyFile`" -o StrictHostKeyChecking=no -o ConnectTimeout=5 $ServerUser@$ServerHost 'echo CONEXION_EXITOSA'"
        $result = Invoke-Expression $sshCommand 2>&1
        
        if ($result -match "CONEXION_EXITOSA") {
            Write-Host "   ✅ Conexión SSH exitosa con llave" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Falló la conexión SSH con llave." -ForegroundColor Red
            Write-Host "   Salida: $result" -ForegroundColor Gray
            Write-Host "   -> Posible causa: La llave pública no está instalada en el servidor. Ejecuta .\SETUP-SSH.ps1" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ❌ Error ejecutando comando SSH: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   ⚠️ Saltando prueba SSH (falta llave local)" -ForegroundColor DarkYellow
}

# 4. Verificación de Herramientas
Write-Host "`n4️⃣  Verificando herramientas..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ npm instalado (v$npmVersion)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ npm no funciona correctamente" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ npm no encontrado en el PATH" -ForegroundColor Red
}

Write-Host "`n🏁 Diagnóstico finalizado." -ForegroundColor Cyan