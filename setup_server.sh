#!/bin/bash

echo "🚀 CONFIGURANDO SERVIDOR CRM COMPLETO"
echo "======================================"

# 1. Actualizar sistema
echo "📦 Actualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar Node.js 18
echo "🟢 Instalando Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# 3. Instalar Nginx
echo "🌐 Instalando Nginx..."
apt install nginx -y

# 4. Instalar PostgreSQL
echo "🐘 Instalando PostgreSQL..."
apt install postgresql postgresql-contrib -y

# 5. Instalar PM2
echo "⚡ Instalando PM2..."
npm install -g pm2

# 6. Instalar dependencias del sistema
echo "🔧 Instalando dependencias del sistema..."
apt install -y git curl wget unzip

# 7. Configurar PostgreSQL
echo "🗄️ Configurando PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE crm_pro;"
sudo -u postgres psql -c "CREATE USER crm_user WITH PASSWORD 'CRM_Seguro_2025!';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE crm_pro TO crm_user;"
sudo -u postgres psql -c "ALTER USER crm_user CREATEDB;"

# 8. Configurar firewall
echo "🔥 Configurando firewall..."
ufw allow ssh
ufw allow 'Nginx Full'
ufw allow 3001
ufw --force enable

# 9. Crear directorio de la aplicación
echo "📁 Creando directorio de la aplicación..."
mkdir -p /var/www/crm
mkdir -p /var/www/dist

# 10. Configurar permisos
echo "🔐 Configurando permisos..."
chown -R www-data:www-data /var/www
chmod -R 755 /var/www

# 11. Configurar Nginx
echo "⚙️ Configurando Nginx..."
cat > /etc/nginx/sites-available/crm << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name 143.244.191.139;

    # API endpoints - Proxy to Node.js backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO - Proxy to Node.js backend
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve static files
    location /assets/ {
        alias /var/www/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Serve index.html for all other requests (React Router)
    location / {
        root /var/www/dist;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
EOF

# 12. Activar sitio de Nginx
ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 13. Reiniciar servicios
echo "🔄 Reiniciando servicios..."
systemctl restart nginx
systemctl enable nginx
systemctl restart postgresql
systemctl enable postgresql

# 14. Verificar instalación
echo "✅ Verificando instalación..."
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "PostgreSQL version: $(sudo -u postgres psql -c 'SELECT version();' | head -3)"
echo "Nginx status: $(systemctl is-active nginx)"

echo ""
echo "🎉 CONFIGURACIÓN COMPLETADA"
echo "=========================="
echo "Servidor IP: 143.244.191.139"
echo "SSH: ssh root@143.244.191.139"
echo "Contraseña: CL@70049ro"
echo ""
echo "Próximo paso: Subir archivos de la aplicación"
