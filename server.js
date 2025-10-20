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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Login endpoint - PRODUCCION
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('🔐 PRODUCCION - Login attempt for:', username);
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }
    
    const userResult = await db.query(`
      SELECT ua.*, s.name, s.email, s.role, s.avatar, s.monthly_sales_goal
      FROM users_auth ua 
      JOIN salespeople s ON ua.salesperson_id = s.id 
      WHERE ua.username = $1 AND ua.is_active = true
    `, [username]);
    
    console.log(`🔍 Searching for user: "${username}"`);
    console.log(`📊 Found ${userResult.rows.length} results`);
    
    if (userResult.rows.length === 0) {
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

// Get all data for CRM
app.get('/api/crm-data', verifyToken, filterDataByRole, async (req, res) => {
  try {
    console.log('📊 PRODUCCION - Obteniendo todos los datos del CRM...');
    
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

    res.json({
      salespeople: salespeople.rows,
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
    console.error('Error fetching CRM data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Create new client
app.post('/api/clients', verifyToken, async (req, res) => {
  try {
    console.log('📝 POST /api/clients received');
    console.log('📦 Headers:', req.headers);
    console.log('📄 Body raw:', req.body);
    
    const { name, company, email, phone, mobile, salesperson_id, pipeline_status_id } = req.body;
    
    console.log('✅ Parsed fields:');
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
    console.error('❌ Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
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