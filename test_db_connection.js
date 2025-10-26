import pkg from 'pg';
const { Client } = pkg;

// Configuración de BD - igual que en server.js
const dbConfig = {
  host: process.env.DB_HOST || '142.93.176.195',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_DATABASE || 'crm_pro',
  user: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!',
  connectTimeoutMillis: 10000,
  query_timeout: 10000
};

console.log('🔍 Configuración de BD:');
console.log(`   Host: ${dbConfig.host}`);
console.log(`   Puerto: ${dbConfig.port}`);
console.log(`   Base de datos: ${dbConfig.database}`);
console.log(`   Usuario: ${dbConfig.user}`);
console.log(`   Password: ${dbConfig.password.substring(0, 4)}...`);

async function testConnection() {
  const client = new Client(dbConfig);
  
  try {
    console.log('\n🔗 Intentando conectar a PostgreSQL...');
    
    await client.connect();
    console.log('✅ Conexión exitosa!');
    
    // Probar una query simple
    const result = await client.query('SELECT NOW() as current_time');
    console.log('⏰ Tiempo del servidor:', result.rows[0].current_time);
    
    // Probar si existen las tablas principales
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📊 Tablas encontradas:');
    tables.rows.forEach(table => console.log(`   - ${table.table_name}`));
    
    // Probar la tabla de usuarios
    try {
      const users = await client.query('SELECT COUNT(*) as count FROM users_auth');
      console.log(`👤 Usuarios en BD: ${users.rows[0].count}`);
    } catch (err) {
      console.log('❌ Error consultando users_auth:', err.message);
    }
    
  } catch (error) {
    console.log('❌ ERROR DE CONEXIÓN:', error.message);
    console.log('💡 Detalles:', error);
  } finally {
    try {
      await client.end();
      console.log('🔌 Conexión cerrada');
    } catch (err) {
      console.log('⚠️ Error cerrando conexión:', err.message);
    }
  }
}

testConnection();