import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

console.log('🚀 DEPLOYANDO VERSIÓN 2026-177 DESDE GITHUB...\n');

async function deployFromGitHub() {
    try {
        const SERVER = '143.244.191.139';
        const USER = 'root';
        const PASSWORD = 'CL@70049ro';

        const deployCommands = `
cd /var/www/VentasProui

echo "📥 [1/6] Pulling latest code from GitHub..."
git pull origin main

echo "📦 [2/6] Installing dependencies..."
npm install --legacy-peer-deps

echo "🔨 [3/6] Building frontend..."
npm run build

echo "🔧 [4/6] Configuring NGINX..."
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root /var/www/VentasProui/dist;
    index index.html;
    
    location / {
        try_files \\$uri \\$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \\$host;
    }
}
EOFNGINX

ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
nginx -t && systemctl reload nginx

echo "🔄 [5/6] Restarting backend..."
pm2 restart all

echo "✅ [6/6] Verifying..."
echo "Backend version:"
grep '"version"' package.json
echo ""
echo "Frontend files:"
ls -lh dist/*.html 2>/dev/null || ls -lh dist/client/*.html 2>/dev/null || echo "Checking subdirs..."
find dist -name "index.html" -type f

echo ""
echo "✅✅✅ DEPLOY COMPLETADO ✅✅✅"
echo "🌐 http://143.244.191.139"
`;

        console.log('Ejecutando comandos en el servidor...\n');
        console.log('═'.repeat(60));

        const sshCommand = `sshpass -p "${PASSWORD}" ssh -o StrictHostKeyChecking=no ${USER}@${SERVER} '${deployCommands}'`;

        const { stdout, stderr } = await execPromise(sshCommand, {
            maxBuffer: 10 * 1024 * 1024
        });

        console.log(stdout);
        if (stderr && !stderr.includes('warn')) {
            console.log('Warnings:', stderr);
        }

        console.log('═'.repeat(60));
        console.log('\n✅ Deploy completado. Abre en INCÓGNITO: http://143.244.191.139\n');

    } catch (error) {
        if (error.message.includes('sshpass')) {
            console.log('\n⚠️  sshpass no disponible. Ejecuta manualmente:\n');
            console.log('ssh root@143.244.191.139');
            console.log('Password: CL@70049ro\n');
            console.log('Luego ejecuta:');
            console.log('cd /var/www/VentasProui');
            console.log('git pull origin main');
            console.log('npm install --legacy-peer-deps');
            console.log('npm run build');
            console.log('pm2 restart all');
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

deployFromGitHub();
