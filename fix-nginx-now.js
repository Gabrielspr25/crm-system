
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: process.env.DEPLOY_SSH_PASS || 'CL@70049ro'
};

const commands = [
    'echo "🔧 Reconfigurando NGINX..."',
    'cat > /etc/nginx/sites-available/ventaspro << \'EOFNGINX\'',
    'server {',
    '    listen 80;',
    '    server_name _;',
    '    root /var/www/VentasProui/dist/client;',
    '    index index.html;',
    '    location / {',
    '        try_files $uri $uri/ /index.html;',
    '        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";',
    '        add_header Pragma "no-cache";',
    '        add_header Expires "0";',
    '    }',
    '    location ~* \\.(js|css)$ {',
    '        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";',
    '    }',
    '}',
    'EOFNGINX',
    '',
    'echo "🔧 Activando configuración..."',
    'ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro',
    'rm -f /etc/nginx/sites-enabled/default',
    '',
    'echo "🔧 Limpiando cache..."',
    'rm -rf /var/cache/nginx/*',
    '',
    'echo "🔧 Testeando y recargando NGINX..."',
    'nginx -t && systemctl reload nginx',
    '',
    'echo "✅ NGINX reconfigurado para servir desde dist/client"'
];

const conn = new Client();
conn.on('ready', () => {
    console.log('Aplicando fix de NGINX...\n');
    const script = commands.join('\n');

    conn.exec(script, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log('\n✅ Fix aplicado. Recarga el navegador en modo incógnito.');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
