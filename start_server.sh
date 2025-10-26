#!/bin/bash

# Cambiar al directorio del proyecto
cd /var/www

# Verificar que existe server.js
if [ ! -f server.js ]; then
    echo "❌ Error: server.js no encontrado en /var/www"
    exit 1
fi

# Verificar que existe la carpeta dist
if [ ! -d dist ]; then
    echo "❌ Error: carpeta dist no encontrada en /var/www"
    exit 1
fi

# Detener procesos existentes de PM2
pm2 delete all 2>/dev/null

# Iniciar el servidor con PM2
echo "🚀 Iniciando servidor Node.js con PM2..."
pm2 start server.js --name "crm-server" --cwd /var/www

# Guardar configuración de PM2
pm2 save

# Configurar PM2 para que inicie automáticamente
pm2 startup

echo "✅ Servidor iniciado correctamente"
echo ""
echo "📊 Estado del servidor:"
pm2 list
echo ""
echo "📋 Logs:"
pm2 logs crm-server --lines 20


