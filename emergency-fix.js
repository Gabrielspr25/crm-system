
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🚨 REPARACIÓN DE EMERGENCIA DEL FRONTEND 🚨\n');

    // Comando para forzar build y reconfigurar NGINX dinámicamente
    const cmd = `
cd /var/www/VentasProui

echo "🧹 [1/5] Limpiando dist/..."
rm -rf dist
mkdir -p dist

echo "📦 [2/5] Instalando dependencias críticas..."
npm install vite @vitejs/plugin-react typescript --legacy-peer-deps

echo "🔨 [3/5] Ejecutando build EXPLICITO..."
# Forzamos el output directory
./node_modules/.bin/vite build --outDir dist --emptyOutDir

echo "🔍 [4/5] Verificando resultado..."
if [ -f "dist/index.html" ]; then
    echo "✅ Build exitoso en dist/index.html"
    NGINX_ROOT="/var/www/VentasProui/dist"
elif [ -f "dist/client/index.html" ]; then
    echo "✅ Build exitoso en dist/client/index.html"
    NGINX_ROOT="/var/www/VentasProui/dist/client"
else
    echo "❌ ERROR CRÍTICO: No se generó index.html"
    exit 1
fi

echo "🔧 [5/5] Apuntando NGINX a $NGINX_ROOT..."
cat > /etc/nginx/sites-available/ventaspro << EOFNGINX
server {
    listen 80;
    server_name _;
    root $NGINX_ROOT;
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
echo "✅ NGINX Recargado"
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log(code === 0 ? '\n✅✅✅ REPARACIÓN EXITOSA' : '\n❌ FALLÓ LA REPARACIÓN');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
