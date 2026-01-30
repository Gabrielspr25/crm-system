
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔄 Reiniciando backend...\n');

    conn.exec('pm2 restart ventaspro-backend', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✅ Backend reiniciado');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
