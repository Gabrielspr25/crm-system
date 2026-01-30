
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: process.env.DEPLOY_SSH_PASS || 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('Consultando logs remotos...');
    // Ver ultimas 50 lineas de logs y verificar si existe .env
    const cmd = 'pm2 logs vendaspro-backend --lines 50 --nostream && ls -la /var/www/VentasProui/.env && cat /var/www/VentasProui/.env';
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
