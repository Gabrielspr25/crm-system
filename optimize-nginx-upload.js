
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 OPTIMIZANDO NGINX PARA UPLOADS GRANDES...\n');

    // Usamos sed para insertar las directivas dentro del bloque server { ... listen 443 ... }
    // O simplemente reescribimos el archivo para estar seguros (más seguro reescribir con cat)

    const cmd = `
cat > /etc/nginx/sites-available/crmp.ss-group.cloud << 'EOF'
server {
    server_name crmp.ss-group.cloud www.crmp.ss-group.cloud;
    
    # ROOT correcto donde movimos los archivos
    root /opt/crmp/dist/client;
    index index.html;

    # AUMENTAR LÍMITES DE SUBIDA Y TIMEOUTS
    client_max_body_size 100M;
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;

    # Compresión Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml;
    gzip_disable "MSIE [1-6]\.";

    location / {
        try_files $uri $uri/ /index.html;
        # Cache control menos agresivo para uso normal, pero no-cache para index
        location = /index.html {
            add_header Cache-Control "no-store, no-cache, must-revalidate";
        }
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization; 
        
        # Timeouts también aquí
        proxy_read_timeout 300s;
    }

    # Certificados SSL (Mantenemos los paths originales)
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/crmp.ss-group.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crmp.ss-group.cloud/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = crmp.ss-group.cloud) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name crmp.ss-group.cloud www.crmp.ss-group.cloud;
    return 404;
}
EOF

# Verificar y Reiniciar
nginx -t && systemctl restart nginx
echo "✅ Configuración NGINX optimizada aplicada."
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
