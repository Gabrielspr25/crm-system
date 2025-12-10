import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

console.log('🚀🚀🚀 SUBIENDO CÓDIGO Y DEPLOYANDO 🚀🚀🚀\n');

async function uploadAndDeploy() {
    try {
        console.log('[1/5] Empaquetando proyecto...\n');
        
        // Crear tarball del proyecto (excluyendo node_modules y dist)
        await execAsync('tar -czf project.tar.gz --exclude=node_modules --exclude=dist --exclude=.git --exclude=.vite .');
        
        console.log('[2/5] Subiendo al servidor...\n');
        await execAsync('scp project.tar.gz ventaspro-server:/tmp/');
        
        console.log('[3/5] Descomprimiendo en servidor...\n');
        
        const deployScript = `
#!/bin/bash
set -e

# Crear directorio del proyecto si no existe
mkdir -p /root/VentasProui
cd /root/VentasProui

# Extraer código
tar -xzf /tmp/project.tar.gz

echo "🔥 [1/8] Instalando dependencias..."
npm install

echo "🔥 [2/8] Building proyecto..."
npm run build

echo "🔥 [3/8] Configurando NGINX..."
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root /root/VentasProui/dist;
    index index.html;
    
    location / {
        try_files \\$uri \\$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
    }
    
    location ~* \\.(js|css)\\$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
    }
}
EOFNGINX

ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default

echo "🔥 [4/8] Limpiando cache NGINX..."
rm -rf /var/cache/nginx/*

echo "🔥 [5/8] Recargando NGINX..."
nginx -t && systemctl reload nginx

echo "🔥 [6/8] Configurando PM2..."
pm2 delete all || true
pm2 start npm --name "ventaspro-backend" -- start
pm2 save

echo "🔥 [7/8] Verificando versión..."
grep -o "V5\\.1\\.[0-9]*" dist/assets/*.js | head -n 1

echo "🔥 [8/8] Limpiando archivos temporales..."
rm -f /tmp/project.tar.gz

echo ""
echo "✅✅✅ DEPLOY COMPLETADO ✅✅✅"
echo "📂 Proyecto en: /root/VentasProui"
echo "🌐 URL: http://143.244.191.139"
`;

        const scriptPath = path.join(__dirname, 'deploy-upload-temp.sh');
        fs.writeFileSync(scriptPath, deployScript);
        
        console.log('[4/5] Subiendo script de deploy...\n');
        await execAsync(`scp "${scriptPath}" ventaspro-server:/tmp/deploy-full.sh`);
        
        console.log('[5/5] Ejecutando deploy completo...\n');
        console.log('⏳ Esto puede tardar 3-5 minutos (instalando dependencias)...\n');
        console.log('━'.repeat(60) + '\n');
        
        const { stdout, stderr } = await execAsync('ssh ventaspro-server "bash /tmp/deploy-full.sh"', {
            maxBuffer: 1024 * 1024 * 10
        });
        
        console.log('📋 RESULTADO:\n');
        console.log(stdout);
        
        if (stderr && !stderr.includes('warn')) {
            console.log('\n⚠️ Warnings:', stderr);
        }
        
        // Limpiar archivos temporales locales
        fs.unlinkSync('project.tar.gz');
        fs.unlinkSync(scriptPath);
        
        console.log('\n' + '━'.repeat(60));
        console.log('✅✅✅ CÓDIGO SUBIDO Y DEPLOYADO ✅✅✅');
        console.log('━'.repeat(60) + '\n');
        console.log('🌐 Abre en INCÓGNITO: http://143.244.191.139');
        console.log('🔍 Verifica versión en consola: V5.1.35+\n');
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
    }
}

uploadAndDeploy();
