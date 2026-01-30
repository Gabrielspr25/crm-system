
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: process.env.DEPLOY_SSH_PASS || 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('Consultando logs de ERROR remotos...');
    // Ver los últimos 100 logs de error y el estado de pm2
    const cmd = 'pm2 list && pm2 logs vendaspro-backend --err --lines 100 --nostream';
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
