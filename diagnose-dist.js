
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔍 Diagnosticando estructura de archivos...\n');

    const cmd = `
echo "=== Buscando index.html ==="
find /var/www/VentasProui/dist -name "index.html" -type f 2>/dev/null

echo -e "\n=== Estructura completa de dist/ ==="
ls -R /var/www/VentasProui/dist/ 2>/dev/null | head -100

echo -e "\n=== Archivos en raíz de dist/ ==="
ls -lah /var/www/VentasProui/dist/ 2>/dev/null

echo -e "\n=== Contenido de package.json ==="
grep -A 5 '"version"' /var/www/VentasProui/package.json

echo -e "\n=== Configuración actual de NGINX ==="
cat /etc/nginx/sites-available/ventaspro
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('\n✅ Diagnóstico completado');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write('STDERR: ' + data);
        });
    });
}).connect(config);
