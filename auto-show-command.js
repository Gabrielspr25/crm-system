import { exec } from 'child_process';

console.log('\n🚀🚀🚀 GENERANDO COMANDO DE DEPLOY 🚀🚀🚀\n');

const SERVER = '143.244.191.139';
const USER = 'root';
const PASSWORD = 'CL@70049ro';

const deployScript = `cd /var/www/VentasProui && pm2 stop all && cat > /etc/nginx/sites-available/ventaspro << 'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/VentasProui/dist;
    index index.html;
    location / {
        try_files \\$uri \\$uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
    location ~* \\.(js|css)\\$ {
        add_header Cache-Control "no-cache";
    }
}
EOF
ln -sf /etc/nginx/sites-available/ventaspro /etc/nginx/sites-enabled/ventaspro && rm -f /etc/nginx/sites-enabled/default && rm -rf /var/cache/nginx/* && nginx -t && systemctl reload nginx && rm -rf dist node_modules/.vite && npm run build && pm2 restart all && echo "LISTO"`;

const command = `ssh ${USER}@${SERVER} "${deployScript}"`;

console.log('============================================');
console.log('📋 COPIA Y PEGA ESTE COMANDO EN POWERSHELL:');
console.log('============================================\n');
console.log(command);
console.log('\n============================================');
console.log(`🔑 Contraseña: ${PASSWORD}`);
console.log('============================================\n');

// Intentar ejecutar automáticamente (pedirá contraseña)
console.log('🔄 Intentando ejecutar automáticamente...\n');

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.log('⚠️  No se pudo ejecutar automáticamente (normal en Windows)');
        console.log('📋 Por favor copia el comando de arriba y pégalo en PowerShell\n');
        return;
    }
    console.log('✅ RESULTADO:\n');
    console.log(stdout);
    if (stderr) console.log('Warnings:', stderr);
});
