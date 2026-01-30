
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

console.log('🚀 SUBIENDO BUILD LOCAL AL SERVIDOR...\n');

async function uploadDist() {
    // 1. Comprimir dist localmente
    console.log('📦 [1/4] Comprimiendo carpeta dist local...');
    try {
        await execPromise('tar -czf dist_local.tar.gz dist');
        console.log('✅ Compresión exitosa.');
    } catch (err) {
        console.error('❌ Error al comprimir:', err.message);
        return;
    }

    const conn = new Client();
    conn.on('ready', () => {
        console.log('🔗 [2/4] Conexión SSH establecida.');

        conn.sftp((err, sftp) => {
            if (err) throw err;

            // 2. Subir archivo
            console.log('📤 [3/4] Subiendo dist_local.tar.gz...');
            const readStream = fs.createReadStream('dist_local.tar.gz');
            const writeStream = sftp.createWriteStream('/var/www/VentasProui/dist_local.tar.gz');

            writeStream.on('close', () => {
                console.log('✅ Subida completada.');

                // 3. Descomprimir y configurar NGINX
                console.log('🔧 [4/4] Instalando en servidor...');
                const cmd = `
cd /var/www/VentasProui

echo "🧹 Limpiando directorio dist remoto..."
rm -rf dist/*
# Asegurar que existe el directorio
mkdir -p dist

echo "🔥 Descomprimiendo build local..."
tar -xzf dist_local.tar.gz
# Mover contenido si se descomprime en dist/dist (depende de cómo tar guardó paths)
if [ -d "dist/dist" ]; then
    mv dist/dist/* dist/
    rm -rf dist/dist
fi

echo "🔍 Verificando index.html..."
if [ -f "dist/index.html" ]; then
    echo "✅ index.html encontrado en dist/"
else
    echo "❌ ERROR: index.html no encontrado tras descomprimir"
    find dist -name "index.html"
fi

echo "🔧 Configurando NGINX..."
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root /var/www/VentasProui/dist;
    index index.html;
    
    location / {
        try_files \\$uri \\$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \\$host;
    }
}
EOFNGINX

nginx -t && systemctl reload nginx
rm dist_local.tar.gz

echo "✅✅✅ DEPLOY FRONTEND FINALIZADO ✅✅✅"
echo "🌐 Abre en INCÓGNITO: http://143.244.191.139"
`;
                conn.exec(cmd, (err, stream) => {
                    if (err) throw err;
                    stream.on('close', () => {
                        conn.end();
                        // Limpiar local
                        fs.unlinkSync('dist_local.tar.gz');
                    }).on('data', (data) => {
                        process.stdout.write(data);
                    }).stderr.on('data', (data) => {
                        process.stderr.write(data);
                    });
                });
            });

            readStream.pipe(writeStream);
        });
    }).connect(config);
}

uploadDist();
