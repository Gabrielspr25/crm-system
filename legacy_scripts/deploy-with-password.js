import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

const SERVER = {
    host: '143.244.191.139',
    user: 'root',
    password: process.env.CRM_SERVER_PASS,
    path: '/root/VentasProui'
};

console.log('🚀🚀🚀 DEPLOY AUTOMÁTICO v5.1.37 🚀🚀🚀\n');

async function deploy() {
    if (!SERVER.password) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        SERVER.password = await new Promise(resolve => {
            rl.question('🔑 Contraseña no detectada en env. Ingrésala: ', (pwd) => {
                rl.close();
                resolve(pwd);
            });
        });
        console.log('\n');
    }

    try {
        console.log('[1/6] Empaquetando...');
        await execAsync('tar -czf project.tar.gz --exclude=node_modules --exclude=dist --exclude=.git .');
        console.log('✅\n');

        console.log('[2/6] Subiendo con sshpass...');
        await execAsync(`sshpass -p "${SERVER.password}" scp -o StrictHostKeyChecking=no project.tar.gz ${SERVER.user}@${SERVER.host}:/tmp/`);
        console.log('✅\n');

        console.log('[3/6] Creando script...');
        const script = `#!/bin/bash
set -e
mkdir -p ${SERVER.path}
cd ${SERVER.path}
tar -xzf /tmp/project.tar.gz
npm install
npm run build
cat > /etc/nginx/sites-available/ventaspro << 'EOF'
server {
    listen 80;
    root ${SERVER.path}/dist;
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
echo "✅ DEPLOY COMPLETADO"
`;
        fs.writeFileSync('deploy.sh', script);
        console.log('✅\n');

        console.log('[4/6] Subiendo script...');
        await execAsync(`sshpass -p "${SERVER.password}" scp -o StrictHostKeyChecking=no deploy.sh ${SERVER.user}@${SERVER.host}:/tmp/`);
        console.log('✅\n');

        console.log('[5/6] Ejecutando deploy (3-5 min)...');
        const { stdout } = await execAsync(`sshpass -p "${SERVER.password}" ssh -o StrictHostKeyChecking=no ${SERVER.user}@${SERVER.host} "bash /tmp/deploy.sh"`, {
            maxBuffer: 10 * 1024 * 1024
        });
        console.log(stdout);

        console.log('[6/6] Limpiando...');
        fs.unlinkSync('project.tar.gz');
        fs.unlinkSync('deploy.sh');
        console.log('✅\n');

        console.log('━'.repeat(60));
        console.log('✅✅✅ DEPLOY EXITOSO v5.1.36 ✅✅✅');
        console.log('━'.repeat(60));
        console.log('\n🌐 https://crmp.ss-group.cloud/');
        console.log('🔧 Abre en INCÓGNITO y presiona Ctrl+Shift+R\n');

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        
        if (error.message.includes('sshpass')) {
            console.log('\n⚠️  sshpass no instalado. Instalando...');
            console.log('Ejecuta: choco install sshpass\n');
        }
    }
}

deploy();
