Write-Host "🚀🚀🚀 DEPLOY AUTOMÁTICO v5.1.36 🚀🚀🚀`n" -ForegroundColor Green

Set-Location "C:\Users\Gabriel\Documentos\Programas\VentasProui"

Write-Host "[1/6] Empaquetando proyecto..." -ForegroundColor Cyan
tar -czf project.tar.gz --exclude=node_modules --exclude=dist --exclude=.git .
Write-Host "✅ Empaquetado`n" -ForegroundColor Green

Write-Host "[2/6] Subiendo al servidor..." -ForegroundColor Cyan
scp project.tar.gz ventaspro-server:/tmp/
Write-Host "✅ Subido`n" -ForegroundColor Green

Write-Host "[3/6] Creando script de deploy..." -ForegroundColor Cyan
@"
#!/bin/bash
set -e
mkdir -p /root/VentasProui
cd /root/VentasProui
tar -xzf /tmp/project.tar.gz
npm install
npm run build
cat > /etc/nginx/sites-available/ventaspro << 'EOF'
server {
    listen 80;
    root /root/VentasProui/dist;
    index index.html;
    location / {
        try_files \`$uri \`$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
EOF
ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
rm -rf /var/cache/nginx/*
systemctl reload nginx
pm2 restart all
echo '✅ DEPLOY COMPLETADO'
"@ | Out-File -FilePath deploy.sh -Encoding UTF8
Write-Host "✅ Script creado`n" -ForegroundColor Green

Write-Host "[4/6] Subiendo script..." -ForegroundColor Cyan
scp deploy.sh ventaspro-server:/tmp/
Write-Host "✅ Subido`n" -ForegroundColor Green

Write-Host "[5/6] Ejecutando deploy (3-5 min)..." -ForegroundColor Yellow
ssh ventaspro-server "bash /tmp/deploy.sh"

Write-Host "`n[6/6] Limpiando..." -ForegroundColor Cyan
Remove-Item project.tar.gz -ErrorAction SilentlyContinue
Remove-Item deploy.sh -ErrorAction SilentlyContinue
Write-Host "✅ Limpio`n" -ForegroundColor Green

Write-Host "━" * 60 -ForegroundColor Green
Write-Host "✅✅✅ DEPLOY EXITOSO v5.1.36 ✅✅✅" -ForegroundColor Green
Write-Host "━" * 60 -ForegroundColor Green
Write-Host "`n🌐 https://crmp.ss-group.cloud/`n" -ForegroundColor Cyan
Write-Host "🔧 CAMBIOS DESPLEGADOS:" -ForegroundColor Yellow
Write-Host "   ✅ Campos Empresa/Dueño corregidos" -ForegroundColor White
Write-Host "   ✅ Validación de duplicados" -ForegroundColor White
Write-Host "   ✅ OfferGenerator con PDF`n" -ForegroundColor White

pause
