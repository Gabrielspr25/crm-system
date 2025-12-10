import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

const SERVER = {
    host: '143.244.191.139',
    user: 'root',
    password: 'CL@70049ro'
};

console.log('🔐 CONFIGURANDO CLAVE SSH PÚBLICA\n');
console.log('━'.repeat(60) + '\n');

async function setupSSHKey() {
    try {
        const sshDir = path.join(os.homedir(), '.ssh');
        const keyPath = path.join(sshDir, 'id_rsa_ventaspro');
        const pubKeyPath = keyPath + '.pub';

        // Crear directorio .ssh si no existe
        if (!fs.existsSync(sshDir)) {
            fs.mkdirSync(sshDir, { recursive: true });
        }

        console.log('[1/5] Generando par de claves SSH...\n');

        // Generar clave SSH si no existe
        if (!fs.existsSync(keyPath)) {
            await execAsync(`ssh-keygen -t rsa -b 4096 -f "${keyPath}" -N "" -C "ventaspro-deploy"`);
            console.log('✅ Claves generadas en:', keyPath);
        } else {
            console.log('✅ Claves ya existen en:', keyPath);
        }

        // Leer clave pública
        const publicKey = fs.readFileSync(pubKeyPath, 'utf8').trim();
        
        console.log('\n[2/5] Clave pública generada:\n');
        console.log(publicKey);

        console.log('\n[3/5] Creando script de instalación...\n');

        // Crear script para instalar la clave en el servidor
        const installScript = `
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "${publicKey}" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
echo "✅ Clave pública instalada correctamente"
`;

        const scriptPath = path.join(__dirname, 'install-key-temp.sh');
        fs.writeFileSync(scriptPath, installScript);

        console.log('[4/5] Subiendo e instalando clave en el servidor...\n');
        console.log('⚠️  Esta es la ÚNICA vez que pedirá contraseña\n');

        // Subir e instalar
        await execAsync(`scp "${scriptPath}" ${SERVER.user}@${SERVER.host}:/tmp/install-key.sh`);
        await execAsync(`ssh ${SERVER.user}@${SERVER.host} "bash /tmp/install-key.sh"`);

        // Limpiar script temporal
        fs.unlinkSync(scriptPath);

        console.log('\n[5/5] Configurando SSH config...\n');

        // Agregar configuración SSH
        const sshConfigPath = path.join(sshDir, 'config');
        const configEntry = `
Host ventaspro-server
    HostName ${SERVER.host}
    User ${SERVER.user}
    IdentityFile ${keyPath}
    StrictHostKeyChecking no
`;

        if (fs.existsSync(sshConfigPath)) {
            const currentConfig = fs.readFileSync(sshConfigPath, 'utf8');
            if (!currentConfig.includes('Host ventaspro-server')) {
                fs.appendFileSync(sshConfigPath, configEntry);
            }
        } else {
            fs.writeFileSync(sshConfigPath, configEntry);
        }

        console.log('━'.repeat(60));
        console.log('✅✅✅ CONFIGURACIÓN SSH COMPLETADA ✅✅✅');
        console.log('━'.repeat(60) + '\n');
        console.log('🎉 AHORA PUEDES CONECTARTE SIN CONTRASEÑA:');
        console.log(`   ssh ventaspro-server\n`);
        console.log('🚀 Y EL DEPLOY FUNCIONARÁ AUTOMÁTICAMENTE:');
        console.log('   npm run deploy:auto\n');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.log('\n━'.repeat(60));
        console.log('📋 INSTALACIÓN MANUAL:');
        console.log('━'.repeat(60) + '\n');
        console.log('1. Ejecuta en PowerShell:');
        console.log('   ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_ventaspro -N ""\n');
        console.log('2. Copia la clave pública:');
        console.log('   type ~\\.ssh\\id_rsa_ventaspro.pub\n');
        console.log(`3. Conéctate al servidor:`);
        console.log(`   ssh ${SERVER.user}@${SERVER.host}`);
        console.log(`   Contraseña: ${SERVER.password}\n`);
        console.log('4. Instala la clave:');
        console.log('   mkdir -p ~/.ssh');
        console.log('   nano ~/.ssh/authorized_keys');
        console.log('   (Pega la clave pública y guarda)\n');
    }
}

setupSSHKey();
