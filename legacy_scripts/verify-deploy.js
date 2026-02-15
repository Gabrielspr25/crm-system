
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔍 VERIFICANDO ARCHIVOS DESPLEGADOS...\n');

    const cmd = `
echo "=== INDEX.HTML ==="
head -20 /opt/crmp/dist/client/index.html

echo ""
echo "=== ARCHIVOS EN DIST ==="
ls -lh /opt/crmp/dist/client/ | head -20

echo ""
echo "=== NGINX STATUS ==="
systemctl status nginx | head -10

echo ""
echo "=== BACKEND STATUS ==="
pm2 list
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => { conn.end(); })
            .on('data', (d) => process.stdout.write(d));
    });
}).connect(config);
