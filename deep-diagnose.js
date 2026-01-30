
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔍 DIAGNÓSTICO PROFUNDO...\n');

    const cmd = `
echo "=== 1. VERIFICANDO VERSIÓN EN DISCO ==="
grep -o "2026-17[0-9]" /var/www/VentasProui/dist/assets/*.js | head -1
grep '"version"' /var/www/VentasProui/package.json

echo -e "\n=== 2. LOGS DE ERROR (Backend 500) ==="
pm2 logs ventaspro-backend --lines 50 --nostream --err

echo -e "\n=== 3. ESTADO DE TABLA PRODUCTS ==="
psql -U crm_user -d crm_pro -c "SELECT count(*) FROM products;"

echo -e "\n=== 4. FECHA DE ARCHIVOS DIST ==="
ls -l --time-style=long-iso /var/www/VentasProui/dist/index.html
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
