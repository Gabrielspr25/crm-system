
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: process.env.DEPLOY_SSH_PASS || 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    const cmd = 'find /var/www/VentasProui/dist -name "index.html" -type f';
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
        }).on('data', (data) => {
            console.log('Archivos index.html encontrados:');
            console.log(data.toString());
        });
    });
}).connect(config);
