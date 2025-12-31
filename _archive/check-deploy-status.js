import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🔍 VERIFICANDO ESTADO DEL DEPLOY EN SERVIDOR...\n');

async function checkStatus() {
    try {
        console.log('[1/5] Verificando archivos subidos...');
        const { stdout: files } = await execAsync('ssh ventaspro-server "ls -lh /tmp/project.tar.gz /tmp/deploy.sh 2>/dev/null"');
        console.log(files || '❌ No hay archivos en /tmp/');
        
        console.log('\n[2/5] Verificando procesos npm/node activos...');
        const { stdout: processes } = await execAsync('ssh ventaspro-server "ps aux | grep -E \'npm|node\' | grep -v grep"');
        console.log(processes || '✅ No hay procesos corriendo');
        
        console.log('\n[3/5] Verificando últimos logs de PM2...');
        const { stdout: pm2logs } = await execAsync('ssh ventaspro-server "pm2 logs --lines 10 --nostream"');
        console.log(pm2logs);
        
        console.log('\n[4/5] Verificando archivos en /root/VentasProui/dist...');
        const { stdout: dist } = await execAsync('ssh ventaspro-server "ls -lh /root/VentasProui/dist/assets/*.js 2>/dev/null | head -n 3"');
        console.log(dist || '❌ No hay archivos en dist/');
        
        console.log('\n[5/5] Verificando versión desplegada...');
        const { stdout: version } = await execAsync('ssh ventaspro-server "grep -r \'5.1.36\' /root/VentasProui/dist/ 2>/dev/null | head -n 1"');
        console.log(version || '❌ No se encontró v5.1.36');
        
        console.log('\n━'.repeat(60));
        console.log('✅ VERIFICACIÓN COMPLETADA');
        console.log('━'.repeat(60));
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
    }
}

checkStatus();
