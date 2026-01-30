const http = require('http');

// Obtener token
function login() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      email: 'admin@crm.com',
      password: 'admin123'
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.accessToken);
        } catch (e) {
          reject('Login failed: ' + data);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Probar endpoint
function testEndpoint(path, token) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        console.log(`\n📡 ${path}`);
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Length: ${data.length} bytes`);
        
        if (data.length > 0) {
          try {
            const json = JSON.parse(data);
            if (Array.isArray(json)) {
              console.log(`   ✅ Array con ${json.length} elementos`);
              if (json.length > 0) {
                console.log(`   Primer elemento:`, json[0]);
              }
            } else {
              console.log(`   JSON:`, json);
            }
          } catch (e) {
            console.log(`   ⚠️ No es JSON válido: ${data.substring(0, 100)}`);
          }
        } else {
          console.log(`   ❌ RESPUESTA VACÍA`);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`\n❌ ${path}: ${e.message}`);
      resolve();
    });

    req.end();
  });
}

async function main() {
  console.log('🔍 DIAGNÓSTICO COMPLETO DEL SISTEMA\n');
  
  // 1. Health check
  console.log('1️⃣ Probando health...');
  await testEndpoint('/api/health');
  
  // 2. Login
  console.log('\n2️⃣ Obteniendo token...');
  let token;
  try {
    token = await login();
    console.log('   ✅ Token obtenido:', token.substring(0, 20) + '...');
  } catch (e) {
    console.log('   ❌ Error login:', e);
    return;
  }
  
  // 3. Productos
  console.log('\n3️⃣ Probando /api/products...');
  await testEndpoint('/api/products', token);
  
  // 4. Completed prospects
  console.log('\n4️⃣ Probando /api/completed-prospects...');
  await testEndpoint('/api/completed-prospects', token);
  
  // 5. Tiers
  console.log('\n5️⃣ Probando /api/products/tiers...');
  await testEndpoint('/api/products/tiers', token);
  
  // 6. Vendors
  console.log('\n6️⃣ Probando /api/vendors...');
  await testEndpoint('/api/vendors', token);
  
  console.log('\n✅ DIAGNÓSTICO COMPLETO');
}

main().catch(console.error);
