# VentasPro CRM - AI Agent Instructions

## REGLAS CRÍTICAS DEL AGENTE (OBLIGATORIAS)

**Estas reglas deben seguirse SIEMPRE sin excepción:**

1. **NUNCA TRABAJAR EN LOCAL**: NO iniciar `npm run dev` ni servidores locales. El proyecto se prueba SIEMPRE en el servidor de producción (143.244.191.139 / crmp.ss-group.cloud).
   - Después de editar código: `npm run build` → deploy al servidor → verificar en el dominio
   - NUNCA sugerir "prueba en localhost" ni abrir puertos locales
   - El flujo es: editar → build → scp → verificar en producción

2. **VERSIÓN OBLIGATORIA**: NUNCA desplegar sin actualizar versión en `src/version.ts` primero
   - Incrementar versión ANTES de `npm run build`
   - Formato: `X.Y.Z-DESCRIPCION-CORTA`
   - Ejemplo: `5.2.3-FIX-REPORTES`

3. **VERIFICACIÓN POST-DEPLOY**: Después de desplegar, SIEMPRE verificar que la versión subió
   - Ejecutar: `ssh root@143.244.191.139 "curl -s http://localhost:3001/api/version"`
   - Confirmar que muestra la nueva versión ANTES de decir "listo"
   - Si no coincide, investigar y corregir

4. **NO PEDIR DISCULPAS**: Nunca escribir "perdón por no darlo", "disculpa", "lo siento"
   - Ser directo y profesional
   - Reconocer errores con "arreglado", "corregido", "actualizado"

5. **PROBAR ANTES DE ENTREGAR**: Verificar lógica antes de mostrar código al usuario
   - Para cambios de BD: ejecutar query de prueba primero
   - Para lógica compleja: revisar casos edge
   - Para cálculos: validar con datos reales

6. **DEPLOYMENT COMPLETO**: Verificar TODOS los pasos se completaron
   - ✓ Versión actualizada
   - ✓ Build exitoso
   - ✓ Archivos copiados (frontend Y backend si aplica)
   - ✓ PM2 reiniciado (si backend cambió)
   - ✓ Versión verificada en servidor

## ERRORES COMUNES Y PREVENCIÓN

### Errores de Deployment Recurrentes

**1. Olvidar actualizar versión en package.json Y src/version.ts**
- ❌ Error: Actualizar solo `src/version.ts` pero NO `package.json`
- ✅ Solución: SIEMPRE actualizar AMBOS archivos antes de `npm run build`:
  - `package.json` línea 4: `"version": "2026-XXX"`
  - `src/version.ts`: `export const APP_VERSION = "2026-XXX"`
- Verificación: `ssh root@143.244.191.139 'curl -s http://localhost:3001/api/version'`
- Verificación Web: `curl -s https://crmp.ss-group.cloud | grep 'CURRENT_VERSION'`

**2. Desplegar frontend a directorio incorrecto**
- ❌ Error: Desplegar a `/var/www/crmp/` cuando nginx sirve desde `/opt/crmp/dist/client/`
- ✅ Solución: SIEMPRE verificar nginx config antes de desplegar:
  - `ssh root@143.244.191.139 "grep 'root ' /etc/nginx/sites-available/crmp.ss-group.cloud"`
  - Resultado: `root /opt/crmp/dist/client;`
- ✅ Comando correcto: `scp -r dist\client\* root@143.244.191.139:/opt/crmp/dist/client/`
- ✅ Rutas correctas:
  - Frontend (nginx): `/opt/crmp/dist/client/`
  - Backend: `/opt/crmp/server-FINAL.js` y `/opt/crmp/src/backend/`
  - PM2 process: `crmp-api` (NOT crm-api)

**3. Olvidar reiniciar PM2**
- ❌ Error: Cambiar backend sin `pm2 restart crmp-api`
- ✅ Solución: SIEMPRE reiniciar después de cambios en backend
- Comando: `ssh root@143.244.191.139 "pm2 restart crmp-api"`

**4. No verificar que la versión subió**
- ❌ Error: Decir "listo" sin confirmar versión
- ✅ Solución: Ejecutar curl al endpoint `/api/version` y comparar

**5. Queries de BD sin probar**
- ❌ Error: Modificar query y desplegar sin probar
- ✅ Solución: Ejecutar query de prueba con `psql` primero
- Comando: `ssh root@143.244.191.139 "PGPASSWORD=CRM_Seguro_2025! psql -h localhost -U crm_user -d crm_pro -c 'SELECT ...'"`

**6. No desplegar todos los archivos necesarios**
- ❌ Error: Cambiar controller pero no desplegarlo
- ✅ Checklist para cada cambio:
  - Frontend modificado? → `scp dist/client/*`
  - Backend modificado? → `scp server-FINAL.js` y/o `scp src/backend/controllers/`
  - Base de datos? → Ejecutar SQL remoto

**7. Asumir que el código funcionó**
- ❌ Error: "Debería funcionar" sin verificar
- ✅ Solución: Probar endpoint/query ANTES de mostrar al usuario
- Para endpoints: `curl http://localhost:3001/api/...`
- Para queries: Ejecutar en `psql` con datos reales

**8. Cache de navegador**
- ❌ Error: Usuario no ve cambios por cache
- ✅ Solución: Vite tiene cache-busting con timestamps
- Recordar al usuario: Ctrl+Shift+R para refrescar

**9. Verificar solo versión sin probar funcionalidad**
- ❌ Error: Versión correcta pero código no funciona
- ✅ Solución: PROBAR la funcionalidad después de desplegar
- Verificar:
  - Para endpoints: Probar con datos reales desde el frontend
  - Para queries: Ejecutar query completa con `psql` verificando resultado
  - Para contadores: Verificar que los números mostrados son correctos
  - NO asumir que versión correcta = código funciona
  
**10. Rutas del servidor mal configuradas**
- ❌ Error: Backend no usa las rutas modulares de `src/backend/routes/`
- ✅ Solución: Verificar que `server-FINAL.js` importa y monta correctamente las rutas
- Check: `grep 'app.use.*Routes' /opt/crmp/server-FINAL.js`

**11. Endpoints duplicados LEGACY sobrescribiendo modulares**
- ❌ Error: `server-FINAL.js` tiene endpoint legacy (ej: `app.get('/api/clients')`) después de montar ruta modular
- ✅ Solución: 
  - Buscar: `grep -n 'app.get.*api/clients' /opt/crmp/server-FINAL.js`
  - Comentar TODOS los endpoints legacy duplicados
  - Dejar solo: `app.use('/api/clients', clientRoutes)` (línea ~70)
- Síntoma: Cambios en `clientController.js` no se reflejan en API
- Verificación: `ssh root@143.244.191.139 "grep -n 'app.get.*api/clients' /opt/crmp/server-FINAL.js"`

**12. Decir "listo" cuando versión subió pero funcionalidad NO**
- ❌ Error: Verificar solo versión del API sin probar que el cambio funciona
- ✅ Solución:
  - Después de desplegar, hacer query a BD verificando datos reales
  - Para stats/contadores: contar directamente con `psql`
  - Para endpoints: hacer request de prueba (con token si es privado)
  - NO asumir que deploy exitoso = código funciona
- Comando test: `ssh root@143.244.191.139 "PGPASSWORD=CRM_Seguro_2025! psql -h localhost -U crm_user -d crm_pro -c 'SELECT ...'"`

**13. Usar campo LEGACY en vez del campo correcto**
- ❌ Error: Usar `is_completed` (boolean legacy) en vez de `completed_date` (timestamp autoritativo)
- ✅ Solución:
  - Tabla `follow_up_prospects`: Usar `completed_date IS NOT NULL` para verificar si está completado
  - NO usar `is_completed` para lógica de filtros o contadores
  - Convertir checkbox UI a completed_date: `completed_date: data.is_completed ? new Date().toISOString() : null`
- Archivos afectados: `FollowUp.tsx` (líneas 153, 361, 372, 637, 658)
- Verificación: `grep -n 'is_completed' src/react-app/pages/FollowUp.tsx`

**14. Contadores globales cuando debería ser filtrado por contexto**
- ❌ Error: Mostrar "Activos (50)" cuando el usuario está viendo UN cliente específico
- ✅ Solución:
  - Si hay `client_id` en URL (`?client_id=XXX`), filtrar datos ANTES de contar
  - Crear variable intermedia `clientFilteredProspects` para contadores
  - Ejemplo: `clientFilteredProspects.filter(p => p.completed_date == null).length`
- Archivos afectados: `FollowUp.tsx` (navegación desde Clientes)
- Verificación: Abrir `/seguimiento?client_id=123` y verificar que contadores muestran solo datos de ese cliente

**15. Integridad de datos: Registros huérfanos sin foreign keys**
- ❌ Error: Tabla con foreign key nullable cuando lógicamente debería ser NOT NULL
- ✅ Solución:
  - Revisar schema: `follow_up_prospects.client_id` es nullable pero la mayoría de queries asumen que existe
  - Opción 1: Hacer `client_id NOT NULL` y limpiar huérfanos
  - Opción 2: Modificar TODAS las queries para manejar `client_id IS NULL` (usar LEFT JOIN)
  - Ejemplo encontrado: 5 de 6 completados tenían `client_id = NULL` causando contadores incorrectos
- Verificación: `SELECT COUNT(*) FROM follow_up_prospects WHERE client_id IS NULL;`
- Decisión tomada: Contadores de Clientes cuentan solo los que tienen `client_id`, Reportes muestra todos (LEFT JOIN)

**16. Asumir schema sin verificar columnas reales**
- ❌ Error: Usar nombres de columnas (`vendor_id`, `is_active`) que NO existen en tabla actual
- ✅ Solución:
  - SIEMPRE verificar schema con: `ssh root@IP "PGPASSWORD=X psql -h localhost -U user -d db -c '\d table_name'"`
  - NUNCA asumir nombres basándose en código viejo
  - Ejemplo v2026-93:
    - `clients.vendor_id` NO existe → usar `salesperson_id` (UUID)
    - `bans.is_active` NO existe → usar `status` ('A'/'C')
    - `clients.is_active` NO existe → campo fue eliminado en migración
- Síntoma: Error SQL "column XYZ does not exist"
- Verificación: Ejecutar `\d table_name` antes de escribir queries

**17. Arquitectura dual vendors/salespeople sin mapeo**
- ❌ Error: Mezclar `vendors` (INTEGER legacy) con `salespeople` (UUID nuevo) sin conversión
- ✅ Contexto del sistema:
  - **Sistema NUEVO**: `salespeople(id UUID)` ← `clients.salesperson_id`, `users_auth.salesperson_id`
  - **Sistema LEGACY**: `vendors(id INTEGER)` ← `follow_up_prospects.vendor_id`, `sales_reports.vendor_id`
- ⚠️ Problema: Frontend envía `salesperson_id` (UUID) pero tablas legacy esperan `vendor_id` (INTEGER)
- ✅ Solución temporal (v2026-93):
  - Importador usa `salesperson_id` para `clients` (OK)
  - NO crea `follow_up_prospects` (requiere mapeo vendors↔salespeople que no existe)
  - Documentar limitación en PENDIENTES
- 📋 TODO futuro:
  - Opción A: Migrar ALL `vendor_id` → `salesperson_id` UUID
  - Opción B: Crear tabla mapeo `vendor_salesperson_mapping`

### Checklist Pre-Deployment

Antes de cada deploy, verificar:
- [ ] Versión actualizada en `src/version.ts`
- [ ] Build exitoso (`npm run build`)
- [ ] Queries probadas en BD remota
- [ ] Archivos copiados a rutas correctas
- [ ] PM2 reiniciado (si backend cambió)
- [ ] Versión verificada con `curl`
- [ ] Confirmación al usuario solo después de verificar

## Project Overview

VentasPro is a **Spanish-language** CRM for sales teams with integrated customer management, follow-up tracking, goals, and CSV/XLSX import. Built with **React 19 + Vite** (frontend) and **Node/Express + PostgreSQL** (backend).

**Key business context:** System manages Claro Puerto Rico telecom offerings (PYMES/Corporate/Consumer) with AI-powered tariff extraction and offer generation.

## Architecture

### Core Data Model (PostgreSQL with UUIDs)
```
salespeople → users_auth (JWT auth)
           ↓
        clients → bans → subscribers (3-level hierarchy)
           ↓
  follow_up_prospects (tracking pipeline)
```

**Critical relationship:** BAN cannot exist without subscribers (enforced in UI + backend). Each subscriber tracks service expiration dates with badge warnings (Vencido +30, Vence en X días).

### Tech Stack
- **Frontend:** `src/react-app/` - React 19, TypeScript, Tailwind CSS, Vite
- **Backend:** `server-FINAL.js` (2132 lines, Express CommonJS) + modular structure in `src/backend/`
- **Database:** PostgreSQL 15+ (`crm_pro` database, schema in `elementos_extra/sqls/schema-final.sql`)
- **Auth:** JWT with refresh tokens (`authFetch` utility handles auto-refresh)
- **Build:** Vite with aggressive cache-busting (`timestamp` in filenames)

### Project Structure
```
src/
├── backend/          # Modular Express API (controllers, routes, middlewares)
├── react-app/        # React frontend (pages, components, hooks, utils)
├── shared/           # Shared types/utilities
└── worker/           # Cloudflare Workers (if applicable)

Root scripts (many legacy):
- agent-*.js          # Automated deployment helpers
- check-*.js          # Database validation scripts
- DEPLOY*.ps1         # PowerShell deployment scripts
- server-FINAL.js     # Main API entry point
```

## Development Workflows

### Build & Run
```powershell
npm run dev              # Vite dev server (port 5173)
npm run dev:backend      # Express API (port 3001)
npm run build            # Production build → dist/client/
```

### Deployment (Production)
**Primary:** `.\DEPLOY.ps1` (PowerShell)
1. `npm run build`
2. `scp` files to server (root@143.244.191.139)
3. Backend: `/opt/crmp/` (PM2 process: `crmp-api`)
4. Frontend: `/var/www/crmp/` (nginx static files)
5. nginx config: `nginx-crmp-no-cache.conf` (aggressive no-cache headers)

**Alternative:** `.\SUBIR-AL-SERVIDOR.ps1` (uses PuTTY's pscp/plink)

**Critical:** Frontend MUST have cache-busting enabled. Check [vite.config.ts](vite.config.ts) for timestamp-based filenames.

### Database Migrations
- **Schema:** `elementos_extra/sqls/schema-final.sql` (authoritative source)
- **Migrations:** `migrations/` folder (numbered: 1/, 3/, 4/, etc.)
- **Apply:** `psql -U crm_user -d crm_pro -f schema-final.sql`
- **Remote:** Use `RUN-MIGRATIONS.ps1` to apply via SSH

## Critical Patterns

### Authentication Flow
1. Login → `/api/login` returns `accessToken` (15min TTL) + `refreshToken` (7d TTL)
2. All API calls use `authFetch()` from [src/react-app/utils/auth.ts](src/react-app/utils/auth.ts)
3. On 401 → auto-refresh with `/api/token/refresh` → retry original request
4. Tokens stored in localStorage: `crm_token`, `crm_refresh_token`, `crm_user`

**Never use raw fetch()** - always use `authFetch()` for authenticated endpoints.

### Import System (CSV/XLSX)
Located: [src/backend/controllers/importController.js](src/backend/controllers/importController.js)

**Smart features:**
- Auto-detects columns via aliases (e.g., "Cliente", "Nombre Cliente" → `name`)
- Drag & drop UI (no dropdowns) - two required fields:
  - `Cliente · Nombre` (mandatory)
  - `BAN · Número` (if no client name)
- Handles `ON CONFLICT` automatically (`ban_number`, `phone`, `name`)
- Supports: `clients`, `bans`, `subscribers`, `products`
- Transaction-based: All-or-nothing with rollback on error

### Client → Follow-Up Flow
1. Client must have: `salesperson_id` assigned + at least 1 BAN with subscribers
2. "A Seguimiento" button creates `follow_up_prospects` record (is_active=true)
3. "Devolver" button marks prospect inactive, returns to client pool
4. "Completado" button sets `completed_date`, keeps prospect in tracking

**Validation:** Frontend prevents actions if requirements not met.

### Tariff System (Claro PR Offers)
Located: `src/backend/routes/tarifasRoutes.js`, Architecture doc: [ARQUITECTURA_AGENTES_CLARO.md](ARQUITECTURA_AGENTES_CLARO.md)

**AI-powered extraction:**
- PDF boletins → structured JSON offers
- Categories: INTERNET_FIJO, PLANES_POSTPAGO, EQUIPOS, CONVERGENCIA, etc.
- Client types: PYMES, CORPORATIVO, PERSONAS
- Convergence logic: Cliente with FIJO + MÓVIL gets special benefits

**Tables:** `tariffs_categories`, `tariffs_plans`, `tariffs_offers_log`

## Code Conventions

### Backend (server-FINAL.js)
- **Module system:** ES Modules (`import`/`export`), but uses `createRequire()` for package.json
- **Database:** Pool connection from `pg`, use parameterized queries (`$1, $2`)
- **Error handling:** Custom helpers in `src/backend/middlewares/errorHandler.js`
- **Auth middleware:** JWT verification, checks PUBLIC_ROUTES Set
- **Routes:** Modular in `src/backend/routes/` (referidosRoutes, tarifasRoutes, clientRoutes, banRoutes)

### Frontend (React)
- **Routing:** react-router v7 (`useNavigate`, not older useHistory)
- **State:** useState/useEffect (no Redux)
- **API calls:** Custom `useApi()` hook + `authFetch()`
- **Icons:** lucide-react
- **Styling:** Tailwind utility classes, `clsx` + `tailwind-merge` for conditionals
- **Exports:** XLSX library for data export

### Naming
- **Spanish variable names** in business logic (e.g., `vendedor`, `suscriptor`, `prospectos`)
- **English for technical** (e.g., `authFetch`, `useApi`)
- **Files:** kebab-case for scripts, PascalCase for React components

## Common Tasks

### Adding a new API endpoint
1. Create controller in `src/backend/controllers/`
2. Create route in `src/backend/routes/`
3. Import route in `server-FINAL.js` and mount with `app.use()`
4. If public route, add to `PUBLIC_ROUTES` Set

### Adding a new page
1. Create in `src/react-app/pages/YourPage.tsx`
2. Add route in `src/react-app/App.tsx`
3. Use `authFetch()` for API calls
4. Follow existing modal patterns (see ClientModal, BANModal, SubscriberModal)

### Database changes
1. Update `elementos_extra/sqls/schema-final.sql` (authoritative)
2. Create migration in `migrations/N/up.sql` and `down.sql`
3. Test locally: `psql -U crm_user -d crm_pro -f migrations/N/up.sql`
4. Deploy: Update schema-final.sql on server, restart API

### Debugging deployment issues
1. Check version: `GET /api/version` (returns package.json version + timestamp)
2. Check health: `GET /api/health/full` (runs [src/backend/controllers/healthController.js](src/backend/controllers/healthController.js))
3. PM2 logs: `ssh root@143.244.191.139 "pm2 logs crmp-api"`
4. nginx logs: `/var/log/nginx/error.log`
5. Frontend cache: Verify timestamp hash in built filenames (`dist/client/assets/`)

## Environment Variables

Required in `.env` (never commit):
```bash
# Database
DB_HOST=localhost
DB_USER=crm_user
DB_PASSWORD=***
DB_NAME=crm_pro
DB_PORT=5432

# JWT
JWT_SECRET=***
JWT_REFRESH_SECRET=***
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend API URL
VITE_API_BASE_URL=http://localhost:3001  # or production domain
```

## Testing & Validation

**No formal test suite**, but extensive manual validation scripts:
- `check-*.js` files validate DB integrity
- `VERIFICAR-*.js` files check data consistency
- Use `DIAGNOSTICO-COMPLETO.ps1` for full system check

## Known Quirks

1. **Cache battles:** Frontend uses timestamp-based filenames + nginx no-cache headers. If changes don't appear, check [vite.config.ts](vite.config.ts) build config.

2. **Module mixing:** `server-FINAL.js` is ES Module but needs CommonJS for package.json (uses `createRequire()`).

3. **BAN validation:** Frontend prevents BAN deletion if last subscriber, but backend double-checks. Always trust backend validation.

4. **Spanish content:** Business logic and UI text are in Spanish. Database columns have English names.

5. **PowerShell deployment:** Scripts use Windows PowerShell 7. Linux users: adapt to bash or use Node.js deployment scripts (auto-deploy*.js).

6. **Many legacy files:** Root folder has 100+ utility scripts (agent-*.js, check-*.js, etc.). Most are one-off helpers - focus on core files listed above.

## AI Agent Best Practices

- **Read schema first:** Check [elementos_extra/sqls/schema-final.sql](elementos_extra/sqls/schema-final.sql) before modifying DB logic
- **Use authFetch:** Never raw fetch() for authenticated endpoints
- **Respect hierarchy:** clients → bans → subscribers (foreign keys enforce this)
- **Spanish context:** Business logic speaks Spanish, translate when necessary
- **Check deployments:** Run `.\DEPLOY.ps1` after changes, verify with `/api/version`
- **Migrations matter:** Update schema-final.sql AND create migration files
- **Test imports:** Use `/importar` page with sample CSV before modifying importController.js
