
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔄 LIMPIANDO CACHE Y REINICIANDO SERVICIOS...\n');
    const cmd = `
# Limpiar cache de NGINX
rm -rf /var/cache/nginx/*

# Reiniciar NGINX
systemctl restart nginx

# Reiniciar backend
pm2 restart ventaspro-backend

echo "✅ Servicios reiniciados"
`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('\n✅ Ahora presiona Ctrl+Shift+Delete en tu navegador y limpia el cache');
            console.log('O simplemente Ctrl+F5 para recargar forzado');
            conn.end();
        })
            .on('data', (d) => process.stdout.write(d));
    });
}).connect(config);
