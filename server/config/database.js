const { Sequelize } = require('sequelize');
require('dotenv').config();

// Configurar conexión a PostgreSQL
const sequelize = new Sequelize(
  process.env.DB_NAME || 'momvision_cms',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgresql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Función para probar la conexión
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL conectado correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    return false;
  }
};

// Función para sincronizar modelos
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Modelos sincronizados con PostgreSQL');
  } catch (error) {
    console.error('❌ Error sincronizando modelos:', error.message);
  }
};

module.exports = {
  sequelize,
  testConnection,
  syncDatabase
};