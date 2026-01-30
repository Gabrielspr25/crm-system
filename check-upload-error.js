
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔍 REVISANDO LOGS DE ERROR (Backend + Nginx)...\n');

    // Ver ultimas 50 lineas de error del backend y de nginx
    const cmd = `
echo "=== PM2 LOGS (Backend) ==="
pm2 logs ventaspro-backend --lines 30 --nostream

echo "\n=== NGINX ERROR LOGS ==="
tail -n 20 /var/log/nginx/error.log
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => { conn.end(); })
            .on('data', (d) => process.stdout.write(d));
    });
}).connect(config);
