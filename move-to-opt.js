
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🚚 MOVIENDO ARCHIVOS AL DIRECTORIO CORRECTO (/opt/crmp)...\n');

    const cmd = `
# 1. Crear el directorio destino si no existe
mkdir -p /opt/crmp/dist/client

# 2. Copiar contenido de mi deploy verificado (v178) al directorio activo de NGINX
# Nota: Mi deploy está en /var/www/VentasProui/dist
# NGINX apunta a /opt/crmp/dist/client
# OJO: Si mi deploy ya tiene la carpeta 'assets', la copiaremos dentro de 'client'

# Limpiar destino para evitar mix de versiones
rm -rf /opt/crmp/dist/client/*

# Copiar todo
cp -r /var/www/VentasProui/dist/* /opt/crmp/dist/client/

# Ajustar permisos
chown -R www-data:www-data /opt/crmp
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✅ Archivos movidos y listos.');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
