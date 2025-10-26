// Script para ejecutar en el servidor de Digital Ocean
// Actualiza la base de datos para usar contraseñas simples

import pkg from 'pg';
const { Client } = pkg;

const dbConfig = {
  host: '142.93.176.195',
  port: 5432,
  database: 'crm_pro',
  user: 'crm_user',
  password: 'CRM_Seguro_2025!',
};

const db = new Client(dbConfig);

async function updateServerDB() {
  try {
    await db.connect();
    console.log('✅ Conectado a PostgreSQL en servidor');
    
    // Añadir columna password_simple si no existe
    try {
      await db.query('ALTER TABLE users_auth ADD COLUMN IF NOT EXISTS password_simple VARCHAR(50)');
      console.log('✅ Columna password_simple añadida');
    } catch (error) {
      console.log('⚠️ Columna ya existe:', error.message);
    }
    
    // Configurar contraseñas simples para usuarios existentes
    const users = [
      { username: 'gabriel', password: 'gabriel123' },
      { username: 'admin', password: 'admin123' }
    ];
    
    for (const user of users) {
      try {
        const result = await db.query(
          'UPDATE users_auth SET password_simple = $1 WHERE username = $2 RETURNING username', 
          [user.password, user.username]
        );
        if (result.rows.length > 0) {
          console.log(`✅ Password actualizada para ${user.username}: ${user.password}`);
        } else {
          console.log(`⚠️ Usuario ${user.username} no encontrado`);
        }
      } catch (error) {
        console.log(`❌ Error actualizando ${user.username}:`, error.message);
      }
    }
    
    // Mostrar usuarios actuales
    const allUsers = await db.query('SELECT username, password_simple, rol FROM users_auth WHERE activo = true ORDER BY username');
    
    console.log('\n📋 USUARIOS EN SERVIDOR:');
    allUsers.rows.forEach(user => {
      console.log(`   - ${user.username} (${user.rol}): ${user.password_simple || 'SIN_PASSWORD_SIMPLE'}`);
    });
    
    console.log('\n🎯 SISTEMA LISTO EN SERVIDOR');
    console.log('🔑 Credenciales de acceso:');
    console.log('   gabriel / gabriel123');
    console.log('   admin / admin123');
    
    await db.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

updateServerDB();





