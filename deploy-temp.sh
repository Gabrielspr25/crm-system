#!/bin/bash
cd /var/www/VentasProui || exit 1

echo "🧹 [1/7] Deteniendo servicios..."
pm2 stop all

echo "🗑️ [2/7] Limpiando caché NGINX..."
rm -rf /var/cache/nginx/* /var/lib/nginx/cache/* 2>/dev/null

echo "🗑️ [3/7] Limpiando caché Vite..."
rm -rf dist node_modules/.vite .vite .cache 2>/dev/null

echo "🔄 [4/7] Actualizando código..."
git pull origin main

echo "📦 [5/7] Instalando dependencias..."
npm ci --force

echo "🏗️ [6/7] Construyendo..."
export VITE_BUILD_ID=$(date +%s)
npm run build

echo "✅ [7/7] Verificando versión..."
grep -o "V5\\.1\\.[0-9]*" dist/assets/*.js 2>/dev/null | head -n 3

echo "🔧 Configurando NGINX..."
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root /var/www/VentasProui/dist;
    index index.html;
    add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    location / { try_files \$uri \$uri/ /index.html; }
    location ~* \.(js|css|json|woff|woff2|ttf|svg|png|jpg|jpeg|gif|ico)\$ {
        add_header Cache-Control "no-cache" always;
        expires -1;
    }
}
EOFNGINX

ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "🚀 Reiniciando app..."
pm2 restart all
pm2 save

echo ""
echo "✅ DEPLOY COMPLETADO"
cat /var/www/VentasProui/package.json | grep '"version"'
