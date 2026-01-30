
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔍 LISTANDO SITES-ENABLED...\n');
    const cmd = `ls -l /etc/nginx/sites-enabled/`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => { conn.end(); })
            .on('data', (d) => process.stdout.write(d));
    });
}).connect(config);
