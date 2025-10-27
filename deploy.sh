#!/bin/bash
echo "🚀 DESPLEGANDO CRM PRODUCTOS"
echo "=============================="

# Verificar que estamos en el directorio correcto
if [ ! -d "dist" ]; then
    echo "❌ Carpeta dist no encontrada"
    exit 1
fi

echo "📦 Archivos a subir:"
ls -la dist/

echo ""
echo "🌐 Subiendo archivos al servidor..."
echo "Ejecuta este comando desde tu máquina local:"
echo "scp -r dist/* user@142.93.176.195:/var/www/dist/"
echo ""
echo "🔧 Luego en el servidor ejecuta:"
echo "sudo chown -R www-data:www-data /var/www/dist"
echo "sudo chmod -R 755 /var/www/dist"
echo "sudo systemctl reload nginx"
echo ""
echo "✅ Después verifica en https://crmp.ss-group.cloud/productos"
