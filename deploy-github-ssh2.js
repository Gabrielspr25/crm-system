
import { Client } from 'ssh2';
import fs from 'fs';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const commands = [
    'echo "📥 [1/6] Pulling from GitHub..."',
    'cd /var/www/VentasProui',
    'git pull origin main',
    '',
    'echo "📦 [2/6] Installing dependencies..."',
    'npm install --legacy-peer-deps',
    '',
    'echo "🔨 [3/6] Building frontend..."',
    'npm run build',
    '',
    'echo "🔧 [4/6] Configuring NGINX..."',
    'cat > /etc/nginx/sites-available/ventaspro << \'EOFNGINX\'',
    'server {',
    '    listen 80;',
    '    server_name _;',
    '    root /var/www/VentasProui/dist;',
    '    index index.html;',
    '    location / {',
    '        try_files $uri $uri/ /index.html;',
    '        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";',
    '    }',
    '    location /api {',
    '        proxy_pass http://localhost:3001;',
    '        proxy_http_version 1.1;',
    '        proxy_set_header Host $host;',
    '    }',
    '}',
    'EOFNGINX',
    '',
    'ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro',
    'nginx -t && systemctl reload nginx',
    '',
    'echo "🔄 [5/6] Restarting PM2..."',
    'pm2 restart all',
    '',
    'echo "✅ [6/6] Verification..."',
    'grep \\"version\\" package.json',
    'find dist -name "index.html" | head -5',
    '',
    'echo ""',
    'echo "✅✅✅ DEPLOY COMPLETADO ✅✅✅"',
    'echo "🌐 http://143.244.191.139"'
];

console.log('🚀 DEPLOYANDO VERSIÓN 2026-177 DESDE GITHUB...\n');

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ Conexión SSH establecida\n');
    console.log('═'.repeat(60));

    const script = commands.join('\n');

    conn.exec(script, (err, stream) => {
        if (err) throw err;

        stream.on('close', (code) => {
            console.log('\n' + '═'.repeat(60));
            if (code === 0) {
                console.log('\n✅✅✅ DEPLOY EXITOSO ✅✅✅');
                console.log('🌐 Abre en INCÓGNITO: http://143.244.191.139\n');
            } else {
                console.log('\n❌ Deploy falló con código:', code);
            }
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write('STDERR: ' + data);
        });
    });
}).on('error', (err) => {
    console.error('❌ Error de conexión:', err.message);
}).connect(config);
