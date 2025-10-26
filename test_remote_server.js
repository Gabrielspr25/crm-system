import fetch from 'node-fetch';

const serverUrl = 'http://142.93.176.195:3001';

async function testRemoteServer() {
  console.log('🌐 Probando servidor remoto en:', serverUrl);
  
  try {
    // Test 1: Health check
    console.log('\n🏥 Test 1: Health check...');
    const healthRes = await fetch(`${serverUrl}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    if (healthRes.ok) {
      const healthData = await healthRes.json();
      console.log('✅ Health check OK:', healthData);
    } else {
      console.log('❌ Health check failed:', healthRes.status, healthRes.statusText);
    }
    
  } catch (error) {
    console.log('❌ Error conectando al servidor remoto:');
    console.log('   Mensaje:', error.message);
    console.log('   Código:', error.code);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 El servidor no está corriendo en el puerto 3001');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('💡 Timeout - el servidor no responde a tiempo');
    } else if (error.code === 'ENOTFOUND') {
      console.log('💡 No se puede resolver la dirección del servidor');
    }
  }
  
  try {
    // Test 2: Login
    console.log('\n🔐 Test 2: Login con credenciales...');
    const loginRes = await fetch(`${serverUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'gabriel',
        password: 'gabriel123'
      }),
      timeout: 10000
    });
    
    if (loginRes.ok) {
      const loginData = await loginRes.json();
      console.log('✅ Login exitoso para gabriel');
      console.log('   Token recibido:', loginData.token ? 'SÍ' : 'NO');
      
      if (loginData.token) {
        // Test 3: Obtener datos del CRM
        console.log('\n📊 Test 3: Obteniendo datos del CRM...');
        const crmRes = await fetch(`${serverUrl}/api/crm-data`, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loginData.token}`
          },
          timeout: 15000
        });
        
        if (crmRes.ok) {
          const crmData = await crmRes.json();
          console.log('✅ Datos del CRM obtenidos exitosamente');
          console.log('   Clientes:', crmData.clients?.length || 0);
          console.log('   Productos:', crmData.products?.length || 0);
          console.log('   Vendedores:', crmData.salespeople?.length || 0);
        } else {
          const errorData = await crmRes.text();
          console.log('❌ Error obteniendo datos del CRM:', crmRes.status);
          console.log('   Respuesta:', errorData);
        }
      }
      
    } else {
      const errorData = await loginRes.text();
      console.log('❌ Login falló:', loginRes.status);
      console.log('   Respuesta:', errorData);
    }
    
  } catch (error) {
    console.log('❌ Error en tests de API:', error.message);
  }
}

testRemoteServer();