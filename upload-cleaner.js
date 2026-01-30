
import { Client } from 'ssh2';
import fs from 'fs';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('📤 Subiendo herramienta de limpieza...\n');

    conn.sftp((err, sftp) => {
        if (err) throw err;

        const readStream = fs.createReadStream('kill-sw-local.html');
        const writeStream = sftp.createWriteStream('/var/www/VentasProui/dist/clean.html');

        writeStream.on('close', () => {
            console.log('✅ Archivo subido a /clean.html');
            conn.end();
        });

        readStream.pipe(writeStream);
    });
}).connect(config);
