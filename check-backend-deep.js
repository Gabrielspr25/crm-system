
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: process.env.DEPLOY_SSH_PASS || 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('Verificando estado crítico del backend...\n');

    const cmd = `
echo "=== PM2 Status ==="
pm2 list

echo -e "\n=== Últimos 50 logs (stdout) ==="
pm2 logs ventaspro-backend --lines 50 --nostream --out

echo -e "\n=== Últimos 50 logs (stderr) ==="
pm2 logs ventaspro-backend --lines 50 --nostream --err

echo -e "\n=== Puerto 3001 ==="
ss -tlnp | grep 3001 || echo "Puerto 3001 NO está escuchando"

echo -e "\n=== Probar curl local al backend ==="
curl -s http://localhost:3001/api/health || echo "Backend NO responde"

echo -e "\n=== Verificar dist/client existe ==="
ls -la /var/www/VentasProui/dist/client/index.html && echo "Frontend OK" || echo "Frontend MISSING"
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
