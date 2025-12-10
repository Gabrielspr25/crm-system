import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🔥 GENERANDO COMANDO DE DEPLOY...\n');

const SERVER = '143.244.191.139';
const USER = 'root';
const PASSWORD = 'CL@70049ro';
const PROJECT_PATH = '/var/www/VentasProui';

const deployScript = `
cd ${PROJECT_PATH}
pm2 stop all
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root ${PROJECT_PATH}/dist;
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
rm -rf /var/cache/nginx/*
nginx -t && systemctl reload nginx
rm -rf dist node_modules/.vite .vite
npm run build
grep "V5.1.3" dist/assets/*.js | head -n 1
pm2 restart all
pm2 save
echo "DEPLOY COMPLETADO - Abre http://${SERVER} en INCOGNITO"
`.trim();

const sshCommand = `ssh ${USER}@${SERVER} "${deployScript.replace(/"/g, '\\"')}"`;

console.log('============================================');
console.log('📋 COMANDO GENERADO - COPIA Y PEGA ESTO:');
console.log('============================================\n');
console.log(sshCommand);
console.log('\n============================================');
console.log('🔑 Contraseña:', PASSWORD);
console.log('============================================\n');

// Guardar en archivo de texto
const commandFile = path.join(__dirname, 'COMANDO-DEPLOY.txt');
const fileContent = `
=================================================
COMANDO DE DEPLOY PARA DIGITAL OCEAN
=================================================

PASO 1: Abre PowerShell

PASO 2: Copia y pega este comando:

${sshCommand}

PASO 3: Cuando pida contraseña, ingresa:
${PASSWORD}

PASO 4: Espera que termine (tarda 2-3 minutos)

PASO 5: Abre en INCÓGNITO:
http://${SERVER}

PASO 6: Abre DevTools (F12) → Consola
Verifica que diga: V5.1.35 o superior

=================================================
`;

fs.writeFileSync(commandFile, fileContent);

console.log(`✅ Comando guardado en: ${commandFile}`);
console.log('\n📋 También puedes abrir ese archivo y copiar de ahí.\n');
