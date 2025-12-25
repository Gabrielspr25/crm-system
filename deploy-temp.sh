cd /var/www/VentasProui

echo "🧹 [1/7] Deteniendo servicios..."
pm2 stop all

echo "🗑️ [2/7] Limpiando caché de NGINX..."
rm -rf /var/cache/nginx/*
rm -rf /var/lib/nginx/cache/*

echo "🗑️ [3/7] Limpiando caché de Node y Vite..."
rm -rf dist node_modules/.vite .vite .cache

echo "🔄 [4/7] Actualizando código desde Git..."
git pull origin main

echo "📦 [5/7] Reinstalando dependencias..."
npm ci --force

echo "🏗️ [6/7] Construyendo con hash único..."
export VITE_BUILD_ID=$(date +%s)
npm run build

echo "✅ [7/7] Verificando versión compilada..."
grep -o "V5\\.1\\.[0-9]*" dist/assets/*.js | head -n 5

echo "🔧 Configurando NGINX sin caché..."
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root /var/www/VentasProui/dist;
    index index.html;

    # Deshabilitar completamente el caché
    add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, proxy-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    add_header X-Content-Type-Options "nosniff" always;

    # ETag único por build
    etag on;
    if_modified_since off;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|json|woff|woff2|ttf|svg|png|jpg|jpeg|gif|ico)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
        expires -1;
    }
}
EOFNGINX

ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default

echo "🔄 Recargando NGINX..."
nginx -t && systemctl reload nginx

echo "🚀 Reiniciando aplicación..."
pm2 restart all
pm2 save

echo ""
echo "✅ DEPLOY COMPLETADO"
echo "📌 Versión desplegada:"
cat /var/www/VentasProui/package.json | grep '"version"'
