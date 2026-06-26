// Servidor del sistema nuevo VentasPro.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { login, requireAuth, devLogin } from './auth.js';
import { salesRouter } from './routes/sales.js';
import { clientsRouter } from './routes/clients.js';
import { linesRouter } from './routes/lines.js';
import { catalogRouter } from './routes/catalog.js';
import { oppsRouter } from './routes/opportunities.js';
import { goalsRouter } from './routes/goals.js';
import { miscRouter } from './routes/misc.js';
import { comisionesRouter } from './routes/comisionesReal.js';
import { clientsRealRouter } from './routes/clientsReal.js';
import { asanaRealRouter } from './routes/asanaReal.js';

const app = express();
app.use(cors());
app.use(express.json());

// Salud
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ventaspro-nuevo' }));

// Login con Tango (público) + quién soy
app.post('/api/auth/login', login);
if (process.env.DEV_LOGIN === '1') app.post('/api/auth/dev-login', devLogin); // solo local
app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }));

// Módulos
app.use('/api/clients', clientsRouter);   // clientes
app.use('/api', linesRouter);             // /bans, /subscribers
app.use('/api', catalogRouter);           // /categories, /products, /step-templates
app.use('/api', oppsRouter);              // seguimiento: oportunidades + pasos + bitácora
app.use('/api/goals', goalsRouter);       // metas + cumplimiento
app.use('/api', miscRouter);              // comparativas + historial
app.use('/api', comisionesRouter);        // COMISIONES con data real de crm_pro
app.use('/api', clientsRealRouter);       // CLIENTES con data real de crm_pro (tarjetas + lista)
app.use('/api', asanaRealRouter);         // ASANA SEG. con data real de crm_pro (SOV2)
app.use('/api/sales', salesRouter);       // ventas / comisiones

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`[ventaspro-nuevo] backend en :${PORT}`));
