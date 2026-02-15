import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

console.log('🚀 INICIANDO DEPLOY AUTOMÁTICO A DIGITAL OCEAN...\n');

const SERVER = '143.244.191.139';
const USER = 'root';
const PASSWORD = 'CL@70049ro';
const PROJECT_PATH = '/var/www/VentasProui';

// Script que se ejecutará en el servidor
const deployScript = `
cd ${PROJECT_PATH}

# Configurar NGINX sin cache
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root ${PROJECT_PATH}/dist;
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
}
EOFNGINX

ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default
rm -rf /var/cache/nginx/*
nginx -t && systemctl reload nginx

# Rebuild proyecto
pm2 stop all
rm -rf dist node_modules/.vite .vite
npm run build
echo "===== VERIFICANDO VERSIÓN ====="
grep -o "V5\\.1\\.[0-9]*" dist/assets/*.js | head -n 3
pm2 restart all
pm2 save

echo ""
echo "✅ DEPLOY COMPLETADO"
echo "🌐 Abre en INCÓGNITO: http://${SERVER}"
`;

console.log('[1/3] Preparando conexión SSH...');

// Intentar con sshpass primero
const commandWithPassword = `sshpass -p "${PASSWORD}" ssh -o StrictHostKeyChecking=no ${USER}@${SERVER} '${deployScript.replace(/'/g, "'\\''")}'`;

console.log('[2/3] Ejecutando deploy en servidor...\n');

try {
    const { stdout, stderr } = await execPromise(commandWithPassword, { 
        maxBuffer: 1024 * 1024 * 10,
        shell: true 
    });

    console.log('[3/3] Resultado del deploy:\n');
    console.log(stdout);
    
    if (stderr) {
        console.log('\n⚠️ Warnings:\n', stderr);
    }

    console.log('\n✅ DEPLOY COMPLETADO EXITOSAMENTE');
    console.log('🌐 Abre en INCÓGNITO: http://143.244.191.139');
    console.log('🔍 Verifica en consola que diga: V5.1.37 o superior\n');

} catch (error) {
    console.error('❌ ERROR durante el deploy:');
    console.error(error.message);
    
    // Si falla sshpass, dar alternativa
    if (error.message.includes('sshpass')) {
        console.log('\n⚠️ sshpass no está instalado.');
        console.log('\n📋 ALTERNATIVA - Ejecuta esto MANUALMENTE:\n');
        console.log(`ssh ${USER}@${SERVER}`);
        console.log(`Contraseña: ${PASSWORD}\n`);
        console.log('Luego copia y pega esto:\n');
        console.log(deployScript);
    }
}
