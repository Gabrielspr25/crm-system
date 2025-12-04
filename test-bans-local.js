
import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/bans',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // Necesitaríamos un token válido aquí si la ruta está protegida, 
    // pero vamos a probar si responde al menos con 401 o datos si es pública/dev.
    // Según el código, usa authenticateRequest, así que fallará sin token.
    // Pero verificaremos que el servidor esté arriba y responda.
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk.substring(0, 200)}...`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
