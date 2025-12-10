import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍🔍🔍 ANALIZANDO CONFIGURACIÓN DEL SERVIDOR 🔍🔍🔍\n');

const SERVER = {
    host: '143.244.191.139',
    user: 'root',
    password: 'CL@70049ro'
};

// Crear script de búsqueda
const searchScript = `
echo "=== BUSCANDO PROYECTO VENTASPRO ==="
echo ""
echo "1. Contenido de /var/www/:"
ls -la /var/www/ 2>/dev/null || echo "No existe /var/www/"
echo ""
echo "2. Contenido de /root/:"
ls -la /root/ 2>/dev/null
echo ""
echo "3. Contenido de /home/:"
ls -la /home/ 2>/dev/null
echo ""
echo "4. Buscando package.json del proyecto:"
find / -name "package.json" -path "*Ventas*" 2>/dev/null | head -n 10
echo ""
echo "5. Buscando carpetas dist:"
find / -type d -name "dist" 2>/dev/null | head -n 10
echo ""
echo "6. Configuración NGINX actual:"
cat /etc/nginx/sites-enabled/* 2>/dev/null | grep -E "root|server_name"
echo ""
echo "7. Servicios PM2 activos:"
pm2 list 2>/dev/null
echo ""
echo "=== FIN DE LA BÚSQUEDA ==="
`;

// Guardar script temporal
const scriptPath = path.join(__dirname, 'search-temp.sh');
fs.writeFileSync(scriptPath, searchScript);

console.log('📋 Script de búsqueda creado\n');
console.log('━'.repeat(60));
console.log('📋 COPIA Y PEGA ESTOS 2 COMANDOS EN POWERSHELL:');
console.log('━'.repeat(60));
console.log('');
console.log(`scp search-temp.sh ${SERVER.user}@${SERVER.host}:/tmp/`);
console.log(`ssh ${SERVER.user}@${SERVER.host} "bash /tmp/search-temp.sh"`);
console.log('');
console.log(`🔑 Contraseña (cuando la pida): ${SERVER.password}`);
console.log('');
console.log('━'.repeat(60));
console.log('');

// Intentar ejecutar automáticamente (probablemente pedirá contraseña)
console.log('⏳ Intentando ejecutar automáticamente...\n');

exec(`scp "${scriptPath}" ${SERVER.user}@${SERVER.host}:/tmp/search-temp.sh`, (error1, stdout1) => {
    if (error1) {
        console.log('⚠️  No se pudo subir automáticamente (necesita contraseña)\n');
        console.log('Por favor ejecuta los comandos de arriba manualmente.\n');
        return;
    }
    
    console.log('✅ Script subido, ejecutando búsqueda...\n');
    
    exec(`ssh ${SERVER.user}@${SERVER.host} "bash /tmp/search-temp.sh"`, (error2, stdout2, stderr2) => {
        if (error2) {
            console.log('⚠️  Necesita ejecutarse manualmente\n');
            return;
        }
        
        console.log('📋 RESULTADO DE LA BÚSQUEDA:\n');
        console.log(stdout2);
        
        // Guardar resultado
        const resultPath = path.join(__dirname, 'server-info.txt');
        fs.writeFileSync(resultPath, stdout2);
        console.log(`\n✅ Resultado guardado en: ${resultPath}\n`);
    });
});
