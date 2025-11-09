// ===============================================
// 🚀 CRM PRO - SERVIDOR FINAL CONSOLIDADO IA + IMPORTADOR
// ===============================================
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import fsPromises from 'fs/promises';
import fetch from 'node-fetch';
import xlsx from 'xlsx';

// ===============================================
// CONFIG
// ===============================================
const NODE_ENV = process.env.NODE_ENV || 'production';
const IS_PROD = NODE_ENV === 'production';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===============================================
// DB
// ===============================================
const db = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'crm_pro',
  user: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000
});

const queryDB = async (text, params = []) => {
  const client = await db.connect();
  try { return await client.query(text, params); }
  finally { client.release(); }
};

// ===============================================
// OLLAMA
// ===============================================
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
let OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'mxbai-embed-large';
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'llama3:instruct';
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);

const ollamaRequest = async (endpoint, payload) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${endpoint} ${res.status}`);
    return data;
  } finally { clearTimeout(id); }
};

const generateEmbedding = async (text) => {
  const cleaned = (text || '').trim();
  if (!cleaned) throw new Error('Texto vacío para embeddings');
  let r = await ollamaRequest('/api/embeddings', { model: OLLAMA_EMBED_MODEL, input: cleaned });
  let emb = r.embedding || r.data?.[0]?.embedding || [];
  if (!emb.length) {
    // Fallback
    OLLAMA_EMBED_MODEL = 'mxbai-embed-large';
    r = await ollamaRequest('/api/embeddings', { model: OLLAMA_EMBED_MODEL, input: cleaned });
    emb = r.embedding || r.data?.[0]?.embedding || [];
    if (!emb.length) throw new Error('Falló la generación de embeddings en ambos modelos');
  }
  return emb;
};

const chatIA = async (messages) => {
  const r = await ollamaRequest('/api/chat', { model: OLLAMA_CHAT_MODEL, messages, stream: false });
  return r?.message?.content || r?.response || '';
};

// ===============================================
// IA FILES
// ===============================================
const AI_UPLOAD_DIR = path.join(__dirname, 'uploads', 'ai-documents');
const AI_TEMP_DIR = path.join(__dirname, 'uploads', 'ai-temp');
for (const d of [AI_UPLOAD_DIR, AI_TEMP_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
const upload = multer({ dest: AI_TEMP_DIR, limits: { fileSize: (parseInt(process.env.AI_MAX_FILE_SIZE_MB || '25') * 1024 * 1024) } });

async function readFileAsText(filePath, mimetype, originalname) {
  const lower = (originalname || '').toLowerCase();
  if (mimetype === 'application/pdf' || lower.endsWith('.pdf')) {
    const buf = await fsPromises.readFile(filePath);
    const data = await pdfParse(buf);
    if (!data.text.trim()) throw new Error('El PDF no contiene texto legible');
    return data.text;
  }
  if (mimetype?.startsWith('text/') || /\.(txt|md|csv|log)$/i.test(lower)) {
    return await fsPromises.readFile(filePath, 'utf8');
  }
  if (/\.(xls|xlsx)$/i.test(lower)) {
    const wb = xlsx.read(await fsPromises.readFile(filePath));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = xlsx.utils.sheet_to_json(ws, { defval: '' });
    return JSON.stringify(json);
  }
  throw new Error('Formato no soportado');
}

// ===============================================
// ENDPOINTS AI
// ===============================================
app.post('/api/ai/documents', upload.single('file'), async (req, res) => {
  try {
    const { file } = req;
    if (!file) return res.status(400).json({ error: 'Archivo no recibido' });
    const text = await readFileAsText(file.path, file.mimetype, file.originalname);
    // Embedding de un slice para validación
    await generateEmbedding(text.slice(0, 2000));
    const cleanName = file.originalname.replace(/[^\w.-]+/g, '_');
    const storedPath = path.join(AI_UPLOAD_DIR, cleanName);
    await fsPromises.rename(file.path, storedPath);
    await queryDB(
      `INSERT INTO ai_documents (title, original_filename, mime_type, size_bytes, status, metadata, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'ready',$5,NOW(),NOW())
       ON CONFLICT (original_filename) DO UPDATE SET updated_at = NOW(), status='ready'`,
      [cleanName, file.originalname, file.mimetype, file.size, JSON.stringify({ stored_filename: cleanName })]
    );
    res.json({ success: true, message: 'Documento indexado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error IA' });
  }
});

app.get('/api/ai/documents', async (req, res) => {
  try {
    const r = await queryDB(`SELECT id, title, original_filename, mime_type, size_bytes, status, metadata, created_at, updated_at FROM ai_documents ORDER BY updated_at DESC`);
    res.json(r.rows || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/ai/documents/:id', async (req, res) => {
  try {
    await queryDB(`DELETE FROM ai_documents WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ error: 'Mensaje vacío' });
    const answer = await chatIA([{ role: 'user', content: message.trim() }]);
    res.json({ answer });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===============================================
// IMPORTER
// ===============================================
app.post('/api/import/upload', upload.single('file'), async (req, res) => {
  try {
    const { file } = req;
    if (!file) return res.status(400).json({ error: 'Archivo no recibido' });
    const ext = path.extname(file.originalname).toLowerCase();
    let rows = [];
    if (ext === '.csv') {
      const content = await fsPromises.readFile(file.path, 'utf8');
      const lines = content.split(/\r?\n/).filter(Boolean);
      const headers = lines.shift().split(',').map(h => h.trim());
      lines.forEach(line => {
        const vals = line.split(','); const obj = {};
        headers.forEach((h, i) => obj[h] = (vals[i] || '').trim());
        rows.push(obj);
      });
    } else if (ext === '.xls' || ext === '.xlsx') {
      const wb = xlsx.read(await fsPromises.readFile(file.path));
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
    } else {
      throw new Error('Formato no soportado. Use CSV/XLSX');
    }
    res.json({ headers: Object.keys(rows[0] || {}), sample: rows.slice(0, 5) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/import/save', async (req, res) => {
  try {
    const { table, rows, mapping, upsertKey } = req.body || {};
    if (!table || !Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'Datos incompletos' });
    const cols = Object.keys(mapping);
    const placeholders = cols.map((_, i) => `$${i+1}`).join(',');
    let inserted = 0, updated = 0;
    for (const r of rows) {
      const values = cols.map(c => r[mapping[c]] ?? null);
      if (upsertKey && cols.includes(upsertKey)) {
        const setCols = cols.map((c, i) => `${c}=EXCLUDED.${c}`).join(',');
        const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})
                     ON CONFLICT (${upsertKey}) DO UPDATE SET ${setCols}`;
        await queryDB(sql, values);
        inserted++;
      } else {
        await queryDB(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`, values);
        inserted++;
      }
    }
    res.json({ ok: true, inserted, updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===============================================
// HEALTH
// ===============================================
app.get('/api/health', async (req, res) => {
  try { await queryDB('SELECT 1'); res.json({ status: 'OK', model: OLLAMA_EMBED_MODEL, time: new Date().toISOString() }); }
  catch { res.status(500).json({ status: 'ERROR' }); }
});

// ===============================================
// START
// ===============================================
server.listen(port, () => {
  console.log(`✅ CRM PRO IA server on port ${port}`);
});
