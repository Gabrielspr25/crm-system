import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
// import bcrypt from 'bcrypt'; // Ya no necesario - login simple
import jwt from 'jsonwebtoken';
import pkg from 'pg';
const { Client } = pkg;
import { createServer } from 'http';
import { Server } from 'socket.io';

// Manejo global de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ ERROR NO CAPTURADO:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ PROMESA RECHAZADA NO MANEJADA:', reason);
  console.error('Promesa:', promise);
});

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;
const server = createServer(app);
const io = new Server(server, {
  path: "/socket.io",
  transports: ["websocket", "polling"],
  cors: {
    origin: ["http://142.93.176.195:3001", "http://142.93.176.195", "https://crmp.ss-group.cloud", "http://crmp.ss-group.cloud"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ["http://142.93.176.195:3001", "http://142.93.176.195", "https://crmp.ss-group.cloud", "http://crmp.ss-group.cloud"]
    : ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.use(express.json());

// Middleware de logs
app.use((req, res, next) => {
  console.log(`🔨 ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📄 Body:', req.body);
  }
  next();
});

app.use(express.static('dist'));

// Database configuration
const dbConfig = {
  host: "localhost",
  port: 5432,
  database: "CRM-pro",
  user: "postgres",
  password: "Gaby0824@a",
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
    action,
    data,
    timestamp: new Date().toISOString()
  });
};

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    console.log('🔗 Database already connected');
    return;
  }
  
  try {
    await db.connect();
    isConnected = true;
    console.log('✅ Connected to PostgreSQL database');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
}

// Middleware for JWT verification - PROFESIONAL
const verifyToken = (req, res, next) => {
  console.log('🔒 VERIFICANDO TOKEN - Headers completos:', JSON.stringify(req.headers, null, 2));
  
  const auth = req.headers.authorization || '';
  const parts = auth.split(' ');
  
  console.log('🔍 AUTH HEADER:', auth);
  console.log('🔍 AUTH PARTS:', parts);
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.log('❌ Formato de token inválido. Esperado: Bearer <token>');
    return res.status(401).json({ error: 'Invalid token format. Expected: Bearer <token>' });
  }
  
  const token = parts[1];
  if (!token || token.length < 10) {
    console.log('❌ Token vacío o muy corto. Length:', token?.length || 0);
    return res.status(401).json({ error: 'No token provided or invalid token length' });
  }

  try {
    console.log('🔍 Verificando token (primeros 30 chars):', token.substring(0, 30) + '...');
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token válido. User ID:', decoded.userId, 'Username:', decoded.username);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('❌ Error verificando token:', error.message);
    console.log('❌ JWT_SECRET usado:', JWT_SECRET.substring(0, 20) + '...');
    return res.status(401).json({ error: 'Invalid or expired token', details: error.message });
  }
};

// Middleware para verificar si es admin
// Middleware simplificado para verificar admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Middleware simplificado para filtrar datos
const filterDataByRole = (req, res, next) => {
  req.userRole = req.user.role || 'vendedor';
  req.userId = req.user.userId;
  console.log('👤 User role:', req.userRole, 'User ID:', req.userId);
  next();
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ENDPOINT LOGIN - CORREGIDO
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('🔐 LOGIN SIMPLE - Intento para:', username);

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }

    // CONSULTA BD: usa password_simple
    const userResult = await db.query(
      'SELECT id, username, password_simple, rol, activo FROM users_auth WHERE username = $1 AND activo = true',
      [username]
    );

    if (!userResult || !userResult.rows || userResult.rows.length === 0) {
      console.log('🔍 Login fallido: usuario no encontrado o inactivo:', username);
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const user = userResult.rows[0];
    console.log('👤 Usuario encontrado:', user.username, 'Rol:', user.rol);

    // VALIDACIÓN PASSWORD: comparación directa texto plano (temporal)
    const isValidPassword = password === user.password_simple;
    console.log('🔑 Password verificado - Válido:', isValidPassword);
    console.log('🔍 Password enviado:', password);
    console.log('🔍 Password en BD:', user.password_simple);

    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    // GENERACIÓN JWT: usa JWT_SECRET (asegúrate que viene de process.env)
    const secret = process.env.JWT_SECRET || JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || JWT_EXPIRES_IN || '8h';

    if (!secret) {
      console.error('⚠️ JWT_SECRET no definido en env');
      return res.status(500).json({ success: false, message: 'Server misconfiguration' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.rol || 'vendedor'
      },
      secret,
      { expiresIn }
    );

    // Return user data
    const userData = {
      id: user.id,
      username: user.username,
      name: user.username,
      email: user.username + '@crm.local',
      role: user.rol || 'vendedor',
      avatar: null,
      monthlyGoal: 0,
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
    console.error('❌ Error en /api/login:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Function to calculate expiration date for subscribers
function calculateExpirationDate(monthsSold, paymentsMade) {
  if (!monthsSold || !paymentsMade || monthsSold <= 0) {
    return null;
  }
  
  const remainingMonths = monthsSold - paymentsMade;
  if (remainingMonths <= 0) {
    return 'PAGADO';
  }
  
  const currentDate = new Date();
  const expirationDate = new Date(currentDate);
  expirationDate.setMonth(currentDate.getMonth() + remainingMonths);
  
  return expirationDate.toISOString().split('T')[0];
}

// Get all data for CRM - VERSIÓN PROFESIONAL
app.get('/api/crm-data', verifyToken, filterDataByRole, async (req, res) => {
  try {
    console.log('📊 PRODUCCION - Obteniendo todos los datos del CRM...');
    
    // Función para ejecutar query de forma segura
    const safeQuery = async (query, tableName) => {
      try {
        const result = await db.query(query);
        console.log(`✅ ${tableName}: ${result.rows.length} registros`);
        return result;
      } catch (error) {
        console.log(`⚠️ ${tableName}: Tabla no existe o error - ${error.message}`);
        return { rows: [] };
      }
    };
    
    // Ejecutar queries de forma segura
    const [users, categories, products, clients, bans, subscribersRaw, pipelineStatuses, incomes, expenses, metas] = await Promise.all([
      safeQuery('SELECT id, username, rol as role, email FROM users_auth ORDER BY username', 'users'),
      safeQuery('SELECT * FROM categories ORDER BY name', 'categories'),
      safeQuery('SELECT * FROM products ORDER BY name', 'products'),
      safeQuery('SELECT * FROM clientes ORDER BY name', 'clientes'),
      safeQuery('SELECT * FROM bans ORDER BY last_updated DESC', 'bans'),
      safeQuery('SELECT * FROM subscribers ORDER BY phone_number', 'subscribers'),
      safeQuery('SELECT * FROM pipeline_statuses ORDER BY name', 'pipeline_statuses'),
      safeQuery('SELECT * FROM incomes ORDER BY date DESC', 'incomes'),
      safeQuery('SELECT * FROM expenses ORDER BY date DESC', 'expenses'),
      safeQuery('SELECT * FROM metas ORDER BY created_at DESC', 'metas')
    ]);
    
    console.log(`👤 User role: ${req.userRole}, returning ${clients.rows.length} clients`);
    
    // Process subscribers with automatic expiration date calculation
    const subscribers = subscribersRaw.rows.map(subscriber => ({
      ...subscriber,
      contract_end_date: calculateExpirationDate(subscriber.months_sold, subscriber.payments_made)
    }));

    // Convert products to frontend format
    const formattedProducts = products.rows.map(product => ({
      id: product.id,
      name: product.name,
      categoryId: product.category_id,
      price: parseFloat(product.price) || 0,
      monthlyGoal: parseFloat(product.monthly_goal) || 0
    }));

    // Convert incomes to frontend format
    const formattedIncomes = incomes.rows.map(income => {
      const product = products.rows.find(p => p.id === income.product_id);
      const user = users.rows.find(u => u.id === income.salesperson_id);
      
      return {
        id: income.id,
        date: income.date,
        description: income.description,
        amount: parseFloat(income.amount) || 0,
        productId: income.product_id,
        productName: product ? product.name : null,
        salespersonId: income.salesperson_id,
        salespersonName: user ? user.username : null
      };
    });

    // Convert expenses to frontend format
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

    console.log('📊 Datos cargados exitosamente:');
    console.log(`   - Users: ${users.rows.length}`);
    console.log(`   - Categories: ${categories.rows.length}`);
    console.log(`   - Products: ${products.rows.length}`);
    console.log(`   - Clients: ${clients.rows.length}`);

    res.json({
      salespeople: users.rows.map(u => ({id: u.id, name: u.username, email: u.email, role: u.role})),
      categories: categories.rows,
      products: formattedProducts,
      clients: clients.rows,
      bans: bans.rows,
      subscribers: subscribers,
      pipelineStatuses: pipelineStatuses.rows,
      incomes: formattedIncomes,
      expenses: formattedExpenses,
      metas: formattedMetas,
      pipelineNotes: []
    });
  } catch (error) {
    console.error('❌ Error fetching CRM data:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch data',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ==================== CLIENTS CRUD ====================

// Create new client
app.post('/api/clients', verifyToken, async (req, res) => {
  try {
    const { name, company, email, phone, mobile, salesperson_id, pipeline_status_id } = req.body;
    
    const result = await db.query(
      `INSERT INTO clientes (name, company, email, phone, mobile, salesperson_id, pipeline_status_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, company, email, phone, mobile, salesperson_id, pipeline_status_id]
    );
    
    broadcastUpdate('clients', result.rows[0], 'created');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
app.put('/api/clients/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, company, email, phone, mobile, salesperson_id, pipeline_status_id } = req.body;
    
    const result = await db.query(
      `UPDATE clientes SET name = $1, company = $2, email = $3, phone = $4, mobile = $5, 
       salesperson_id = $6, pipeline_status_id = $7 WHERE id = $8 RETURNING *`,
      [name, company, email, phone, mobile, salesperson_id, pipeline_status_id, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    broadcastUpdate('clients', result.rows[0], 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Delete client
app.delete('/api/clients/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM clientes WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    broadcastUpdate('clients', { id }, 'deleted');
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting client:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// ==================== SALESPEOPLE CRUD ====================

// Create salesperson - CON CONTRASEÑA AUTOMÁTICA
app.post('/api/salespeople', verifyToken, async (req, res) => {
  try {
    const { name, email, rol, avatar, monthly_sales_goal } = req.body;
    
    // Crear en tabla salespeople
    const result = await db.query(
      `INSERT INTO salespeople (name, email, rol, avatar, monthly_sales_goal) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, rol, avatar, monthly_sales_goal || 0]
    );
    
    // Crear usuario automáticamente en users_auth con contraseña simple
    const username = name.toLowerCase().replace(/\s+/g, '');
    const simplePassword = `${username}123`;
    
    try {
      await db.query(
        `INSERT INTO users_auth (username, password_simple, rol, activo, email) 
         VALUES ($1, $2, $3, true, $4)`,
        [username, simplePassword, rol || 'vendedor', email]
      );
      console.log(`✅ Usuario creado automáticamente: ${username} / ${simplePassword}`);
    } catch (userError) {
      console.log('⚠️ Usuario ya existe o error:', userError.message);
    }
    
    broadcastUpdate('salespeople', result.rows[0], 'created');
    res.status(201).json({
      ...result.rows[0],
      credentials: { username, password: simplePassword }
    });
  } catch (error) {
    console.error('❌ Error creating salesperson:', error);
    res.status(500).json({ error: 'Failed to create salesperson' });
  }
});

// Update salesperson
app.put('/api/salespeople/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, rol, avatar, monthly_sales_goal } = req.body;
    
    const result = await db.query(
      `UPDATE salespeople SET name = $1, email = $2, rol = $3, avatar = $4, monthly_sales_goal = $5 
       WHERE id = $6 RETURNING *`,
      [name, email, rol, avatar, monthly_sales_goal || 0, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Salesperson not found' });
    }
    
    broadcastUpdate('salespeople', result.rows[0], 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating salesperson:', error);
    res.status(500).json({ error: 'Failed to update salesperson' });
  }
});

// Delete salesperson
app.delete('/api/salespeople/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM salespeople WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Salesperson not found' });
    }
    
    broadcastUpdate('salespeople', { id }, 'deleted');
    res.json({ message: 'Salesperson deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting salesperson:', error);
    res.status(500).json({ error: 'Failed to delete salesperson' });
  }
});

// ==================== PRODUCTS CRUD ====================

// Create product
app.post('/api/products', verifyToken, async (req, res) => {
  try {
    const { name, category_id, price, monthly_goal } = req.body;
    
    const result = await db.query(
      `INSERT INTO products (name, category_id, price, monthly_goal) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, category_id, price || 0, monthly_goal || 0]
    );
    
    broadcastUpdate('products', result.rows[0], 'created');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
app.put('/api/products/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_id, price, monthly_goal } = req.body;
    
    const result = await db.query(
      `UPDATE products SET name = $1, category_id = $2, price = $3, monthly_goal = $4 
       WHERE id = $5 RETURNING *`,
      [name, category_id, price || 0, monthly_goal || 0, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    broadcastUpdate('products', result.rows[0], 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
app.delete('/api/products/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    broadcastUpdate('products', { id }, 'deleted');
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ==================== CATEGORIES CRUD ====================

// Create category
app.post('/api/categories', verifyToken, async (req, res) => {
  try {
    const { name } = req.body;
    
    const result = await db.query(
      `INSERT INTO categories (name) VALUES ($1) RETURNING *`,
      [name]
    );
    
    broadcastUpdate('categories', result.rows[0], 'created');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
app.put('/api/categories/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    const result = await db.query(
      `UPDATE categories SET name = $1 WHERE id = $2 RETURNING *`,
      [name, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    broadcastUpdate('categories', result.rows[0], 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category
app.delete('/api/categories/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    broadcastUpdate('categories', { id }, 'deleted');
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ==================== SUBSCRIBERS CRUD ====================

// Create subscriber
app.post('/api/subscribers', verifyToken, async (req, res) => {
  try {
    const { phone_number, months_sold, payments_made, salesperson_id } = req.body;
    
    const result = await db.query(
      `INSERT INTO subscribers (phone_number, months_sold, payments_made, salesperson_id) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [phone_number, months_sold || 0, payments_made || 0, salesperson_id]
    );
    
    broadcastUpdate('subscribers', result.rows[0], 'created');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating subscriber:', error);
    res.status(500).json({ error: 'Failed to create subscriber' });
  }
});

// Update subscriber
app.put('/api/subscribers/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { phone_number, months_sold, payments_made, salesperson_id } = req.body;
    
    const result = await db.query(
      `UPDATE subscribers SET phone_number = $1, months_sold = $2, payments_made = $3, salesperson_id = $4 
       WHERE id = $5 RETURNING *`,
      [phone_number, months_sold || 0, payments_made || 0, salesperson_id, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    
    broadcastUpdate('subscribers', result.rows[0], 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating subscriber:', error);
    res.status(500).json({ error: 'Failed to update subscriber' });
  }
});

// Delete subscriber
app.delete('/api/subscribers/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM subscribers WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    
    broadcastUpdate('subscribers', { id }, 'deleted');
    res.json({ message: 'Subscriber deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting subscriber:', error);
    res.status(500).json({ error: 'Failed to delete subscriber' });
  }
});

// ==================== BANS CRUD ====================

// Create ban
app.post('/api/bans', verifyToken, async (req, res) => {
  try {
    const { client_id, number } = req.body;
    
    console.log('🔄 Creando BAN via API:', { client_id, number });
    
    if (!client_id || !number) {
      return res.status(400).json({ error: 'client_id y number son requeridos' });
    }
    
    const result = await db.query(
      `INSERT INTO bans (client_id, number, last_updated) 
       VALUES ($1, $2, NOW()) RETURNING *`,
      [client_id, number]
    );
    
    console.log('✅ BAN creado exitosamente:', result.rows[0]);
    
    broadcastUpdate('bans', result.rows[0], 'created');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating ban:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create ban', 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update ban
app.put('/api/bans/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { phone_number, reason } = req.body;
    
    const result = await db.query(
      `UPDATE bans SET phone_number = $1, reason = $2, last_updated = NOW() 
       WHERE id = $3 RETURNING *`,
      [phone_number, reason, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ban not found' });
    }
    
    broadcastUpdate('bans', result.rows[0], 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating ban:', error);
    res.status(500).json({ error: 'Failed to update ban' });
  }
});

// Delete ban
app.delete('/api/bans/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM bans WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ban not found' });
    }
    
    broadcastUpdate('bans', { id }, 'deleted');
    res.json({ message: 'Ban deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting ban:', error);
    res.status(500).json({ error: 'Failed to delete ban' });
  }
});

// ==================== METAS CRUD ====================

// Create meta
app.post('/api/metas', verifyToken, async (req, res) => {
  try {
    const { vendedor_id, meta_valor, periodo, fecha_inicio, fecha_fin, tipo_meta, categoria, descripcion } = req.body;
    
    const result = await db.query(
      `INSERT INTO metas (vendedor_id, meta_valor, periodo, fecha_inicio, fecha_fin, activa, created_at, tipo_meta, categoria, descripcion) 
       VALUES ($1, $2, $3, $4, $5, true, NOW(), $6, $7, $8) RETURNING *`,
      [vendedor_id, meta_valor, periodo, fecha_inicio, fecha_fin, tipo_meta, categoria, descripcion]
    );
    
    broadcastUpdate('metas', result.rows[0], 'created');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating meta:', error);
    res.status(500).json({ error: 'Failed to create meta' });
  }
});

// Update meta
app.put('/api/metas/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { vendedor_id, meta_valor, periodo, fecha_inicio, fecha_fin, activa, tipo_meta, categoria, descripcion } = req.body;
    
    const result = await db.query(
      `UPDATE metas SET vendedor_id = $1, meta_valor = $2, periodo = $3, fecha_inicio = $4, fecha_fin = $5, 
       activa = $6, tipo_meta = $7, categoria = $8, descripcion = $9 WHERE id = $10 RETURNING *`,
      [vendedor_id, meta_valor, periodo, fecha_inicio, fecha_fin, activa, tipo_meta, categoria, descripcion, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meta not found' });
    }
    
    broadcastUpdate('metas', result.rows[0], 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating meta:', error);
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
    
    broadcastUpdate('metas', { id }, 'deleted');
    res.json({ message: 'Meta deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting meta:', error);
    res.status(500).json({ error: 'Failed to delete meta' });
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

// Serve React app for specific routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Catch all handler para servir React App (Compatible con Express 4.18.2)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Middleware de manejo de errores (AL FINAL)
app.use((err, req, res, next) => {
  console.error('🔥 Error en endpoint:', req.url, err);
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