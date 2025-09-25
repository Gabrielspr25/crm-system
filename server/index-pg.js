const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { testConnection, syncDatabase } = require('./config/database');
require('dotenv').config();

const app = express();

// Middleware de seguridad
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de 100 requests por windowMs
});
app.use('/api/', limiter);

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos
app.use('/uploads', express.static('uploads'));

// Rutas básicas
app.get('/', (req, res) => {
  res.json({
    message: '🚀 MOM Vision CMS API funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: 'PostgreSQL',
    endpoints: {
      health: '/api/health'
    }
  });
});

app.get('/api/health', async (req, res) => {
  const dbConnected = await testConnection();
  
  res.json({
    status: 'OK',
    message: '✅ Servidor funcionando correctamente',
    database: dbConnected ? 'PostgreSQL - Conectado' : 'PostgreSQL - Desconectado',
    timestamp: new Date().toISOString()
  });
});

// Función para inicializar la base de datos
const initializeDatabase = async () => {
  try {
    console.log('🔄 Conectando a PostgreSQL...');
    const connected = await testConnection();
    
    if (connected) {
      console.log('🔄 Sincronizando modelos...');
      await syncDatabase();
      console.log('✅ Base de datos inicializada correctamente');
    } else {
      console.log('⚠️ No se pudo conectar a PostgreSQL');
      console.log('💡 Asegúrate de que PostgreSQL esté ejecutándose');
      console.log('💡 Y verifica las credenciales en el archivo .env');
    }
    
    return connected;
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error.message);
    return false;
  }
};

// Iniciar servidor
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  console.log('🚀 Iniciando MOM Vision CMS...');
  
  // Intentar conectar a la base de datos
  const dbReady = await initializeDatabase();
  
  // Iniciar servidor independientemente del estado de la DB
  app.listen(PORT, () => {
    console.log(`🌟 Servidor corriendo en puerto ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}`);
    console.log(`🔍 Health: http://localhost:${PORT}/api/health`);
    
    if (dbReady) {
      console.log('✅ Sistema completo listo para usar');
    } else {
      console.log('⚠️  Sistema funcionando sin base de datos');
      console.log('💡 Configura PostgreSQL para funcionalidad completa');
    }
  });
};

startServer();

module.exports = app;