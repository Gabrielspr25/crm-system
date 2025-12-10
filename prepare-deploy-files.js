import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 PREPARANDO ARCHIVOS PARA DEPLOY...\n');

// 1. Crear script de deploy
const deployScript = `#!/bin/bash
# SCRIPT DE DEPLOY AUTOMÁTICO - v5.1.36

cd /var/www/VentasProui

echo "🔥 [1/10] Deteniendo servicios..."
pm2 stop all

echo "🔥 [2/10] Configurando NGINX sin cache..."
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root /var/www/VentasProui/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    location ~* \\.(js|css)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
}
EOFNGINX

echo "🔥 [3/10] Activando configuración..."
ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro
rm -f /etc/nginx/sites-enabled/default

echo "🔥 [4/10] Limpiando cache NGINX..."
rm -rf /var/cache/nginx/*
rm -rf /var/lib/nginx/cache/*

echo "🔥 [5/10] Recargando NGINX..."
nginx -t && systemctl reload nginx

echo "🔥 [6/10] Limpiando builds anteriores..."
rm -rf dist
rm -rf node_modules/.vite
rm -rf .vite

echo "🔥 [7/10] Instalando dependencias..."
npm install

echo "🔥 [8/10] Building proyecto..."
npm run build

echo "🔥 [9/10] Verificando versión..."
grep -o "V5\\.1\\.[0-9]*" dist/assets/*.js | head -n 3

echo "🔥 [10/10] Reiniciando servicios..."
pm2 restart all
pm2 save

echo ""
echo "✅✅✅ DEPLOY COMPLETADO ✅✅✅"
echo "🌐 URL: http://143.244.191.139"
echo "🔍 Abre en INCÓGNITO y verifica: V5.1.36"
`;

// 2. Guardar script
const deployScriptPath = path.join(__dirname, 'deploy-to-server.sh');
fs.writeFileSync(deployScriptPath, deployScript);

// 3. Crear instrucciones
const instructions = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  INSTRUCCIONES DE DEPLOY - Digital Ocean
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ ARCHIVOS PREPARADOS:
   • deploy-to-server.sh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 COPIA Y PEGA ESTOS 4 COMANDOS EN POWERSHELL:

1️⃣  Subir script al servidor:
scp deploy-to-server.sh root@143.244.191.139:/root/

2️⃣  Conectarse al servidor:
ssh root@143.244.191.139

3️⃣  Dar permisos y ejecutar (dentro del servidor):
chmod +x /root/deploy-to-server.sh && /root/deploy-to-server.sh

4️⃣  Salir del servidor:
exit

🔑 Contraseña (cuando la pida): CL@70049ro

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 VERIFICACIÓN FINAL:

1. Cierra COMPLETAMENTE tu navegador
2. Abre en MODO INCÓGNITO (Ctrl + Shift + N)
3. Ve a: http://143.244.191.139
4. Abre DevTools (F12) → Consola
5. Verifica que diga: V5.1.36 o superior

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  SI SIGUE DICIENDO v5.1.22:
    El problema NO es cache - Es configuración de servidor
    o hay 2 servidores activos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

// 4. Guardar instrucciones
const instructionsPath = path.join(__dirname, 'INSTRUCCIONES-DEPLOY.txt');
fs.writeFileSync(instructionsPath, instructions);

console.log('✅ Archivos preparados exitosamente:\n');
console.log(`   📄 ${deployScriptPath}`);
console.log(`   📄 ${instructionsPath}\n`);
console.log('━'.repeat(60));
console.log(instructions);
console.log('━'.repeat(60));
