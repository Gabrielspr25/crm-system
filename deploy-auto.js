import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync } from 'fs';

const execPromise = promisify(exec);

console.log('🚀 DEPLOY AUTOMÁTICO A DIGITAL OCEAN\n');

const SERVER = '143.244.191.139';
const USER = 'root';
const PASSWORD = 'CL@70049ro';

// Script bash que se ejecutará en el servidor
const deployScript = `#!/bin/bash
cd /var/www/VentasProui || exit 1

echo "🧹 [1/7] Deteniendo servicios..."
pm2 stop all

echo "🗑️ [2/7] Limpiando caché NGINX..."
rm -rf /var/cache/nginx/* /var/lib/nginx/cache/* 2>/dev/null

echo "🗑️ [3/7] Limpiando caché Vite..."
rm -rf dist node_modules/.vite .vite .cache 2>/dev/null

echo "🔄 [4/7] Actualizando código..."
git pull origin main

echo "📦 [5/7] Instalando dependencias..."
npm ci --force

echo "🏗️ [6/7] Construyendo..."
export VITE_BUILD_ID=$(date +%s)
npm run build

echo "✅ [7/7] Verificando versión..."
grep -o "V5\\\\.1\\\\.[0-9]*" dist/assets/*.js 2>/dev/null | head -n 3

echo "🔧 Configurando NGINX..."
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root /var/www/VentasProui/dist;
    index index.html;
    add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    location / { try_files \\$uri \\$uri/ /index.html; }
    location ~* \\.(js|css|json|woff|woff2|ttf|svg|png|jpg|jpeg|gif|ico)\\$ {
        add_header Cache-Control "no-cache" always;
        expires -1;
    }
}
EOFNGINX

ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "🚀 Reiniciando app..."
pm2 restart all
pm2 save

echo ""
echo "✅ DEPLOY COMPLETADO"
cat /var/www/VentasProui/package.json | grep '"version"'
`;

// Guardar script temporal
const scriptPath = 'deploy-temp.sh';
writeFileSync(scriptPath, deployScript);

console.log('[1/3] Conectando al servidor...');

try {
    // Verificar si plink está disponible
    let plinkCommand = 'plink';
    try {
        await execPromise('plink -V');
    } catch {
        // Si plink no está en PATH, buscar en ubicaciones comunes
        const possiblePaths = [
            'C:\\Program Files\\PuTTY\\plink.exe',
            'C:\\Program Files (x86)\\PuTTY\\plink.exe',
            'C:\\ProgramData\\chocolatey\\bin\\plink.exe'
        ];
        
        for (const path of possiblePaths) {
            try {
                await execPromise(`"${path}" -V`);
                plinkCommand = `"${path}"`;
                break;
            } catch {}
        }
    }

    console.log('[2/3] Ejecutando deploy en servidor...\n');

    // Ejecutar con plink (auto-acepta host key con -batch)
    const command = `type ${scriptPath} | ${plinkCommand} -batch -ssh -pw ${PASSWORD} ${USER}@${SERVER} "bash -s"`;
    
    const { stdout, stderr } = await execPromise(command, {
        maxBuffer: 1024 * 1024 * 10,
        shell: true
    });

    console.log('[3/3] Resultado:\n');
    console.log(stdout);

    if (stderr && !stderr.includes('Warning')) {
        console.log('\n⚠️ Advertencias:', stderr);
    }

    console.log('\n✅ DEPLOY COMPLETADO EXITOSAMENTE');
    console.log('🌐 URL: http://143.244.191.139');
    console.log('\n⚠️ IMPORTANTE:');
    console.log('  1. Abre en modo INCÓGNITO (Ctrl+Shift+N)');
    console.log('  2. O presiona Ctrl+Shift+R para forzar recarga');
    console.log('  3. Verifica versión en consola F12\n');

} catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.message.includes('plink')) {
        console.log('\n⚠️ plink no encontrado.');
        console.log('\n📋 SOLUCIÓN:');
        console.log('  1. Instala PuTTY: choco install putty -y');
        console.log('  2. O descarga: https://www.putty.org/\n');
    }
    
    console.log('📋 ALTERNATIVA MANUAL:');
    console.log(`  ssh ${USER}@${SERVER}`);
    console.log(`  Contraseña: ${PASSWORD}`);
    console.log(`  Luego ejecuta: bash ${scriptPath}\n`);
}
