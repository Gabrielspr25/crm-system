
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
    console.log('📤 Subiendo archivos del backend...\n');

    conn.sftp((err, sftp) => {
        if (err) throw err;

        const files = [
            {
                local: 'src/backend/controllers/productController.js',
                remote: '/var/www/VentasProui/src/backend/controllers/productController.js'
            },
            {
                local: 'src/backend/routes/productRoutes.js',
                remote: '/var/www/VentasProui/src/backend/routes/productRoutes.js'
            }
        ];

        let uploaded = 0;

        files.forEach(file => {
            const readStream = fs.createReadStream(file.local);
            const writeStream = sftp.createWriteStream(file.remote);

            writeStream.on('close', () => {
                console.log(`✅ ${file.local}`);
                uploaded++;

                if (uploaded === files.length) {
                    console.log('\n🔄 Reiniciando backend...\n');
                    conn.exec('pm2 restart ventaspro-backend', (err, stream) => {
                        if (err) throw err;
                        stream.on('close', () => {
                            console.log('\n✅ Backend actualizado con endpoints de tiers');
                            conn.end();
                        }).on('data', (d) => process.stdout.write(d));
                    });
                }
            });

            readStream.pipe(writeStream);
        });
    });
}).connect(config);
