#!/bin/bash
# Backup de configuracion anterior
cp /etc/nginx/sites-available/crmp.ss-group.cloud /etc/nginx/sites-available/crmp.ss-group.cloud.backup

# Crear nueva configuracion
cat > /etc/nginx/sites-available/crmp.ss-group.cloud << 'EOF'
server {
    listen 80;
    server_name crmp.ss-group.cloud;
    root /var/www/crmp;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        expires -1;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        add_header Cache-Control "public, max-age=3600";
        expires 1h;
    }
}
EOF

# Crear enlace simbolico
ln -sf /etc/nginx/sites-available/crmp.ss-group.cloud /etc/nginx/sites-enabled/

# Verificar y recargar Nginx
nginx -t && systemctl reload nginx

echo "[OK] Configuracion de Nginx actualizada correctamente"
