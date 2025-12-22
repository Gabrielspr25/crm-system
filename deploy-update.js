import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SERVER = {
    host: '143.244.191.139',
    user: 'root',
    password: 'CL@70049ro',
    remotePath: '/opt/crmp'
};

async function runCommand(command, description) {
    console.log(`\n[${description}] Ejecutando...`);
    try {
        const { stdout, stderr } = await execAsync(command);
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        console.log(`✅ [${description}] Completado.`);
    } catch (error) {
        console.error(`❌ [${description}] Falló:`, error.message);
        throw error;
    }
}

async function deploy() {
    console.log('🚀 Iniciando despliegue de actualización...');

    // 1. Build Frontend
    await runCommand('npm run build', 'Construyendo Frontend');

    // 2. Upload Frontend (dist)
    // Using scp with sshpass
    // Note: Windows might not have sshpass easily available, but let's try or use pscp if on windows.
    // The environment info says Windows. So I should use pscp if available or just standard scp if keys are set up.
    // But the previous script used sshpass which implies it might be running in a wsl or git bash environment, OR it was just a script that never worked on windows.
    // The user is on Windows. `deploy-fixed.ps1` used plink/pscp.
    
    // Let's try to use scp directly. If it asks for password, this script will hang.
    // But wait, I can use the `deploy-with-password.js` approach if I have `sshpass` installed.
    // If not, I'll generate a PowerShell script instead which is safer for Windows.
}

// I will switch to creating a PowerShell script instead as it is more reliable on Windows for this user.
