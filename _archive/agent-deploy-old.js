import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración
const REMOTE_USER = 'root';
const REMOTE_HOST = '143.244.191.139';
const REMOTE_PATH = '/opt/crmp';
const PUTTY_PATH = 'C:\\Program Files\\PuTTY';
const PLINK = `"${path.join(PUTTY_PATH, 'plink.exe')}"`;
const PSCP = `"${path.join(PUTTY_PATH, 'pscp.exe')}"`;
const PASSWORD = 'CL@70049ro';

// Colores para consola
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m"
};

function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

function runCommand(command, ignoreError = false) {
    try {
        return execSync(command, { stdio: 'inherit', encoding: 'utf8' });
    } catch (error) {
        if (!ignoreError) {
            log(`❌ Error ejecutando: ${command}`, colors.red);
            process.exit(1);
        }
        return null;
    }
}

function updateVersion() {
    log('\n[1/5] Actualizando versión...', colors.cyan);
    
    // 1. Actualizar src/version.ts
    const versionFilePath = path.join(__dirname, 'src', 'version.ts');
    let versionContent = fs.readFileSync(versionFilePath, 'utf8');
    const versionRegex = /export const APP_VERSION = "v(\d+)\.(\d+)\.(\d+)(.*)";/;
    const match = versionContent.match(versionRegex);
    
    let newVersionString = "";

    if (match) {
        const major = parseInt(match[1]);
        const minor = parseInt(match[2]);
        let patch = parseInt(match[3]);
        const suffix = match[4];
        patch++;
        newVersionString = `${major}.${minor}.${patch}${suffix}`; // Sin 'v' para package.json
        const fullVersion = `v${newVersionString}`;
        
        const newContent = versionContent.replace(versionRegex, `export const APP_VERSION = "${fullVersion}";`);
        fs.writeFileSync(versionFilePath, newContent, 'utf8');
        log(`✅ src/version.ts actualizado a: ${fullVersion}`, colors.green);

        // 2. Actualizar package.json
        const pkgPath = path.join(__dirname, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.version = fullVersion.replace('v', ''); // package.json suele ir sin 'v' o con, depende. Lo pondremos igual que version.ts pero limpio
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
        log(`✅ package.json actualizado a: ${pkg.version}`, colors.green);
        
        return fullVersion;
    } else {
        log('❌ No se encontró patrón de versión en src/version.ts', colors.red);
        process.exit(1);
    }
}

function buildFrontend() {
    log('\n[2/5] Construyendo Frontend (Vite)...', colors.cyan);
    try {
        // Limpiar dist anterior para asegurar frescura
        if (fs.existsSync(path.join(__dirname, 'dist'))) {
            fs.rmSync(path.join(__dirname, 'dist'), { recursive: true, force: true });
        }
        runCommand('npm run build');
        log('✅ Frontend construido exitosamente.', colors.green);
    } catch (e) {
        log('❌ Falló el build del frontend.', colors.red);
        process.exit(1);
    }
}

function deployBackend() {
    log('\n[3/5] Subiendo Backend...', colors.cyan);
    const filesToUpload = [
        'server-FINAL.js',
        'package.json',
        '.env',
        'app.js',
        'env.js',
        'src/backend' // Carpeta entera
    ];

    // Crear lista de archivos para pscp (o subir uno por uno/carpeta)
    // Para simplificar y ser robusto con pscp recursivo:
    
    // 1. Subir archivos raíz
    const rootFiles = ['server-FINAL.js', 'package.json', '.env', 'app.js', 'env.js'];
    for (const file of rootFiles) {
        if (fs.existsSync(path.join(__dirname, file))) {
            log(`Subiendo ${file}...`, colors.yellow);
            runCommand(`${PSCP} -batch -pw ${PASSWORD} "${path.join(__dirname, file)}" ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/`);
        }
    }

    // 2. Subir carpeta src/backend
    log(`Subiendo src/backend...`, colors.yellow);
    runCommand(`${PSCP} -batch -pw ${PASSWORD} -r "${path.join(__dirname, 'src', 'backend')}" ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/src/`);
    
    log('✅ Backend subido.', colors.green);
}

function deployFrontend() {
    log('\n[4/5] Subiendo Frontend...', colors.cyan);
    const localDist = path.join(__dirname, 'dist', 'client');
    
    if (!fs.existsSync(localDist)) {
        log('❌ No se encuentra dist/client. ¿Falló el build?', colors.red);
        process.exit(1);
    }

    log(`Subiendo contenido de dist/client a ${REMOTE_PATH}/dist/client...`, colors.yellow);
    // Asegurar directorio remoto
    runCommand(`${PLINK} -batch -pw ${PASSWORD} ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${REMOTE_PATH}/dist/client"`);
    
    // Subir todo el contenido
    runCommand(`${PSCP} -batch -pw ${PASSWORD} -r "${localDist}\\*" ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/dist/client/`);
    log('✅ Frontend subido.', colors.green);
}

function restartServer() {
    log('\n[5/5] Reiniciando Servidor...', colors.cyan);
    const cmd = `
        cd ${REMOTE_PATH} && 
        npm install --production --omit=dev && 
        pm2 restart crmp-api || pm2 start server-FINAL.js --name crmp-api
    `;
    runCommand(`${PLINK} -batch -pw ${PASSWORD} ${REMOTE_USER}@${REMOTE_HOST} "${cmd}"`);
    log('✅ Servidor reiniciado.', colors.green);
}

async function main() {
    log('🚀 INICIANDO AGENTE DE DESPLIEGUE (DEPLOY AGENT)', colors.magenta);
    log('===============================================');

    const args = process.argv.slice(2);
    const skipBuild = args.includes('--skip-build');

    const newVersion = updateVersion();
    
    if (!skipBuild) {
        buildFrontend();
    } else {
        log('⚠️ Saltando build de frontend (--skip-build)', colors.yellow);
    }

    deployBackend();
    
    if (!skipBuild) {
        deployFrontend();
    }

    restartServer();

    log(`\n✨ DESPLIEGUE COMPLETADO EXITOSAMENTE: ${newVersion} ✨`, colors.green);
}

main();
