
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔍 TESTEANDO ENDPOINT DE PRODUCTOS INTERNAMENTE...\n');
    const cmd = `
# Obtener un token válido primero (simular login)
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "Token obtenido: \${TOKEN:0:20}..."

# Llamar al endpoint de productos
echo ""
echo "=== RESPUESTA DE /api/products ==="
curl -s -H "Authorization: Bearer \$TOKEN" http://localhost:3001/api/products | head -200

echo ""
echo "=== STATUS CODE ==="
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer \$TOKEN" http://localhost:3001/api/products
`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => { conn.end(); })
            .on('data', (d) => process.stdout.write(d))
            .stderr.on('data', (d) => process.stderr.write(d));
    });
}).connect(config);
