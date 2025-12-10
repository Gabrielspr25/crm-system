#!/bin/bash
set -e
cd /var/www/VentasProui
echo "🔥 [1/10] Deteniendo servicios..."
pm2 stop all
echo "🔥 [2/10] Configurando NGINX sin cache..."
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root /var/www/VentasProui/dist;
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    location ~* \.(js|css)\$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
    }
}
EOFNGINX
echo "🔥 [3/10] Activando configuración..."
ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default
echo "🔥 [4/10] Limpiando cache NGINX..."
rm -rf /var/cache/nginx/*
echo "🔥 [5/10] Recargando NGINX..."
nginx -t && systemctl reload nginx
echo "🔥 [6/10] Limpiando builds anteriores..."
rm -rf dist node_modules/.vite .vite
echo "🔥 [7/10] Building proyecto..."
npm run build
echo "🔥 [8/10] Verificando versión..."
grep -o "V5\.1\.[0-9]*" dist/assets/*.js | head -n 3
echo "🔥 [9/10] Reiniciando servicios..."
pm2 restart all
pm2 save
echo ""
echo "✅✅✅ DEPLOY COMPLETADO ✅✅✅"
