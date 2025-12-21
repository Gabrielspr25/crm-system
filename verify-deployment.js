import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🔍🔍🔍 VERIFICACIÓN DE DEPLOY v5.1.36 🔍🔍🔍\n');

async function verifyDeployment() {
    try {
        console.log('[1/6] Verificando versión en el servidor...\n');
        
        const versionCheck = await execAsync('ssh ventaspro-server "grep -r \'5.1.36\' /var/www/crmp/dist/ | head -n 3"');
        console.log('📊 Versión en servidor:');
        console.log(versionCheck.stdout || '❌ No se encontró v5.1.36');
        console.log('');

        console.log('[2/6] Verificando archivos desplegados...\n');
        const files = await execAsync('ssh ventaspro-server "ls -lh /var/www/crmp/dist/assets/*.js | head -n 5"');
        console.log('📂 Archivos JS en dist:');
        console.log(files.stdout);

        console.log('[3/6] Verificando configuración de Nginx...\n');
        const nginxConfig = await execAsync('ssh ventaspro-server "cat /etc/nginx/sites-enabled/* | grep -E \'root|server_name\'"');
        console.log('⚙️  Nginx apuntando a:');
        console.log(nginxConfig.stdout);

        console.log('[4/6] Verificando cache de Nginx...\n');
        const cacheHeaders = await execAsync('ssh ventaspro-server "cat /etc/nginx/sites-enabled/* | grep -i cache"');
        console.log('🗄️  Headers de cache:');
        console.log(cacheHeaders.stdout || '⚠️ Sin configuración de cache');
        console.log('');

        console.log('[5/6] Verificando estado de PM2...\n');
        const pm2Status = await execAsync('ssh ventaspro-server "pm2 list"');
        console.log('🔄 Servicios PM2:');
        console.log(pm2Status.stdout);

        console.log('[6/6] Verificando API de completados...\n');
        const apiTest = await execAsync('ssh ventaspro-server "curl -s http://localhost:3000/api/follow-up-prospects?include_completed=true | head -c 200"');
        console.log('🔌 Respuesta de API:');
        console.log(apiTest.stdout || '❌ API no responde');
        console.log('');

        console.log('━'.repeat(60));
        console.log('✅ DIAGNÓSTICO COMPLETADO');
        console.log('━'.repeat(60));
        console.log('\n📋 ACCIONES RECOMENDADAS:\n');
        console.log('1. Abre en INCÓGNITO: https://crmp.ss-group.cloud/');
        console.log('2. Presiona Ctrl+Shift+R (hard reload)');
        console.log('3. Abre DevTools (F12) → Consola');
        console.log('4. Verifica que diga: v5.1.36');
        console.log('5. Ve a pestaña "Completados" y verifica datos\n');

    } catch (error) {
        console.error('❌ ERROR en verificación:', error.message);
        
        console.log('\n🔧 SOLUCIÓN RÁPIDA:\n');
        console.log('Si no se ve v5.1.36, ejecuta:');
        console.log('  npm run deploy:upload');
        console.log('\nEsto volverá a subir todo el código actualizado.\n');
    }
}

verifyDeployment();
