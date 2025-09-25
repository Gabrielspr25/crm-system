# 🖥️ DEPLOY MANUAL PROFESIONAL EN SERVIDOR

## 🎯 CONFIGURACIÓN DE DROPLET

### Crear Droplet en DigitalOcean:
1. **Imagen**: Ubuntu 22.04 LTS
2. **Tamaño**: Basic - $6/mes (1 vCPU, 1GB RAM, 25GB SSD)
3. **Región**: New York 3 (o más cerca de tu ubicación)
4. **SSH Key**: Agregar tu clave SSH
5. **Hostname**: momvision-cms

## 🔧 CONFIGURACIÓN INICIAL DEL SERVIDOR

### Conexión SSH:
```bash
ssh root@tu_ip_del_droplet
```

### Actualización del sistema:
```bash
apt update && apt upgrade -y
apt install -y curl wget git nginx certbot python3-certbot-nginx
```

### Instalar Node.js 18 LTS:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs
node --version  # Verificar v18.x
npm --version   # Verificar v9.x
```

### Instalar PostgreSQL:
```bash
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# Configurar base de datos
sudo -u postgres psql
CREATE DATABASE momvision_cms;
CREATE USER momvision WITH ENCRYPTED PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE momvision_cms TO momvision;
\q
```

### Instalar PM2 (Process Manager):
```bash
npm install -g pm2
```

## 📂 DEPLOY DE LA APLICACIÓN

### Clonar repositorio:
```bash
cd /var/www/
git clone https://github.com/Gabrielspr25/crm-system.git
mv crm-system momvision-cms
cd momvision-cms
chown -R www-data:www-data /var/www/momvision-cms
```

### Instalar dependencias:
```bash
cd /var/www/momvision-cms/server
npm install --production
cd ../client
npm install
npm run build
```

### Configurar variables de entorno:
```bash
cd /var/www/momvision-cms/server
nano .env
```

#### Contenido del .env:
```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://momvision:tu_password_seguro@localhost:5432/momvision_cms
JWT_SECRET=momvision_jwt_secret_2024_production_secure
UPLOAD_DIR=/var/www/momvision-cms/server/uploads
MAX_FILE_SIZE=10485760
CORS_ORIGIN=https://cms.momvision.com
```

### Configurar PM2:
```bash
cd /var/www/momvision-cms/server
pm2 start index.js --name "momvision-cms"
pm2 startup
pm2 save
```

## 🌐 CONFIGURACIÓN DE NGINX

### Archivo de configuración:
```bash
nano /etc/nginx/sites-available/momvision-cms
```

#### Contenido:
```nginx
server {
    listen 80;
    server_name cms.momvision.com;

    # Frontend (React build)
    location / {
        root /var/www/momvision-cms/client/build;
        try_files $uri $uri/ /index.html;
        
        # Cache estático
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Admin routes
    location /admin {
        root /var/www/momvision-cms/client/build;
        try_files $uri $uri/ /index.html;
    }

    # Uploads
    location /uploads/ {
        alias /var/www/momvision-cms/server/uploads/;
        expires 1y;
        add_header Cache-Control "public";
    }
}
```

### Activar sitio:
```bash
ln -s /etc/nginx/sites-available/momvision-cms /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## 🔒 CONFIGURAR SSL (HTTPS)

### Obtener certificado Let's Encrypt:
```bash
certbot --nginx -d cms.momvision.com
```

## 🔥 CONFIGURAR FIREWALL

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

## 📊 MONITOREO Y LOGS

### Ver logs de la aplicación:
```bash
pm2 logs momvision-cms
```

### Ver logs de Nginx:
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Estado del servidor:
```bash
pm2 status
systemctl status nginx
systemctl status postgresql
```

## 🔄 DEPLOY DE ACTUALIZACIONES

### Script de actualización:
```bash
nano /var/www/momvision-cms/deploy.sh
```

#### Contenido:
```bash
#!/bin/bash
cd /var/www/momvision-cms
git pull origin main
cd server && npm install --production
cd ../client && npm install && npm run build
pm2 restart momvision-cms
echo "✅ Deploy completado!"
```

```bash
chmod +x /var/www/momvision-cms/deploy.sh
```

### Para actualizar:
```bash
/var/www/momvision-cms/deploy.sh
```

## 🎯 ACCESO FINAL

- **Frontend**: https://cms.momvision.com
- **Admin**: https://cms.momvision.com/admin
- **API**: https://cms.momvision.com/api

### Credenciales:
- **Usuario**: admin@momvision.com
- **Password**: admin123

## ⚡ OPTIMIZACIONES ADICIONALES

### Configurar swap (si tienes 1GB RAM):
```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Backup automático:
```bash
crontab -e
# Agregar: 0 2 * * * pg_dump momvision_cms > /var/backups/momvision_$(date +%Y%m%d).sql
```

¡Tu CMS profesional estará funcionando en tu propio servidor! 🚀