import { exec } from 'child_process';
import fs from 'fs';

console.log('🚀 INICIANDO DEPLOY Y GUARDANDO LOG...\n');

const logFile = 'deploy-log.txt';
let logContent = '';

function log(msg) {
    console.log(msg);
    logContent += msg + '\n';
    fs.writeFileSync(logFile, logContent);
}

const deploy = exec('npm run deploy:upload', { maxBuffer: 10 * 1024 * 1024 });

deploy.stdout.on('data', (data) => {
    log(data.toString());
});

deploy.stderr.on('data', (data) => {
    log('ERROR: ' + data.toString());
});

deploy.on('close', (code) => {
    log(`\n✅ Deploy terminado con código: ${code}`);
    log(`📄 Log guardado en: ${logFile}`);
});
