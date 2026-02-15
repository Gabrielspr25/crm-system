import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

const SERVER_CONFIG = {
    host: '143.244.191.139',
    user: 'root',
    password: 'CL@70049ro',
    projectPath: '/var/www/VentasProui'
};

console.log('🚀🚀🚀 PREPARANDO DEPLOY A DIGITAL OCEAN 🚀🚀🚀\n');
console.log(`📡 Servidor: ${SERVER_CONFIG.host}`);
console.log(`👤 Usuario: ${SERVER_CONFIG.user}\n`);

const deployScript = `#!/bin/bash
set -e
cd ${SERVER_CONFIG.projectPath}
echo "🔥 [1/10] Deteniendo servicios..."
pm2 stop all
echo "🔥 [2/10] Configurando NGINX sin cache..."
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root ${SERVER_CONFIG.projectPath}/dist;
    index index.html;
    location / {
        try_files \\$uri \\$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    location ~* \\.(js|css)\\$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
    }
}
EOFNGINX
echo "🔥 [3/10] Activando configuración..."
ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default
echo "🔥 [4/10] Limpiando cache NGINX..."
rm -rf /var/cache/nginx/*
echo "🔥 [5/10] Recargando NGINX..."
nginx -t && systemctl reload nginx
echo "🔥 [6/10] Limpiando builds anteriores..."
rm -rf dist node_modules/.vite .vite
echo "🔥 [7/10] Building proyecto..."
npm run build
echo "🔥 [8/10] Verificando versión..."
grep -o "V5\\.1\\.[0-9]*" dist/assets/*.js | head -n 3
echo "🔥 [9/10] Reiniciando servicios..."
pm2 restart all
pm2 save
echo ""
echo "✅✅✅ DEPLOY COMPLETADO ✅✅✅"
`;

async function deployToServer() {
    try {
        console.log('📝 Creando script de deploy temporal...\n');

        // Crear script temporal
        const scriptPath = path.join(__dirname, 'deploy-temp.sh');
        fs.writeFileSync(scriptPath, deployScript);

        console.log('📤 Subiendo script al servidor...\n');

        // Subir script al servidor
        const scpCommand = `scp "${scriptPath}" ${SERVER_CONFIG.user}@${SERVER_CONFIG.host}:/tmp/deploy-ventaspro.sh`;
        await execAsync(scpCommand);

        console.log('🔄 Ejecutando deploy en el servidor...\n');
        console.log('⏳ Esto puede tardar 2-3 minutos...\n');
        console.log('━'.repeat(60) + '\n');

        // Ejecutar script en el servidor
        const sshCommand = `ssh ${SERVER_CONFIG.user}@${SERVER_CONFIG.host} "chmod +x /tmp/deploy-ventaspro.sh && /tmp/deploy-ventaspro.sh"`;
        const { stdout, stderr } = await execAsync(sshCommand, {
            maxBuffer: 1024 * 1024 * 10
        });

        console.log('📋 RESULTADO DEL DEPLOY:\n');
        console.log(stdout);

        if (stderr && !stderr.includes('Warning')) {
            console.log('\n⚠️  Warnings:\n', stderr);
        }

        // Limpiar script temporal
        fs.unlinkSync(scriptPath);

        console.log('\n' + '━'.repeat(60));
        console.log('✅✅✅ DEPLOY COMPLETADO EXITOSAMENTE ✅✅✅');
        console.log('━'.repeat(60) + '\n');
        console.log('🌐 Abre en MODO INCÓGNITO: http://143.244.191.139');
        console.log('🔍 DevTools (F12) → Consola → Verifica: V5.1.35+\n');
        console.log(`🔑 Contraseña usada: ${SERVER_CONFIG.password}\n`);

    } catch (error) {
        console.error('\n❌ ERROR durante el deploy:');
        console.error(error.message);
        console.log('\n' + '━'.repeat(60));
        console.log('📋 COMANDO MANUAL:');
        console.log('━'.repeat(60) + '\n');
        console.log(`ssh ${SERVER_CONFIG.user}@${SERVER_CONFIG.host}`);
        console.log(`🔑 Contraseña: ${SERVER_CONFIG.password}\n`);
        console.log('Luego copia y pega:\n');
        console.log(deployScript);
        console.log('\n' + '━'.repeat(60) + '\n');
    }
}

deployToServer();
