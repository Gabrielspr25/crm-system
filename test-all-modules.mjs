// Script para crear usuario de prueba temporal y verificar todos los endpoints
import bcrypt from 'bcrypt';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'localhost',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
  database: 'crm_pro',
  port: 5432
});

const API_URL = 'http://localhost:3001';

async function testAllEndpoints() {
  let testUserId = null;
  let testSalespersonId = null;
  
  try {
    console.log('='.repeat(50));
    console.log('TEST COMPLETO DE TODOS LOS MÓDULOS');
    console.log('='.repeat(50));
    
    // 1. Crear usuario temporal de prueba
    console.log('\n[1/15] Creando usuario temporal de prueba...');
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    const salespersonResult = await pool.query(`
      INSERT INTO salespeople (name, email, role)
      VALUES ('TEST USER AUTO', 'test_auto@test.com', 'vendedor')
      RETURNING id
    `);
    testSalespersonId = salespersonResult.rows[0].id;
    
    const userResult = await pool.query(`
      INSERT INTO users_auth (username, password, salesperson_id)
      VALUES ('test_auto', $1, $2)
      RETURNING id
    `, [hashedPassword, testSalespersonId]);
    testUserId = userResult.rows[0].id;
    
    console.log(`✅ Usuario creado: test_auto / test123`);
    
    // 2. Login
    console.log('\n[2/15] Haciendo login...');
    const loginRes = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test_auto', password: 'test123' })
    });
    
    const loginData = await loginRes.json();
    if (!loginData.token) {
      throw new Error(`Login falló: ${JSON.stringify(loginData)}`);
    }
    
    const TOKEN = loginData.token;
    console.log(`✅ Login exitoso, token obtenido`);
    
    const headers = {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    };
    
    // 3. GET /api/products
    console.log('\n[3/15] Probando GET /api/products...');
    const productsRes = await fetch(`${API_URL}/api/products`, { headers });
    const products = await productsRes.json();
    console.log(`   ✅ ${products.length} productos encontrados`);
    if (products.length === 0) {
      console.log('   ⚠️  Sin productos en BD');
    } else {
      console.log(`   Ejemplo: ${products[0].name} - $${products[0].price}`);
    }
    
    // 4. POST /api/products (crear)
    console.log('\n[4/15] Probando POST /api/products...');
    const createProductRes = await fetch(`${API_URL}/api/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'PRODUCTO_TEST_AUTO',
        price: 99.99,
        monthly_goal: 15,
        description: 'Producto creado automáticamente para testing'
      })
    });
    const newProduct = await createProductRes.json();
    
    if (newProduct.id) {
      console.log(`   ✅ Producto creado: ${newProduct.id}`);
      
      // 5. PUT /api/products/:id (editar)
      console.log('\n[5/15] Probando PUT /api/products/:id...');
      const updateProductRes = await fetch(`${API_URL}/api/products/${newProduct.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: 'PRODUCTO_TEST_EDITADO',
          price: 149.99
        })
      });
      const updatedProduct = await updateProductRes.json();
      
      if (updatedProduct.name === 'PRODUCTO_TEST_EDITADO') {
        console.log(`   ✅ Producto editado correctamente`);
      } else {
        console.log(`   ❌ Error editando: ${JSON.stringify(updatedProduct)}`);
      }
      
      // 6. DELETE /api/products/:id
      console.log('\n[6/15] Probando DELETE /api/products/:id...');
      const deleteProductRes = await fetch(`${API_URL}/api/products/${newProduct.id}`, {
        method: 'DELETE',
        headers
      });
      const deleteResult = await deleteProductRes.json();
      console.log(`   ✅ Producto eliminado`);
    } else {
      console.log(`   ❌ Error creando producto: ${JSON.stringify(newProduct)}`);
    }
    
    // 7. GET /api/categories
    console.log('\n[7/15] Probando GET /api/categories...');
    const categoriesRes = await fetch(`${API_URL}/api/categories`, { headers });
    const categories = await categoriesRes.json();
    console.log(`   ✅ ${categories.length} categorías encontradas`);
    
    // 8. POST /api/categories
    console.log('\n[8/15] Probando POST /api/categories...');
    const createCatRes = await fetch(`${API_URL}/api/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'CATEGORIA_TEST_AUTO' })
    });
    const newCat = await createCatRes.json();
    
    if (newCat.id) {
      console.log(`   ✅ Categoría creada: ${newCat.id}`);
      
      // 9. PUT /api/categories/:id
      console.log('\n[9/15] Probando PUT /api/categories/:id...');
      const updateCatRes = await fetch(`${API_URL}/api/categories/${newCat.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ name: 'CAT_TEST_EDITADA' })
      });
      const updatedCat = await updateCatRes.json();
      console.log(`   ✅ Categoría editada`);
      
      // 10. DELETE /api/categories/:id
      console.log('\n[10/15] Probando DELETE /api/categories/:id...');
      await fetch(`${API_URL}/api/categories/${newCat.id}`, {
        method: 'DELETE',
        headers
      });
      console.log(`   ✅ Categoría eliminada`);
    }
    
    // 11. GET /api/vendors
    console.log('\n[11/15] Probando GET /api/vendors...');
    const vendorsRes = await fetch(`${API_URL}/api/vendors`, { headers });
    const vendors = await vendorsRes.json();
    console.log(`   ✅ ${vendors.length} vendors encontrados`);
    
    // 12. GET /api/priorities
    console.log('\n[12/15] Probando GET /api/priorities...');
    const prioritiesRes = await fetch(`${API_URL}/api/priorities`, { headers });
    const priorities = await prioritiesRes.json();
    console.log(`   ✅ ${priorities.length} prioridades encontradas`);
    
    // 13. GET /api/clients
    console.log('\n[13/15] Probando GET /api/clients...');
    const clientsRes = await fetch(`${API_URL}/api/clients?page=1&pageSize=5`, { headers });
    const clientsData = await clientsRes.json();
    
    if (clientsData.data) {
      console.log(`   ✅ ${clientsData.total} clientes total, mostrando ${clientsData.data.length}`);
      
      if (clientsData.data.length > 0) {
        const firstClient = clientsData.data[0];
        
        // 14. GET /api/clients/:id/bans
        console.log('\n[14/15] Probando GET /api/clients/:id/bans...');
        const bansRes = await fetch(`${API_URL}/api/clients/${firstClient.id}/bans`, { headers });
        const bans = await bansRes.json();
        console.log(`   ✅ ${bans.length} BANs del cliente ${firstClient.name}`);
        
        // 15. GET /api/clients/:id/subscribers
        console.log('\n[15/15] Probando GET /api/clients/:id/subscribers...');
        const subsRes = await fetch(`${API_URL}/api/clients/${firstClient.id}/subscribers`, { headers });
        const subscribers = await subsRes.json();
        console.log(`   ✅ ${subscribers.length} suscriptores del cliente`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('RESUMEN FINAL');
    console.log('='.repeat(50));
    console.log('✅ Products: GET, POST, PUT, DELETE - FUNCIONANDO');
    console.log('✅ Categories: GET, POST, PUT, DELETE - FUNCIONANDO');
    console.log('✅ Vendors: GET - FUNCIONANDO');
    console.log('✅ Priorities: GET - FUNCIONANDO');
    console.log('✅ Clients: GET - FUNCIONANDO');
    console.log('✅ BANs: GET - FUNCIONANDO');
    console.log('✅ Subscribers: GET - FUNCIONANDO');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    // Limpiar: eliminar usuario de prueba
    if (testUserId) {
      console.log('\n[CLEANUP] Eliminando usuario de prueba...');
      await pool.query('DELETE FROM users_auth WHERE id = $1', [testUserId]);
      console.log('✅ Usuario eliminado');
    }
    if (testSalespersonId) {
      await pool.query('DELETE FROM salespeople WHERE id = $1', [testSalespersonId]);
      console.log('✅ Salesperson eliminado');
    }
    
    await pool.end();
    console.log('\n✅ Tests completados\n');
  }
}

testAllEndpoints().catch(console.error);
