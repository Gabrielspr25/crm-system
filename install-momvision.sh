#!/bin/bash

# 🚀 SCRIPT DE INSTALACIÓN AUTOMÁTICA PARA MOMVISION CMS
# Ejecutar como: bash install-momvision.sh

set -e

echo "🚀 Iniciando instalación de MOM Vision CMS..."

# Actualizar sistema
echo "📦 Actualizando sistema..."
apt update && apt upgrade -y

# Instalar dependencias básicas
echo "🔧 Instalando dependencias..."
apt install -y curl wget git nginx certbot python3-certbot-nginx ufw

# Instalar Node.js 18 LTS
echo "📗 Instalando Node.js 18 LTS..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Verificar versiones
echo "✅ Versiones instaladas:"
node --version
npm --version

# Instalar PostgreSQL
echo "🗄️ Instalando PostgreSQL..."
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# Instalar PM2
echo "⚙️ Instalando PM2..."
npm install -g pm2

# Crear directorio de la aplicación
echo "📂 Preparando directorios..."
cd /var/www/
rm -rf momvision-cms 2>/dev/null || true

# Clonar repositorio
echo "📥 Descargando código desde GitHub..."
git clone https://github.com/Gabrielspr25/crm-system.git momvision-cms
cd momvision-cms

# Configurar permisos
chown -R www-data:www-data /var/www/momvision-cms

# Instalar dependencias del servidor
echo "📦 Instalando dependencias del backend..."
cd server
npm install --production

# Instalar dependencias del cliente y hacer build
echo "🎨 Construyendo frontend..."
cd ../client
npm install
npm run build

# Configurar base de datos
echo "🗄️ Configurando base de datos..."
sudo -u postgres psql << EOF
CREATE DATABASE momvision_cms;
CREATE USER momvision WITH ENCRYPTED PASSWORD 'momvision2024!';
GRANT ALL PRIVILEGES ON DATABASE momvision_cms TO momvision;
\q
EOF

# Crear archivo .env
echo "⚙️ Configurando variables de entorno..."
cd /var/www/momvision-cms/server
cat > .env << EOF
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://momvision:momvision2024!@localhost:5432/momvision_cms
JWT_SECRET=momvision_jwt_secret_2024_production_secure_$(date +%s)
UPLOAD_DIR=/var/www/momvision-cms/server/uploads
MAX_FILE_SIZE=10485760
CORS_ORIGIN=*
EOF

# Crear directorio de uploads
mkdir -p uploads
chown -R www-data:www-data uploads

# Configurar Nginx
echo "🌐 Configurando Nginx..."
cat > /etc/nginx/sites-available/momvision-cms << 'EOF'
server {
    listen 80;
    server_name _;
    
    client_max_body_size 50M;

    # Frontend (React build)
    location / {
        root /var/www/momvision-cms/client/build;
        try_files $uri $uri/ /index.html;
        
        # Headers de seguridad
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        
        # Cache para archivos estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Demo endpoint
    location /demo {
        proxy_pass http://localhost:5000/demo;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads
    location /uploads/ {
        alias /var/www/momvision-cms/server/uploads/;
        expires 1y;
        add_header Cache-Control "public";
    }
}
EOF

# Activar sitio
ln -sf /etc/nginx/sites-available/momvision-cms /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Configurar PM2
echo "⚙️ Configurando PM2..."
cd /var/www/momvision-cms/server
pm2 start demo-server.js --name "momvision-cms"
pm2 startup
pm2 save

# Configurar firewall
echo "🔥 Configurando firewall..."
ufw --force enable
ufw allow OpenSSH
ufw allow 'Nginx Full'

# Crear script de actualización
echo "🔄 Creando script de actualización..."
cat > /var/www/momvision-cms/deploy.sh << 'EOF'
#!/bin/bash
echo "🔄 Actualizando MOM Vision CMS..."
cd /var/www/momvision-cms
git pull origin main
cd server && npm install --production
cd ../client && npm install && npm run build
pm2 restart momvision-cms
echo "✅ Actualización completada!"
EOF

chmod +x /var/www/momvision-cms/deploy.sh

# Obtener IP del servidor
SERVER_IP=$(curl -s https://ipv4.icanhazip.com/)

echo ""
echo "🎉 ¡INSTALACIÓN COMPLETADA!"
echo ""
echo "🌐 Tu CMS está disponible en:"
echo "   Frontend: http://$SERVER_IP"
echo "   Admin:    http://$SERVER_IP/admin"  
echo "   Demo:     http://$SERVER_IP/demo"
echo ""
echo "🔐 Credenciales por defecto:"
echo "   Usuario:  admin@momvision.com"
echo "   Password: admin123"
echo ""
echo "📋 Comandos útiles:"
echo "   Ver logs:       pm2 logs momvision-cms"
echo "   Estado:         pm2 status"
echo "   Reiniciar:      pm2 restart momvision-cms"
echo "   Actualizar:     /var/www/momvision-cms/deploy.sh"
echo ""
echo "🔒 Para configurar HTTPS:"
echo "   1. Apunta tu dominio a: $SERVER_IP"  
echo "   2. Ejecuta: certbot --nginx -d tudominio.com"
echo ""
echo "🚀 ¡MOM Vision CMS está funcionando!"