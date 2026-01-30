
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: process.env.DEPLOY_SSH_PASS || 'CL@70049ro', // Fallback for immediate execution
    remotePath: '/var/www/VentasProui'
};

const commands = [
    'echo "🔥 [1/8] Descomprimiendo..."',
    'mkdir -p /var/www/VentasProui',
    'cd /var/www/VentasProui',
    'tar -xzf deploy.tar.gz',
    'rm deploy.tar.gz',

    'echo "🔥 [2/8] Instalando dependencias..."',
    'npm install --legacy-peer-deps', // Ensure we use legacy-peer-deps remotely too just in case

    'echo "🔥 [3/8] Building proyecto..."',
    'rm -rf dist',
    'npm run build',

    'echo "🔥 [4/8] Configurando NGINX..."',
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
    '    location ~* \.(js|css)$ {',
    '        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";',
    '    }',
    '}',
    'EOFNGINX',

    'ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro',
    'rm -f /etc/nginx/sites-enabled/default',
    'nginx -t && systemctl reload nginx',

    'echo "🔥 [5/8] Reiniciando Backend..."',
    'pm2 stop all || true',
    'pm2 delete all || true',
    'cd /var/www/VentasProui',
    'pm2 start server-FINAL.js --name "ventaspro-backend"',
    'pm2 save',

    'echo "🔥 [6/8] Verificando..."',
    'grep -o "V5\.1\.[0-9]*" dist/assets/*.js | head -n 1',
    'echo "✅ DEPLOY FINALIZADO"'
];

async function deploy() {
    console.log('🚀 INICIANDO DEPLOY SEGURO (SSH2)...');

    // 1. Tarball
    console.log('[1/4] Comprimiendo archivos locales...');
    try {
        if (fs.existsSync('deploy.tar.gz')) fs.unlinkSync('deploy.tar.gz');
        // Exclude huge folders
        await execPromise('tar -czf deploy.tar.gz --exclude=node_modules --exclude=dist --exclude=.git --exclude=.vite .');
    } catch (e) {
        console.error('Error comprimiendo:', e);
        process.exit(1);
    }

    const conn = new Client();

    conn.on('ready', () => {
        console.log('[2/4] Conexión SSH establecida.');

        // 2. Upload
        conn.sftp((err, sftp) => {
            if (err) throw err;
            console.log('[3/4] Subiendo deploy.tar.gz al servidor...');

            sftp.fastPut('deploy.tar.gz', '/var/www/VentasProui/deploy.tar.gz', {}, (err) => {
                if (err) throw err;
                console.log('✅ Archivo subido.');

                // 3. Execute
                console.log('[4/4] Ejecutando comandos remotos...');

                // Join commands into a single script string
                const script = commands.join('\n');

                conn.exec(script, (err, stream) => {
                    if (err) throw err;

                    stream.on('close', (code, signal) => {
                        console.log('SSH Stream Close: code ' + code + ', signal ' + signal);
                        conn.end();
                        // Cleanup local
                        fs.unlinkSync('deploy.tar.gz');
                        if (code === 0) {
                            console.log('\n✅✅✅ DEPLOY EXITOSO ✅✅✅');
                            console.log('🌐 http://143.244.191.139');
                        } else {
                            console.error('❌ Falló la ejecución remota.');
                        }
                    }).on('data', (data) => {
                        process.stdout.write(data);
                    }).stderr.on('data', (data) => {
                        process.stderr.write(data);
                    });
                });
            });
        });
    }).connect(config);

    conn.on('error', (err) => {
        console.error('Connection Error:', err);
    });
}

deploy();
