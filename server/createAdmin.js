const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const createAdminUser = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/momvision-cms');
    console.log('✅ MongoDB conectado');

    // Verificar si ya existe un admin
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('⚠️ Ya existe un usuario administrador:', existingAdmin.email);
      process.exit(0);
    }

    // Crear usuario admin
    const adminUser = await User.create({
      name: 'Administrador',
      email: 'admin@momvision.com',
      password: 'admin123',
      role: 'admin'
    });

    console.log('🎉 Usuario administrador creado correctamente:');
    console.log('📧 Email:', adminUser.email);
    console.log('🔑 Contraseña: admin123');
    console.log('⚠️ IMPORTANTE: Cambia la contraseña después del primer login');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando usuario admin:', error);
    process.exit(1);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  createAdminUser();
}

module.exports = createAdminUser;