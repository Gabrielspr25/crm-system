import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

// Rutas
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import banRoutes from './routes/banRoutes.js';
import subscriberRoutes from './routes/subscriberRoutes.js';
import followUpRoutes from './routes/followUpRoutes.js';
import productRoutes from './routes/productRoutes.js';
import importRoutes from './routes/importRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import referidosRoutes from './routes/referidosRoutes.js';

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/bans', banRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use('/api/follow-up-prospects', followUpRoutes);
app.use('/api/products', productRoutes);
app.use('/api/importador', importRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/referidos', referidosRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({ message: 'API CRM Pro funcionando correctamente 🚀' });
});

// Manejo de 404
app.use((req, res) => {
    notFound(res, 'Ruta');
});

// Manejo de errores global
app.use(errorHandler);

// Iniciar servidor
const PORT = config.port;
app.listen(PORT, () => {
    console.log(`
  🚀 Servidor corriendo en http://localhost:${PORT}
  ⭐️ Ambiente: ${config.nodeEnv}
  `);
});

export default app;
