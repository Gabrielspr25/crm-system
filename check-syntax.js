
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔍 VERIFICANDO SINTAXIS DEL CONTROLADOR...\n');
    const cmd = `node -c /var/www/VentasProui/src/backend/controllers/productController.js && echo "✅ Sintaxis OK" || echo "❌ ERROR DE SINTAXIS"`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => { conn.end(); })
            .on('data', (d) => process.stdout.write(d))
            .stderr.on('data', (d) => process.stderr.write(d));
    });
}).connect(config);
