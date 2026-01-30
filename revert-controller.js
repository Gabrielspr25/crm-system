
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔄 REVIRTIENDO CONTROLADOR DE PRODUCTOS...\n');
    const cmd = `
cd /var/www/VentasProui
git checkout src/backend/controllers/productController.js
git checkout src/backend/routes/productRoutes.js
pm2 restart ventaspro-backend
pm2 logs ventaspro-backend --lines 5 --nostream
`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('\n✅ Controlador revertido y backend reiniciado');
            conn.end();
        })
            .on('data', (d) => process.stdout.write(d));
    });
}).connect(config);
