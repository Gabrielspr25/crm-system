
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔍 Buscando index.html REAL...\n');

    const cmd = `
find /var/www/VentasProui/dist -name "index.html" -type f
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
        }).on('data', (data) => {
            console.log('📍 Ubicación encontrada:');
            console.log(data.toString());

            // Si está en dist/index.html y NO en dist/client/index.html, hay que corregir NGINX
            if (data.toString().trim() === '/var/www/VentasProui/dist/index.html') {
                console.log('⚠️ ALERTA: Está en dist/, no en client/');
            }
        });
    });
}).connect(config);
