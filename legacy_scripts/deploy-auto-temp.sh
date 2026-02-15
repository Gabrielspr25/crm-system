#!/bin/bash
set -e

# Buscar el proyecto automáticamente
PROJECT_PATH=""
if [ -d "/var/www/VentasProui" ]; then
    PROJECT_PATH="/var/www/VentasProui"
elif [ -d "/root/VentasProui" ]; then
    PROJECT_PATH="/root/VentasProui"
elif [ -d "~/VentasProui" ]; then
    PROJECT_PATH="~/VentasProui"
elif [ -d "/home/VentasProui" ]; then
    PROJECT_PATH="/home/VentasProui"
else
    echo "❌ ERROR: No se encontró el proyecto VentasProui"
    echo "Buscando en todo el sistema..."
    PROJECT_PATH=$(find / -name "package.json" -path "*VentasProui*" 2>/dev/null | head -n 1 | xargs dirname)
    if [ -z "$PROJECT_PATH" ]; then
        echo "❌ No se pudo encontrar el proyecto"
        exit 1
    fi
fi

echo "✅ Proyecto encontrado en: $PROJECT_PATH"
cd "$PROJECT_PATH"

echo "🔥 [1/9] Deteniendo servicios..."
pm2 stop all || true

echo "🔥 [2/9] Configurando NGINX..."
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root PROJECT_PATH_PLACEHOLDER/dist;
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
    }
    location ~* \.(js|css)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
    }
}
EOFNGINX

# Reemplazar placeholder con ruta real
sed -i "s|PROJECT_PATH_PLACEHOLDER|$PROJECT_PATH|g" /etc/nginx/sites-available/ventaspro

echo "🔥 [3/9] Activando configuración NGINX..."
ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default

echo "🔥 [4/9] Limpiando cache NGINX..."
rm -rf /var/cache/nginx/* || true

echo "🔥 [5/9] Recargando NGINX..."
nginx -t && systemctl reload nginx

echo "🔥 [6/9] Limpiando builds anteriores..."
rm -rf dist node_modules/.vite .vite

echo "🔥 [7/9] Building proyecto..."
npm run build

echo "🔥 [8/9] Verificando versión..."
grep -o "V5\.1\.[0-9]*" dist/assets/*.js | head -n 1 || echo "⚠️ No se pudo verificar versión"

echo "🔥 [9/9] Reiniciando servicios..."
pm2 restart all
pm2 save

echo ""
echo "✅✅✅ DEPLOY COMPLETADO ✅✅✅"
echo "🌐 URL: http://143.244.191.139"
echo "📂 Proyecto en: $PROJECT_PATH"
