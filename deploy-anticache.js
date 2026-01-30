
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('💥 ESTRATEGIA ROMPE-CACHÉ 💥\n');

    const cmd = `
cd /var/www/VentasProui/dist

# 1. Renombrar el index real
cp index.html app.html

# 2. Crear un index.html trampa que fuerza recarga y limpieza
cat > index.html << 'EOFHTML'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>Actualizando...</title>
</head>
<body style="background:#000;color:#0f0;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;">
    <div id="msg">DETECTANDO VERSIÓN...</div>
    <script>
        // Limpieza agresiva antes de redirigir
        async function nukeAndRedirect() {
            document.getElementById('msg').innerText = "BORRANDO CACHÉ ANTIGUA...";
            
            if(navigador && navigator.serviceWorker) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for(let r of regs) await r.unregister();
            }
            
            if(window.caches) {
                const keys = await caches.keys();
                for(let k of keys) await caches.delete(k);
            }
            
            localStorage.clear();
            sessionStorage.clear();
            
            document.getElementById('msg').innerText = "CARGANDO NUEVA VERSIÓN...";
            
            // Redirigir a la app real con parámetro de tiempo para burlar caché
            window.location.replace('/app.html?v=' + Date.now());
        }
        nukeAndRedirect();
    </script>
</body>
</html>
EOFHTML

# 3. Ajustar NGINX para permitir servir app.html
cat > /etc/nginx/sites-available/ventaspro << 'EOFNGINX'
server {
    listen 80 default_server;
    server_name _;
    root /var/www/VentasProui/dist;
    index index.html;
    
    # El index.html (trampa) nunca se cachea
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    location / {
        try_files \$uri \$uri/ /app.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header Authorization \$http_authorization;
    }
}
EOFNGINX

nginx -t && systemctl restart nginx
echo "✅ Sistema de redirección anti-caché activado"
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('\nTrampa activada.');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
