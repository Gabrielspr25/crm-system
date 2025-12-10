import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SERVER = {
    host: '143.244.191.139',
    user: 'root',
    password: 'CL@70049ro'
};

console.log('🔍 BUSCANDO RUTA DEL PROYECTO EN EL SERVIDOR...\n');

async function findProjectPath() {
    try {
        const searchCommand = `ssh ${SERVER.user}@${SERVER.host} "find / -name 'package.json' -path '*/VentasProui/*' 2>/dev/null | head -n 5"`;
        
        console.log('⏳ Buscando archivos package.json...\n');
        
        const { stdout } = await execAsync(searchCommand, {
            maxBuffer: 1024 * 1024 * 10
        });

        console.log('📂 RUTAS ENCONTRADAS:\n');
        console.log(stdout);

        // También buscar por dist
        const distCommand = `ssh ${SERVER.user}@${SERVER.host} "find / -type d -name 'dist' -path '*/VentasProui/*' 2>/dev/null | head -n 5"`;
        
        console.log('\n📂 CARPETAS DIST ENCONTRADAS:\n');
        const { stdout: distOut } = await execAsync(distCommand, {
            maxBuffer: 1024 * 1024 * 10
        });
        console.log(distOut);

        // Buscar configuración de NGINX
        const nginxCommand = `ssh ${SERVER.user}@${SERVER.host} "cat /etc/nginx/sites-enabled/* 2>/dev/null | grep -i 'root'"`;
        
        console.log('\n⚙️  CONFIGURACIÓN NGINX ACTUAL:\n');
        const { stdout: nginxOut } = await execAsync(nginxCommand, {
            maxBuffer: 1024 * 1024 * 10
        });
        console.log(nginxOut);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.log('\n📋 Ejecuta manualmente:\n');
        console.log(`ssh ${SERVER.user}@${SERVER.host}`);
        console.log(`🔑 Contraseña: ${SERVER.password}\n`);
        console.log('Luego ejecuta:');
        console.log('  find / -name package.json -path "*VentasProui*" 2>/dev/null');
        console.log('  ls -la /var/www/');
        console.log('  ls -la /root/');
        console.log('  ls -la /home/');
    }
}

findProjectPath();
