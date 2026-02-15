import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SERVER_CONFIG = {
    host: '143.244.191.139',
    user: 'root',
    password: 'CL@70049ro',
    projectPath: '/var/www/VentasProui'
};

const DEPLOY_SCRIPT = `
set -e
cd ${SERVER_CONFIG.projectPath}

echo "🔥 [1/8] Configurando NGINX sin cache..."
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

echo "🔥 [2/8] Activando configuración NGINX..."
ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default

echo "🔥 [3/8] Limpiando cache de NGINX..."
rm -rf /var/cache/nginx/*

echo "🔥 [4/8] Recargando NGINX..."
nginx -t && systemctl reload nginx

echo "🔥 [5/8] Deteniendo servicios..."
pm2 stop all

echo "🔥 [6/8] Limpiando cache de build..."
rm -rf dist node_modules/.vite .vite

echo "🔥 [7/8] Rebuilding proyecto..."
npm run build

echo "🔥 [8/8] Verificando versión en build..."
grep -o "V5\\.1\\.[0-9]*" dist/assets/*.js | head -n 3

echo "✅ Reiniciando servicios..."
pm2 restart all
pm2 save

echo ""
echo "✅✅✅ DEPLOY COMPLETADO ✅✅✅"
echo "🌐 URL: http://143.244.191.139"
echo "🔍 Verifica en consola: V5.1.35 o superior"
`;

async function deployToServer() {
    console.log('🚀 INICIANDO DEPLOY AUTOMÁTICO...\n');
    
    try {
        // Crear archivo temporal con el script
        const scriptCommand = `ssh ${SERVER_CONFIG.user}@${SERVER_CONFIG.host} 'bash -s' << 'EOFSCRIPT'\n${DEPLOY_SCRIPT}\nEOFSCRIPT\n`;
        
        console.log('📡 Conectando a Digital Ocean...');
        console.log(`🖥️  Servidor: ${SERVER_CONFIG.host}`);
        console.log(`👤 Usuario: ${SERVER_CONFIG.user}\n`);
        
        const { stdout, stderr } = await execAsync(scriptCommand, {
            maxBuffer: 1024 * 1024 * 10,
            shell: true
        });
        
        console.log('📋 RESULTADO DEL DEPLOY:\n');
        console.log(stdout);
        
        if (stderr && !stderr.includes('Warning')) {
            console.log('\n⚠️  Errores:\n', stderr);
        }
        
        console.log('\n✅✅✅ DEPLOY EXITOSO ✅✅✅');
        console.log('🌐 Abre en INCÓGNITO: http://143.244.191.139');
        console.log('🔍 Verifica en consola del navegador que diga: V5.1.35 o superior\n');
        
    } catch (error) {
        console.error('❌ ERROR durante el deploy:');
        console.error(error.message);
        
        console.log('\n⚠️  SOLUCIÓN MANUAL:');
        console.log(`\n1. Abre PowerShell y ejecuta:`);
        console.log(`   ssh ${SERVER_CONFIG.user}@${SERVER_CONFIG.host}`);
        console.log(`   Contraseña: ${SERVER_CONFIG.password}\n`);
        console.log(`2. Luego copia y pega este script:\n`);
        console.log(DEPLOY_SCRIPT);
    }
}

deployToServer();
