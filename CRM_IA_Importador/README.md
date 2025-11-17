# CRM PRO — Módulo IA de Ventas + Importador CSV/Excel (Ollama)

> **Nota:** este README documentaba la versión experimental con Ollama + importador independiente. El proyecto actual usa el importador integrado descrito en el README principal de la raíz. Conserva este archivo sólo como referencia histórica.

## Requisitos
- Node 18+
- PostgreSQL (usa tu `crm_pro`)
- Ollama corriendo: `ollama serve`
  - Modelos aconsejados:
    - `mxbai-embed-large` (embeddings)
    - `llama3:instruct` (chat)

## Instalación rápida
1. Copia estos archivos dentro de tu proyecto (raíz del repositorio).
2. Renombra `.env.example` a `.env` y ajusta credenciales.
3. Instala dependencias (si faltan): 
   ```bash
   npm i express cors pg multer pdf-parse node-fetch xlsx socket.io
   ```
4. Inicia tu backend (pm2 o node): 
   ```bash
   node server-FINAL.js
   ```

## Frontend
- Agrega rutas a tus páginas React:
  - `src/react-app/pages/IASales.tsx`
  - `src/react-app/pages/ImportadorCSV.tsx`
- En tu router, crea dos rutas:
  - `/ia` → `IASales`
  - `/importar` → `ImportadorCSV`

## Endpoints principales
- POST `/api/ai/documents` — subir PDF/TXT/CSV/XLSX
- GET `/api/ai/documents`
- POST `/api/ai/chat` — chat con IA local
- POST `/api/import/upload` — analiza archivo y devuelve headers
- POST `/api/import/save` — inserta/actualiza en tabla

## Notas
- Los archivos subidos se guardan en `uploads/ai-documents/`
- Si el PDF no tiene texto, el endpoint devolverá error explícito.
- El importador acepta CSV/XLSX y permite mapeo columna→campo de tabla.
