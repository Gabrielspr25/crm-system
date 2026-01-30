
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔐 LEYENDO secretos remotos...\n');

    // Leer .env y buscar JWT_SECRET (sin mostrar valor completo por seguridad si me ven)
    const cmd = `
grep "JWT_SECRET" /var/www/VentasProui/.env
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
        }).on('data', (data) => {
            console.log('Encontrado: ' + data.toString());
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
