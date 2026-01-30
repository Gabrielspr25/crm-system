
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔧 Reconfigurando NGINX para servir desde dist/client/...\n');

    const cmd = `
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root /var/www/VentasProui/dist/client;
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
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
    }
}
EOFNGINX

echo "Testing NGINX config..."
nginx -t

echo "Reloading NGINX..."
systemctl reload nginx

echo "Clearing browser cache headers..."
rm -rf /var/cache/nginx/*

echo ""
echo "✅ NGINX reconfigurado para servir desde dist/client/"
echo "🌐 Abre en INCÓGNITO: http://143.244.191.139"
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            if (code === 0) {
                console.log('\n✅✅✅ NGINX RECONFIGURADO ✅✅✅');
                console.log('🌐 Recarga la página en modo INCÓGNITO\n');
            } else {
                console.log('\n❌ Error al reconfigurar NGINX');
            }
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write('STDERR: ' + data);
        });
    });
}).connect(config);
