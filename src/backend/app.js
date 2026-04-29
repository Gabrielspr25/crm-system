import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

// Rutas
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js'; // New Import
import banRoutes from './routes/banRoutes.js';
import subscriberRoutes from './routes/subscriberRoutes.js';
import followUpRoutes from './routes/followUpRoutes.js';
import followUpConfigRoutes from './routes/followUpConfigRoutes.js';
import productRoutes from './routes/productRoutes.js';
import importRoutes from './routes/importRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import referidosRoutes from './routes/referidosRoutes.js';
import discrepanciasRoutes from './routes/discrepanciasRoutes.js';
import tarifasRoutes from './routes/tarifasRoutes.js';
import ocrRoutes from './routes/ocrRoutes.js';
import dealWorkflowRoutes from './routes/dealWorkflowRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import systemTestRoutes from './routes/systemTestRoutes.js';
import subscriberReportsRoutes from './routes/subscriberReportsRoutes.js';
import tangoRoutes from './routes/tangoRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import categoryStepsRoutes from './routes/categoryStepsRoutes.js';
import categoryStepsSingleRoutes from './routes/categoryStepsSingleRoutes.js';
import clientStepsRoutes from './routes/clientStepsRoutes.js';
import gestionRoutes from './routes/gestionRoutes.js';
import goalsRoutes from './routes/goalsRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import salesHistoryRoutes from './routes/salesHistoryRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import tiersFixedRoutes from './routes/tiersFixedRoutes.js';
import tariffsRoutes from './routes/tariffsRoutes.js';
import posIntegrationRoutes from './routes/posIntegrationRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/categories', categoryRoutes); // New Route
app.use('/api/bans', banRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use('/api/follow-up-prospects', followUpRoutes);
app.use('/api', followUpConfigRoutes);
app.use('/api/products', productRoutes);
app.use('/api/importador', importRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/referidos', referidosRoutes);
app.use('/api/discrepancias', discrepanciasRoutes);
app.use('/api/tarifas', tarifasRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/system-test', systemTestRoutes);
app.use('/api/subscriber-reports', subscriberReportsRoutes);
app.use('/api/tango', tangoRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/categories/:id/steps', categoryStepsRoutes);
app.use('/api/category-steps', categoryStepsSingleRoutes);
app.use('/api/clients/:clientId/steps', clientStepsRoutes);
app.use('/api', dealWorkflowRoutes);
app.use('/api/gestion', gestionRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sales-history', salesHistoryRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/tiers-fixed', tiersFixedRoutes);
app.use('/api/tariffs', tariffsRoutes);
app.use('/api/pos', posIntegrationRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/campaigns', campaignRoutes);


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
