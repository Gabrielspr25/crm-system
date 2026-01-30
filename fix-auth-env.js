
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🛡️ Verificando Autenticación y Entorno...\n');

    const cmd = `
cd /var/www/VentasProui

echo "🔄 [1/3] Reiniciando backend con actualización de ENV..."
pm2 restart ventaspro-backend --update-env

echo -e "\n🧪 [2/3] Test de Login Local..."
# Intentar login para obtener token
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"gabriel","password":"123"}')

echo "Respuesta Login: $LOGIN_RESPONSE"

# Extraer token (parseo simple con grep/sed porque no tengo jq garantizado)
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ FALLÓ LOGIN: No se obtuvo token."
    exit 1
else
    echo "✅ Token obtenido exitosamente."
    
    echo -e "\n🧪 [3/3] Probando acceso a Productos con el token..."
    # Usar token para pedir productos
    PRODUCT_RESPONSE=$(curl -s -w "%{http_code}" -X GET http://localhost:3001/api/products \
      -H "Authorization: Bearer $TOKEN")
    
    HTTP_CODE=${PRODUCT_RESPONSE: -3
}
    CONTENT = ${ PRODUCT_RESPONSE: 0: ${ #PRODUCT_RESPONSE} - 3}
    
    if ["$HTTP_CODE" == "200"]; then
        echo "✅ ACCESO EXITOSO (HTTP 200)"
        echo "Muestra (primeros 100 caracteres): ${CONTENT:0:100}..."
        echo "✅✅ SISTEMA DE AUTENTICACIÓN OPERATIVO"
    else
        echo "❌ FALLÓ ACCESO (HTTP $HTTP_CODE)"
        echo "Respuesta: $CONTENT"
fi
fi
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('\nDiagnóstico finalizado.');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
