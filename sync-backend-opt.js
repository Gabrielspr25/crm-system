
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 SINCRONIZANDO BACKEND DE /var/www A /opt/crmp...\n');
    const cmd = `
# Asegurar directorios
mkdir -p /opt/crmp/src/backend

# Copiar server-FINAL.js
cp -v /var/www/VentasProui/server-FINAL.js /opt/crmp/

# Copiar todo el backend
cp -rv /var/www/VentasProui/src/backend/* /opt/crmp/src/backend/

# Reiniciar backend
pm2 restart ventaspro-backend --update-env

echo ""
echo "✅ Backend sincronizado y reiniciado en /opt/crmp"
`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('\n✅ Proceso completado. Prueba de nuevo en unos segundos.');
            conn.end();
        })
            .on('data', (d) => process.stdout.write(d));
    });
}).connect(config);
