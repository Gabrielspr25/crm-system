
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔥 LIMPIEZA TOTAL DE NGINX 🔥\n');

    const cmd = `
# 1. Eliminar ALIAS y sitios viejos
rm -f /etc/nginx/sites-enabled/*
rm -f /etc/nginx/sites-available/default
rm -f /etc/nginx/sites-available/ventaspro

# 2. Crear configuración ÚNICA y CORRECTA
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80 default_server;
    server_name _;
    
    # Raíz confirmada donde subimos los archivos
    root /var/www/VentasProui/dist;
    index index.html;
    
    # Renderizado SPA
    location / {
        try_files $uri $uri/ /index.html;
        
        # Desactivar caché agresivamente para HTML
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    # Archivos estáticos con caché controlado
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # API Proxy - CRÍTICO: Pasar headers de Auth
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # IMPORTANTE: Asegurar que Authorization pasa
        proxy_set_header Authorization $http_authorization;
        proxy_pass_header Authorization;
    }
}
EOFNGINX

# 3. Enlazar y reiniciar
ln -s /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

echo "✅ NGINX Reiniciado por completo"
echo "🌐 Ruta actual: $(grep 'root' /etc/nginx/sites-enabled/ventaspro)"
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('\nConfiguración aplicada.');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
