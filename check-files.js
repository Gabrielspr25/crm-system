
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔍 VERIFICANDO ARCHIVOS...\n');
    const cmd = `
echo "=== FECHA DE index.html ==="
ls -lh /opt/crmp/dist/client/index.html

echo ""
echo "=== VERSIÓN EN index.html ==="
grep CURRENT_VERSION /opt/crmp/dist/client/index.html

echo ""
echo "=== ARCHIVOS EN /var/www/VentasProui/dist ==="
ls -lh /var/www/VentasProui/dist/index.html 2>/dev/null || echo "No existe"

echo ""
echo "=== VERSIÓN EN /var/www ==="
grep CURRENT_VERSION /var/www/VentasProui/dist/index.html 2>/dev/null || echo "No existe"
`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => { conn.end(); })
            .on('data', (d) => process.stdout.write(d));
    });
}).connect(config);
