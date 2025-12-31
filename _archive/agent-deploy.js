import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const versionFilePath = path.join(__dirname, 'src', 'version.ts');
const packageJsonPath = path.join(__dirname, 'package.json');

console.log('\n🤖 AGENTE DE DESPLIEGUE - VENTASPRO');
console.log('===================================');

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

function updateVersionFile(type) {
    try {
        let content = fs.readFileSync(versionFilePath, 'utf8');
        const versionRegex = /export const APP_VERSION = "v(\d+)\.(\d+)\.(\d+)(.*)";/;
        const match = content.match(versionRegex);

        if (!match) throw new Error('No se encontró versión en src/version.ts');

        let [full, major, minor, patch, suffix] = match;
        major = parseInt(major);
        minor = parseInt(minor);
        patch = parseInt(patch);

        if (type === 'major') {
            major++;
            minor = 0;
            patch = 0;
        } else if (type === 'minor') {
            minor++;
            patch = 0;
        } else {
            patch++;
        }

        const newVersion = `v${major}.${minor}.${patch}${suffix}`;
        const newContent = content.replace(versionRegex, `export const APP_VERSION = "${newVersion}";`);
        fs.writeFileSync(versionFilePath, newContent, 'utf8');
        
        // Update package.json
        if (fs.existsSync(packageJsonPath)) {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            pkg.version = `${major}.${minor}.${patch}${suffix}`;
            fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf8');
        }

        console.log(`✅ Versión actualizada a: ${newVersion}`);
        return newVersion;
    } catch (error) {
        console.error('❌ Error actualizando versión:', error);
        process.exit(1);
    }
}

async function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        console.log(`\n> Ejecutando: ${command} ${args.join(' ')}`);
        const child = spawn(command, args, { stdio: 'inherit', shell: true });
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Comando falló con código ${code}`));
        });
    });
}

async function main() {
    try {
        console.log('\nSeleccione el tipo de actualización:');
        console.log('1. 🐛 Patch / Fix (Corrección de errores) [Recomendado]');
        console.log('2. ✨ Minor / Feature (Nueva funcionalidad)');
        console.log('3. 🚀 Major (Cambio grande/ruptura)');
        
        const answer = await askQuestion('\nOpción (1/2/3) [Default: 1]: ');
        
        let type = 'patch';
        if (answer.trim() === '2') type = 'minor';
        if (answer.trim() === '3') type = 'major';

        console.log(`\n🔄 Preparando despliegue tipo: ${type.toUpperCase()}`);
        
        // 1. Actualizar Versión
        updateVersionFile(type);

        // 2. Construir Frontend
        console.log('\n🏗️  Construyendo Frontend (Esto asegura que la versión se vea)...');
        await runCommand('npm', ['run', 'build']);

        // 3. Ejecutar Script de Despliegue (Saltando build y version update porque ya lo hicimos)
        console.log('\n🚀 Iniciando subida al servidor y verificación...');
        // Usamos powershell para ejecutar el ps1
        await runCommand('powershell', ['-ExecutionPolicy', 'Bypass', '-File', '.\\deploy-fixed.ps1', '-SkipBuild', '-SkipVersionUpdate']);

        console.log('\n✨ ¡Misión Cumplida! El sistema está actualizado.');

    } catch (error) {
        console.error('\n❌ ERROR FATAL:', error.message);
    } finally {
        rl.close();
    }
}

main();
