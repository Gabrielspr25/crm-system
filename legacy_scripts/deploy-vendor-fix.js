
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
    console.log('📤 Subiendo vendorController.js actualizado...\n');

    conn.sftp((err, sftp) => {
        if (err) throw err;

        const localPath = 'src/backend/controllers/vendorController.js';
        const remotePath = '/var/www/VentasProui/src/backend/controllers/vendorController.js';

        const readStream = fs.createReadStream(localPath);
        const writeStream = sftp.createWriteStream(remotePath);

        writeStream.on('close', () => {
            console.log('✅ Archivo subido');
            console.log('🔄 Reiniciando backend...\n');

            conn.exec('pm2 restart ventaspro-backend', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => {
                    console.log('\n✅ Backend reiniciado. Intenta crear un vendedor ahora.');
                    conn.end();
                }).on('data', (d) => process.stdout.write(d));
            });
        });

        readStream.pipe(writeStream);
    });
}).connect(config);
