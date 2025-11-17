# Script de arreglo rápido del backend
$ServerHost = "143.244.191.139"
$ServerUser = "root"
$ServerPass = "CL@70049ro"

Write-Host "Ejecutando arreglo del backend en segundo plano..." -ForegroundColor Yellow

$fixScript = @'
#!/bin/bash
cd /opt/crmp
npm install express cors pg multer xlsx socket.io iconv-lite --save > /tmp/npm-install.log 2>&1
pm2 restart crmp-api
pm2 logs crmp-api --lines 5 --nostream
echo "BACKEND ARREGLADO"
'@

# Subir script
$fixScript | Out-File -FilePath "$env:TEMP\fix-backend.sh" -Encoding ASCII -NoNewline

& "C:\Program Files\PuTTY\pscp.exe" -batch -pw $ServerPass "$env:TEMP\fix-backend.sh" "${ServerUser}@${ServerHost}:/tmp/"

# Ejecutar en background
& "C:\Program Files\PuTTY\plink.exe" -batch -ssh -pw $ServerPass "$ServerUser@$ServerHost" "nohup bash /tmp/fix-backend.sh > /tmp/fix-output.log 2>&1 &"

Write-Host "✓ Script ejecutándose en el servidor" -ForegroundColor Green
Write-Host ""
Write-Host "Para ver el progreso, ejecuta:" -ForegroundColor Cyan
Write-Host '  plink root@143.244.191.139 "cat /tmp/fix-output.log"' -ForegroundColor Gray
Write-Host ""
Write-Host "Espera 30-60 segundos y luego verifica:" -ForegroundColor Cyan
Write-Host "  https://crmp.ss-group.cloud" -ForegroundColor White
Write-Host "  https://crmp.ss-group.cloud/api/health" -ForegroundColor White
