
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
    console.log('📤 RESTAURANDO productController.js COMPLETO...\n');

    conn.sftp((err, sftp) => {
        if (err) throw err;

        const localPath = 'c:/Users/Gabriel/Documentos/Programas/VentasProui/src/backend/controllers/productController.js';
        const remotePaths = [
            '/var/www/VentasProui/src/backend/controllers/productController.js',
            '/opt/crmp/src/backend/controllers/productController.js'
        ];

        let uploaded = 0;

        remotePaths.forEach(remotePath => {
            const readStream = fs.createReadStream(localPath);
            const writeStream = sftp.createWriteStream(remotePath);

            writeStream.on('close', () => {
                console.log(`✅ Restaurado en ${remotePath}`);
                uploaded++;

                if (uploaded === remotePaths.length) {
                    console.log('\n🔄 Reiniciando backend...\n');
                    conn.exec('pm2 restart ventaspro-backend', (err, stream) => {
                        if (err) throw err;
                        stream.on('close', () => {
                            console.log('\n✅ SECCIÓN DE PRODUCTOS DEBERÍA FUNCIONAR AHORA');
                            conn.end();
                        }).on('data', (d) => process.stdout.write(d));
                    });
                }
            });

            readStream.pipe(writeStream);
        });
    });
}).connect(config);
