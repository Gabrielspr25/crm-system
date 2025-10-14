import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pkg from 'pg';
const { Client } = pkg;
import { createServer } from 'http';
import { Server } from 'socket.io';

// Manejo global de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ ERROR NO CAPTURADO:', error);
  console.error('Stack:', error.stack);
  // No salir del proceso para debug
  // process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ PROMESA RECHAZADA NO MANEJADA:', reason);
  console.error('Promesa:', promise);
  // No salir del proceso para debug
  // process.exit(1);
});

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://crmp.ss-group.cloud", "http://crmp.ss-group.cloud"]
      : ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ["https://crmp.ss-group.cloud", "http://crmp.ss-group.cloud"]
    : ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.use(express.json());

// SOLUCIÃ“N: Middleware de logs detallados para errores
app.use((req, res, next) => {
  console.log(`ðŸ“¨ ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('ðŸ“„ Body:', req.body);
  }
  next();
});

app.use(express.static('dist'));

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '142.93.176.195',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_DATABASE || 'crm_pro',
  user: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD || 'CRM_Seguro_2025!',
};

// Database connection
const db = new Client(dbConfig);

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'CRM_Pro_JWT_Seguro_2025_Produccion_Key_Ultra_Secreto';
const JWT_EXPIRES_IN = '24h';

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`🔗 Cliente conectado: ${socket.id}`);
  
  socket.on('join-room', (data) => {
    socket.join('crm-updates');
    console.log(`🏠 Cliente ${socket.id} se unió a sala crm-updates`);
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
  });
});

// Helper function to broadcast data changes
const broadcastUpdate = (type, data, action = 'created') => {
  console.log(`📡 Broadcasting ${action} ${type}:`, data?.id || 'unknown');
  io.to('crm-updates').emit('data-update', {
    type,
    action, // created, updated, deleted
    data,
    timestamp: new Date().toISOString()
  });
};

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    console.log('ðŸ”— Database already connected');
    return;
  }
  
  try {
    await db.connect();
    isConnected = true;
    console.log('âœ… Connected to PostgreSQL database');
  } catch (error) {
    console.error('âŒ Database connection error:', error);
    process.exit(1);
  }
}

// Debug middleware específico para POST /api/metas
app.use((req, res, next) => {
  if (req.path === '/api/metas' && req.method === 'POST') {
    console.log('🧾 RAW AUTH HEADER:', req.headers.authorization);
    console.log('🧾 ALL HEADERS:', req.headers);
  }
  next();
});

// Middleware for JWT verification
const verifyToken = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const parts = auth.split(' ');
  
  console.log('🔍 AUTH PARTS:', parts, 'len token:', (parts[1] || '').length);
  
  const token = parts[1];
  if (!token) {
    console.log('❌ No token provided. Auth header:', auth);
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    console.log('🔍 Verificando token con JWT_SECRET:', JWT_SECRET);
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token decodificado exitosamente:', decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('❌ Error verificando token:', error.message);
    console.log('❌ Token recibido:', token.substring(0, 20) + '...');
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware para verificar si es admin
const requireAdmin = async (req, res, next) => {
  try {
    const userResult = await db.query(
      'SELECT s.role FROM salespeople s JOIN users_auth ua ON ua.salesperson_id = s.id WHERE ua.id = $1',
      [req.user.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: 'User not found' });
    }
    
    const userRole = userResult.rows[0].role;
    console.log('🔒 Role check:', userRole, 'for user:', req.user.username);
    
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('Error checking admin role:', error);
    return res.status(500).json({ error: 'Role verification failed' });
  }
};

// Middleware para filtrar datos según rol
const filterDataByRole = async (req, res, next) => {
  try {
    console.log('🔍 PRODUCCION - Verificando rol del usuario:', req.user.userId);
    
    // Buscar usuario en users_auth y obtener datos del vendedor
    const userResult = await db.query(
      'SELECT ua.*, s.role, s.id as salesperson_id FROM users_auth ua JOIN salespeople s ON ua.salesperson_id = s.id WHERE ua.id = $1',
      [req.user.userId]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ Usuario no encontrado con ID:', req.user.userId);
      return res.status(403).json({ error: 'User not found' });
    }
    
    req.userRole = userResult.rows[0].role;
    req.salespersonId = userResult.rows[0].salesperson_id;
    
    console.log('👤 PRODUCCION - User role:', req.userRole, 'Salesperson ID:', req.salespersonId);
    next();
  } catch (error) {
    console.error('❌ Error getting user role:', error);
    return res.status(500).json({ error: 'Role verification failed' });
  }
};

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Temporary endpoint to see salespeople (for debugging)
app.get('/api/debug/salespeople', async (req, res) => {
  try {
    const salespeople = await db.query('SELECT id, name, email, role FROM salespeople ORDER BY name');
    console.log('👥 Salespeople in database:', salespeople.rows);
    res.json({ salespeople: salespeople.rows });
  } catch (error) {
    console.error('❌ Error getting salespeople:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// DEBUG: Endpoint para obtener datos sin autenticación (temporal)
app.get('/api/debug/crm-data-no-auth', async (req, res) => {
  try {
    console.log('🔍 Obteniendo datos del CRM sin autenticación...');
    
    const [salespeople, categories, products, clients, bans, pipeline_statuses] = await Promise.all([
      db.query('SELECT * FROM salespeople ORDER BY name'),
      db.query('SELECT * FROM categories ORDER BY name'),
      db.query('SELECT * FROM products ORDER BY name'),
      db.query('SELECT * FROM clients ORDER BY name'),
      db.query('SELECT * FROM bans ORDER BY id'),
      db.query('SELECT * FROM pipeline_statuses ORDER BY name')
    ]);
    
    // Formatear productos
    const formattedProducts = products.rows.map(product => ({
      id: product.id,
      name: product.name,
      categoryId: product.category_id,
      price: parseFloat(product.price) || 0,
      monthlyGoal: parseFloat(product.monthly_goal) || 0
    }));
    
    console.log('📊 Datos encontrados:');
    console.log(`  - Vendedores: ${salespeople.rows.length}`);
    console.log(`  - Categorías: ${categories.rows.length}`);
    console.log(`  - Productos: ${products.rows.length}`);
    console.log(`  - Clientes: ${clients.rows.length}`);
    
    res.json({
      salespeople: salespeople.rows,
      categories: categories.rows,
      products: formattedProducts,
      clients: clients.rows,
      bans: bans.rows,
      subscribers: [],
      pipelineStatuses: pipeline_statuses.rows,
      incomes: [],
      expenses: [],
      metas: []
    });
  } catch (error) {
    console.error('❌ Error obteniendo datos del CRM:', error);
    res.status(500).json({ error: 'Error obteniendo datos', details: error.message });
  }
});

// PRODUCCIÓN: Endpoint para poner productos en cero
app.get('/api/debug/zero-products', async (req, res) => {
  try {
    console.log('📋 Poniendo todos los productos en cero...');
    
    // Actualizar todos los productos a precio 0 y meta 0
    const updated = await db.query(
      'UPDATE products SET price = 0, monthly_goal = 0 RETURNING name, price, monthly_goal'
    );
    
    console.log(`✅ ${updated.rows.length} productos actualizados a cero`);
    
    res.json({ 
      success: true, 
      message: `${updated.rows.length} productos actualizados a precio $0 y meta 0`,
      products: updated.rows
    });
    
  } catch (error) {
    console.error('❌ Error actualizando productos:', error);
    res.status(500).json({ error: 'Error actualizando productos', details: error.message });
  }
});

// PRODUCCIÓN: Endpoint para crear productos de Claro
app.get('/api/debug/create-claro-products', async (req, res) => {
  try {
    console.log('📱 Creando productos de Claro...');
    
    // 1. Obtener IDs de categorías
    const categoriesResult = await db.query('SELECT id, name FROM categories');
    const categories = {};
    categoriesResult.rows.forEach(cat => {
      categories[cat.name] = cat.id;
    });
    
    console.log('📝 Categorías disponibles:', categories);
    
    // 2. Eliminar productos existentes para empezar limpio
    const deleted = await db.query('DELETE FROM products RETURNING name');
    console.log('🗑️ Productos eliminados:', deleted.rows.length);
    
    // 3. Definir productos por categoría
    const products = [
      // Móvil
      { name: 'Renovación Móvil', category: 'Móvil', price: 45.00, monthly_goal: 30 },
      { name: 'Nueva Móvil', category: 'Móvil', price: 50.00, monthly_goal: 25 },
      
      // Fijo
      { name: 'Renovación Fijo', category: 'Fijo', price: 40.00, monthly_goal: 20 },
      { name: 'Nueva Fijo', category: 'Fijo', price: 45.00, monthly_goal: 15 },
      { name: 'MPLS', category: 'Fijo', price: 150.00, monthly_goal: 5 },
      
      // Claro TV Cloud
      { name: 'Essential', category: 'Claro TV Cloud', price: 25.00, monthly_goal: 40 },
      
      // Pos
      { name: 'Tango', category: 'Pos', price: 35.00, monthly_goal: 20 }
    ];
    
    // 4. Crear productos
    let created = 0;
    for (const product of products) {
      const categoryId = categories[product.category];
      if (!categoryId) {
        console.log(`❌ Categoría no encontrada: ${product.category}`);
        continue;
      }
      
      await db.query(
        'INSERT INTO products (name, category_id, price, monthly_goal) VALUES ($1, $2, $3, $4)',
        [product.name, categoryId, product.price, product.monthly_goal]
      );
      created++;
      console.log(`✅ Producto creado: ${product.name} (${product.category}) - $${product.price}`);
    }
    
    // 5. Verificar productos creados
    const finalProducts = await db.query(`
      SELECT p.id, p.name, p.price, p.monthly_goal, c.name as category_name 
      FROM products p 
      JOIN categories c ON p.category_id = c.id 
      ORDER BY c.name, p.name
    `);
    
    res.json({ 
      success: true, 
      message: `${created} productos de Claro creados correctamente`,
      deleted_count: deleted.rows.length,
      products: finalProducts.rows
    });
    
  } catch (error) {
    console.error('❌ Error creando productos:', error);
    res.status(500).json({ error: 'Error creando productos', details: error.message });
  }
});

// PRODUCCIÓN: Endpoint para arreglar categorías
app.get('/api/debug/fix-categories', async (req, res) => {
  try {
    console.log('🗂️ Arreglando categorías de producción...');
    
    // 1. Eliminar todas las categorías existentes
    const deleted = await db.query('DELETE FROM categories RETURNING name');
    console.log('🗑️ Categorías eliminadas:', deleted.rows.map(r => r.name));
    
    // 2. Crear las categorías correctas de Claro
    const categories = ['Móvil', 'Fijo', 'Claro TV Cloud', 'Pos'];
    
    let created = 0;
    for (const categoryName of categories) {
      await db.query(
        'INSERT INTO categories (name) VALUES ($1)',
        [categoryName]
      );
      created++;
      console.log(`✅ Categoría creada: ${categoryName}`);
    }
    
    // 3. Verificar categorías creadas
    const finalCategories = await db.query('SELECT id, name FROM categories ORDER BY name');
    
    res.json({ 
      success: true, 
      message: `${created} categorías creadas correctamente`,
      deleted_count: deleted.rows.length,
      categories: finalCategories.rows
    });
    
  } catch (error) {
    console.error('❌ Error arreglando categorías:', error);
    res.status(500).json({ error: 'Error arreglando categorías', details: error.message });
  }
});

// PRODUCCIÓN: Endpoint para crear usuarios de login
app.get('/api/debug/create-production-users', async (req, res) => {
  try {
    console.log('🚀 Creando usuarios de producción...');
    
    // Hash para contraseña '1234'
    const passwordHash = '$2b$10$Wey00b70YXE2mQRaI5NRnOn2Tpo6hAkKPUYGYhhIu65xDe9eTlAQ6';
    
    // Limpiar usuarios existentes
    await db.query('DELETE FROM users_auth');
    
    // Crear usuarios para cada vendedor
    const users = [
      { username: 'admin', salesperson_id: '541ef303-916d-4e43-92fa-81458d156058', email: 'admin@crm.com' },
      { username: 'dayana', salesperson_id: '5f6e5b72-8091-4cf2-8e5e-4a5d0b1e74ab', email: 'dayana.sepulveda@claroprssdelivery.com' },
      { username: 'gabriel', salesperson_id: 'c820965a-e7dc-4a0f-a087-fd237ace9854', email: 'gsanchez@claroprossdelivery.com' },
      { username: 'mayra', salesperson_id: '74c24f36-b209-4f36-b105-88f8e4896cd9', email: 'admin@claroprssdelivery.com' },
      { username: 'randy', salesperson_id: 'e2e35982-1928-4e6a-bad9-5e3b24efbb48', email: 'venta.empresas@claroprssdelivery.com' },
      { username: 'hernan', salesperson_id: '70eea7f2-c091-449f-9c63-83c873ca7a18', email: 'ssgroup@claropr.com' }
    ];
    
    let created = 0;
    for (const user of users) {
      await db.query(
        `INSERT INTO users_auth (username, email, password_hash, salesperson_id, is_active, created_at) 
         VALUES ($1, $2, $3, $4, true, NOW())`,
        [user.username, user.email, passwordHash, user.salesperson_id]
      );
      created++;
    }
    
    console.log(`✅ ${created} usuarios de producción creados exitosamente`);
    res.json({ 
      success: true, 
      message: `${created} usuarios creados`, 
      users: users.map(u => ({ username: u.username, password: '1234' }))
    });
    
  } catch (error) {
    console.error('❌ Error creando usuarios:', error);
    res.status(500).json({ error: 'Error creando usuarios', details: error.message });
  }
});

// DEBUG: Endpoint para ver datos sin autenticación
app.get('/api/debug/check-data', async (req, res) => {
  try {
    console.log('🔍 Verificando datos en la base de datos...');
    
    const salespeople = await db.query('SELECT COUNT(*) as count FROM salespeople');
    const clients = await db.query('SELECT COUNT(*) as count FROM clients');
    
    let products = { rows: [{ count: 0 }] };
    let categories = { rows: [{ count: 0 }] };
    let pipeline_statuses = { rows: [{ count: 0 }] };
    let categoriesList = { rows: [] };
    let productsList = { rows: [] };
    
    try {
      products = await db.query('SELECT COUNT(*) as count FROM products');
      productsList = await db.query('SELECT id, name, price, monthly_goal FROM products ORDER BY name');
    } catch (e) {
      console.log('❌ Tabla products no existe');
    }
    
    try {
      categories = await db.query('SELECT COUNT(*) as count FROM categories');
      categoriesList = await db.query('SELECT id, name, created_at FROM categories ORDER BY name');
    } catch (e) {
      console.log('❌ Tabla categories no existe');
    }
    
    try {
      pipeline_statuses = await db.query('SELECT COUNT(*) as count FROM pipeline_statuses');
    } catch (e) {
      console.log('❌ Tabla pipeline_statuses no existe');
    }
    
    const result = {
      salespeople: parseInt(salespeople.rows[0].count),
      clients: parseInt(clients.rows[0].count),
      products: parseInt(products.rows[0].count),
      categories: parseInt(categories.rows[0].count),
      pipeline_statuses: parseInt(pipeline_statuses.rows[0].count),
      total_data: parseInt(salespeople.rows[0].count) + parseInt(clients.rows[0].count) + parseInt(products.rows[0].count),
      details: {
        categories: categoriesList.rows,
        products: productsList.rows
      }
    };
    
    console.log('📊 Datos encontrados:', result);
    console.log('📋 Categorías:', result.details.categories);
    console.log('🛍️ Productos:', result.details.products);
    res.json(result);
  } catch (error) {
    console.error('❌ Error verificando datos:', error);
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Endpoint para verificar todas las tablas y datos
app.get('/api/debug/tables', async (req, res) => {
  try {
    const tables = ['salespeople', 'clients', 'products', 'categories', 'bans', 'subscribers', 'pipeline_statuses', 'incomes', 'expenses', 'metas'];
    const results = {};
    
    for (const table of tables) {
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
        const sample = await db.query(`SELECT * FROM ${table} LIMIT 3`);
        results[table] = {
          count: parseInt(result.rows[0].count),
          sample: sample.rows
        };
      } catch (error) {
        results[table] = {
          error: error.message,
          exists: false
        };
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('❌ Error checking tables:', error);
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Endpoint GET para inicializar la base de datos con datos básicos - DESHABILITADO
app.get('/api/debug/init-now-DISABLED', async (req, res) => {
  res.status(403).json({ 
    error: 'Endpoint deshabilitado para prevenir duplicación de datos',
    message: 'Los datos ya han sido inicializados correctamente'
  });
});

// DEBUG: Endpoint para ver TODOS los productos y categorías con detalles completos
app.get('/api/debug/detailed-data', async (req, res) => {
  try {
    console.log('🔍 Obteniendo datos detallados...');
    
    // Obtener todas las categorías con detalles
    const categories = await db.query(`
      SELECT id, name, created_at 
      FROM categories 
      ORDER BY name
    `);
    
    // Obtener todos los productos con detalles
    const products = await db.query(`
      SELECT id, name, price, monthly_goal, created_at 
      FROM products 
      ORDER BY name
    `);
    
    // Obtener estados del pipeline
    const pipelineStatuses = await db.query(`
      SELECT id, name, color, created_at 
      FROM pipeline_statuses 
      ORDER BY name
    `);
    
    const result = {
      categories: categories.rows,
      products: products.rows,
      pipelineStatuses: pipelineStatuses.rows,
      summary: {
        total_categories: categories.rows.length,
        total_products: products.rows.length,
        total_pipeline_statuses: pipelineStatuses.rows.length
      }
    };
    
    console.log('📋 Categorías encontradas:', categories.rows);
    console.log('🛍️ Productos encontrados:', products.rows);
    console.log('📊 Estados pipeline:', pipelineStatuses.rows);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo datos detallados:', error);
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Endpoint para limpiar TODAS las categorías automáticas y crear solo las del usuario
app.get('/api/debug/reset-categories', async (req, res) => {
  try {
    console.log('🧹 LIMPIANDO todas las categorías automáticas...');
    
    // 1. ELIMINAR TODAS las categorías existentes (porque todas son automáticas)
    const deletedAll = await db.query(`
      DELETE FROM categories 
      RETURNING name
    `);
    
    console.log('🗑️ Categorías eliminadas:', deletedAll.rows.map(row => row.name));
    
    // 2. CREAR SOLO las 4 categorías que el usuario quiere
    const userCategories = ['Móvil', 'Fijo', 'Claro TV', 'Cloud'];
    const createdCategories = [];
    
    for (const categoryName of userCategories) {
      const result = await db.query(`
        INSERT INTO categories (name) 
        VALUES ($1)
        RETURNING *
      `, [categoryName]);
      
      createdCategories.push(result.rows[0]);
      console.log(`✅ Categoría creada: ${categoryName}`);
    }
    
    // 3. Verificar resultado final
    const allCategories = await db.query('SELECT * FROM categories ORDER BY name');
    
    const result = {
      success: true,
      message: '🎯 Categorías resetadas correctamente',
      deleted: deletedAll.rows.map(row => row.name),
      created: createdCategories.map(c => c.name),
      final_categories: allCategories.rows
    };
    
    console.log('🎉 Categorías finales:', allCategories.rows.map(c => c.name));
    res.json(result);
  } catch (error) {
    console.error('❌ Error reseteando categorías:', error);
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Endpoint temporal para verificar datos sin autenticación
app.get('/api/debug/crm-data-no-auth', async (req, res) => {
  try {
    console.log('🔍 Obteniendo datos CRM sin autenticación para debug...');
    
    const categoriesResult = await db.query('SELECT * FROM categories ORDER BY name');
    const productsResult = await db.query('SELECT * FROM products ORDER BY name');
    const pipelineStatusesResult = await db.query(`
      SELECT * FROM pipeline_statuses ORDER BY name
    `);
    
    const result = {
      categories: categoriesResult.rows,
      products: productsResult.rows,
      pipelineStatuses: pipelineStatusesResult.rows,
      debug_info: {
        total_categories: categoriesResult.rows.length,
        total_products: productsResult.rows.length,
        total_pipeline_statuses: pipelineStatusesResult.rows.length,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📋 Categorías en BD:', categoriesResult.rows.map(c => c.name));
    console.log('🛍️ Productos en BD:', productsResult.rows.map(p => p.name));
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo datos CRM:', error);
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Endpoint para crear las categorías correctas del usuario
app.get('/api/debug/create-user-categories', async (req, res) => {
  try {
    console.log('📋 CREANDO categorías del usuario...');
    
    // Crear las 4 categorías que el usuario especificó
    const categories = ['Móvil', 'Fijo', 'Claro TV', 'Cloud'];
    const createdCategories = [];
    
    for (const categoryName of categories) {
      try {
        const result = await db.query(`
          INSERT INTO categories (name) 
          SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE LOWER(name) = LOWER($1))
          RETURNING *
        `, [categoryName]);
        
        if (result.rows.length > 0) {
          createdCategories.push(result.rows[0]);
          console.log(`✅ Categoría creada: ${categoryName}`);
        } else {
          console.log(`📋 Categoría ya existe: ${categoryName}`);
        }
      } catch (error) {
        console.error(`❌ Error creando categoría ${categoryName}:`, error);
      }
    }
    
    // Verificar todas las categorías actuales
    const allCategories = await db.query('SELECT * FROM categories ORDER BY name');
    
    const result = {
      success: true,
      message: 'Categorías del usuario creadas correctamente',
      created: createdCategories,
      all_categories: allCategories.rows
    };
    
    console.log('🎉 Categorías finales:', allCategories.rows);
    res.json(result);
  } catch (error) {
    console.error('❌ Error creando categorías del usuario:', error);
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Endpoint para limpiar datos automáticos y conservar solo los del usuario
app.get('/api/debug/clean-auto-data', async (req, res) => {
  try {
    console.log('🧹 LIMPIANDO datos automáticos...');
    
    // Eliminar productos automáticos (los que tienen nombres específicos que creamos automáticamente)
    const deletedProducts = await db.query(`
      DELETE FROM products 
      WHERE name IN ('Plan Móvil', 'Internet Hogar')
      RETURNING name
    `);
    
    // Eliminar categorías automáticas  
    const deletedCategories = await db.query(`
      DELETE FROM categories 
      WHERE name IN ('Móvil', 'Internet')
      RETURNING name
    `);
    
    // Eliminar estados de pipeline automáticos
    const deletedPipelineStatuses = await db.query(`
      DELETE FROM pipeline_statuses 
      WHERE name IN ('Prospecto', 'Ganado')
      RETURNING name
    `);
    
    const result = {
      success: true,
      message: 'Datos automáticos eliminados',
      deleted: {
        products: deletedProducts.rows.map(row => row.name),
        categories: deletedCategories.rows.map(row => row.name),
        pipeline_statuses: deletedPipelineStatuses.rows.map(row => row.name)
      }
    };
    
    console.log('🗑️ Eliminados:', result.deleted);
    res.json(result);
  } catch (error) {
    console.error('❌ Error limpiando datos:', error);
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Endpoint para inicializar la base de datos con datos de ejemplo
app.post('/api/debug/init-database', async (req, res) => {
  try {
    console.log('🚀 Inicializando base de datos con datos básicos...');
    
    // Crear tablas básicas una por una
    
    // 1. Crear tabla de categorías
    await db.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 2. Crear tabla de productos
    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) DEFAULT 0,
        monthly_goal DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 3. Crear tabla de estados del pipeline
    await db.query(`
      CREATE TABLE IF NOT EXISTS pipeline_statuses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        color VARCHAR(20) DEFAULT '#10b981',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 4. Insertar categorías básicas
    await db.query(`
      INSERT INTO categories (name) 
      SELECT 'Móvil' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Móvil')
    `);
    
    await db.query(`
      INSERT INTO categories (name) 
      SELECT 'Internet' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Internet')
    `);
    
    // 5. Insertar productos básicos
    await db.query(`
      INSERT INTO products (name, price, monthly_goal) 
      SELECT 'Plan Móvil', 35.00, 50 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Plan Móvil')
    `);
    
    await db.query(`
      INSERT INTO products (name, price, monthly_goal) 
      SELECT 'Internet Hogar', 45.00, 30 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Internet Hogar')
    `);
    
    // 6. Insertar estados del pipeline
    await db.query(`
      INSERT INTO pipeline_statuses (name, color) 
      SELECT 'Prospecto', '#3b82f6' WHERE NOT EXISTS (SELECT 1 FROM pipeline_statuses WHERE name = 'Prospecto')
    `);
    
    await db.query(`
      INSERT INTO pipeline_statuses (name, color) 
      SELECT 'Ganado', '#10b981' WHERE NOT EXISTS (SELECT 1 FROM pipeline_statuses WHERE name = 'Ganado')
    `);
    
    console.log('✅ Base de datos inicializada correctamente con datos básicos');
    res.json({ 
      success: true, 
      message: '✅ Base de datos inicializada con categorías, productos y estados del pipeline' 
    });
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Login endpoint - PRODUCCION
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('🔐 PRODUCCION - Login attempt for:', username);
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }
    
    // PRODUCCION: Use users_auth table with password hash verification
    const userResult = await db.query(`
      SELECT ua.*, s.name, s.email, s.role, s.avatar, s.monthly_sales_goal
      FROM users_auth ua 
      JOIN salespeople s ON ua.salesperson_id = s.id 
      WHERE ua.username = $1 AND ua.is_active = true
    `, [username]);
    
    console.log(`🔍 Searching for user: "${username}"`);
    console.log(`📊 Found ${userResult.rows.length} results`);
    
    if (userResult.rows.length === 0) {
      // Show available usernames
      const allUsers = await db.query('SELECT username FROM users_auth WHERE is_active = true ORDER BY username');
      console.log('📋 Available usernames:', allUsers.rows.map(row => row.username));
      console.log('❌ User not found:', username);
      return res.status(401).json({ 
        message: `Usuario no encontrado. Nombres disponibles: ${allUsers.rows.map(row => row.username).join(', ')}` 
      });
    }
    
    const user = userResult.rows[0];
    
    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', username);
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }
    
    // Create JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        salespersonId: user.salesperson_id,
        username: user.username,
        email: user.email,
        role: user.role || 'vendedor'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    // Return user data
    const userData = {
      id: user.salesperson_id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role || 'vendedor',
      avatar: user.avatar,
      monthlyGoal: parseFloat(user.monthly_sales_goal) || 0,
      theme: {
        mode: 'dark',
        primaryColor: '#10b981',
        bgColor: '#0f172a',
        textColor: '#f8fafc',
        sidebarColor: '#1e293b'
      }
    };
    
    console.log('✅ PRODUCCION - Login successful for:', username);
    
    res.json({
      success: true,
      token,
      user: userData
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Update user theme preferences
app.put('/api/user/theme', verifyToken, async (req, res) => {
  try {
    const { theme } = req.body;
    const { salespersonId } = req.user;
    
    console.log('ðŸŽ¨ Updating theme for salesperson:', salespersonId);
    
    const result = await db.query(`
      UPDATE salespeople 
      SET theme_mode = $1, theme_primary_color = $2, theme_bg_color = $3,
          theme_text_color = $4, theme_sidebar_color = $5
      WHERE id = $6
      RETURNING theme_mode, theme_primary_color, theme_bg_color, theme_text_color, theme_sidebar_color
    `, [
      theme.mode,
      theme.primaryColor,
      theme.bgColor,
      theme.textColor,
      theme.sidebarColor,
      salespersonId
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const updatedTheme = {
      mode: result.rows[0].theme_mode,
      primaryColor: result.rows[0].theme_primary_color,
      bgColor: result.rows[0].theme_bg_color,
      textColor: result.rows[0].theme_text_color,
      sidebarColor: result.rows[0].theme_sidebar_color
    };
    
    console.log('âœ… Theme updated successfully');
    res.json({ success: true, theme: updatedTheme });
    
  } catch (error) {
    console.error('âŒ Error updating theme:', error);
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

// Function to calculate expiration date for subscribers
function calculateExpirationDate(monthsSold, paymentsMade) {
  if (!monthsSold || !paymentsMade || monthsSold <= 0) {
    return null; // Return null if invalid data
  }
  
  const remainingMonths = monthsSold - paymentsMade;
  if (remainingMonths <= 0) {
    return 'PAGADO'; // Contract fully paid
  }
  
  const currentDate = new Date();
  const expirationDate = new Date(currentDate);
  expirationDate.setMonth(currentDate.getMonth() + remainingMonths);
  
  return expirationDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

// Get all data for CRM
app.get('/api/crm-data', verifyToken, filterDataByRole, async (req, res) => {
  try {
    console.log('📊 PRODUCCION - Obteniendo todos los datos del CRM...');
    
    // Obtener todos los datos (sin filtros de rol)
    const clientsQuery = 'SELECT * FROM clients ORDER BY name';
    const clientsParams = [];
    
    const [salespeople, categories, products, clients, bans, subscribersRaw, pipelineStatuses, incomes, expenses, metas] = await Promise.all([
      db.query('SELECT * FROM salespeople ORDER BY name'),
      db.query('SELECT * FROM categories ORDER BY name'),
      db.query('SELECT * FROM products ORDER BY name'),
      db.query(clientsQuery, clientsParams),
      db.query('SELECT * FROM bans ORDER BY last_updated DESC'),
      db.query('SELECT * FROM subscribers ORDER BY phone_number'),
      db.query('SELECT * FROM pipeline_statuses ORDER BY name'),
      db.query('SELECT * FROM incomes ORDER BY date DESC'),
      db.query('SELECT * FROM expenses ORDER BY date DESC'),
      db.query('SELECT * FROM metas ORDER BY created_at DESC')
    ]);
    
    console.log(`👤 User role: ${req.userRole}, returning ${clients.rows.length} clients`);
    
    // Process subscribers with automatic expiration date calculation
    const subscribers = subscribersRaw.rows.map(subscriber => ({
      ...subscriber,
      contract_end_date: calculateExpirationDate(subscriber.months_sold, subscriber.payments_made)
    }));

    // Convert products to frontend format with proper number conversion
    const formattedProducts = products.rows.map(product => ({
      id: product.id,
      name: product.name,
      categoryId: product.category_id,
      price: parseFloat(product.price) || 0,
      monthlyGoal: parseFloat(product.monthly_goal) || 0
    }));

    // Convert incomes to frontend format with proper number conversion and include names
    const formattedIncomes = incomes.rows.map(income => {
      const product = products.rows.find(p => p.id === income.product_id);
      const salesperson = salespeople.rows.find(s => s.id === income.salesperson_id);
      
      return {
        id: income.id,
        date: income.date,
        description: income.description,
        amount: parseFloat(income.amount) || 0,
        productId: income.product_id,
        productName: product ? product.name : null,
        salespersonId: income.salesperson_id,
        salespersonName: salesperson ? salesperson.name : null
      };
    });

    // Convert expenses to frontend format with proper number conversion
    const formattedExpenses = expenses.rows.map(expense => ({
      id: expense.id,
      date: expense.date,
      description: expense.description,
      amount: parseFloat(expense.amount) || 0
    }));

    // Convert metas to frontend format
    const formattedMetas = metas.rows.map(meta => ({
      id: meta.id,
      vendedorId: meta.vendedor_id,
      metaValor: parseFloat(meta.meta_valor) || 0,
      periodo: meta.periodo,
      fechaInicio: meta.fecha_inicio,
      fechaFin: meta.fecha_fin,
      activa: meta.activa,
      createdAt: meta.created_at,
      tipoMeta: meta.tipo_meta,
      categoria: meta.categoria,
      descripcion: meta.descripcion,
      year: meta.year,
      month: meta.month
    }));

    res.json({
      salespeople: salespeople.rows,
      categories: categories.rows,
      products: formattedProducts,
      clients: clients.rows,
      bans: bans.rows,
      subscribers: subscribers, // Using processed subscribers with calculated expiration dates
      pipelineStatuses: pipelineStatuses.rows,
      incomes: formattedIncomes,
      expenses: formattedExpenses,
      metas: formattedMetas,
      pipelineNotes: [] // TODO: Add pipeline_notes table if needed
    });
  } catch (error) {
    console.error('Error fetching CRM data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Create new client
app.post('/api/clients', verifyToken, async (req, res) => {
  try {
    console.log('ðŸ“ POST /api/clients received');
    console.log('ðŸ“¦ Headers:', req.headers);
    console.log('ðŸ“„ Body raw:', req.body);
    console.log('ðŸ“„ Body type:', typeof req.body);
    
    const { name, company, email, phone, mobile, salesperson_id, pipeline_status_id } = req.body;
    
    console.log('âœ… Parsed fields:');
    console.log('  - name:', name);
    console.log('  - company:', company);
    console.log('  - email:', email);
    console.log('  - phone:', phone);
    
    const result = await db.query(
      `INSERT INTO clients (name, company, email, phone, mobile, salesperson_id, pipeline_status_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, company, email, phone, mobile, salesperson_id, pipeline_status_id]
    );
    
    console.log('✅ Client created successfully:', result.rows[0]);
    
    // Broadcast update to all connected clients
    broadcastUpdate('clients', result.rows[0], 'created');
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('âŒ Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
app.put('/api/clients/:id', verifyToken, filterDataByRole, async (req, res) => {
  // Si es vendedor, solo puede actualizar sus propios clientes
  if (req.userRole === 'vendedor') {
    const clientCheck = await db.query(
      'SELECT salesperson_id FROM clients WHERE id = $1',
      [req.params.id]
    );
    
    if (clientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    if (clientCheck.rows[0].salesperson_id !== req.salespersonId) {
      return res.status(403).json({ error: 'Access denied. You can only modify your own clients.' });
    }
  }
  try {
    console.log('ðŸ”„ PUT /api/clients/:id received:', req.params.id);
    console.log('ðŸ“„ Request body:', req.body);
    
    const { id } = req.params;
    const clientData = req.body;
    
    // Mapeo de campos frontend -> backend
    const fieldMapping = {
      'salespersonId': 'salesperson_id',
      'pipelineStatusId': 'pipeline_status_id',
      'taxId': 'tax_id',
      'zipCode': 'zip_code'
    };
    
    // Construir campos permitidos para actualizaciÃ³n
    const allowedFields = ['name', 'company', 'email', 'phone', 'mobile', 'address', 'city', 'notes'];
    const mappedFields = Object.keys(fieldMapping);
    
    const updates = {};
    
    // Procesar campos directos
    allowedFields.forEach(field => {
      if (clientData[field] !== undefined) {
        updates[field] = clientData[field];
      }
    });
    
    // Procesar campos mapeados
    mappedFields.forEach(frontendField => {
      if (clientData[frontendField] !== undefined) {
        const backendField = fieldMapping[frontendField];
        updates[backendField] = clientData[frontendField];
      }
    });
    
    console.log('âœ… Campos mapeados para actualizaciÃ³n:', updates);
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    // Construir query dinÃ¡mico con campos mapeados
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(updates)];
    
    console.log('ðŸ“Š Query SQL:', `UPDATE clients SET ${setClause} WHERE id = $1`);
    console.log('ðŸ“Š Valores:', values);
    
    const result = await db.query(
      `UPDATE clients SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    console.log('✅ Cliente actualizado exitosamente:', result.rows[0]);
    
    // Broadcast update to all connected clients
    broadcastUpdate('clients', result.rows[0], 'updated');
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('âŒ Error updating client:', error);
    console.error('âŒ Stack trace:', error.stack);
    res.status(500).json({ error: 'Failed to update client', details: error.message });
  }
});

// Delete client
app.delete('/api/clients/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM clients WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// ============================================================================
// CALLS MODULE API ROUTES
// ============================================================================

// Get all calls with full information
app.get('/api/calls', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM calls_full ORDER BY scheduled_date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching calls:', error);
    res.status(500).json({ error: 'Failed to fetch calls' });
  }
});

// Get single call by ID
app.get('/api/calls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM calls_full WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching call:', error);
    res.status(500).json({ error: 'Failed to fetch call' });
  }
});

// Create new call
app.post('/api/calls', async (req, res) => {
  try {
    const { client_id, assigned_user_id, scheduled_date, status, priority, subject, description } = req.body;
    
    const result = await db.query(
      `INSERT INTO calls (client_id, assigned_user_id, scheduled_date, status, priority, subject, description) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [client_id, assigned_user_id, scheduled_date, status || 'pending', priority || 'medium', subject, description]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating call:', error);
    res.status(500).json({ error: 'Failed to create call' });
  }
});

// Update call
app.put('/api/calls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(updates)];
    
    const result = await db.query(
      `UPDATE calls SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating call:', error);
    res.status(500).json({ error: 'Failed to update call' });
  }
});

// Delete call
app.delete('/api/calls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM calls WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }
    
    res.json({ message: 'Call deleted successfully' });
  } catch (error) {
    console.error('Error deleting call:', error);
    res.status(500).json({ error: 'Failed to delete call' });
  }
});

// Get notes for a call
app.get('/api/calls/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT cn.*, s.name as user_name 
       FROM call_notes cn 
       LEFT JOIN salespeople s ON cn.user_id = s.id 
       WHERE cn.call_id = $1 
       ORDER BY cn.created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching call notes:', error);
    res.status(500).json({ error: 'Failed to fetch call notes' });
  }
});

// Add note to call
app.post('/api/calls/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, content, note_type, is_private } = req.body;
    
    const result = await db.query(
      `INSERT INTO call_notes (call_id, user_id, content, note_type, is_private) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, user_id, content, note_type || 'general', is_private || false]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding call note:', error);
    res.status(500).json({ error: 'Failed to add call note' });
  }
});

// Get attachments for a call
app.get('/api/calls/:id/attachments', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT ca.*, s.name as user_name 
       FROM call_attachments ca 
       LEFT JOIN salespeople s ON ca.user_id = s.id 
       WHERE ca.call_id = $1 
       ORDER BY ca.created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching call attachments:', error);
    res.status(500).json({ error: 'Failed to fetch call attachments' });
  }
});

// Add reminder to call
app.post('/api/calls/:id/reminders', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, reminder_type, remind_at, message } = req.body;
    
    const result = await db.query(
      `INSERT INTO call_reminders (call_id, user_id, reminder_type, remind_at, message) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, user_id, reminder_type || 'system', remind_at, message]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding call reminder:', error);
    res.status(500).json({ error: 'Failed to add call reminder' });
  }
});

// Delete attachment
app.delete('/api/attachments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM call_attachments WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// ============================================================================
// CATEGORIES API ROUTES
// ============================================================================

// Create new category
app.post('/api/categories', async (req, res) => {
  try {
    console.log('ðŸ“ POST /api/categories received:', req.body);
    const { name } = req.body;
    
    const result = await db.query(
      `INSERT INTO categories (name) VALUES ($1) RETURNING *`,
      [name]
    );
    
    console.log('âœ… Category created successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('âŒ Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
app.put('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    const result = await db.query(
      `UPDATE categories SET name = $2 WHERE id = $1 RETURNING *`,
      [id, name]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category has products
    const productsCheck = await db.query('SELECT COUNT(*) FROM products WHERE category_id = $1', [id]);
    if (parseInt(productsCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete category with associated products' });
    }
    
    const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ============================================================================
// PRODUCTS API ROUTES
// ============================================================================

// Create new product
app.post('/api/products', async (req, res) => {
  try {
    console.log('ðŸ“ POST /api/products received:', req.body);
    const { name, category_id, price, monthly_goal } = req.body;
    
    const result = await db.query(
      `INSERT INTO products (name, category_id, price, monthly_goal) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, category_id, price, monthly_goal]
    );
    
    console.log('âœ… Product created successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('âŒ Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(updates)];
    
    const result = await db.query(
      `UPDATE products SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ============================================================================
// SALESPEOPLE API ROUTES
// ============================================================================

// Get all salespeople
app.get('/api/salespeople', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, email, avatar, monthly_sales_goal, role, 
             theme_mode, theme_primary_color, theme_bg_color, 
             theme_text_color, theme_sidebar_color
      FROM salespeople 
      ORDER BY name ASC
    `);
    
    const formattedSalespeople = result.rows.map(person => ({
      id: person.id,
      name: person.name,
      email: person.email,
      avatar: person.avatar,
      monthlySalesGoal: parseFloat(person.monthly_sales_goal) || 0,
      role: person.role,
      theme: {
        mode: person.theme_mode || 'dark',
        primaryColor: person.theme_primary_color || '#10b981',
        bgColor: person.theme_bg_color || '#0f172a',
        textColor: person.theme_text_color || '#f8fafc',
        sidebarColor: person.theme_sidebar_color || '#1e293b'
      }
    }));
    
    res.json(formattedSalespeople);
  } catch (error) {
    console.error('Error fetching salespeople:', error);
    res.status(500).json({ error: 'Failed to fetch salespeople' });
  }
});

// Create new salesperson
app.post('/api/salespeople', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('ðŸ“ POST /api/salespeople received:', req.body);
    const { name, email, avatar, monthly_sales_goal, role } = req.body;
    
    const result = await db.query(
      `INSERT INTO salespeople (name, email, avatar, monthly_sales_goal, role) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, avatar, monthly_sales_goal, role]
    );
    
    console.log('âœ… Salesperson created successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('âŒ Error creating salesperson:', error);
    res.status(500).json({ error: 'Failed to create salesperson' });
  }
});

// Update salesperson
app.put('/api/salespeople/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(updates)];
    
    const result = await db.query(
      `UPDATE salespeople SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Salesperson not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating salesperson:', error);
    res.status(500).json({ error: 'Failed to update salesperson' });
  }
});

// Delete salesperson
app.delete('/api/salespeople/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM salespeople WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Salesperson not found' });
    }
    
    res.json({ message: 'Salesperson deleted successfully' });
  } catch (error) {
    console.error('Error deleting salesperson:', error);
    res.status(500).json({ error: 'Failed to delete salesperson' });
  }
});

// ============================================================================
// BANS API ROUTES
// ============================================================================

// Create new ban
app.post('/api/bans', verifyToken, async (req, res) => {
  try {
    console.log('ðŸ“ POST /api/bans received:', req.body);
    // Soporte para ambos formatos: client_id (snake_case) y clientId (camelCase)
    const client_id = req.body.client_id ?? req.body.clientId;
    const { number } = req.body;
    
    if (!client_id) {
      return res.status(400).json({ error: 'client_id or clientId is required' });
    }
    
    const result = await db.query(
      `INSERT INTO bans (client_id, number, status, last_updated) 
       VALUES ($1, $2, 'activo', CURRENT_TIMESTAMP) RETURNING *`,
      [client_id, number]
    );
    
    console.log('âœ… Ban created successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('âŒ Error creating ban:', error);
    res.status(500).json({ error: 'Failed to create ban' });
  }
});

// Update ban
app.put('/api/bans/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, last_updated: new Date() };
    
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(updates)];
    
    const result = await db.query(
      `UPDATE bans SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ban not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating ban:', error);
    res.status(500).json({ error: 'Failed to update ban' });
  }
});

// Delete ban
app.delete('/api/bans/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM bans WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ban not found' });
    }
    
    res.json({ message: 'Ban deleted successfully' });
  } catch (error) {
    console.error('Error deleting ban:', error);
    res.status(500).json({ error: 'Failed to delete ban' });
  }
});

// ============================================================================
// SUBSCRIBERS API ROUTES
// ============================================================================

// Create new subscriber
app.post('/api/subscribers', verifyToken, async (req, res) => {
  try {
    console.log('ðŸ“ POST /api/subscribers received:', req.body);
    const { ban_id, phone_number, status, product_id, category_id, contract_end_date, equipment, city, months_sold, payments_made } = req.body;
    
    const result = await db.query(
      `INSERT INTO subscribers (ban_id, phone_number, status, product_id, category_id, contract_end_date, equipment, city, months_sold, payments_made) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [ban_id, phone_number, status, product_id, category_id, contract_end_date, equipment, city, months_sold, payments_made]
    );
    
    console.log('âœ… Subscriber created successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('âŒ Error creating subscriber:', error);
    res.status(500).json({ error: 'Failed to create subscriber' });
  }
});

// Update subscriber
app.put('/api/subscribers/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(updates)];
    
    const result = await db.query(
      `UPDATE subscribers SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    
    // Calculate and return updated expiration date
    const updatedSubscriber = {
      ...result.rows[0],
      contract_end_date: calculateExpirationDate(result.rows[0].months_sold, result.rows[0].payments_made)
    };
    
    res.json(updatedSubscriber);
  } catch (error) {
    console.error('Error updating subscriber:', error);
    res.status(500).json({ error: 'Failed to update subscriber' });
  }
});

// Complete sale and update subscriber contract
app.put('/api/subscribers/:id/complete-sale', verifyToken, async (req, res) => {
  try {
    console.log('ðŸŽ‰ Completing sale for subscriber:', req.params.id);
    const { id } = req.params;
    const { newMonthsSold } = req.body;
    
    if (!newMonthsSold || newMonthsSold <= 0) {
      return res.status(400).json({ error: 'New months sold must be greater than 0' });
    }
    
    // Update subscriber with new contract period (reset payments to 0)
    const result = await db.query(
      `UPDATE subscribers 
       SET months_sold = $2, payments_made = 0 
       WHERE id = $1 
       RETURNING *`,
      [id, newMonthsSold]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    
    // Calculate new expiration date
    const updatedSubscriber = {
      ...result.rows[0],
      contract_end_date: calculateExpirationDate(result.rows[0].months_sold, result.rows[0].payments_made)
    };
    
    console.log('âœ… Sale completed, new expiration date:', updatedSubscriber.contract_end_date);
    res.json(updatedSubscriber);
  } catch (error) {
    console.error('âŒ Error completing sale:', error);
    res.status(500).json({ error: 'Failed to complete sale' });
  }
});

// Delete subscriber
app.delete('/api/subscribers/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM subscribers WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    
    res.json({ message: 'Subscriber deleted successfully' });
  } catch (error) {
    console.error('Error deleting subscriber:', error);
    res.status(500).json({ error: 'Failed to delete subscriber' });
  }
});

// ============================================================================
// PIPELINE STATUSES API ROUTES
// ============================================================================

// Create new pipeline status
app.post('/api/pipeline-statuses', async (req, res) => {
  try {
    console.log('ðŸ“ POST /api/pipeline-statuses received:', req.body);
    const { name, color } = req.body;
    
    const result = await db.query(
      `INSERT INTO pipeline_statuses (name, color) VALUES ($1, $2) RETURNING *`,
      [name, color]
    );
    
    console.log('âœ… Pipeline status created successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('âŒ Error creating pipeline status:', error);
    res.status(500).json({ error: 'Failed to create pipeline status' });
  }
});

// Update pipeline status
app.put('/api/pipeline-statuses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    
    const result = await db.query(
      `UPDATE pipeline_statuses SET name = $2, color = $3 WHERE id = $1 RETURNING *`,
      [id, name, color]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pipeline status not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating pipeline status:', error);
    res.status(500).json({ error: 'Failed to update pipeline status' });
  }
});

// Delete pipeline status
app.delete('/api/pipeline-statuses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM pipeline_statuses WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pipeline status not found' });
    }
    
    res.json({ message: 'Pipeline status deleted successfully' });
  } catch (error) {
    console.error('Error deleting pipeline status:', error);
    res.status(500).json({ error: 'Failed to delete pipeline status' });
  }
});

// ============================================================================
// INCOMES API ROUTES
// ============================================================================

// Create new income
app.post('/api/incomes', async (req, res) => {
  try {
    console.log('ðŸ“ POST /api/incomes received:', req.body);
    const { date, description, amount, product_id, salesperson_id } = req.body;
    
    const result = await db.query(
      `INSERT INTO incomes (date, description, amount, product_id, salesperson_id) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [date, description, amount, product_id, salesperson_id]
    );
    
    console.log('âœ… Income created successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('âŒ Error creating income:', error);
    res.status(500).json({ error: 'Failed to create income' });
  }
});

// Update income
app.put('/api/incomes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(updates)];
    
    const result = await db.query(
      `UPDATE incomes SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating income:', error);
    res.status(500).json({ error: 'Failed to update income' });
  }
});

// Delete income
app.delete('/api/incomes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM incomes WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income not found' });
    }
    
    res.json({ message: 'Income deleted successfully' });
  } catch (error) {
    console.error('Error deleting income:', error);
    res.status(500).json({ error: 'Failed to delete income' });
  }
});

// ============================================================================
// EXPENSES API ROUTES
// ============================================================================

// Create new expense
app.post('/api/expenses', async (req, res) => {
  try {
    console.log('ðŸ“ POST /api/expenses received:', req.body);
    const { date, description, amount } = req.body;
    
    const result = await db.query(
      `INSERT INTO expenses (date, description, amount) VALUES ($1, $2, $3) RETURNING *`,
      [date, description, amount]
    );
    
    console.log('âœ… Expense created successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('âŒ Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update expense
app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(updates)];
    
    const result = await db.query(
      `UPDATE expenses SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete expense
app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM expenses WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// ============================================================================
// METAS API ROUTES
// ============================================================================

// Get all metas
app.get('/api/metas', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT m.*, s.name as vendedor_name, s.avatar as vendedor_avatar
      FROM metas m
      LEFT JOIN salespeople s ON m.vendedor_id = s.id
      ORDER BY m.created_at DESC
    `);
    
    const formattedMetas = result.rows.map(meta => ({
      id: meta.id,
      vendedorId: meta.vendedor_id,
      vendedorName: meta.vendedor_name || (meta.tipo_objetivo === 'negocio' ? 'NEGOCIO' : null),
      vendedorAvatar: meta.vendedor_avatar,
      metaValor: parseFloat(meta.meta_valor),
      periodo: meta.periodo,
      fechaInicio: meta.fecha_inicio,
      fechaFin: meta.fecha_fin,
      activa: meta.activa,
      createdAt: meta.created_at,
      tipoMeta: meta.tipo_meta,
      tipoObjetivo: meta.tipo_objetivo || 'vendedor',
      categoria: meta.categoria,
      descripcion: meta.descripcion,
      year: meta.year,
      month: meta.month
    }));
    
    res.json(formattedMetas);
  } catch (error) {
    console.error('Error fetching metas:', error);
    res.status(500).json({ error: 'Failed to fetch metas' });
  }
});

// Create new meta
app.post('/api/metas', verifyToken, async (req, res) => {
  try {
    console.log('🎯 POST /api/metas received:', JSON.stringify(req.body, null, 2));
    console.log('📄 Headers received:', {
      authorization: req.headers.authorization ? 'Bearer ***' + req.headers.authorization.slice(-10) : 'MISSING',
      contentType: req.headers['content-type'],
      origin: req.headers.origin
    });
    
    const { 
      vendedorId, 
      metaValor, 
      periodo, 
      fechaInicio, 
      fechaFin, 
      tipoMeta, 
      categoria, 
      descripcion,
      tipoObjetivo 
    } = req.body;
    
    // Determinar valores finales - SOLUCION DEFINITIVA
    const finalVendedorId = vendedorId === undefined ? null : vendedorId;
    const finalTipoObjetivo = tipoObjetivo || (finalVendedorId ? 'vendedor' : 'negocio');
    
    // Extraer year y month
    const now = new Date();
    const yearFromPeriod = periodo ? parseInt(periodo.split('-')[0]) : now.getFullYear();
    const monthFromPeriod = periodo ? parseInt(periodo.split('-')[1]) : now.getMonth() + 1;
    
    console.log('📊 PROCESANDO DATOS:', {
      finalVendedorId,
      metaValor,
      periodo,
      fechaInicio,
      fechaFin,
      tipoMeta,
      categoria,
      descripcion,
      finalTipoObjetivo,
      yearFromPeriod,
      monthFromPeriod
    });
    
    const result = await db.query(`
      INSERT INTO metas (
        vendedor_id, meta_valor, periodo, fecha_inicio, fecha_fin, 
        tipo_meta, categoria, descripcion, year, month, tipo_objetivo, activa
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
      RETURNING *
    `, [
      finalVendedorId,
      metaValor, 
      periodo, 
      fechaInicio, 
      fechaFin,
      tipoMeta, 
      categoria, 
      descripcion,
      yearFromPeriod,
      monthFromPeriod,
      finalTipoObjetivo,
      true
    ]);
    
    console.log('✅ META CREADA EXITOSAMENTE:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
    
  } catch (error) {
    console.error('❌ ERROR DETALLADO EN SERVIDOR:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Code:', error.code);
    console.error('Detail:', error.detail);
    res.status(500).json({ 
      error: 'Failed to create meta', 
      details: error.message,
      code: error.code,
      sqlMessage: error.detail 
    });
  }
});

// Update meta
app.put('/api/metas/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      metaValor, 
      periodo, 
      fechaInicio, 
      fechaFin, 
      tipoMeta, 
      categoria, 
      descripcion, 
      activa 
    } = req.body;
    
    const result = await db.query(`
      UPDATE metas SET 
        meta_valor = $2, periodo = $3, fecha_inicio = $4, fecha_fin = $5,
        tipo_meta = $6, categoria = $7, descripcion = $8, activa = $9
      WHERE id = $1 
      RETURNING *
    `, [id, metaValor, periodo, fechaInicio, fechaFin, tipoMeta, categoria, descripcion, activa]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meta not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating meta:', error);
    res.status(500).json({ error: 'Failed to update meta' });
  }
});

// Delete meta
app.delete('/api/metas/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM metas WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meta not found' });
    }
    
    res.json({ message: 'Meta deleted successfully' });
  } catch (error) {
    console.error('Error deleting meta:', error);
    res.status(500).json({ error: 'Failed to delete meta' });
  }
});

// Get metas progress for specific salesperson
app.get('/api/metas/progress/:vendedorId', async (req, res) => {
  try {
    const { vendedorId } = req.params;
    const year = req.query.year || new Date().getFullYear();
    const month = req.query.month || new Date().getMonth() + 1;
    
    // Get active metas for the salesperson
    const metasResult = await db.query(`
      SELECT * FROM metas 
      WHERE vendedor_id = $1 AND activa = true AND year = $2 AND month = $3
    `, [vendedorId, year, month]);
    
    // Get actual sales/incomes for the period
    const salesResult = await db.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_sales,
        COUNT(*) as total_transactions
      FROM incomes 
      WHERE salesperson_id = $1 
        AND EXTRACT(YEAR FROM date) = $2 
        AND EXTRACT(MONTH FROM date) = $3
    `, [vendedorId, year, month]);
    
    const metas = metasResult.rows;
    const sales = salesResult.rows[0];
    
    const progress = metas.map(meta => {
      const totalMeta = parseFloat(meta.meta_valor);
      const totalSales = parseFloat(sales.total_sales);
      const progressPercent = totalMeta > 0 ? (totalSales / totalMeta) * 100 : 0;
      
      return {
        ...meta,
        totalSales,
        progressPercent: Math.round(progressPercent * 100) / 100,
        remaining: Math.max(0, totalMeta - totalSales)
      };
    });
    
    res.json({
      metas: progress,
      totalSales: parseFloat(sales.total_sales),
      totalTransactions: parseInt(sales.total_transactions),
      period: { year: parseInt(year), month: parseInt(month) }
    });
  } catch (error) {
    console.error('Error fetching metas progress:', error);
    res.status(500).json({ error: 'Failed to fetch metas progress' });
  }
});

// Serve static files with proper MIME types
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filepath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Serve React app for specific routes (avoiding problematic * route)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Middleware de manejo de errores (AL FINAL)
app.use((err, req, res, next) => {
  console.error('ðŸ”¥ Error en endpoint:', req.url, err);
  res.status(500).json({ error: err.message, stack: err.stack });
});

// Start server with WebSocket support
async function startServer() {
  await connectDB();
  
  server.listen(port, () => {
    console.log(`🚀 CRM Pro server running on port ${port}`);
    console.log(`📊 API: http://localhost:${port}/api/health`);
    console.log(`🌍 Frontend: http://localhost:${port}`);
    console.log(`🔗 WebSocket server ready for real-time updates`);
  });
}

// EJECUTAR SERVIDOR
startServer().catch(console.error);

