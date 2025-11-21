# ================================================
# LIMPIAR BD - Clientes, BANs y Suscriptores
# ================================================
# ⚠️ ADVERTENCIA: Este script BORRARÁ TODOS los datos de:
#   - clients
#   - bans  
#   - subscribers
# ================================================

Write-Host "`n===================================================" -ForegroundColor Red
Write-Host "  ⚠️  LIMPIEZA DE BASE DE DATOS  ⚠️" -ForegroundColor Red
Write-Host "===================================================" -ForegroundColor Red
Write-Host ""
Write-Host "Este script BORRARÁ:" -ForegroundColor Yellow
Write-Host "  ❌ TODOS los clientes" -ForegroundColor Red
Write-Host "  ❌ TODOS los BANs" -ForegroundColor Red
Write-Host "  ❌ TODOS los suscriptores" -ForegroundColor Red
Write-Host ""
Write-Host "⚠️  ESTA ACCIÓN NO SE PUEDE DESHACER  ⚠️" -ForegroundColor Red
Write-Host ""

$confirmacion = Read-Host "¿Estás SEGURO? Escribe 'SI BORRAR TODO' para continuar"

if ($confirmacion -ne "SI BORRAR TODO") {
    Write-Host "`n❌ Operación cancelada" -ForegroundColor Green
    exit 0
}

Write-Host "`n[1/4] Conectando a la base de datos..." -ForegroundColor Yellow

# Leer configuración de .env
$envContent = Get-Content ".env" -Raw
$dbHost = ($envContent | Select-String -Pattern "DB_HOST=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value }).Trim()
$dbPort = ($envContent | Select-String -Pattern "DB_PORT=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value }).Trim()
$dbName = ($envContent | Select-String -Pattern "DB_NAME=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value }).Trim()
$dbUser = ($envContent | Select-String -Pattern "DB_USER=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value }).Trim()
$dbPass = ($envContent | Select-String -Pattern "DB_PASSWORD=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value }).Trim()

Write-Host "  Base de datos: $dbName en $dbHost:$dbPort" -ForegroundColor Gray

# Verificar que tenemos los valores
if (-not $dbHost -or -not $dbName -or -not $dbUser -or -not $dbPass) {
    Write-Host "❌ Error: No se pudieron leer las credenciales de .env" -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/4] Contando registros antes de borrar..." -ForegroundColor Yellow

# Crear script SQL temporal
$sqlScript = @"
-- Contar registros
SELECT 
    (SELECT COUNT(*) FROM subscribers) as total_subscribers,
    (SELECT COUNT(*) FROM bans) as total_bans,
    (SELECT COUNT(*) FROM clients) as total_clients;

-- Borrar en orden (respetando foreign keys)
DELETE FROM subscribers;
DELETE FROM bans;
DELETE FROM clients;

-- Verificar que se borraron
SELECT 
    (SELECT COUNT(*) FROM subscribers) as remaining_subscribers,
    (SELECT COUNT(*) FROM bans) as remaining_bans,
    (SELECT COUNT(*) FROM clients) as remaining_clients;
"@

$sqlFile = "temp_cleanup.sql"
$sqlScript | Out-File -FilePath $sqlFile -Encoding UTF8

Write-Host "`n[3/4] Ejecutando limpieza..." -ForegroundColor Yellow
Write-Host "  ⚠️  Esto puede tardar unos segundos..." -ForegroundColor Gray

# Ejecutar con psql
$env:PGPASSWORD = $dbPass
$psqlCommand = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlFile"

try {
    $result = & cmd /c $psqlCommand 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Limpieza completada" -ForegroundColor Green
        Write-Host "`nResultado:" -ForegroundColor Cyan
        Write-Host $result -ForegroundColor Gray
    } else {
        Write-Host "❌ Error ejecutando psql" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        Remove-Item $sqlFile -ErrorAction SilentlyContinue
        exit 1
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host "`n💡 Asegúrate de tener psql instalado y en el PATH" -ForegroundColor Yellow
    Write-Host "   O ejecuta el SQL manualmente en pgAdmin/DBeaver" -ForegroundColor Yellow
    Remove-Item $sqlFile -ErrorAction SilentlyContinue
    exit 1
}

# Limpiar archivo temporal
Remove-Item $sqlFile -ErrorAction SilentlyContinue

Write-Host "`n[4/4] Verificación final..." -ForegroundColor Yellow

# Verificar que quedó vacío
$verifyScript = @"
SELECT 
    (SELECT COUNT(*) FROM subscribers) as subscribers,
    (SELECT COUNT(*) FROM bans) as bans,
    (SELECT COUNT(*) FROM clients) as clients;
"@

$verifyFile = "temp_verify.sql"
$verifyScript | Out-File -FilePath $verifyFile -Encoding UTF8

$verifyResult = & cmd /c "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $verifyFile" 2>&1
Remove-Item $verifyFile -ErrorAction SilentlyContinue

if ($verifyResult -match "0.*0.*0") {
    Write-Host "✓ Base de datos limpiada completamente" -ForegroundColor Green
} else {
    Write-Host "⚠️  Verificar manualmente - puede haber registros restantes" -ForegroundColor Yellow
}

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  ✓ LIMPIEZA COMPLETADA" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Yellow
Write-Host "  1. Importar los datos con el importador" -ForegroundColor White
Write-Host "  2. Los clientes incompletos aparecerán automáticamente en el tab 'Incompletos'" -ForegroundColor White
Write-Host "  3. Completar la información de los clientes incompletos" -ForegroundColor White
Write-Host ""
