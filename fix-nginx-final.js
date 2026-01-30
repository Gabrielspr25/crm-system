import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: process.env.DEPLOY_SSH_PASS || 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔧 Buscando archivos del build y reconfigurando NGINX...\n');

    const cmd = `
echo "=== Buscando index.html ==="
find /var/www/VentasProui/dist -name "index.html" -type f

echo -e "\n=== Estructura de dist/ ==="
ls -R /var/www/VentasProui/dist/ | head -50

echo -e "\n=== Reconfigurando NGINX para servir desde dist/ directamente ==="
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root /var/www/VentasProui/dist;
    index index.html;
    
    location / {
        try_files \\$uri \\$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    location ~* \\.(js|css)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
    }
}
EOFNGINX

ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo -e "\n✅ NGINX reconfigurado"
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('\n✅ Diagnóstico y reconfiguración completados');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
