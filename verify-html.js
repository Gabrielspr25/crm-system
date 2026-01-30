
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔍 Verificando archivos HTML...\n');

    const cmd = `
echo "=== ¿Existe index.html en dist/client? ==="
ls -lah /var/www/VentasProui/dist/client/index.html

echo -e "\n=== Contenido de index.html (primeras 30 líneas) ==="
head -30 /var/www/VentasProui/dist/client/index.html

echo -e "\n=== Archivos JS en dist/client/assets ==="
ls -lah /var/www/VentasProui/dist/client/assets/*.js 2>/dev/null | head -10

echo -e "\n=== Buscando la versión en los archivos JS ==="
grep -h "2026-17" /var/www/VentasProui/dist/client/assets/*.js 2>/dev/null | head -5

echo -e "\n=== Test de curl local ==="
curl -s http://localhost/ | head -20
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('\n✅ Verificación completada');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write('STDERR: ' + data);
        });
    });
}).connect(config);
