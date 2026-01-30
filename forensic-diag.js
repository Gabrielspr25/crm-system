
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🕵️ DIAGNÓSTICO FORENSE REAL\n');

    // 1. Ver qué entrega el servidor exactamente (headers y contenido)
    // 2. Ver logs de NGINX para confirmar ruta física
    // 3. Ver logs de Backend para el error 401

    const cmd = `
echo "=== 1. ¿QUÉ CONSULTA ESTÁ LLEGANDO? (Access Log) ==="
tail -n 10 /var/log/nginx/access.log | grep "GET / "

echo -e "\n=== 2. ¿QUÉ HTML ENTREGA REALMENTE? ==="
# Descargar el index que sirve NGINX ahora mismo
curl -s http://localhost/ > /tmp/served_index.html
cat /tmp/served_index.html | grep -o "2026-[0-9]*"

echo -e "\n=== 3. ¿DÓNDE CARAJOS ESTÁ ESA VERSIÓN? ==="
# Buscar qué archivo en TODO el servidor contiene la versión 172
grep -r "2026-172" /var/www/VentasProui/dist 2>/dev/null
grep -r "2026-172" /var/www/VentasProui/dist/client 2>/dev/null

echo -e "\n=== 4. CONFLICTOS DE NGINX ==="
ls -l /etc/nginx/sites-enabled/
grep -r "server_name" /etc/nginx/sites-enabled/

echo -e "\n=== 5. LOGS DEL BACKEND (Por qué 401?) ==="
pm2 logs ventaspro-backend --lines 30 --nostream
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
