import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

console.log('🚀🚀🚀 DEPLOY AUTOMÁTICO v5.1.37 - FIX CAMPOS 🚀🚀🚀\n');

async function deploy() {
    try {
        console.log('[1/6] Empaquetando...');
        await execAsync('tar -czf project.tar.gz --exclude=node_modules --exclude=dist --exclude=.git .');
        console.log('✅\n');

        console.log('[2/6] Subiendo...');
        await execAsync('scp project.tar.gz ventaspro-server:/tmp/');
        console.log('✅\n');

        console.log('[3/6] Script...');
        const script = `#!/bin/bash
set -e
mkdir -p /root/VentasProui
cd /root/VentasProui
tar -xzf /tmp/project.tar.gz
npm install
npm run build
cat > /etc/nginx/sites-available/ventaspro << 'EOF'
server {
    listen 80;
    root /root/VentasProui/dist;
    index index.html;
    location / {
        try_files \\$uri \\$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
EOF
ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
rm -rf /var/cache/nginx/*
systemctl reload nginx
pm2 restart all
echo "✅ LISTO"
`;
        fs.writeFileSync('deploy.sh', script);
        console.log('✅\n');

        console.log('[4/6] Subiendo script...');
        await execAsync('scp deploy.sh ventaspro-server:/tmp/');
        console.log('✅\n');

        console.log('[5/6] Ejecutando...');
        const { stdout } = await execAsync('ssh ventaspro-server "bash /tmp/deploy.sh"', { maxBuffer: 10485760 });
        console.log(stdout);

        console.log('[6/6] Limpiando...');
        fs.unlinkSync('project.tar.gz');
        fs.unlinkSync('deploy.sh');
        console.log('✅\n');

        console.log('✅✅✅ DEPLOY EXITOSO ✅✅✅');
        console.log('🌐 https://crmp.ss-group.cloud/');
        console.log('🔧 ARREGLADO: Campos Empresa/Dueño corregidos\n');

    } catch (error) {
        console.error('❌', error.message);
    }
}

deploy();
