
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔄 RESTAURANDO INDEX ORIGINAL (v178)...\n');

    const cmd = `
cd /var/www/VentasProui/dist

# 1. Verificar si existe app.html (el backup que hice)
if [ -f "app.html" ]; then
    echo "✅ Encontrado app.html (Backup v178)"
    # Borrar la trampa
    rm index.html
    # Restaurar el real
    mv app.html index.html
    echo "✅ Restaurado a index.html"
else
    echo "⚠️ No se encontró app.html, verificando index actual..."
fi

# 2. Leer la versión del index.html resultante
echo "--- CONTENIDO VERSIÓN ---"
grep "const CURRENT_VERSION" index.html || echo "No se encontró tag de versión explícito"
echo "--- TITULO ---"
grep "<title>" index.html
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
