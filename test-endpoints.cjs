const http = require('http');

// Primero obtener token
const loginData = JSON.stringify({
  email: 'admin@ventaspro.com',
  password: 'admin123'
});

const loginOptions = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
};

console.log('🔐 Intentando login...');

const loginReq = http.request(loginOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const loginResult = JSON.parse(data);
      const token = loginResult.accessToken;
      console.log('✅ Login exitoso, token:', token?.substring(0, 20) + '...');
      
      // Probar endpoints
      testEndpoint('/api/products', token);
      testEndpoint('/api/completed-prospects', token);
      testEndpoint('/api/products/tiers', token);
    } catch (e) {
      console.error('❌ Error parseando login:', e.message, 'Data:', data);
    }
  });
});

loginReq.on('error', (e) => {
  console.error('❌ Error en login:', e.message);
});

loginReq.write(loginData);
loginReq.end();

function testEndpoint(path, token) {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: path,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  console.log(`\n🔍 Probando ${path}...`);

  const req = http.request(options, (res) => {
    console.log(`  Status: ${res.statusCode}`);
    console.log(`  Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(`  Body length: ${data.length}`);
      if (data.length > 0) {
        try {
          const parsed = JSON.parse(data);
          console.log(`  ✅ JSON válido, items:`, Array.isArray(parsed) ? parsed.length : 'objeto');
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`  📦 Primer item:`, parsed[0]);
          }
        } catch (e) {
          console.log(`  ❌ Error parseando JSON:`, e.message);
          console.log(`  Raw data:`, data.substring(0, 200));
        }
      } else {
        console.log(`  ⚠️ Respuesta VACÍA - Sin cuerpo`);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`  ❌ Error en request:`, e.message);
  });

  req.end();
}
