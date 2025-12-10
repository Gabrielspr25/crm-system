import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

console.log('🚀 INICIANDO DEPLOY AUTOMÁTICO CON LIMPIEZA TOTAL DE CACHÉ...\n');

const SERVER = '143.244.191.139';
const USER = 'root';
const PASSWORD = 'CL@70049ro';
const PROJECT_PATH = '/var/www/VentasProui';

// Script mejorado que se ejecutará en el servidor
const deployScript = `
cd ${PROJECT_PATH}

echo "🧹 [1/7] Deteniendo servicios..."
pm2 stop all

echo "🗑️ [2/7] Limpiando caché de NGINX..."
rm -rf /var/cache/nginx/*
rm -rf /var/lib/nginx/cache/*

echo "🗑️ [3/7] Limpiando caché de Node y Vite..."
rm -rf dist node_modules/.vite .vite .cache

echo "🔄 [4/7] Actualizando código desde Git..."
git pull origin main

echo "📦 [5/7] Reinstalando dependencias..."
npm ci --force

echo "🏗️ [6/7] Construyendo con hash único..."
# Generar timestamp único para forzar rebuild completo
export VITE_BUILD_ID=$(date +%s)
npm run build

echo "✅ [7/7] Verificando versión compilada..."
grep -o "V5\\.1\\.[0-9]*" dist/assets/*.js | head -n 5

echo "🔧 Configurando NGINX sin caché..."
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root ${PROJECT_PATH}/dist;
    index index.html;

    # Deshabilitar completamente el caché
    add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, proxy-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # ETag único por build
    etag on;
    if_modified_since off;

    location / {
        try_files \\$uri \\$uri/ /index.html;
    }

    location ~* \\.(js|css|json|woff|woff2|ttf|svg|png|jpg|jpeg|gif|ico)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
        expires -1;
    }
}
EOFNGINX

ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default

echo "🔄 Recargando NGINX..."
nginx -t && systemctl reload nginx

echo "🚀 Reiniciando aplicación..."
pm2 restart all
pm2 save

echo ""
echo "✅ DEPLOY COMPLETADO"
echo "📌 Versión desplegada:"
cat ${PROJECT_PATH}/package.json | grep '"version"'
echo ""
echo "🌐 IMPORTANTE: Abre en modo INCÓGNITO o presiona Ctrl+Shift+R"
echo "🔗 URL: http://${SERVER}"
echo ""
echo "🔍 En la consola del navegador debería aparecer la nueva versión"
`;

console.log('[1/3] Preparando conexión SSH...');

const commandWithPassword = `sshpass -p "${PASSWORD}" ssh -o StrictHostKeyChecking=no ${USER}@${SERVER} '${deployScript.replace(/'/g, "'\\''")}' `;

console.log('[2/3] Ejecutando deploy en servidor...\n');

try {
    const { stdout, stderr } = await execPromise(commandWithPassword, { 
        maxBuffer: 1024 * 1024 * 10,
        shell: true 
    });

    console.log('[3/3] Resultado del deploy:\n');
    console.log(stdout);
    
    if (stderr && !stderr.includes('Cloning into')) {
        console.log('\n⚠️ Warnings:\n', stderr);
    }

    console.log('\n✅ DEPLOY COMPLETADO EXITOSAMENTE');
    console.log('🌐 URL: http://143.244.191.139');
    console.log('\n⚠️ IMPORTANTE PARA VER LOS CAMBIOS:');
    console.log('   1. Abre en modo INCÓGNITO (Ctrl+Shift+N en Chrome)');
    console.log('   2. O presiona Ctrl+Shift+R para forzar recarga');
    console.log('   3. Abre DevTools (F12) > Application > Clear Storage > Clear site data');
    console.log('\n🔍 En consola del navegador debe decir V5.1.29 o superior\n');

} catch (error) {
    console.error('❌ ERROR durante el deploy:');
    console.error(error.message);
    
    if (error.message.includes('sshpass')) {
        console.log('\n⚠️ sshpass no está instalado.');
        console.log('\n📋 ALTERNATIVA - Ejecuta esto MANUALMENTE:\n');
        console.log(`ssh ${USER}@${SERVER}`);
        console.log(`Contraseña: ${PASSWORD}\n`);
        console.log('Luego copia y pega esto:\n');
        console.log(deployScript);
    }
}
