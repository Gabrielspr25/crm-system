import { spawn } from 'child_process';
import chalk from 'chalk'; // Opcional, pero para colores nativos usaremos códigos ANSI si no queremos dependencia extra.

// Códigos de colores ANSI
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

console.log(CYAN + '\n==================================================' + RESET);
console.log(CYAN + '       🕵️  AGENTE VIGÍA - REPORTE DE ESTADO       ' + RESET);
console.log(CYAN + '==================================================\n' + RESET);

console.log('Iniciando escaneo del sistema...\n');

// Ejecutar vitest programáticamente
// Usamos npx vitest run tests/vigia --reporter=verbose
const vigia = spawn('npx.cmd', ['vitest', 'run'], {
    stdio: 'inherit',
    shell: true
});

vigia.on('close', (code) => {
    console.log(CYAN + '\n==================================================' + RESET);
    if (code === 0) {
        console.log(GREEN + '✅  SISTEMA OPERATIVO Y SALUDABLE' + RESET);
        console.log(GREEN + 'Todos los sistemas responden correctamente.' + RESET);
    } else {
        console.log(RED + '❌  ALERTA: SE ENCONTRARON PROBLEMAS' + RESET);
        console.log(RED + 'Revise los logs de arriba para más detalles.' + RESET);
        console.log(YELLOW + 'Posibles causas:' + RESET);
        console.log(YELLOW + '1. El servidor backend no está corriendo (puerto 3001).' + RESET);
        console.log(YELLOW + '2. La base de datos no es accesible.' + RESET);
        console.log(YELLOW + '3. Archivos críticos fueron borrados.' + RESET);
    }
    console.log(CYAN + '==================================================' + RESET);
});
