
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('📋 COPIANDO ARCHIVOS CORRECTAMENTE...\n');
    const cmd = `
# Borrar destino
rm -rf /opt/crmp/dist/client/*

# Copiar TODO desde /var/www/VentasProui/dist
cp -rv /var/www/VentasProui/dist/* /opt/crmp/dist/client/

# Verificar
echo ""
echo "=== VERIFICACIÓN ==="
ls -lh /opt/crmp/dist/client/index.html
grep CURRENT_VERSION /opt/crmp/dist/client/index.html | head -1

# Permisos
chown -R www-data:www-data /opt/crmp/dist/
`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('\n✅ Archivos copiados. RECARGA CON CTRL+F5');
            conn.end();
        })
            .on('data', (d) => process.stdout.write(d));
    });
}).connect(config);
